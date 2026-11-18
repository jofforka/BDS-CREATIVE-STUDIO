(() => {
  'use strict';

  const title = document.getElementById('course-title');
  const summary = document.getElementById('course-summary');
  const category = document.getElementById('course-category');
  const section = document.getElementById('preview-lessons');
  const list = document.getElementById('preview-list');
  const start = document.getElementById('preview-start');
  const slug = new URLSearchParams(location.search).get('id');

  function renderExamples(examples) {
    const group = document.getElementById('lesson-examples');
    group.replaceChildren();
    group.hidden = true;
    if (!examples || !/^assets\/academy\/[\w.-]+\.jpg$/.test(examples.image) ||
        !Array.isArray(examples.frames)) return;

    const heading = document.createElement('h3');
    heading.textContent = examples.title;
    const grid = document.createElement('div');
    grid.className = 'example-grid';
    grid.classList.toggle('example-grid-pair', examples.frames.length === 2);

    for (const frame of examples.frames) {
      if (!Number.isInteger(frame.cell) || frame.cell < 0 || frame.cell > 4) continue;
      const figure = document.createElement('figure');
      const crop = document.createElement('div');
      crop.className = 'example-crop';
      const image = document.createElement('img');
      image.src = examples.image;
      image.alt = frame.alt;
      image.style.left = `-${(frame.cell % 3) * 100}%`;
      image.style.top = `-${Math.floor(frame.cell / 3) * 100}%`;
      crop.append(image);
      const caption = document.createElement('figcaption');
      const label = document.createElement('strong');
      label.textContent = frame.label;
      const context = document.createElement('p');
      context.textContent = frame.caption;
      caption.append(label, context);
      figure.append(crop, caption);
      grid.append(figure);
    }

    if (!grid.children.length) return;
    const note = document.createElement('p');
    note.className = 'example-note';
    note.textContent = 'AI-generated teaching stills';
    group.append(heading, grid, note);
    group.hidden = false;
  }

  function renderAssignment(assignment) {
    if (!assignment || !Array.isArray(assignment.shots) || !Array.isArray(assignment.checks)) return;

    const section = document.getElementById('film-assignment');
    const title = document.getElementById('assignment-title');
    title.textContent = assignment.title;
    document.getElementById('assignment-brief').textContent = assignment.brief;
    const shots = document.getElementById('assignment-shots');
    for (const shot of assignment.shots) {
      const item = document.createElement('li');
      item.textContent = shot;
      shots.append(item);
    }

    const review = document.getElementById('assignment-checks');
    const status = document.getElementById('assignment-status');
    const boxes = assignment.checks.map(check => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      label.append(input, document.createTextNode(check));
      review.append(label);
      return input;
    });
    function updateProgress() {
      const completed = boxes.filter(box => box.checked).length;
      status.textContent = completed === boxes.length
        ? 'Self-review complete. Keep your sequence and compare it with your next shoot.'
        : `${completed} of ${boxes.length} checked`;
    }
    review.addEventListener('change', updateProgress);
    updateProgress();
    section.hidden = false;

    const link = document.getElementById('lesson-assignment');
    link.addEventListener('click', () => title.focus({preventScroll: true}));
  }

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
      renderExamples(lesson.examples);
      check.textContent = typeof lesson.check === 'string' ? lesson.check : '';
      check.hidden = !check.textContent;
      buttons.forEach((button, i) => {
        if (i === index) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      });
      previous.disabled = index === 0;
      next.hidden = index === items.length - 1;
      document.getElementById('lesson-assignment').hidden = !next.hidden || document.getElementById('film-assignment').hidden;
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
    document.getElementById('full-course-invitation').hidden = course.slug !== 'demo-cinematography';
    renderAssignment(course.assignment);
    renderLessons(course.previewLessons);
  }

  loadCourse().catch(() => {
    summary.textContent = 'Course information is temporarily unavailable.';
  });
})();
