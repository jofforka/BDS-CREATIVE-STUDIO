begin;
create table if not exists public.studio_admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.studio_admins enable row level security;
revoke all on public.studio_admins from anon, authenticated;
grant select on public.studio_admins to authenticated;
create policy "studio admin reads own membership" on public.studio_admins for select to authenticated using (user_id = (select auth.uid()));
create policy "studio admin reads all services" on public.studio_services for select to authenticated using (exists(select 1 from public.studio_admins where user_id=(select auth.uid())));
create policy "studio admin inserts quote services" on public.studio_services for insert to authenticated with check (booking_mode='quote' and exists(select 1 from public.studio_admins where user_id=(select auth.uid())));
create policy "studio admin updates quote services" on public.studio_services for update to authenticated using (booking_mode='quote' and exists(select 1 from public.studio_admins where user_id=(select auth.uid()))) with check (booking_mode='quote' and exists(select 1 from public.studio_admins where user_id=(select auth.uid())));
grant select,insert,update on public.studio_services to authenticated;
revoke insert,update,delete on public.studio_services from anon;
commit;
