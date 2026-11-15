# BDS booking engine — implementation contract (not deployed)

## Existing baseline
The repository is a static HTML/CSS website. `booking.html` is currently an enquiry-to-WhatsApp form, **not** an availability engine. Existing BDS black/cream/gold styling and logo must be preserved. Do not publish fictional studio metrics or invented prices.

## Configuration to obtain from BDS
- Official service catalogue, each fixed price and session duration, approved deposit amount/percentage, currency (NGN), tax/fees and refund terms.
- Studio rooms, crew members, equipment dependencies, working hours, turnaround buffers, holidays and timezone (`Africa/Lagos`).
- Authorized BDS Paystack merchant account, verified webhook endpoint, approved messaging templates and privacy policy.
- Staff roles, approval requirements, customer consent and cancellation/reschedule rules.

## Backend endpoints (planned; NOT live)
- `GET /api/services`: active public services, sanitized package data.
- `GET /api/availability?service_id=...&date=YYYY-MM-DD`: suggested free slots, not guaranteed.
- `POST /api/holds`: authenticated, rate-limited transaction; validate service, derive amount and resource requirements on server, lock resources via exclusion constraint, create expiring hold.
- `POST /api/payments/initialize`: server-only Paystack secret, idempotency/reference checks, exact booking deposit in kobo, authenticated booking owner.
- `POST /api/webhooks/paystack`: verify raw-body HMAC SHA512 signature using secret key, reject malformed/replayed events, independently verify reference, amount, currency and successful charge with Paystack before marking payment verified. Idempotent database transaction.
- `POST /api/bookings/:id/cancel`: authenticated and authorized; follow published policy.
- `POST /api/quotes`: authenticated quote request, no automatic booking confirmation.
- `GET /api/admin/schedule`: staff-only with server-side role authorization.

## Transaction lifecycle
1. Customer selects service, local date and time. Server converts `Africa/Lagos` local time to UTC.
2. Server calculates price and deposit from approved database values (never client totals). Determine room, crew and equipment needed, and include setup/cleanup buffers.
3. In one database transaction, create `held` booking with short expiry and resource occupancy rows. An exclusion constraint rejects overlapping active reservations.
4. Initialize Paystack payment only for valid unexpired holds. Do not store payment secrets in Git or browser code.
5. Verify webhook signature and independently validate transaction with Paystack; process event idempotently. If hold expired or resource was released, do not auto-confirm; escalate for refund/rebooking.
6. Confirm booking and resource rows atomically after verified deposit; send receipt and appointment details via authorized messaging provider.
7. Expiry worker marks stale holds and allocations expired atomically, releasing resources; reconcile delayed webhooks.
8. On cancellation/reschedule, update occupancy, payment/refund and audit history atomically.

## Security and operational safeguards
- Use separate Supabase project and environment for staging; run SQL migration only after review.
- RLS enabled on tables; customer can only read their own bookings, payments and quotes. No direct client-side writes.
- Enforce server authorization for every mutation and admin endpoint; audit booking changes.
- Protect PII, minimize retention, and never include sensitive customer details in analytics.
- Use secure secret storage, webhook verification, rate limiting, CSRF protections where applicable, and backups.
- Paystack test mode first; never represent an initialized or pending transaction as paid.
- Exclusion constraints require allocation rows to be kept synchronized with booking status.
- No automated confirmations until actual availability, payment, notifications and failure recovery pass integration tests.

## Acceptance tests before any deployment
- Two concurrent attempts for same room/time: exactly one succeeds.
- Different resources at same time: both may succeed.
- Expired hold releases all resources; delayed payment cannot silently confirm.
- Payment callback spoof, wrong amount, wrong currency, duplicate webhook: no confirmation.
- Valid test payment: exactly one confirmed booking, one receipt, correct deposit balance.
- Unauthorized user cannot view another user's booking or payment.
- Timezone boundary, daylight and overnight sessions; working-hours and buffers.
- Mobile keyboard, screen reader labels, form validation, cancellation and refund policies.

## Next development task
Implement backend using a server-capable runtime (Next.js API routes or a separate Node service) on a **feature branch**; do not assume GitHub Pages can host secrets or webhooks. The current SQL migration is a reviewed starting point, not a production-complete scheduling service.
