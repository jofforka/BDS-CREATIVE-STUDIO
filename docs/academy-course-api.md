# BDS Academy course management API contract (not deployed)

The browser on GitHub Pages must not be treated as a privileged server. This contract defines the backend endpoints to implement after Supabase provisioning. Until then, the workspace remains a local, non-persistent draft preview.

## Authentication and authorization
All write endpoints require a verified Supabase JWT, a server-side lookup of `academy_profiles.role`, and explicit ownership/admin checks. Do not rely on hidden UI, client role fields, user-supplied instructor IDs or public catalogue JSON for authorization. Validate request bodies again server-side; the shared JavaScript model is UX validation only. Rate-limit requests, enforce payload limits and audit every privileged action.

## Endpoints (proposed)
- `GET /api/academy/instructor/courses`: list only courses owned by authenticated instructor (admins can list all).
- `POST /api/academy/instructor/courses`: validate title, category, summary, outcomes and module titles; create draft course and module rows in one transaction; assign instructor from verified JWT identity, never request body.
- `PATCH /api/academy/instructor/courses/:id`: modify authorized draft; use optimistic concurrency.
- `POST /api/academy/instructor/courses/:id/publish`: validate minimum lessons and approved media; admin or authorized instructor according to policy; publish transactionally.
- `POST /api/academy/instructor/courses/:id/modules`: create ordered module, enforce uniqueness and ownership.
- `POST /api/academy/instructor/modules/:id/lessons`: create lesson metadata with private video asset identifier.
- `POST /api/academy/media/upload-session`: authorize course owner, validate content type/size and return short-lived signed upload capability for private media.
- `GET /api/academy/learn/courses/:id`: verify active enrolment; return entitled curriculum, never permanent private media URLs.
- `POST /api/academy/learn/lessons/:id/playback-session`: verify entitlement, issue short-lived playback token.
- `POST /api/academy/learn/lessons/:id/complete`: server-side completion validation and idempotent progress write.

## Data changes still needed
Baseline migration lacks `outcomes`, instructor assignment policies beyond a single instructor ID, course versioning, video provider metadata and assessment tables. Add those in reviewed forward-only migrations before activating these endpoints. Do not deploy an API that silently discards learning outcomes.

## Failure and test cases
Unauthenticated requests -> 401; student trying to publish -> 403; instructor editing another instructor's course -> 403; invalid category -> 422; duplicate slug -> 409; expired upload/playback tokens rejected. Tests must verify multi-tenant isolation, cross-course module/lesson IDs, audit logging, idempotent completion and publication consistency.
