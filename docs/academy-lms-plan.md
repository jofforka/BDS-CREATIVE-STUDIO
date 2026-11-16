# BDS Academy — LMS implementation contract

## Current release
Public Academy catalogue and individual course information pages only. No student registration, paid enrolment, course playback, progress tracking or certificates are claimed. Catalog starts empty; never invent approved courses.

## Architecture
Retain GitHub Pages for public marketing. Use a separate authenticated application/API for student and instructor workflows. Recommended baseline: Supabase Auth + PostgreSQL with row-level security and server-side privileged functions; private video hosting with signed playback access; object storage for assignments. No service-role keys, personal access tokens, payment secrets or private videos in GitHub Pages.

## Required domain entities
profiles (auth UID, role), courses (owner, status, price, visibility), modules, lessons (sequence, video asset reference, availability), enrollments (student, status), lesson_progress, quizzes, questions, attempts, assignments, submissions, reviews, certificate_issuances (unique code, revocation status), audit_events.

## Access rules
Students see their own enrolments, attempts, submissions and progress. Instructors may edit only assigned courses. Administrators manage courses and roles. Publishing, enrolment, grading, certificate issuance and revocation require server authorization. Never trust client-submitted completion or score. Signed video playback URLs must be short-lived and issued only for entitled students. Public verification returns only certificate holder name, course, issue date, status and ID, with consent/privacy review.

## Release gates
1. Provision a backend project and confirm access/ownership.
2. Apply migrations and RLS; test cross-user isolation and privilege escalation.
3. Implement registration, verified email, login/logout and password recovery.
4. Implement instructor course CRUD, module/lesson upload, drafts and publishing.
5. Implement enrolled student lesson player and server-tracked progress.
6. Implement server-graded quizzes and assessed project submissions.
7. Issue certificates after verifiable completion rules, with unique IDs, QR and revocation.
8. Run mobile, accessibility, privacy, backup, upload security and payment tests before opening enrolment.

## Course catalogue
Public `content/academy-catalog.json` contains only approved published marketing metadata. It is **not** a source of truth for authorization, progress, private lessons or certificates. A later server-backed publish pipeline should produce it automatically.
