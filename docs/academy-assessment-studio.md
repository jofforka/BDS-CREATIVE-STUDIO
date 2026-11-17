# Assessment Studio preview

The Academy Assessment Studio builds local quiz and creative-assignment drafts without a backend. It never stores, grades, or publishes student work. Quiz preview deliberately omits correct answer keys; private instructor clipboard exports contain keys and must never be shared with students.

## Before connecting to Supabase
- Authenticate instructor/admin and verify course ownership server-side.
- Validate questions, options and answer keys again on server.
- Store answer keys in the restricted table, never in student-facing JSON.
- Implement trusted quiz scoring, attempt limits, transactional submission, instructor grading and audit logs.
- Verify assessment course/lesson ownership, enrollment, private file access and grading permissions.
- Perform real browser accessibility, keyboard, mobile and integration tests.
