# BDS Academy backend setup and security checklist

This is a **migration blueprint**, not a connected or deployed backend. Do not expose a Supabase service-role key in browser JavaScript, GitHub Pages, or a public repository.

1. Create a dedicated Supabase project owned by BDS. Enable email verification and configure allowed redirect URLs for the Academy domain.
2. Review `supabase/migrations/202611160001_academy_baseline.sql` in a disposable staging project. Apply only after validating role policies and existing schema.
3. Provision the first admin via a privileged one-time server-side operation after verifying the account owner's identity. Never offer client-side role elevation.
4. Implement server endpoints for course/module/lesson publishing, enrolment, video signing, progress validation, assessment grading, and certificate issuance. Keep audit logs for privileged operations.
5. Store video assets in private storage. Generate short-lived playback tokens server-side only after verifying entitlement.
6. Add a public certificate-verification endpoint with minimal data disclosure, revocation checks, abuse throttling and consent review.
7. Configure database backups, monitoring, rate limits, file size/type validation, antivirus scanning where supported, and incident response.

## Negative authorization tests (mandatory)
- Anonymous visitor cannot read profiles, enrolments, progress or certificates.
- Student A cannot read Student B's profile, enrolment, progress or certificate.
- Student cannot promote self to instructor/admin or create/publish courses.
- Instructor cannot edit another instructor's course or issue certificates directly.
- Unenrolled student cannot fetch private lesson content or obtain video tokens.
- Course progress cannot be marked complete by arbitrary client writes.
- Public verification cannot expose emails, dates of birth, private enrolment data or private assessment results.
- Revoked certificates cannot be verified as valid.

## Schema limitations and next migration
The baseline migration defines the initial identity/course/lesson/enrolment/progress/certificate entities and read-only RLS. It does **not** implement automatic profile creation, server writes, quizzes, submissions, video transcoding, payments or certificate generation. Do not enable enrolment or certificates until those systems and tests exist.
