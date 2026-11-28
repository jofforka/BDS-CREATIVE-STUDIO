alter table public.studio_bookings alter column customer_id drop not null;
alter table public.studio_bookings add column guest_name text, add column guest_contact text;
alter table public.studio_bookings add constraint studio_booking_customer_identity check (customer_id is not null or (guest_name is not null and length(btrim(guest_name)) between 1 and 120 and guest_contact is not null and length(btrim(guest_contact)) between 1 and 30));
alter table public.studio_payments drop constraint studio_payments_provider_check;
alter table public.studio_payments add constraint studio_payments_provider_check check (provider in ('paystack','manual'));
alter table public.studio_payments add column recorded_by uuid references auth.users(id);
alter table public.studio_payments add constraint studio_manual_payment_evidence check (provider <> 'manual' or (recorded_by is not null and verified_at is not null and length(btrim(provider_reference)) > 0));
