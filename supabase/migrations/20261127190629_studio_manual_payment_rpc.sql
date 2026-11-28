create function public.studio_record_manual_payment(p_booking_id uuid,p_reference text,p_amount_kobo bigint) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
if not exists(select 1 from public.studio_admin_memberships where user_id=auth.uid()) then raise exception 'Administrator required'; end if;
if p_amount_kobo is null or p_amount_kobo <= 0 or p_reference is null or length(btrim(p_reference)) not between 1 and 120 then raise exception 'Invalid payment'; end if;
insert into public.studio_payments(booking_id,provider,provider_reference,amount_kobo,status,verified_at,recorded_by) values(p_booking_id,'manual',btrim(p_reference),p_amount_kobo,'verified',now(),auth.uid()) returning id into v_id;
return v_id;
end; $$;
revoke all on function public.studio_record_manual_payment(uuid,text,bigint) from public,anon;
grant execute on function public.studio_record_manual_payment(uuid,text,bigint) to authenticated;
grant insert on public.studio_payments to authenticated;
create policy studio_admin_insert_manual_payment on public.studio_payments for insert to authenticated with check (provider='manual' and status='verified' and recorded_by=(select auth.uid()) and verified_at is not null and exists(select 1 from public.studio_admin_memberships where user_id=(select auth.uid())));
