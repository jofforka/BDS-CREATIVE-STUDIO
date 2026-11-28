# Optional BDS service catalogue API

The GitHub Pages site reads its catalogue from Supabase and sends booking enquiries to the configured BDS WhatsApp number. Studio staff verify transfers manually. The legacy Paystack checkout and webhook routes have been removed. Existing payment records are preserved.

This optional development server exposes `GET /health` and `GET /api/services` only. The Pages site does not need it. To run locally, install the server dependencies and set a read-only `DATABASE_URL`. Configure `DB_SSL=true` for a database that requires validated TLS.
