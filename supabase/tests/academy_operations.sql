begin;
insert into auth.users(id,email,raw_user_meta_data) values
('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','instructor@example.test','{}'),
('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb','student@example.test','{}');
update public.academy_profiles set role='admin' where user_id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',true);
do $$
declare
  course uuid := public.academy_save_course_draft('test-course','Test course','Photography','Test content',array['Module']);
  module uuid;
begin
  select id into strict module from public.academy_modules where course_id=course;
  insert into public.academy_lessons(module_id,title,body,position)
  values(module,'Test lesson','Lesson text',0);
  perform public.academy_set_course_status(course,'published');
  perform public.academy_save_assessment(course,'dddddddd-dddd-4ddd-dddd-dddddddddddd',
    '{"kind":"quiz","title":"Test quiz","instructions":"Select one option","passingPercent":75,"maxAttempts":1,"questions":[{"prompt":"Choose the first option","options":["First","Second"],"correctOption":0}]}',true);
end;
$$;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',true);
do $$
declare
  course uuid;
  lesson uuid;
  quiz uuid := 'dddddddd-dddd-4ddd-dddd-dddddddddddd';
  attempt uuid := 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee';
  student uuid := auth.uid();
  question uuid;
  result public.academy_assessment_attempts%rowtype;
begin
  select id into strict course from public.academy_courses where slug='test-course';
  if exists(select 1 from public.academy_lessons where title='Test lesson') then raise exception 'Lesson readable without enrollment'; end if;
  insert into public.academy_enrollments(student_id,course_id) values(student,course);
  select id into strict lesson from public.academy_lessons where title='Test lesson';
  insert into public.academy_lesson_progress(student_id,lesson_id) values(student,lesson);
  select id into strict question from public.academy_assessment_questions where assessment_id=quiz;
  begin
    perform 1 from public.academy_assessment_answers where question_id=question;
    raise exception 'Answer key accessible';
  exception when insufficient_privilege then null;
  end;
  result := public.academy_grade_quiz(quiz,attempt,jsonb_build_object(question::text,0));
  if result.score_percent <> 100 or not result.passed then raise exception 'Quiz grading failed'; end if;
  result := public.academy_grade_quiz(quiz,attempt,jsonb_build_object(question::text,0));
  if result.attempt_number <> 1 then raise exception 'Retry consumed another attempt'; end if;
  if public.academy_issue_certificate(course) is null then raise exception 'Certificate missing'; end if;
end;
$$;
rollback;
