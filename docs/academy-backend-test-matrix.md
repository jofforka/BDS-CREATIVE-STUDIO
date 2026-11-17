# Academy backend integration test matrix

These tests **cannot run until a disposable Supabase staging project exists**. Static contract checks do not validate SQL syntax, permissions or behavior.

| Scenario | Expected outcome |
|---|---|
| Student registration | Student profile created, role student only |
| Metadata role escalation | Rejected or ignored |
| Unauthenticated draft course read | Denied |
| Student A reads student B enrolments | Denied |
| Instructor edits another instructor course | Denied |
| Student reads answer key table | Denied |
| Unenrolled student opens private lesson | Denied |
| Duplicate enrollment/progress writes | Idempotent and authorized |
| Quiz answers tampered with in browser | Server computes result independently |
| Assignment reviewed by unrelated instructor | Denied |
| Certificate issued before completion | Denied |
| Certificate revoked | Public verification invalid |
| Brute-force verification requests | Rate limited and monitored |
| Recovery link expired/reused | Safely rejected |
| Uploaded video/resource accessed without entitlement | Denied |
| User deleted | Retention and cascade behavior validated |

## Setup
Use separate staging users for student A, student B, instructor A, instructor B and admin. Apply migrations in order, create controlled test fixtures and run negative authorization cases. Do not use production data or expose service-role credentials in browser tests. Capture CI logs and security evidence before enabling Academy features.
