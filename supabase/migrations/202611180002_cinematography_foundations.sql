-- Studio-produced lessons do not require a personal Auth identity as their owner.
alter table public.academy_courses alter column instructor_id drop not null;
alter table public.academy_courses add constraint academy_instructor_required
  check (instructor_id is not null or slug = 'cinematography-foundations');

-- This free course is available to signed-in students. Existing course access
-- still depends on the enrollment and instructor policies.
create policy academy_foundations_student_read on public.academy_lessons
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and not coalesce((select auth.jwt() ->> 'is_anonymous') = 'true', false)
    and exists (
      select 1
      from public.academy_modules m
      join public.academy_courses c on c.id = m.course_id
      where m.id = module_id and c.slug = 'cinematography-foundations' and c.status = 'published'
    )
  );

with course as (
  insert into public.academy_courses (slug, title, summary, category, status)
  values ('cinematography-foundations', 'Cinematography Foundations',
    'Plan, shoot, and edit a short scene with consistent framing, exposure, and continuity.',
    'Cinematography', 'published')
  returning id
), modules as (
  insert into public.academy_modules (course_id, title, position)
  select course.id, outline.title, outline.position
  from course cross join (values ('Plan and shoot', 0), ('Edit and review', 1)) outline(title, position)
  returning id, position
)
insert into public.academy_lessons (module_id, title, position, body)
select modules.id, lesson.title, lesson.position, lesson.body
from modules join (values
  (0, 'Plan a six-shot scene', 0, $lesson$Pick a simple action with a beginning, a change, and an ending. A character making tea, packing a bag, or setting down a prop is enough. Write one sentence about what you want the viewer to notice.

Draw six frames: an establishing shot, a medium action shot, two details, a reaction, and an ending. Under each frame, write where the camera goes and where the action enters or leaves the frame.

Practice: Read the plan without explaining it aloud. Revise any shot whose purpose is unclear.$lesson$),
  (0, 'Keep exposure and focus consistent', 1, $lesson$Set your first camera position and place your subject. Tap the subject to focus on a phone. If the camera supports exposure and focus lock, use it to avoid brightness and focus changes mid-shot. Review the brightest areas and the shadow detail before recording.

Repeat the check for each angle. Keep window light on the same side of the subject. If a close-up makes the image change brightness, match the neighboring shot before moving on.

Practice: Record two angles. Switch between them and adjust anything that makes the subject appear to move into different light.$lesson$),
  (0, 'Capture coverage that cuts together', 2, $lesson$Mark the direction of the action and keep the camera on one side of that line. Record the full action from the wide and medium positions. Start recording before the movement and hold a few seconds after it ends.

For the details and reaction, repeat the same action at the same pace. Watch hand positions and prop placement between takes. Record a few seconds of room sound to help smooth the cuts.

Practice: Lay the clips in order and find a movement that appears in two angles. Use that shared moment as a possible cut point.$lesson$),
  (1, 'Edit for attention and continuity', 0, $lesson$Cut the scene in order using the wide, medium, and detail shots first. Cut while a clear action is moving so the viewer follows the movement between framings. Add the reaction only where it changes what the viewer understands.

Watch the edit once with sound, then once muted. On the muted pass, look for jumps in direction, repeated action, or changes in brightness that distract from the scene.

Practice: Make one alternate cut using fewer shots. Compare the two versions and keep the one that tells the action most clearly.$lesson$),
  (1, 'Final project: deliver a 30–60 second scene', 1, $lesson$Film and edit your six-shot plan into a 30–60 second scene. Include an establishing shot, a readable action, at least one meaningful detail, and a clear ending.

Self-review: Can a first-time viewer explain what happened? Do the cuts preserve screen direction and the order of movement? Is the subject readable in every shot? Does each angle add something? Is the ending easy to identify?

Export your strongest version and keep the shot plan with it. No upload is required.$lesson$)
) lesson(module_position, title, position, body) on lesson.module_position = modules.position;
