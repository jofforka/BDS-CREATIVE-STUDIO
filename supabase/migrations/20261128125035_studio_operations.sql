-- Extends the deployed guest enquiry and manual-payment foundations.
alter table public.studio_bookings add column enquiry_id uuid unique references public.studio_enquiries(id);

create table public.studio_operations_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null default auth.uid(),
  action text not null,
  record_id uuid not null,
  occurred_at timestamptz not null default now()
);
alter table public.studio_operations_audit enable row level security;
revoke all on public.studio_operations_audit from anon, authenticated;
grant select on public.studio_operations_audit to authenticated;
create policy studio_admin_audit on public.studio_operations_audit for select to authenticated
using (exists (select 1 from public.studio_admin_memberships where user_id = (select auth.uid())));

create table public.studio_branches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 120),
  active boolean not null default true
);
alter table public.studio_resources add column branch_id uuid references public.studio_branches(id);
create table public.studio_staff_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schedule boolean not null default false,
  payments boolean not null default false,
  finance boolean not null default false
);
alter table public.studio_branches enable row level security;
alter table public.studio_staff_access enable row level security;
revoke all on public.studio_branches, public.studio_staff_access from anon, authenticated;
grant select, insert, update on public.studio_branches, public.studio_staff_access to authenticated;
grant insert(branch_id), update(branch_id) on public.studio_resources to authenticated;

create policy studio_branch_admin on public.studio_branches for all to authenticated
using (exists (select 1 from public.studio_admin_memberships where user_id = (select auth.uid())))
with check (exists (select 1 from public.studio_admin_memberships where user_id = (select auth.uid())));
create policy studio_staff_admin on public.studio_staff_access for all to authenticated
using (exists (select 1 from public.studio_admin_memberships where user_id = (select auth.uid())))
with check (exists (select 1 from public.studio_admin_memberships where user_id = (select auth.uid())));
create policy studio_staff_own_permissions on public.studio_staff_access for select to authenticated
using (user_id = (select auth.uid()));

create function public.studio_workspace_permission(p_permission text)
returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from public.studio_admin_memberships where user_id = (select auth.uid()))
    or exists (
      select 1 from public.studio_staff_access where user_id = (select auth.uid())
        and case p_permission when 'schedule' then schedule when 'payments' then payments
              when 'finance' then finance else false end
    );
$$;
revoke all on function public.studio_workspace_permission(text) from public, anon, authenticated;
grant execute on function public.studio_workspace_permission(text) to authenticated;

