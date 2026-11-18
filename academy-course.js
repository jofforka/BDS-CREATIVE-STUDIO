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

    for (const lesson of lessons) {
      if (!lesson || typeof lesson.title !== 'string' || typeof lesson.text !== 'string') continue;

      const item = document.createElement('li');
      const details = document.createElement('details');
      const heading = document.createElement('summary');
      const body = document.createElement('p');
      heading.textContent = lesson.title;
      body.textContent = lesson.text;
      details.open = list.children.length === 0;
      details.append(heading, body);
      item.append(details);
      list.append(item);
    }

    if (list.children.length) {
      section.hidden = false;
      start.hidden = false;
    }
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
