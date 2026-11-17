-- Apply after baseline. Auto-create a least-privileged profile on registration.
-- No user-supplied metadata is permitted to set the role.
create or replace function public.academy_create_student_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 insert into public.academy_profiles(user_id, display_name, role)
 values(new.id, '', 'student')
 on conflict (user_id) do nothing;
 return new;
end;
$$;
revoke all on function public.academy_create_student_profile() from public, anon, authenticated;
drop trigger if exists academy_auth_user_created on auth.users;
create trigger academy_auth_user_created
after insert on auth.users for each row execute function public.academy_create_student_profile();
-- Existing auth users are NOT automatically backfilled: review them before
-- running a controlled, explicit backfill for the Academy project.
