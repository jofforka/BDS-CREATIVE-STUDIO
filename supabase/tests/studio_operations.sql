begin;
insert into auth.users(id, email, raw_user_meta_data)
values ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'studio-test@example.test', '{}'),
       ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'studio-customer@example.test', '{}');
insert into public.studio_admin_memberships(user_id) values ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
insert into public.studio_services(id,name,active,booking_mode)
values ('cccccccc-cccc-4ccc-cccc-cccccccccccc','Photography — Test package',true,'quote');
insert into public.studio_resources(id,name,kind)
values ('dddddddd-dddd-4ddd-dddd-dddddddddddd','Test room','room');

set local role anon;
do $$
declare
  first_id uuid := '11111111-1111-4111-8111-111111111111';
  second_id uuid := '22222222-2222-4222-8222-222222222222';
begin
  if public.studio_save_enquiry(first_id,'Test','+2340000000000',null,'Photography','Test',current_date+1,'10:00','1 hour','Test request') <> first_id then
    raise exception 'Enquiry not saved';
  end if;
  perform public.studio_save_enquiry(first_id,'Test','+2340000000000',null,'Photography','Test',current_date+1,'10:00','1 hour','Test request');
  perform public.studio_save_enquiry(second_id,'Test','+2340000000000',null,'Photography','Test',current_date+1,'10:00','1 hour','Second request');
  for attempt in 1..3 loop
    perform public.studio_save_enquiry(gen_random_uuid(),'Test','+2340000000000',null,'Photography','Test',current_date+1,'10:00','1 hour','Test request');
  end loop;
  begin
    perform public.studio_save_enquiry(gen_random_uuid(),'Test','+2340000000000',null,'Photography','Test',current_date+1,'10:00','1 hour','Test request');
    raise exception 'Rate limit missing';
  exception when sqlstate 'PT429' then null;
  end;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',true);
do $$
begin
  if exists(select 1 from public.studio_enquiries) then raise exception 'Guest PII visible to customer'; end if;
  begin
    perform public.studio_cancel_appointment(gen_random_uuid());
    raise exception 'Customer can invoke admin operation';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',true);
do $$
declare
  service_id uuid := 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
  resources uuid[] := array['dddddddd-dddd-4ddd-dddd-dddddddddddd'::uuid];
  first_id uuid := '11111111-1111-4111-8111-111111111111';
  second_id uuid := '22222222-2222-4222-8222-222222222222';
  start_at timestamptz := now() + interval '1 day';
  end_at timestamptz := start_at + interval '1 hour';
  booking_id uuid;
  second_booking uuid;
  payment_id uuid;
begin
  booking_id := public.studio_save_appointment(first_id,null,service_id,start_at,end_at,resources,5000,2000);
  if public.studio_save_appointment(first_id,null,service_id,start_at,end_at,resources,5000,2000) <> booking_id then
    raise exception 'Repeat approval changed booking';
  end if;
  begin
    perform public.studio_save_appointment(second_id,null,service_id,start_at,end_at,resources,5000,2000);
    raise exception 'Overlapping allocation accepted';
  exception when exclusion_violation then null;
  end;
  second_booking := public.studio_save_appointment(second_id,null,service_id,end_at,end_at + interval '1 hour',resources,5000,2000);
  begin
    perform public.studio_save_appointment(null,second_booking,null,start_at,end_at,resources,null,null);
    raise exception 'Conflicting reschedule accepted';
  exception when exclusion_violation then null;
  end;
  if not exists(select 1 from public.studio_booking_resources where studio_booking_resources.booking_id=second_booking and lower(occupied_range)=end_at) then
    raise exception 'Failed reschedule lost original allocation';
  end if;
  if not exists(select 1 from public.studio_bookings where id=booking_id and status='held') then
    raise exception 'Booking confirmed before receiving deposit';
  end if;
  payment_id := public.studio_record_manual_payment(booking_id,' Receipt-A ',2000);
  if public.studio_record_manual_payment(booking_id,'receipt-a',2000) <> payment_id then raise exception 'Payment duplicated'; end if;
  if not exists(select 1 from public.studio_bookings where id=booking_id and status='confirmed') then
    raise exception 'Deposit did not confirm booking';
  end if;
  if not exists (select 1 from public.studio_appointment_balances where id=booking_id and balance_kobo=3000 and deposit_remaining_kobo=0) then
    raise exception 'Deposit or balance is incorrect';
  end if;
  begin
    perform public.studio_record_manual_payment(second_booking,'receipt-a',2000);
    raise exception 'Accepted the same payment for another appointment';
  exception when unique_violation then null;
  end;
  perform public.studio_cancel_appointment(booking_id);
  perform public.studio_save_appointment(null,second_booking,null,start_at,end_at,resources,null,null);
  if not exists(select 1 from public.studio_finance_entries where id=payment_id and amount_kobo=2000) then
    raise exception 'Verified payment missing from finance';
  end if;
  if (select count(*) from public.studio_operations_audit) <> 6 then raise exception 'Unexpected audit count'; end if;
end;
$$;
rollback;
