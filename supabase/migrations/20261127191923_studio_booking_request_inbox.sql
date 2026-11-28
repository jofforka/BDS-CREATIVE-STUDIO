create table public.studio_booking_requests (
id uuid primary key default gen_random_uuid(), service_id uuid references public.studio_services(id), service_category text not null check(length(service_category) between 1 and 120), customer_name text not null check(length(customer_name) between 1 and 120), customer_contact text not null check(length(customer_contact) between 1 and 30), preferred_start timestamptz not null, duration_label text not null check(length(duration_label) between 1 and 80), details text not null check(length(details)<=2000), quoted_kobo bigint check(quoted_kobo>=0), status text not null default 'pending' check(status in ('pending','approved','declined')), created_at timestamptz not null default now());
alter table public.studio_booking_requests enable row level security;
revoke all on public.studio_booking_requests from public,anon,authenticated;
grant select on public.studio_booking_requests to authenticated;
create policy studio_admin_read_requests on public.studio_booking_requests for select to authenticated using (exists(select 1 from public.studio_admin_memberships where user_id=(select auth.uid())));
create function public.studio_submit_request(p_id uuid,p_service_id uuid,p_category text,p_name text,p_contact text,p_start timestamptz,p_duration text,p_details text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_price bigint; v_name text;
begin
if p_id is null or p_start is null or p_start<now() or p_start>now()+interval '1 year' then raise exception 'Invalid appointment date'; end if;
if p_service_id is not null then select price_kobo,name into v_price,v_name from public.studio_services where id=p_service_id and active; if not found then raise exception 'Package unavailable'; end if; if split_part(v_name,' — ',1)<>p_category then raise exception 'Invalid package'; end if; end if;
insert into public.studio_booking_requests(id,service_id,service_category,customer_name,customer_contact,preferred_start,duration_label,details,quoted_kobo) values(p_id,p_service_id,btrim(p_category),btrim(p_name),btrim(p_contact),p_start,btrim(p_duration),coalesce(p_details,''),v_price) on conflict(id) do nothing;
return p_id;
end; $$;
revoke all on function public.studio_submit_request(uuid,uuid,text,text,text,timestamptz,text,text) from public;
grant execute on function public.studio_submit_request(uuid,uuid,text,text,text,timestamptz,text,text) to anon,authenticated;
