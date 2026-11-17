# Academy workspace integration requirements

The workspace is a **non-persistent course-planning preview** and an information architecture reference, not an instructor admin panel. It must not be advertised as a live instructor login or student LMS.

## Instructor workflow to wire
- Authenticate with Supabase and verify instructor/admin role server-side.
- CRUD courses with server-side role checks, draft/published transitions and audit records.
- Create/reorder modules and lessons; upload video to private provider/storage through signed upload flows.
- Store provider video IDs, not public secret URLs, in lesson records.
- Approve publication and synchronize public catalogue metadata from backend.

## Student workflow to wire
- Verified signup and profile provisioning; course enrolment with server-side checks.
- Read-only curriculum access scoped to enrolled students; signed, short-lived playback.
- Track server-validated lesson completion and course progress.
- Submit projects privately; provide authorized instructor review and feedback.

## Assessments and certificates
- Create quiz/assignment tables and row-level security in a follow-up migration.
- Keep correct quiz answers and grading decisions server-side.
- Issue and revoke certificates only through audited privileged functions.
- Verification endpoint should reveal only consented minimum public data.

## Acceptance gates
- RLS tests for cross-student and cross-instructor access.
- Unauthorized upload/publish/grade/issue attempts rejected.
- Course draft cannot be accessed as a public published course.
- Video playback tokens expire and cannot be obtained by unenrolled users.
- Certificate IDs cannot be forged or marked valid from browser input.
- End-to-end mobile, keyboard, accessibility and data privacy tests.
