-- BDS booking foundation: apply only after reviewing in a dedicated Supabase project.
-- Never expose service_role keys in the browser.
create extension if not exists pgcrypto;
create extension if not exists btree_gist with schema extensions;
create table if not exists public.studio_services (
 id uuid primary key default gen_random_uuid(),
 name text not null unique,
 booking_mode text not null check (booking_mode in ('instant','quote')),
 duration_minutes integer check(duration_minutes > 0),
 price_kobo bigint check(price_kobo >= 0),
 deposit_kobo bigint check(deposit_kobo >= 0),
 active boolean not null default false,
 constraint valid_instant_service check (booking_mode <> 'instant' or (duration_minutes is not null and price_kobo is not null and deposit_kobo is not null and deposit_kobo <= price_kobo))
);
create table if not exists public.studio_resources (
 id uuid primary key default gen_random_uuid(),
 name text not null unique,
 kind text not null check(kind in ('room','crew','equipment')),
 active boolean not null default true
);
create table if not exists public.studio_bookings (
 id uuid primary key default gen_random_uuid(),
 service_id uuid not null references public.studio_services(id),
 customer_id uuid not null references auth.users(id),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 status text not null default 'held' check(status in ('held','confirmed','completed','cancelled','expired')),
 hold_expires_at timestamptz,
 total_kobo bigint not null check(total_kobo >= 0),
 deposit_due_kobo bigint not null check(deposit_due_kobo >= 0 and deposit_due_kobo <= total_kobo),
 created_at timestamptz not null default now(),
 constraint positive_booking_duration check(ends_at > starts_at),
 constraint held_has_expiry check(status <> 'held' or hold_expires_at is not null)
);
create table if not exists public.studio_booking_resources (
 booking_id uuid not null references public.studio_bookings(id) on delete cascade,
 resource_id uuid not null references public.studio_resources(id),
 occupied_range tstzrange not null,
 status text not null check(status in ('held','confirmed','completed','cancelled','expired')),
 primary key(booking_id,resource_id),
 constraint resource_range_not_empty check(not isempty(occupied_range)),
 constraint no_overlapping_active_resource exclude using gist (resource_id with =, occupied_range with &&) where (status in ('held','confirmed'))
);
create table if not exists public.studio_payments (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.studio_bookings(id),
 provider text not null default 'paystack' check(provider = 'paystack'),
 provider_reference text not null unique,
 amount_kobo bigint not null check(amount_kobo > 0),
 status text not null default 'pending' check(status in ('pending','verified','failed','refunded')),
 verified_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.studio_quotes (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references auth.users(id),
 service_id uuid references public.studio_services(id),
 description text not null,
 status text not null default 'requested' check(status in ('requested','reviewing','offered','accepted','declined')),
 created_at timestamptz not null default now()
);
create index if not exists studio_bookings_customer_idx on public.studio_bookings(customer_id,starts_at);
create index if not exists studio_bookings_expiry_idx on public.studio_bookings(hold_expires_at) where status='held';
create index if not exists studio_payments_booking_idx on public.studio_payments(booking_id);
alter table public.studio_services enable row level security;
alter table public.studio_resources enable row level security;
alter table public.studio_bookings enable row level security;
alter table public.studio_booking_resources enable row level security;
alter table public.studio_payments enable row level security;
alter table public.studio_quotes enable row level security;
-- Read-only customer access; writes must use authenticated server-side workflows.
create policy "customers read own bookings" on public.studio_bookings for select to authenticated using(customer_id = (select auth.uid()));
create policy "customers read own payments" on public.studio_payments for select to authenticated using(exists(select 1 from public.studio_bookings b where b.id=booking_id and b.customer_id=(select auth.uid())));
create policy "customers read own quotes" on public.studio_quotes for select to authenticated using(customer_id=(select auth.uid()));
create policy "public reads active services" on public.studio_services for select to anon,authenticated using(active);
-- The exclusion constraint blocks concurrent active holds for the same resource.
-- Expired holds MUST be transitioned to expired before a slot is offered again.
-- Allocation + booking + resource rows MUST be inserted in one server transaction.
-- Keep resource allocation status synchronized with booking status inside the transaction.
