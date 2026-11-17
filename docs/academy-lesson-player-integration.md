# Student lesson player integration checklist

This phase is an interface-only preview, with no lesson data, progress persistence, or private media playback. Never treat URL query parameters as authorization.

## Integration requirements
1. Verify the Supabase JWT on a trusted backend and check active enrolment for the requested course.
2. Fetch only entitled modules and lessons in server-approved order. Do not embed video provider secrets or permanent media URLs in static HTML.
3. Issue short-lived playback sessions after checking lesson-to-course ownership and enrolment. Refresh access safely on expiry.
4. Return downloadable resource links only after entitlement checks, using short-lived signed URLs.
5. Record lesson completion server-side, idempotently, after the approved completion criteria; do not trust a browser button alone.
6. Derive course progress from authoritative lesson completion records and the current published lesson set.
7. Store student notes only with explicit consent, private per-user storage, deletion and export support.
8. Disable certificate issuance until assessments and eligibility checks are server enforced.

## Validation before launch
Test unenrolled students, signed-out users, expired sessions, cross-course lesson IDs, token replay, private file sharing, screen readers, keyboard navigation, mobile video, captions, transcript access, and intermittent network connectivity.
