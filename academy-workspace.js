(()=>{'use strict';const tabs=[...document.querySelectorAll('[data-panel]')];for(const tab of tabs){tab.addEventListener('click',()=>{for(const item of tabs){const selected=item===tab;item.setAttribute('aria-pressed',String(selected));document.getElementById('panel-'+item.dataset.panel).hidden=!selected}})}const form=document.getElementById('course-outline'),preview=document.getElementById('course-preview');form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;const data=Object.fromEntries(new FormData(form));let draft;try{draft=window.BDSCourseModel.buildCourse(data)}catch(error){preview.hidden=false;preview.textContent=error.message;return}const outcome=draft.outcomes,modules=draft.modules.map(m=>m.title);preview.hidden=false;preview.textContent=['LOCAL VALIDATED DRAFT — NOT SAVED OR PUBLISHED','',draft.title,'Discipline: '+draft.category,'','Overview:',draft.summary,'','Learning outcomes:',...(outcome.length?outcome.map((s,i)=>(i+1)+'. '+s):['Not specified']),'','Course modules:',...(modules.length?modules.map((s,i)=>(i+1)+'. '+s):['Not specified'])].join('\n');preview.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'})})})();
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('course-outline');
  const manager = $('lesson-editor');
  const course = $('managed-course');
  const module = manager.elements.module;
  const lessons = manager.elements.lesson;
  const status = $('course-save-status');
  let courses = [];

  async function run(operation) {
    try {
      const client = await window.BDSAcademyClient();
      if (!(await client.auth.getUser()).data.user) throw Error('Sign in through the Academy portal first.');
      await operation(client);
    } catch (error) { status.textContent = error.message; }
  }

  function chooseCourse() {
    const active = courses.find(row => row.id === course.value);
    module.replaceChildren(...(active?.academy_modules || []).map(row => new Option(row.title, row.id)));
    chooseModule();
  }

  function chooseModule() {
    const active = courses.find(row => row.id === course.value)?.academy_modules.find(row => row.id === module.value);
    lessons.replaceChildren(new Option('New lesson', ''), ...(active?.academy_lessons || []).map(row => new Option(row.title, row.id)));
    chooseLesson();
  }

  function chooseLesson() {
    const active = courses.find(row => row.id === course.value)?.academy_modules.find(row => row.id === module.value);
    const lesson = active?.academy_lessons.find(row => row.id === lessons.value);
    manager.elements.title.value = lesson?.title || '';
    manager.elements.body.value = lesson?.body || '';
    manager.elements.video.value = '';
  }

  async function load(client, selected = course.value) {
    const result = await client.from('academy_courses')
      .select('id,title,status,academy_modules(id,title,academy_lessons(id,title,body,position,video_asset_id))')
      .order('title');
    if (result.error) throw result.error;
    courses = result.data;
    course.replaceChildren(...courses.map(row => new Option(row.title + ' · ' + row.status, row.id)));
    if (courses.some(row => row.id === selected)) course.value = selected;
    chooseCourse();
  }

  $('academy-load-courses').addEventListener('click', () => run(load));
  course.addEventListener('change', chooseCourse);
  module.addEventListener('change', chooseModule);
  lessons.addEventListener('change', chooseLesson);

  $('academy-save-draft').addEventListener('click', event => {
    if (!form.reportValidity()) return;
    const button = event.currentTarget;
    button.disabled = true;
    run(async client => {
      const draft = window.BDSCourseModel.buildCourse(Object.fromEntries(new FormData(form)));
      const summary = [draft.summary, ...draft.outcomes.map(outcome => '• ' + outcome)].join('\n');
      const result = await client.rpc('academy_save_course_draft', {
        p_slug: draft.slug, p_title: draft.title, p_category: draft.category, p_summary: summary,
        p_modules: draft.modules.map(row => row.title)
      });
      if (result.error) throw result.error;
      await load(client, result.data);
      status.textContent = 'Course draft saved.';
    }).finally(() => { button.disabled = false; });
  });

  manager.addEventListener('submit', event => {
    event.preventDefault();
    const button = manager.querySelector('button[type=submit]');
    button.disabled = true;
    run(async client => {
      const active = courses.find(row => row.id === course.value)?.academy_modules.find(row => row.id === module.value);
      if (!active) throw Error('Select a course and module.');
      const payload = { title: manager.elements.title.value.trim(), body: manager.elements.body.value.trim() };
      const video = manager.elements.video.files[0];
      if (video) {
        if (video.type !== 'video/mp4' || video.size > 52428800) throw Error('Choose an MP4 no larger than 50 MiB.');
        const path = crypto.randomUUID() + '.mp4';
        const upload = await client.storage.from('bds-learning').upload(path, video);
        if (upload.error) throw upload.error;
        payload.video_asset_id = path;
      }
      const table = client.from('academy_lessons');
      const result = lessons.value ? await table.update(payload).eq('id', lessons.value).select('id').single() :
        await table.insert({ ...payload, module_id: active.id,
          position: 1 + Math.max(-1, ...active.academy_lessons.map(row => row.position)) }).select('id').single();
      if (result.error) throw result.error;
      await load(client);
      status.textContent = 'Lesson saved.';
    }).finally(() => { button.disabled = false; });
  });

  for (const [id, state] of [['academy-publish-course', 'published'], ['academy-archive-course', 'archived']]) {
    $(id).addEventListener('click', () => run(async client => {
      if (!course.value) throw Error('Select a course.');
      if (state === 'archived' && !confirm('Archive this course and remove student access?')) return;
      const result = await client.rpc('academy_set_course_status', { p_course: course.value, p_status: state });
      if (result.error) throw result.error;
      await load(client);
      status.textContent = 'Course ' + state + '.';
    }));
  }
})();
