-- BDS Academy LMS baseline for a dedicated Supabase project.
-- Review and run in Supabase SQL editor/migrations; never run in public browser.
create extension if not exists pgcrypto;
create type public.academy_role as enum ('student','instructor','admin');
create type public.academy_course_status as enum ('draft','published','archived');
create table public.academy_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 role public.academy_role not null default 'student',
 created_at timestamptz not null default now()
);
create table public.academy_courses (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 title text not null check (length(title) between 3 and 180),
 summary text not null default '',
 category text not null,
 instructor_id uuid not null references public.academy_profiles(user_id),
 status public.academy_course_status not null default 'draft',
 created_at timestamptz not null default now()
);
create table public.academy_modules (
 id uuid primary key default gen_random_uuid(),
 course_id uuid not null references public.academy_courses(id) on delete cascade,
 title text not null,
 position integer not null check(position >= 0),
 unique(course_id,position),
 unique(id,course_id)
);
create table public.academy_lessons (
 id uuid primary key default gen_random_uuid(),
 module_id uuid not null references public.academy_modules(id) on delete cascade,
 title text not null,
 position integer not null check(position >= 0),
 video_asset_id text,
 body text not null default '',
 unique(module_id,position)
);
create table public.academy_enrollments (
 student_id uuid not null references public.academy_profiles(user_id) on delete cascade,
 course_id uuid not null references public.academy_courses(id) on delete cascade,
 enrolled_at timestamptz not null default now(),
 primary key(student_id,course_id)
);
create table public.academy_lesson_progress (
 student_id uuid not null references public.academy_profiles(user_id) on delete cascade,
 lesson_id uuid not null references public.academy_lessons(id) on delete cascade,
 completed_at timestamptz not null default now(),
 primary key(student_id,lesson_id)
);
create table public.academy_certificates (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.academy_profiles(user_id),
 course_id uuid not null references public.academy_courses(id),
 verification_code text not null unique default encode(gen_random_bytes(18),'hex'),
 issued_at timestamptz not null default now(),
 revoked_at timestamptz,
 unique(student_id,course_id)
);
create or replace function public.academy_is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.academy_profiles where user_id = (select auth.uid()) and role = 'admin') $$;
create or replace function public.academy_teaches(p_course uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.academy_courses where id = p_course and instructor_id = (select auth.uid())) $$;
create or replace function public.academy_is_enrolled(p_course uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.academy_enrollments where course_id = p_course and student_id = (select auth.uid())) $$;
create or replace function public.academy_lesson_course(p_lesson uuid) returns uuid
language sql stable security definer set search_path = ''
as $$ select m.course_id from public.academy_lessons l join public.academy_modules m on m.id=l.module_id where l.id=p_lesson $$;
revoke all on function public.academy_is_admin() from public, anon, authenticated;
revoke all on function public.academy_teaches(uuid) from public, anon, authenticated;
revoke all on function public.academy_is_enrolled(uuid) from public, anon, authenticated;
revoke all on function public.academy_lesson_course(uuid) from public, anon, authenticated;
grant execute on function public.academy_is_admin(),public.academy_teaches(uuid),public.academy_is_enrolled(uuid),public.academy_lesson_course(uuid) to authenticated;
alter table public.academy_profiles enable row level security;
alter table public.academy_courses enable row level security;
alter table public.academy_modules enable row level security;
alter table public.academy_lessons enable row level security;
alter table public.academy_enrollments enable row level security;
alter table public.academy_lesson_progress enable row level security;
alter table public.academy_certificates enable row level security;
create policy profiles_read on public.academy_profiles for select to authenticated using(user_id=(select auth.uid()) or (select public.academy_is_admin()));
create policy courses_read on public.academy_courses for select to authenticated using(status='published' or (select public.academy_is_admin()) or (select public.academy_teaches(id)));
create policy academy_published_courses_anon on public.academy_courses for select to anon using(status='published');
create policy modules_read on public.academy_modules for select to authenticated using(exists(select 1 from public.academy_courses c where c.id=course_id and (c.status='published' or (select public.academy_is_admin()) or (select public.academy_teaches(c.id)))));
create policy lessons_read on public.academy_lessons for select to authenticated using(exists(select 1 from public.academy_modules m where m.id=module_id and ((select public.academy_is_admin()) or (select public.academy_teaches(m.course_id)) or (select public.academy_is_enrolled(m.course_id)))));
create policy enrollments_read on public.academy_enrollments for select to authenticated using(student_id=(select auth.uid()) or (select public.academy_is_admin()) or (select public.academy_teaches(course_id)));
create policy progress_read on public.academy_lesson_progress for select to authenticated using(student_id=(select auth.uid()) or (select public.academy_is_admin()) or (select public.academy_teaches((select public.academy_lesson_course(lesson_id)))));
create policy certificates_read on public.academy_certificates for select to authenticated using(student_id=(select auth.uid()) or (select public.academy_is_admin()));
-- Intentionally NO browser-facing INSERT/UPDATE/DELETE policies.
-- Authenticated write operations must use audited, server-side endpoints
-- with explicit authorization and transaction-level eligibility checks.
-- Never expose service-role credentials to the public site.
