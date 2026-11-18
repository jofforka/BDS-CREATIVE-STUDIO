const byId = id => document.getElementById(id);
const status = byId('learn-status');

function renderCourse(course) {
  const outline = byId('learn-outline');
  const title = byId('learn-title');
  const previous = byId('learn-prev');
  const next = byId('learn-next');
  const lessons = [];
  let current = 0;

  for (const module of course.academy_modules.sort((a, b) => a.position - b.position)) {
    const heading = document.createElement('h3');
    heading.textContent = module.title;
    const list = document.createElement('ol');
    for (const lesson of module.academy_lessons.sort((a, b) => a.position - b.position)) {
      const index = lessons.length;
      const row = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = lesson.title;
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
    byId('learn-position').textContent = `Lesson ${index + 1} of ${lessons.length}`;
    byId('learn-body').textContent = lesson.body;
    lessons.forEach(({button}, i) => {
      if (i === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    previous.disabled = index === 0;
    next.hidden = index === lessons.length - 1;
    if (focus) title.focus();
  }

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

  const result = await client.from('academy_courses')
    .select('summary,academy_modules(title,position,academy_lessons(title,position,body))')
    .eq('slug', 'cinematography-foundations')
    .eq('status', 'published')
    .single();
  if (result.error) throw result.error;
  renderCourse(result.data);
}

loadCourse().catch(() => {
  status.textContent = 'The course could not load. Return to the student portal and try again.';
});
