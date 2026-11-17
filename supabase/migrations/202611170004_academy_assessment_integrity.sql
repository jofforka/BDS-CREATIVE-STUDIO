-- Apply AFTER 202611170001_academy_assessments.sql. Schema integrity only.
-- Reject lesson references belonging to another course.
create or replace function public.academy_assert_assessment_lesson_course()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.lesson_id is not null and not exists (
   select 1 from public.academy_lessons l
   join public.academy_modules m on m.id=l.module_id
   where l.id=new.lesson_id and m.course_id=new.course_id
 ) then
   raise check_violation using message='Assessment lesson must belong to assessment course';
 end if;
 return new;
end;
$$;
revoke all on function public.academy_assert_assessment_lesson_course() from public, anon, authenticated;
create trigger academy_assessment_lesson_course_guard
before insert or update of lesson_id,course_id on public.academy_assessments
for each row execute function public.academy_assert_assessment_lesson_course();

-- A lesson's module may change after an assessment is linked. Reject moves across courses.
create or replace function public.academy_guard_lesson_module_move()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.module_id is distinct from old.module_id and exists (
   select 1 from public.academy_assessments a
   join public.academy_modules m on m.id=new.module_id
   where a.lesson_id=new.id and a.course_id<>m.course_id
 ) then
   raise check_violation using message='Cannot move assessed lesson to another course';
 end if;
 return new;
end;
$$;
revoke all on function public.academy_guard_lesson_module_move() from public, anon, authenticated;
create trigger academy_assessed_lesson_module_guard
before update of module_id on public.academy_lessons
for each row execute function public.academy_guard_lesson_module_move();

-- Validate answer indexes against actual option count and restrict options to nonblank strings.
create or replace function public.academy_assert_answer_option()
returns trigger language plpgsql set search_path = '' as $$
declare opts jsonb;
begin
 select q.options into opts from public.academy_assessment_questions q where q.id=new.question_id;
 if opts is null or new.correct_option >= jsonb_array_length(opts) then
   raise check_violation using message='Correct answer must refer to an existing option';
 end if;
 return new;
end;
$$;
revoke all on function public.academy_assert_answer_option() from public, anon, authenticated;
create trigger academy_answer_option_guard
before insert or update on public.academy_assessment_answers
for each row execute function public.academy_assert_answer_option();

create or replace function public.academy_assert_question_options()
returns trigger language plpgsql set search_path = '' as $$
begin
 if exists (
   select 1 from jsonb_array_elements(new.options) o(value)
   where jsonb_typeof(o.value)<>'string' or length(trim(o.value #>> '{}'))=0
 ) then
   raise check_violation using message='Question options must be nonblank strings';
 end if;
 if exists (
   select 1 from public.academy_assessment_answers a
   where a.question_id=new.id and a.correct_option >= jsonb_array_length(new.options)
 ) then
   raise check_violation using message='Cannot remove the selected correct option';
 end if;
 return new;
end;
$$;
revoke all on function public.academy_assert_question_options() from public, anon, authenticated;
create trigger academy_question_options_guard
before insert or update of options on public.academy_assessment_questions
for each row execute function public.academy_assert_question_options();

-- Existing records must be checked before this migration is applied in a populated database.
-- This migration does not implement trusted grading, attempt limits or secure API writes.
