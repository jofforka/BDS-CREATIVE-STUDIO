const byId = id => document.getElementById(id);
const status = byId('learn-status');

function renderCourse(course, client, user, completed) {
  const outline = byId('learn-outline');
  const title = byId('learn-title');
  const previous = byId('learn-prev');
  const next = byId('learn-next');
  const lessons = [];
  let current = 0;
  let view = 0;
  const complete = byId('learn-complete');
  const content = byId('learn-body');
  const player = document.createElement('video');
  player.controls = true;
  player.preload = 'metadata';
  player.style.maxWidth = '100%';
  player.hidden = true;
  content.after(player);

  for (const module of course.academy_modules.sort((a, b) => a.position - b.position)) {
    const heading = document.createElement('h3');
    heading.textContent = module.title;
    const list = document.createElement('ol');
    for (const lesson of module.academy_lessons.sort((a, b) => a.position - b.position)) {
      const index = lessons.length;
      const row = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = lesson.title + (completed.has(lesson.id) ? ' (completed)' : '');
      button.addEventListener('click', () => showLesson(index, true));
      row.append(button);
      list.append(row);
      lessons.push({lesson, button});
    }
    outline.append(heading, list);
  }

  if (!lessons.length) throw new Error('No lessons available');

  function showLesson(index, focus = false) {
    current = index;
    const {lesson} = lessons[index];
    title.textContent = lesson.title;
    const request = ++view;
    byId('learn-position').textContent = `Lesson ${index + 1} of ${lessons.length} · ${completed.size} completed`;
    complete.disabled = completed.has(lesson.id);
    player.removeAttribute('src');
    player.load();
    player.hidden = true;
    if (lesson.video_asset_id) {
      client.storage.from('bds-learning').createSignedUrl(lesson.video_asset_id, 1800).then(({ data, error }) => {
        if (request !== view) return;
        if (error) { status.textContent = 'The lesson video could not load.'; return; }
        player.src = data.signedUrl;
        player.hidden = false;
      });
    }
    byId('learn-body').textContent = lesson.body;
    lessons.forEach(({button}, i) => {
      if (i === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    previous.disabled = index === 0;
    next.hidden = index === lessons.length - 1;
    if (focus) title.focus();
  }

  complete.addEventListener('click', async () => {
    const { lesson, button } = lessons[current];
    complete.disabled = true;
    const { error } = await client.from('academy_lesson_progress').upsert(
      { student_id: user.id, lesson_id: lesson.id },
      { onConflict: 'student_id,lesson_id', ignoreDuplicates: true }
    );
    if (error) {
      if (lessons[current].lesson.id === lesson.id) complete.disabled = false;
      status.textContent = 'Progress could not be saved. Please try again.';
      return;
    }
    completed.add(lesson.id);
    button.textContent = lesson.title + ' (completed)';
    byId('learn-position').textContent = `Lesson ${current + 1} of ${lessons.length} · ${completed.size} completed`;
    status.textContent = 'Progress saved.';
  });

  previous.addEventListener('click', () => showLesson(current - 1, true));
  next.addEventListener('click', () => showLesson(current + 1, true));
  status.textContent = course.summary;
  byId('learn-content').hidden = false;
  showLesson(0);
}

async function loadCourse() {
  const {supabaseUrl, supabasePublishableKey} = window.BDS_ACADEMY_CONFIG;
  const {createClient} = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const client = createClient(supabaseUrl, supabasePublishableKey, {auth:{flowType:'pkce'}});
  const {data: {user}, error} = await client.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') throw error;
  if (!user || user.is_anonymous) {
    status.textContent = 'Sign in or create a free student account to open the full course.';
    byId('learn-auth').hidden = false;
    return;
  }

  const slug = new URLSearchParams(location.search).get('id') || 'cinematography-foundations';
  const catalogue = await client.from('academy_courses').select('id,summary').eq('slug', slug).eq('status', 'published').maybeSingle();
  if (catalogue.error || !catalogue.data) throw Error('Course unavailable');
  const courseId = catalogue.data.id;
  const enrollment = await client.from('academy_enrollments').select('course_id').eq('course_id', courseId).eq('student_id', user.id).maybeSingle();
  if (enrollment.error) throw enrollment.error;
  if (!enrollment.data) {
    const enroll = byId('learn-enroll');
    status.textContent = catalogue.data.summary;
    enroll.hidden = false;
    enroll.addEventListener('click', async () => {
      enroll.disabled = true;
      const { error } = await client.from('academy_enrollments').upsert(
        { course_id: courseId, student_id: user.id }, { onConflict: 'student_id,course_id', ignoreDuplicates: true }
      );
      if (error) {
        status.textContent = 'Enrollment could not be saved. Please try again.';
        enroll.disabled = false;
      } else location.reload();
    });
    return;
  }
  const result = await client.from('academy_courses')
    .select('summary,academy_modules(title,position,academy_lessons(id,title,position,body,video_asset_id))')
    .eq('id', courseId).single();
  if (result.error) throw result.error;
  const ids = result.data.academy_modules.flatMap(module => module.academy_lessons.map(lesson => lesson.id));
  const progress = ids.length ? await client.from('academy_lesson_progress').select('lesson_id')
    .eq('student_id', user.id).in('lesson_id', ids) : { data: [] };
  if (progress.error) throw progress.error;
  renderCourse(result.data, client, user, new Set(progress.data.map(row => row.lesson_id)));
  await loadAssessments(client, courseId, user.id);
}

loadCourse().catch(() => {
  status.textContent = 'The course could not load. Return to the student portal and try again.';
});

async function loadAssessments(client, courseId, studentId) {
  const [result, submissions] = await Promise.all([
    client.from('academy_assessments')
      .select('id,title,instructions,kind,academy_assessment_questions(id,prompt,position,options)')
      .eq('course_id', courseId).eq('published', true).order('created_at'),
    client.from('academy_assignment_submissions')
      .select('assessment_id,status,academy_assignment_reviews(grade_percent,feedback)').eq('student_id', studentId)
  ]);
  if (result.error || submissions.error) throw Error('Assessments unavailable');
  const reviews = new Map(submissions.data.map(row => [row.assessment_id, row]));
  const list = byId('learn-assessment-list');
  byId('learn-assessments').hidden = false;
  if (!result.data.length) list.textContent = 'No assessments published.';
  for (const item of result.data) {
    const form = document.createElement('form');
    const heading = document.createElement('h3');
    heading.textContent = item.title;
    const instructions = document.createElement('p');
    instructions.textContent = item.instructions;
    form.append(heading, instructions);
    const existing = reviews.get(item.id);
    const review = existing?.academy_assignment_reviews;
    if (review && existing.status === 'reviewed') {
      const feedback = document.createElement('p');
      feedback.textContent = 'Grade: ' + review.grade_percent + '% · ' + review.feedback;
      form.append(feedback);
      list.append(form);
      continue;
    }

    if (item.kind === 'quiz') {
      for (const question of item.academy_assessment_questions.sort((a,b) => a.position-b.position)) {
        const group = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = question.prompt;
        group.append(legend);
        question.options.forEach((option, index) => {
          const label = document.createElement('label');
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = question.id;
          radio.value = index;
          radio.required = true;
          label.append(radio, document.createTextNode(' ' + option));
          group.append(label);
        });
        form.append(group);
      }
    } else {
      const label = document.createElement('label');
      label.textContent = 'Your assignment';
      const text = document.createElement('textarea');
      text.name = 'submission';
      text.maxLength = 20000;
      text.required = true;
      label.append(text);
      form.append(label);
    }
    const submit = document.createElement('button');
    submit.textContent = item.kind === 'quiz' ? 'Submit quiz' : 'Submit assignment';
    const feedback = document.createElement('p');
    feedback.setAttribute('role','status');
    if (existing) feedback.textContent = 'Assignment submitted. Awaiting review.';
    form.append(submit, feedback);
    list.append(form);
    let attempt;
    form.addEventListener('input', () => { attempt = null; });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      submit.disabled = true;
      attempt ??= crypto.randomUUID();
      const fields = new FormData(form);
      try {
        const { data, error } = item.kind === 'quiz' ? await client.rpc('academy_grade_quiz', {
          p_assessment: item.id, p_attempt: attempt,
          p_choices: Object.fromEntries([...fields].map(([id, value]) => [id, Number(value)]))
        }) : await client.rpc('academy_submit_assignment', { p_assessment: item.id, p_text: fields.get('submission') });
        if (error) throw error;
        feedback.textContent = item.kind === 'quiz' ?
          'Score ' + data.score_percent + '% · ' + (data.passed ? 'Passed' : 'Below passing score') : 'Assignment submitted.';
        attempt = null;
      } catch (error) { feedback.textContent = error.message; }
      finally { submit.disabled = false; }
    });
  }

  byId('learn-certificate').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    const output = byId('learn-certificate-status');
    try {
      const { data, error } = await client.rpc('academy_issue_certificate', { p_course: courseId });
      if (error) throw error;
      output.textContent = 'Certificate issued. Your certificate code is ' + data + '.';
    } catch (error) { output.textContent = error.message; }
    finally { button.disabled = false; }
  });
}