create or replace function public.studio_save_appointment(
  p_enquiry_id uuid, p_booking_id uuid, p_service_id uuid,
  p_start timestamptz, p_end timestamptz, p_resources uuid[],
  p_total bigint, p_deposit bigint, p_customer_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  enquiry public.studio_enquiries%rowtype;
  booking public.studio_bookings%rowtype;
  linked_id uuid;
  resource_count integer;
  next_status text;
begin
  if auth.uid() is null or not public.studio_workspace_permission('schedule') then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  if (p_enquiry_id is null) = (p_booking_id is null) then
    raise exception 'Select an enquiry or appointment';
  end if;

  if p_enquiry_id is not null then
    select * into strict enquiry from public.studio_enquiries where id = p_enquiry_id for update;
    select id into linked_id from public.studio_bookings where enquiry_id = p_enquiry_id;
    if found then return linked_id; end if;
  else
    select * into strict booking from public.studio_bookings where id = p_booking_id for update;
    if booking.status not in ('confirmed', 'held') or (booking.status = 'held' and booking.hold_expires_at <= now()) then
      raise exception 'Only active appointments can be rescheduled';
    end if;
  end if;

  if p_start is null or p_end is null or p_start <= now() or p_end <= p_start
     or p_end - p_start > interval '7 days' or p_resources is null
     or cardinality(p_resources) not between 1 and 50 then
    raise exception 'Enter a future appointment and select at least one resource';
  end if;

  -- Acquire resource locks in a stable order before touching the allocations.
  perform id from public.studio_resources where id = any(p_resources) and active and (branch_id is null or exists (
    select 1 from public.studio_branches branch where branch.id = branch_id and branch.active
  )) order by id for share;
  get diagnostics resource_count = row_count;
  if resource_count <> cardinality(p_resources) then raise exception 'Select distinct active resources'; end if;

  if p_enquiry_id is not null then
    perform id from public.studio_services
      where id = p_service_id and active and split_part(name, ' — ', 1) = enquiry.service for share;
    if not found then raise exception 'Choose an active package for this service'; end if;
    if p_total is null or p_deposit is null or p_total < 0 or p_deposit < 0 or p_deposit > p_total then
      raise exception 'Enter the agreed total and deposit';
    end if;
    if p_customer_id is not null and not exists (
      select 1 from auth.users customer where customer.id = p_customer_id
        and customer.email_confirmed_at is not null
        and lower(btrim(customer.email)) = lower(btrim(enquiry.email))
    ) then raise exception 'Customer account must have the verified enquiry email'; end if;
    next_status := case when p_deposit = 0 then 'confirmed' else 'held' end;
    insert into public.studio_bookings(
      enquiry_id, service_id, customer_id, guest_name, guest_contact, starts_at, ends_at, status, hold_expires_at, total_kobo, deposit_due_kobo
    ) values (
      p_enquiry_id, p_service_id, p_customer_id, enquiry.guest_name, enquiry.contact, p_start, p_end, next_status, case when next_status = 'held' then p_start end, p_total, p_deposit
    ) returning id into linked_id;
  else
    linked_id := p_booking_id;
    next_status := booking.status;
    update public.studio_bookings set starts_at = p_start, ends_at = p_end,
      hold_expires_at = case when next_status = 'held' then p_start end where id = linked_id;
    delete from public.studio_booking_resources where booking_id = linked_id;
  end if;

  insert into public.studio_booking_resources(booking_id, resource_id, occupied_range, status)
  select linked_id, resource_id, tstzrange(p_start, p_end, '[)'), next_status
    from unnest(p_resources) as resource_id order by resource_id;

  insert into public.studio_operations_audit(action, record_id)
  values (case when p_enquiry_id is null then 'appointment.rescheduled' else 'appointment.approved' end, linked_id);
  return linked_id;
exception when exclusion_violation then
  raise exception 'One or more resources are already booked at that time' using errcode = '23P01';
end;
$$;

create or replace function public.studio_cancel_appointment(p_booking_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_status text;
begin
  if auth.uid() is null or not public.studio_workspace_permission('schedule') then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  select status into strict current_status from public.studio_bookings where id = p_booking_id for update;
  if current_status = 'cancelled' then return p_booking_id; end if;
  if current_status not in ('confirmed', 'held') then raise exception 'Appointment cannot be cancelled'; end if;
  update public.studio_bookings set status = 'cancelled' where id = p_booking_id;
  update public.studio_booking_resources set status = 'cancelled' where booking_id = p_booking_id;
  insert into public.studio_operations_audit(action, record_id) values ('appointment.cancelled', p_booking_id);
  return p_booking_id;
end;
$$;

create unique index studio_manual_payment_normalized_reference
on public.studio_payments (lower(btrim(provider_reference))) where provider = 'manual';

drop policy studio_admin_insert_manual_payment on public.studio_payments;
revoke insert on public.studio_payments from anon, authenticated;
create or replace function public.studio_record_manual_payment(p_booking_id uuid, p_reference text, p_amount_kobo bigint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  payment public.studio_payments%rowtype;
  booking public.studio_bookings%rowtype;
  paid numeric;
  payment_id uuid;
  normalized_reference text := lower(btrim(p_reference));
begin
  if auth.uid() is null or not public.studio_workspace_permission('payments') then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  if p_amount_kobo is null or p_amount_kobo <= 0 or normalized_reference is null
     or length(normalized_reference) not between 1 and 120 then raise exception 'Invalid payment'; end if;
  select * into strict booking from public.studio_bookings where id = p_booking_id for update;
  select * into payment from public.studio_payments
    where provider = 'manual' and lower(btrim(provider_reference)) = normalized_reference;
  if found then
    if payment.booking_id = p_booking_id and payment.amount_kobo = p_amount_kobo
       and payment.status = 'verified' then return payment.id; end if;
    raise exception 'This payment reference is already on file' using errcode = '23505';
  end if;
  if booking.status not in ('held', 'confirmed', 'completed')
     or (booking.status = 'held' and booking.hold_expires_at <= now()) then raise exception 'Appointment is closed'; end if;
  select coalesce(sum(amount_kobo), 0) into paid from public.studio_payments
    where booking_id = p_booking_id and status = 'verified';
  if paid + p_amount_kobo > booking.total_kobo then raise exception 'Payment exceeds the outstanding balance'; end if;
  insert into public.studio_payments(booking_id, provider, provider_reference, amount_kobo, status, verified_at, recorded_by)
  values (p_booking_id, 'manual', btrim(p_reference), p_amount_kobo, 'verified', now(), auth.uid())
  returning id into payment_id;
  insert into public.studio_operations_audit(action, record_id) values ('payment.verified', payment_id);
  if booking.status = 'held' and paid + p_amount_kobo >= booking.deposit_due_kobo then
    update public.studio_bookings set status = 'confirmed', hold_expires_at = null where id = booking.id;
    update public.studio_booking_resources set status = 'confirmed' where booking_id = booking.id;
    insert into public.studio_operations_audit(action, record_id) values ('appointment.deposit_confirmed', booking.id);
  end if;
  return payment_id;
end;
$$;

revoke all on function public.studio_save_appointment(uuid,uuid,uuid,timestamptz,timestamptz,uuid[],bigint,bigint,uuid),
  public.studio_cancel_appointment(uuid), public.studio_record_manual_payment(uuid,text,bigint)
  from public, anon, authenticated;
grant execute on function public.studio_save_appointment(uuid,uuid,uuid,timestamptz,timestamptz,uuid[],bigint,bigint,uuid),
  public.studio_cancel_appointment(uuid), public.studio_record_manual_payment(uuid,text,bigint) to authenticated;

alter table public.studio_media drop constraint studio_media_object_path_check;
alter table public.studio_media add constraint studio_media_object_path_check
  check (object_path ~ '^[0-9a-f-]{36}[.](jpg|png|webp|mp4)$');

create table public.studio_expenses (
  id uuid primary key,
  description text not null check (length(btrim(description)) between 1 and 200),
  amount_kobo bigint not null check (amount_kobo between 1 and 10000000000),
  incurred_on date not null check (isfinite(incurred_on)),
  recorded_by uuid not null default auth.uid()
);
alter table public.studio_expenses enable row level security;
revoke all on public.studio_expenses from anon, authenticated;
grant select on public.studio_expenses to authenticated;
create policy studio_expense_admin on public.studio_expenses for select to authenticated
using (exists (select 1 from public.studio_admin_memberships where user_id = (select auth.uid())));

create function public.studio_record_expense(p_id uuid, p_description text, p_amount bigint, p_date date)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.studio_workspace_permission('finance') then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  insert into public.studio_expenses(id, description, amount_kobo, incurred_on)
  values(p_id, btrim(p_description), p_amount, p_date) on conflict(id) do nothing;
  if found then
    insert into public.studio_operations_audit(action, record_id) values ('expense.recorded', p_id);
  elsif not exists (
    select 1 from public.studio_expenses where id = p_id and recorded_by = auth.uid()
      and description = btrim(p_description) and amount_kobo = p_amount and incurred_on = p_date
  ) then raise exception 'Expense reference already used';
  end if;
  return p_id;
end;
$$;
revoke all on function public.studio_record_expense(uuid,text,bigint,date) from public, anon, authenticated;
grant execute on function public.studio_record_expense(uuid,text,bigint,date) to authenticated;

create view public.studio_finance_entries with (security_invoker = true) as
  select id, (verified_at at time zone 'Africa/Lagos')::date as entry_date,
    'revenue'::text as entry_type, provider_reference as reference, amount_kobo
  from public.studio_payments where status = 'verified' and verified_at is not null
  and (select public.studio_workspace_permission('finance'))
  union all
  select id, incurred_on, 'expense', description, amount_kobo from public.studio_expenses;
revoke all on public.studio_finance_entries from anon, authenticated;
grant select on public.studio_finance_entries to authenticated;

create index studio_enquiries_contact_recent
on public.studio_enquiries ((regexp_replace(contact, '[^0-9]', '', 'g')), created_at);

-- Keep the previous Pages checkout compatible during deployment.
create function public.studio_limit_enquiry_contact()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  phone text := regexp_replace(new.contact, '[^0-9]', '', 'g');
begin
  if phone is null or length(phone) not between 7 and 15 then raise exception 'Invalid contact number'; end if;
  perform pg_advisory_xact_lock(hashtextextended('bds-contact:' || phone, 0));
  if (select count(*) from public.studio_enquiries e
      where regexp_replace(e.contact, '[^0-9]', '', 'g') = phone
      and e.created_at > now() - interval '1 hour') >= 5 then
    raise sqlstate 'PT429' using message = 'Request limit reached. Please try again later.';
  end if;
  return new;
end;
$$;
revoke all on function public.studio_limit_enquiry_contact() from public, anon, authenticated;
create trigger studio_limit_enquiry_contact before insert on public.studio_enquiries
for each row execute function public.studio_limit_enquiry_contact();

create function public.studio_save_enquiry(
  id uuid, guest_name text, contact text, email text, service text, package_label text,
  preferred_date date, preferred_time time, duration_label text, details text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  phone text := regexp_replace(studio_save_enquiry.contact, '[^0-9]', '', 'g');
  existing public.studio_enquiries%rowtype;
begin
  if id is null or phone is null or length(phone) not between 7 and 15
     or (email is not null and email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then
    raise exception 'Enter a valid contact number and email';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('bds-enquiry:' || id::text, 0));
  select * into existing from public.studio_enquiries e where e.id = studio_save_enquiry.id;
  if found then
    if (existing.guest_name, existing.contact, existing.email, existing.service, existing.package_label,
        existing.preferred_date, existing.preferred_time, existing.duration_label, existing.details)
       is not distinct from (guest_name, contact, email, service, package_label,
        preferred_date, preferred_time, duration_label, details) then return id; end if;
    raise exception 'Enquiry reference already used';
  end if;
  if preferred_date is null or preferred_date not between
      (now() at time zone 'Africa/Lagos')::date and (now() at time zone 'Africa/Lagos')::date + 730 then
    raise exception 'Invalid preferred date';
  end if;
  insert into public.studio_enquiries(id, guest_name, contact, email, service, package_label,
                                    preferred_date, preferred_time, duration_label, details)
  values(id, guest_name, contact, email, service, package_label, preferred_date, preferred_time, duration_label, details);
  return id;
end;
$$;
revoke all on function public.studio_save_enquiry(uuid,text,text,text,text,text,date,time,text,text) from public, anon, authenticated;
grant execute on function public.studio_save_enquiry(uuid,text,text,text,text,text,date,time,text,text) to anon, authenticated;

create view public.studio_appointment_balances with (security_invoker = true) as
select booking.id, coalesce(sum(payment.amount_kobo), 0) as paid_kobo,
  greatest(booking.deposit_due_kobo - coalesce(sum(payment.amount_kobo), 0), 0) as deposit_remaining_kobo,
  greatest(booking.total_kobo - coalesce(sum(payment.amount_kobo), 0), 0) as balance_kobo
from public.studio_bookings booking
left join public.studio_payments payment on payment.booking_id = booking.id and payment.status = 'verified'
group by booking.id;
revoke all on public.studio_appointment_balances from anon, authenticated;
grant select on public.studio_appointment_balances to authenticated;

alter table public.studio_media add column deleting boolean not null default false;
alter table public.studio_media add constraint studio_media_deleting_not_public check (not (deleting and published));

-- Metadata must enter a non-publishable state before the Storage API can remove bytes.
drop policy bds_media_admin_delete_draft on storage.objects;
create policy bds_media_admin_delete_draft on storage.objects for delete to authenticated using (
  bucket_id = 'bds-media'
  and exists (select 1 from public.studio_admin_memberships where user_id = (select auth.uid()))
  and (
    exists (select 1 from public.studio_media where object_path = objects.name and deleting)
    or (created_at < now() - interval '24 hours'
      and not exists (select 1 from public.studio_media where object_path = objects.name))
  )
);

create function public.studio_media_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if not old.deleting or exists (
      select 1 from storage.objects where bucket_id = 'bds-media' and name = old.object_path
    ) then raise exception 'Remove draft storage before deleting its record'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and (new.object_path <> old.object_path or (old.deleting and not new.deleting)) then
    raise exception 'Media path and pending deletion cannot be changed';
  end if;
  if new.published or tg_op = 'INSERT' then
    if not exists (
      select 1 from storage.objects where bucket_id = 'bds-media' and name = new.object_path
        and (tg_op <> 'INSERT' or created_at >= now() - interval '23 hours')
    ) then raise exception 'Media file is missing'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.studio_media_guard() from public, anon, authenticated;
create trigger studio_media_guard before insert or update or delete on public.studio_media
for each row execute function public.studio_media_guard();

create function public.studio_media_orphans()
returns table (object_path text)
language sql stable set search_path = '' as $$
  select object.name
  from storage.objects object
  where object.bucket_id = 'bds-media'
    and object.created_at < now() - interval '24 hours'
    and not exists (select 1 from public.studio_media media where media.object_path = object.name)
    and exists (select 1 from public.studio_admin_memberships where user_id = (select auth.uid()))
  order by object.created_at, object.name
  limit 50;
$$;
revoke all on function public.studio_media_orphans() from public, anon, authenticated;
grant execute on function public.studio_media_orphans() to authenticated;

create policy studio_staff_bookings on public.studio_bookings for select to authenticated
using ((select public.studio_workspace_permission('schedule')) or (select public.studio_workspace_permission('payments')));
create policy studio_staff_enquiries on public.studio_enquiries for select to authenticated
using ((select public.studio_workspace_permission('schedule')));
create policy studio_staff_resources on public.studio_resources for select to authenticated
using ((select public.studio_workspace_permission('schedule')));
create policy studio_staff_allocations on public.studio_booking_resources for select to authenticated
using ((select public.studio_workspace_permission('schedule')));
create policy studio_staff_payments on public.studio_payments for select to authenticated
using ((select public.studio_workspace_permission('payments')) or (select public.studio_workspace_permission('finance')));
create policy studio_staff_expenses on public.studio_expenses for select to authenticated
using ((select public.studio_workspace_permission('finance')));

create function public.studio_audit_management()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    insert into public.studio_operations_audit(action, record_id)
    values (tg_table_name || '.' || lower(tg_op),
      coalesce(to_jsonb(new)->>'user_id', to_jsonb(new)->>'id')::uuid);
  end if;
  return new;
end;
$$;
revoke all on function public.studio_audit_management() from public, anon, authenticated;
create trigger studio_branch_audit after insert or update on public.studio_branches
for each row execute function public.studio_audit_management();
create trigger studio_staff_audit after insert or update on public.studio_staff_access
for each row execute function public.studio_audit_management();
create trigger studio_resource_audit after insert or update on public.studio_resources
for each row execute function public.studio_audit_management();

-- Allow video delivery only when the same caller can read its linked lesson.
-- Existing foundation content remains available to signed-in students during
-- the frontend cutover. Other courses require enrollment; videos always do.

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('bds-learning','bds-learning',false,52428800,array['video/mp4']);

create policy bds_learning_student_read on storage.objects for select to authenticated using (
  bucket_id = 'bds-learning' and exists (
    select 1 from public.academy_lessons lesson
    join public.academy_modules module on module.id = lesson.module_id
    join public.academy_enrollments enrollment on enrollment.course_id = module.course_id
    join public.academy_courses course on course.id = module.course_id
    where lesson.video_asset_id = objects.name and course.status = 'published'
      and enrollment.student_id = (select auth.uid())
  )
);
create policy bds_learning_admin_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'bds-learning' and (select public.studio_workspace_permission('owner'))
);
create policy bds_learning_admin_read on storage.objects for select to authenticated using (
  bucket_id = 'bds-learning' and (select public.studio_workspace_permission('owner'))
);

create function public.academy_save_course_draft(p_slug text, p_title text, p_category text, p_summary text, p_modules text[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  course_id uuid;
begin
  if auth.uid() is null or not academy_private.academy_is_admin() then
    raise exception 'Academy administrator required' using errcode = '42501';
  end if;
  if length(p_slug) not between 3 and 120 or length(p_title) not between 3 and 180
    or length(p_category) not between 1 and 120 or length(p_summary) not between 1 and 5000
    or cardinality(p_modules) not between 1 and 30
    or exists (select 1 from unnest(p_modules) title where title is null or length(title) not between 1 and 180) then
    raise exception 'Invalid course outline';
  end if;
  insert into public.academy_courses(slug,title,summary,category,instructor_id,status)
  values(p_slug,p_title,p_summary,p_category,auth.uid(),'draft') returning id into course_id;
  insert into public.academy_modules(course_id,title,position)
  select course_id,title,position - 1 from unnest(p_modules) with ordinality as module(title,position);
  return course_id;
end;
$$;
revoke all on function public.academy_save_course_draft(text,text,text,text,text[]) from public, anon, authenticated;
grant execute on function public.academy_save_course_draft(text,text,text,text,text[]) to authenticated;

create function public.academy_grade_quiz(p_assessment uuid, p_attempt uuid, p_choices jsonb)
returns public.academy_assessment_attempts language plpgsql security definer set search_path = '' as $$
declare
  quiz public.academy_assessments%rowtype;
  result public.academy_assessment_attempts%rowtype;
  previous_attempts integer;
  question_count integer;
  answered integer;
  correct integer;
  score numeric(5,2);
begin
  select a.* into strict quiz from public.academy_assessments a
  join public.academy_courses course on course.id = a.course_id
  where a.id = p_assessment and a.published and a.kind = 'quiz' and course.status = 'published';
  if auth.uid() is null or not academy_private.academy_is_enrolled(quiz.course_id) then
    raise exception 'Enrollment required' using errcode = '42501';
  end if;
  if p_attempt is null or p_choices is null or jsonb_typeof(p_choices) <> 'object' or octet_length(p_choices::text) > 30000 then
    raise exception 'Invalid quiz submission';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('bds-quiz:' || p_assessment::text || ':' || auth.uid()::text, 0));
  select * into result from public.academy_assessment_attempts where id = p_attempt;
  if found then
    if result.student_id = auth.uid() and result.assessment_id = p_assessment then return result; end if;
    raise exception 'Attempt reference already used';
  end if;
  select count(*) into previous_attempts from public.academy_assessment_attempts
    where assessment_id = p_assessment and student_id = auth.uid();
  if quiz.max_attempts is not null and previous_attempts >= quiz.max_attempts then raise exception 'Attempt limit reached'; end if;
  select count(*), count(*) filter (where selected.value is not null and answer.question_id is not null),
    count(*) filter (where to_jsonb(answer.correct_option) = selected.value)
  into question_count, answered, correct
  from public.academy_assessment_questions question
  left join public.academy_assessment_answers answer on answer.question_id = question.id
  left join lateral (
    select value from jsonb_each(p_choices) where key = question.id::text
      and value in (select to_jsonb(i) from generate_series(0, jsonb_array_length(question.options) - 1) i)
  ) selected on true
  where question.assessment_id = p_assessment;
  if question_count = 0 or answered <> question_count or (select count(*) from jsonb_each(p_choices)) <> question_count then
    raise exception 'Answer every quiz question';
  end if;
  score := round(100.0 * correct / question_count, 2);
  insert into public.academy_assessment_attempts(id,assessment_id,student_id,attempt_number,score_percent,passed)
  values(p_attempt,p_assessment,auth.uid(),previous_attempts + 1,score,score >= quiz.passing_percent)
  returning * into result;
  return result;
end;
$$;

create function public.academy_submit_assignment(p_assessment uuid, p_text text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  submission_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.academy_assessments a join public.academy_courses c on c.id = a.course_id
    where a.id = p_assessment and a.kind = 'assignment' and a.published and c.status = 'published'
      and academy_private.academy_is_enrolled(a.course_id)
  ) then raise exception 'Enrollment and published assignment required' using errcode = '42501'; end if;
  if p_text is null or length(btrim(p_text)) not between 1 and 20000 then raise exception 'Enter your assignment'; end if;
  insert into public.academy_assignment_submissions(assessment_id,student_id,submission_text)
  values(p_assessment,auth.uid(),btrim(p_text))
  on conflict(assessment_id,student_id) do update set submission_text = excluded.submission_text,
    status = 'submitted', submitted_at = now()
    where academy_assignment_submissions.status in ('submitted','returned')
  returning id into submission_id;
  if submission_id is null then raise exception 'This assignment has already been graded'; end if;
  return submission_id;
end;
$$;

create function public.academy_review_assignment(p_submission uuid, p_grade numeric, p_feedback text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  course_id uuid;
begin
  select a.course_id into course_id from public.academy_assignment_submissions s
  join public.academy_assessments a on a.id = s.assessment_id where s.id = p_submission for update of s;
  if course_id is null or auth.uid() is null or not (
    academy_private.academy_is_admin() or academy_private.academy_teaches(course_id)
  ) then raise exception 'Instructor access required' using errcode = '42501'; end if;
  if p_grade is null or p_grade not between 0 and 100 or p_feedback is null or length(p_feedback) > 10000
  then raise exception 'Invalid grade or feedback'; end if;
  insert into public.academy_assignment_reviews(submission_id,reviewer_id,grade_percent,feedback)
  values(p_submission,auth.uid(),p_grade,p_feedback)
  on conflict(submission_id) do update set reviewer_id=excluded.reviewer_id,
    grade_percent=excluded.grade_percent, feedback=excluded.feedback, reviewed_at=now();
  update public.academy_assignment_submissions set status='reviewed' where id=p_submission;
  return p_submission;
end;
$$;

create function public.academy_issue_certificate(p_course uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  code text;
begin
  if auth.uid() is null or not academy_private.academy_is_enrolled(p_course)
     or not exists(select 1 from public.academy_courses where id=p_course and status='published')
  then raise exception 'Enrollment required' using errcode = '42501'; end if;
  if not exists(select 1 from public.academy_lessons l join public.academy_modules m on m.id=l.module_id where m.course_id=p_course)
     or exists (
       select 1 from public.academy_lessons l join public.academy_modules m on m.id=l.module_id
       where m.course_id=p_course and not exists(
         select 1 from public.academy_lesson_progress p where p.lesson_id=l.id and p.student_id=auth.uid())
     ) or exists (
       select 1 from public.academy_assessments a where a.course_id=p_course and a.published and (
         (a.kind='quiz' and not exists(
           select 1 from public.academy_assessment_attempts t where t.assessment_id=a.id and t.student_id=auth.uid() and t.passed))
         or (a.kind='assignment' and not exists(
           select 1 from public.academy_assignment_submissions s join public.academy_assignment_reviews r on r.submission_id=s.id
           where s.assessment_id=a.id and s.student_id=auth.uid() and s.status='reviewed' and r.grade_percent >= coalesce(a.passing_percent,0)))
       )
     ) then raise exception 'Complete all lessons and required assessments first'; end if;
  insert into public.academy_certificates(student_id,course_id,verification_code)
  values(auth.uid(),p_course,replace(gen_random_uuid()::text,'-',''))
  on conflict(student_id,course_id) do nothing;
  select verification_code into code from public.academy_certificates
  where student_id=auth.uid() and course_id=p_course and revoked_at is null;
  if code is null then raise exception 'Certificate has been revoked'; end if;
  return code;
end;
$$;
revoke all on function public.academy_grade_quiz(uuid,uuid,jsonb), public.academy_submit_assignment(uuid,text),
  public.academy_review_assignment(uuid,numeric,text), public.academy_issue_certificate(uuid)
from public, anon, authenticated;
grant execute on function public.academy_grade_quiz(uuid,uuid,jsonb), public.academy_submit_assignment(uuid,text),
  public.academy_review_assignment(uuid,numeric,text), public.academy_issue_certificate(uuid) to authenticated;

revoke insert, update on public.academy_lessons from anon, authenticated;
revoke all on public.academy_assessment_answers from anon, authenticated;
grant insert(module_id,title,position,body,video_asset_id), update(title,body,video_asset_id)
on public.academy_lessons to authenticated;
create policy academy_admin_insert_lessons on public.academy_lessons for insert to authenticated
with check ((select academy_private.academy_is_admin()));
create policy academy_admin_update_lessons on public.academy_lessons for update to authenticated
using ((select academy_private.academy_is_admin())) with check ((select academy_private.academy_is_admin()));

create function public.academy_set_course_status(p_course uuid, p_status public.academy_course_status)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not academy_private.academy_is_admin() then
    raise exception 'Academy administrator required' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('published','archived') then raise exception 'Invalid publication state'; end if;
  if p_status = 'published' and not exists (
    select 1 from public.academy_lessons lesson join public.academy_modules module on module.id=lesson.module_id
    where module.course_id=p_course and length(btrim(lesson.body))>0
  ) then raise exception 'Add lesson content before publishing'; end if;
  update public.academy_courses set status=p_status where id=p_course;
  if not found then raise exception 'Course was not found'; end if;
  return p_course;
end;
$$;
revoke all on function public.academy_set_course_status(uuid,public.academy_course_status) from public, anon, authenticated;
grant execute on function public.academy_set_course_status(uuid,public.academy_course_status) to authenticated;

create function public.academy_save_assessment(p_course uuid, p_id uuid, p_draft jsonb, p_publish boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  kind public.academy_assessment_kind := (p_draft->>'kind')::public.academy_assessment_kind;
  question jsonb;
  question_id uuid;
  position integer := 0;
begin
  if auth.uid() is null or not (academy_private.academy_is_admin() or academy_private.academy_teaches(p_course)) then
    raise exception 'Course instructor required' using errcode = '42501';
  end if;
  if p_id is null or p_draft is null or kind is null or octet_length(p_draft::text) > 120000
     or length(btrim(coalesce(p_draft->>'instructions',''))) not between 1 and 10000 then
    raise exception 'Invalid assessment';
  end if;
  if kind = 'quiz' and (
      coalesce(jsonb_typeof(p_draft->'questions'),'') <> 'array'
      or jsonb_array_length(p_draft->'questions') not between 1 and 40
  ) then raise exception 'Add 1 to 40 questions'; end if;
  insert into public.academy_assessments(id,course_id,kind,title,instructions,passing_percent,max_attempts,published)
  values(p_id,p_course,kind,p_draft->>'title',p_draft->>'instructions',
    (p_draft->>'passingPercent')::integer,(p_draft->>'maxAttempts')::integer,coalesce(p_publish,false));
  if kind = 'quiz' then
    for question in select value from jsonb_array_elements(p_draft->'questions') loop
      if length(btrim(coalesce(question->>'prompt',''))) not between 1 and 1000 then raise exception 'Invalid question'; end if;
      insert into public.academy_assessment_questions(assessment_id,position,prompt,options)
      values(p_id,position,question->>'prompt',question->'options') returning id into question_id;
      insert into public.academy_assessment_answers(question_id,correct_option)
      values(question_id,(question->>'correctOption')::integer);
      position := position + 1;
    end loop;
  end if;
  return p_id;
end;
$$;
revoke all on function public.academy_save_assessment(uuid,uuid,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.academy_save_assessment(uuid,uuid,jsonb,boolean) to authenticated;

alter table public.studio_payments add column reconciled_at timestamptz;
alter table public.studio_payments add column reconciled_by uuid references auth.users(id);

create function public.studio_reconcile_payment(p_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.studio_workspace_permission('payments') then
    raise exception 'Payment verification access required' using errcode = '42501';
  end if;
  update public.studio_payments set reconciled_at=now(), reconciled_by=auth.uid()
    where id=p_id and status='verified' and reconciled_at is null;
  if found then
    insert into public.studio_operations_audit(action,record_id) values ('payment.reconciled',p_id);
  elsif not exists(select 1 from public.studio_payments where id=p_id and status='verified') then
    raise exception 'Verified payment required';
  end if;
  return p_id;
end;
$$;
revoke all on function public.studio_reconcile_payment(uuid) from public,anon,authenticated;
grant execute on function public.studio_reconcile_payment(uuid) to authenticated;
