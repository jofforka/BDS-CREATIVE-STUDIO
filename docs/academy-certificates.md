# BDS Academy certificate verification and issuance

## Current state
`academy-verify.html` is a public interface that **does not verify credentials**. The Supabase migration is not deployed. The browser intentionally never claims a certificate is authentic. The database already has a certificate table from the baseline migration.

## Issuance requirements
- Authenticate the requesting user and authorize certificate issuance through a trusted backend only.
- Verify student enrolment, every required published lesson completed, required quizzes passed and practical assignments approved; do not trust browser-supplied completion.
- Make issuance idempotent with the existing unique(student_id,course_id) constraint. Record issuance and revocation audit events.
- Store certificates as private generated PDFs, with a short-lived authorized download URL.
- Generate a QR code linking to the public verification URL with an unpredictable verification code, not a student ID.
- Ensure certificate content uses the correct approved course title, recipient display name, completion date and branding. Never fabricate qualifications, accreditations or professional licenses.

## Public verification
- Rate-limit verification, log abuse and avoid exposing student personal data without consent.
- The migration provides a restricted internal function returning valid status and issue date; do not expose the SQL function to anonymous API callers until protections are implemented.
- Revoked certificates and unpublished courses must not be confirmed as valid.
- The UI must remain non-verifying until the protected endpoint is deployed and tested.

## Tests before activation
Test random and malformed codes, revoked certificates, course status transitions, multiple student identities, certificate reissue, unauthorized issuance, concurrent requests, private PDF access, accessible PDFs and QR scanning.
