# BDS Studio API (development only)

This is a **partial backend scaffold**, not a deployable booking platform. No database, Paystack merchant credentials, or hosted API has been configured.

## Local setup
1. Use Node.js 20+ and a separate development PostgreSQL/Supabase database.
2. Review `../supabase/migrations/20261115_studio_booking_foundation.sql` before applying it.
3. In this directory, run `npm install`, then `npm test`.
4. Supply `DATABASE_URL`, `PAYSTACK_SECRET_KEY` (test key only), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and optionally `PORT` and `DB_SSL` through secure environment variables.
5. Run `npm start`. The static website does **not** yet call this API.

## Available API scaffold
- `GET /health` basic process status (does not check database)
- `GET /api/services` active catalogue from database
- `POST /api/payments/initialize` authenticated held-booking deposit initialization
- `POST /api/webhooks/paystack` signature check, independent verification, transactional status update

## Release blockers — do not deploy
- Booking hold creation, scheduling availability and resource allocation endpoints are **not implemented**.
- Hold expiry worker, retries, event audit trail, receipts, refunds, cancellations and rescheduling are **not implemented**.
- Paystack initialization currently inserts a pending payment before provider initialization; provider failures need reconciliation and retry logic.
- Paystack reference verification and transactional updates require integration tests with a test merchant.
- Webhook response handling, operational alerting and rate limiting need production hardening.
- Server needs CORS/origin policy, HTTPS deployment, authenticated admin access, monitoring and environment-specific secrets.
- A browser frontend for authenticated reservations and deposit checkout is **not connected**.
- Database migration and server tests have not been executed in this repository's environment.
- Studio pricing, deposit policy, service/resource catalogue and opening hours need BDS approval.
- Do not deploy or merge without verifying all of the above.

## Key safety rule
Never claim a booking is confirmed until its deposit has been independently verified and its resources remain reserved. Never expose Paystack secret keys in static HTML or browser JavaScript.
