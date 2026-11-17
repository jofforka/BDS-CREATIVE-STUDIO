# Assessment integrity migration review

Migration 202611170004 adds checks that an assessment lesson belongs to the same course, blocks moving assessed lessons into another course, validates nonempty string options and prevents answer indexes from exceeding the option count.

## Important limitations
- Must apply only after baseline and assessment migrations; run against a disposable staging project first.
- Existing data must be audited before applying; triggers do not retroactively validate rows.
- Moving an entire module to a different course is not yet blocked by these triggers. Add that safeguard before course/module reassignment is enabled.
- Concurrent changes to question options and answer keys, versioned quizzes, scoring integrity, write authorization, and answer confidentiality require server-side transaction design and live tests.
- No browser-facing write policies have been added.
