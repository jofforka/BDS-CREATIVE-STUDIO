# Instructor studio v2

This interface supports local planning of courses, ordered modules and lessons, validation through the shared course model, and manual export via clipboard. It has **no persistence, instructor authentication, media upload, or publishing**.

Before activating: verify instructor/admin role on server, enforce per-course ownership, create server-side draft CRUD endpoints, add upload size/type scanning and signed private media storage, preserve draft version history, require review before publishing, and test all workflows across devices. No user-supplied JSON may be trusted as authorization or published directly.
