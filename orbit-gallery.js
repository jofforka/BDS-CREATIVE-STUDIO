(() => {
  const gallery = document.querySelector('.showcase-visual');
  if (!gallery) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let stage, pauseButton;
  let cards = [];
  let angle = 0, lastFrame = 0;
  let paused = false, visible = true, dirty = true;

  function updateButton() {
    if (pauseButton) pauseButton.textContent = paused ? 'Resume rotation' : 'Pause rotation';
  }

  function position() {
    if (!stage || !cards.length) return;
    dirty = false;
    const radiusX = Math.min(stage.clientWidth * .32, 340);
    const radiusY = Math.min(stage.clientHeight * .32, 175);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    cards.forEach((card, index) => {
      const latitude = 1 - 2 * (index + .5) / cards.length;
      const ring = Math.sqrt(1 - latitude * latitude);
      const longitude = index * goldenAngle + angle;
      const x = Math.cos(longitude) * ring;
      const z = Math.sin(longitude) * ring;
      const scale = .54 + (z + 1) * .19;
      card.style.transform = `translate(-50%, -50%) translate3d(${x * radiusX}px, ${latitude * radiusY}px, ${z * 260}px) scale(${scale})`;
      card.style.zIndex = String(Math.round((z + 1) * 100));
      card.style.opacity = String(.33 + (z + 1) * .33);
      card.style.filter = `brightness(${.58 + (z + 1) * .21})`;
    });
  }

  function animate(now) {
    const elapsed = lastFrame ? now - lastFrame : 0;
    lastFrame = now;
    const moving = stage && !paused && visible && !document.hidden
      && !stage.matches(':focus-within') && !document.querySelector('.portfolio-viewer[open]');
    if (moving) angle = (angle + elapsed * (reduce.matches ? .00015 : .00025)) % (2 * Math.PI);
    if (moving || dirty) position();
    requestAnimationFrame(animate);
  }

  function setup() {
    const grid = gallery.querySelector('.portfolio-grid');
    if (!grid || grid === stage) return;
    stage = grid;
    stage.classList.add('orbit-stage');

    const toolbar = document.createElement('div');
    toolbar.className = 'orbit-toolbar';
    pauseButton = document.createElement('button');
    pauseButton.type = 'button';
    pauseButton.className = 'orbit-control';
    updateButton();
    pauseButton.addEventListener('click', () => {
      paused = !paused;
      updateButton();
    });
    toolbar.append(pauseButton);
    stage.after(toolbar);

    const updateCards = () => {
      cards = [...stage.querySelectorAll('.portfolio-project')];
      dirty = true;
      position();
    };
    new MutationObserver(updateCards).observe(stage,{childList:true});
    updateCards();
  }

  new MutationObserver(setup).observe(gallery,{childList:true});
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(gallery);
  document.addEventListener('visibilitychange', () => { lastFrame = 0; });
  window.addEventListener('resize', () => { dirty = true; }, {passive:true});
  setup();
  requestAnimationFrame(animate);
})();
