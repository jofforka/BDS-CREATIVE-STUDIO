-- BDS Academy assessments. Apply AFTER 202611160001_academy_baseline.sql.
-- Schema only: no browser-facing write policies or certificate issuance.
create type public.academy_assessment_kind as enum ('quiz','assignment');
create type public.academy_submission_status as enum ('submitted','reviewed','returned');
create table public.academy_assessments (
 id uuid primary key default gen_random_uuid(),
 course_id uuid not null references public.academy_courses(id) on delete cascade,
 lesson_id uuid references public.academy_lessons(id) on delete set null,
 kind public.academy_assessment_kind not null,
 title text not null check (length(trim(title)) between 3 and 180),
 instructions text not null default '',
 passing_percent integer check (passing_percent between 0 and 100),
 max_attempts integer check (max_attempts between 1 and 20),
 published boolean not null default false,
 created_at timestamptz not null default now(),
 constraint quiz_requires_pass_score check (kind <> 'quiz' or passing_percent is not null)
);
create table public.academy_assessment_questions (
 id uuid primary key default gen_random_uuid(),
 assessment_id uuid not null references public.academy_assessments(id) on delete cascade,
 position integer not null check (position >= 0),
 prompt text not null check (length(trim(prompt)) > 0),
 options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 8),
 unique(assessment_id,position)
);
-- Keep correct answers in a separate table with NO client-facing SELECT policies.
create table public.academy_assessment_answers (
 question_id uuid primary key references public.academy_assessment_questions(id) on delete cascade,
 correct_option integer not null check(correct_option between 0 and 7)
);
create table public.academy_assessment_attempts (
 id uuid primary key default gen_random_uuid(),
 assessment_id uuid not null references public.academy_assessments(id) on delete cascade,
 student_id uuid not null references public.academy_profiles(user_id) on delete cascade,
 attempt_number integer not null check (attempt_number > 0),
 submitted_at timestamptz not null default now(),
 score_percent numeric(5,2) check(score_percent between 0 and 100),
 passed boolean,
 unique(assessment_id,student_id,attempt_number)
);
-- No student answers are exposed to other students.
create table public.academy_assignment_submissions (
 id uuid primary key default gen_random_uuid(),
 assessment_id uuid not null references public.academy_assessments(id) on delete cascade,
 student_id uuid not null references public.academy_profiles(user_id) on delete cascade,
 submission_text text not null default '',
 private_asset_id text,
 status public.academy_submission_status not null default 'submitted',
 submitted_at timestamptz not null default now(),
 unique(assessment_id,student_id),
 check(length(submission_text) <= 20000),
 check(length(trim(submission_text)) > 0 or private_asset_id is not null)
);
create table public.academy_assignment_reviews (
 submission_id uuid primary key references public.academy_assignment_submissions(id) on delete cascade,
 reviewer_id uuid not null references public.academy_profiles(user_id),
 grade_percent numeric(5,2) not null check(grade_percent between 0 and 100),
 feedback text not null default '',
 reviewed_at timestamptz not null default now()
);
-- RLS is enabled on ALL new tables, including the secret answer key.
alter table public.academy_assessments enable row level security;
alter table public.academy_assessment_questions enable row level security;
alter table public.academy_assessment_answers enable row level security;
alter table public.academy_assessment_attempts enable row level security;
alter table public.academy_assignment_submissions enable row level security;
alter table public.academy_assignment_reviews enable row level security;
create policy academy_assessments_read on public.academy_assessments
 for select to authenticated using (
 (published and public.academy_is_enrolled(course_id))
 or public.academy_is_admin() or public.academy_teaches(course_id)
 );
create policy academy_questions_read on public.academy_assessment_questions
 for select to authenticated using (
 exists (select 1 from public.academy_assessments a where a.id=assessment_id
 and (public.academy_is_admin() or public.academy_teaches(a.course_id)
 or (a.published and public.academy_is_enrolled(a.course_id))))
 );
-- Deliberately no SELECT policy for academy_assessment_answers.
create policy academy_attempts_read on public.academy_assessment_attempts
 for select to authenticated using (
 student_id=(select auth.uid()) or public.academy_is_admin()
 or exists(select 1 from public.academy_assessments a where a.id=assessment_id and public.academy_teaches(a.course_id))
 );
create policy academy_submissions_read on public.academy_assignment_submissions
 for select to authenticated using (
 student_id=(select auth.uid()) or public.academy_is_admin()
 or exists(select 1 from public.academy_assessments a where a.id=assessment_id and public.academy_teaches(a.course_id))
 );
create policy academy_reviews_read on public.academy_assignment_reviews
 for select to authenticated using (
 exists(select 1 from public.academy_assignment_submissions s
 where s.id=submission_id and (s.student_id=(select auth.uid()) or public.academy_is_admin()
 or exists(select 1 from public.academy_assessments a where a.id=s.assessment_id and public.academy_teaches(a.course_id))))
 );
-- Important: authenticated and anon have NO INSERT/UPDATE/DELETE policies.
-- Service-side endpoints must verify role, enrollment, assessment kind,
-- attempt limits, grading authority, cross-course lesson ownership and asset access.
-- Do not expose the answer key via API, view, logs, or public client.
