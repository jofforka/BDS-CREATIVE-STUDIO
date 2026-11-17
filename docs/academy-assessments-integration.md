# Assessment and grading integration

Migration `202611170001_academy_assessments.sql` depends on the Academy baseline. It has not been run on a live Supabase project.

## Workflow
- Instructor creates a draft quiz or assignment scoped to their own course. Publishing requires backend checks.
- Quiz questions are student-readable only for enrolled students when the assessment is published. Correct answers remain in a separate RLS-protected table.
- Student submits an attempt to an authenticated backend function. The function verifies enrolment, published status, quiz kind, max attempts and options; scores the attempt server-side and writes it transactionally.
- Student submits a private assignment file reference or text. Backend validates storage ownership, course enrolment and assessment kind.
- Assigned instructor/admin reviews submission and publishes grade and feedback after verifying scope.
- Certificates remain disabled until server-side eligibility rules include completion, passing scores and instructor-approved assignments.

## Required hardening before activation
- Add a cross-course lesson ownership constraint/trigger for `academy_assessments.lesson_id`.
- Validate correct answer index against each question's actual option count.
- Validate question options are non-empty strings and enforce total question limits.
- Require score/pass consistency and prevent student modification of results.
- Implement versioning or snapshot of questions per attempt to preserve grade integrity.
- Protect answer keys from every browser-facing endpoint and view.
- Add auditing, rate limiting, upload malware scanning and file limits.
- Test RLS with separate student/instructor/admin identities and direct REST requests.
- Explicitly grant only required table/function privileges after reviewing Supabase defaults.

No instructor, student or grading backend is deployed by this PR.
