-- Student self-enrollment and lesson completion for published BDS Academy courses.
-- Both operations are limited to the signed-in user's own records.
-- Course content and assessment answers remain protected by their existing policies.
grant select on public.academy_courses, public.academy_modules, public.academy_lessons to authenticated;
grant select, insert on public.academy_enrollments, public.academy_lesson_progress to authenticated;

create policy academy_student_self_enroll
on public.academy_enrollments for insert to authenticated
with check (
  student_id = (select auth.uid())
  and exists (
    select 1 from public.academy_courses c
    where c.id = course_id and c.status = 'published'
  )
);

create policy academy_student_mark_completed
on public.academy_lesson_progress for insert to authenticated
with check (
  student_id = (select auth.uid())
  and exists (
    select 1
    from public.academy_lessons l
    join public.academy_modules m on m.id = l.module_id
    join public.academy_enrollments e on e.course_id = m.course_id
    join public.academy_courses c on c.id = m.course_id
    where l.id = lesson_id
      and e.student_id = (select auth.uid())
      and c.status = 'published'
  )
);
