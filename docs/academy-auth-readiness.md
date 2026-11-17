# BDS Academy authentication readiness

This PR prepares, but does not activate, student signup.

## Database
Run the baseline migration first, followed by the student-profile trigger migration. The trigger inserts a profile with role **student** for each newly created auth user. Client-supplied metadata cannot elevate the role. The trigger does not backfill existing users; review existing identities before controlled backfill.

## Recovery
The password update form now hides and does not require the email field during the PASSWORD_RECOVERY event. Test actual email redirects, expired links, repeat submissions and sessions in a configured Supabase staging project.

## Release gate
1. Provision dedicated Supabase project, configure email confirmation, SMTP, approved redirect URLs, RLS and publishable key only.
2. Apply migrations in order and test signup and trigger transaction with fresh accounts.
3. Confirm no user can self-promote to instructor/admin by editing metadata or direct REST requests.
4. Test login, recovery, logout, course visibility, and cross-user enrolment access.
5. Verify CORS, security headers, dependency pinning, monitoring and abuse limits.
6. Keep enrolment, content publishing, grading and certificates disabled until server-side endpoints pass authorization tests.

No Supabase migration has been executed by this PR.
