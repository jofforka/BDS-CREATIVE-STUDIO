(() => {
  'use strict';

  const title = document.getElementById('course-title');
  const summary = document.getElementById('course-summary');
  const category = document.getElementById('course-category');
  const section = document.getElementById('preview-lessons');
  const list = document.getElementById('preview-list');
  const start = document.getElementById('preview-start');
  const slug = new URLSearchParams(location.search).get('id');

  function renderLessons(lessons) {
    if (!Array.isArray(lessons)) return;

    const items = lessons.filter(lesson =>
      lesson && typeof lesson.title === 'string' && typeof lesson.text === 'string'
    );
    if (!items.length) return;

    const heading = document.getElementById('lesson-title');
    const position = document.getElementById('lesson-position');
    const text = document.getElementById('lesson-text');
    const check = document.getElementById('lesson-check');
    const previous = document.getElementById('lesson-prev');
    const next = document.getElementById('lesson-next');
    let current = 0;

    const buttons = items.map((lesson, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = lesson.title;
      button.addEventListener('click', () => showLesson(index, true));
      item.append(button);
      list.append(item);
      return button;
    });

    function showLesson(index, focus = false) {
      current = index;
      const lesson = items[index];
      position.textContent = `Lesson ${index + 1} of ${items.length}`;
      heading.textContent = lesson.title;
      text.textContent = lesson.text;
      check.textContent = typeof lesson.check === 'string' ? lesson.check : '';
      check.hidden = !check.textContent;
      buttons.forEach((button, i) => {
        if (i === index) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      });
      previous.disabled = index === 0;
      next.hidden = index === items.length - 1;
      if (focus) heading.focus();
    }

    previous.addEventListener('click', () => showLesson(current - 1, true));
    next.addEventListener('click', () => showLesson(current + 1, true));
    start.addEventListener('click', event => {
      event.preventDefault();
      showLesson(0, true);
    });

    const count = items.length;
    document.getElementById('preview-count').textContent = `Free preview · ${count} ${count === 1 ? 'lesson' : 'lessons'}`;
    document.getElementById('preview-actions').hidden = false;
    section.hidden = false;
    showLesson(0);
  }

  async function loadCourse() {
    if (!slug || !/^[a-z0-9-]{1,80}$/.test(slug)) {
      summary.textContent = 'Course not found.';
      return;
    }

    const response = await fetch('content/academy-catalog.json', {cache: 'no-store'});
    if (!response.ok) throw new Error('Catalog unavailable');

    const catalog = await response.json();
    const courses = Array.isArray(catalog.courses) ? catalog.courses : [];
    const course = courses.find(item => item?.published === true && item.slug === slug);
    if (!course) {
      summary.textContent = 'This course is not currently available.';
      return;
    }

    document.title = course.title + ' | BDS Academy';
    title.textContent = course.title;
    summary.textContent = course.summary;
    category.textContent = course.category;
    category.hidden = false;
    renderLessons(course.previewLessons);
  }

  loadCourse().catch(() => {
    summary.textContent = 'Course information is temporarily unavailable.';
  });
})();
