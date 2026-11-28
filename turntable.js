document.querySelectorAll('[data-turntable]').forEach(stage => {
  const root = stage.closest('[data-turntable-root]');
  if (root.hidden) return;
  const rotor = stage.querySelector('[data-turntable-rotor]');
  const control = root.querySelector('[data-turntable-control]');
  const name = root.dataset.turntableRoot;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const hero = name === 'motion';
  const speed = 360 / (hero ? 16000 : 18000);
  let angle = hero ? -10 : 0;
  let paused = false, requested = false;
  let frame = 0, last = 0;
  let start = null;

  function render() {
    rotor.style.transform = 'rotateY(' + angle + 'deg)';
  }

  function tick(now) {
    if (last) angle = (angle + (hero ? 1 : -1) * (now - last) * speed) % 360;
    last = now;
    render();
    frame = requestAnimationFrame(tick);
  }

  function update() {
    const enabled = !reduce.matches || requested;
    const running = enabled && !paused;
    root.dataset.motionState = running ? 'playing' : enabled ? 'paused' : 'off';
    control.textContent = (!enabled ? 'Play ' : paused ? 'Resume ' : 'Pause ') + name;
    root.classList.toggle('is-motion-paused', !running);
    root.classList.toggle('is-motion-requested', requested);
    cancelAnimationFrame(frame);
    last = 0;
    if (running && !document.hidden) frame = requestAnimationFrame(tick);
  }

  control.addEventListener('click', () => {
    if (reduce.matches && !requested) {
      requested = true;
      paused = false;
    } else {
      paused = !paused;
    }
    update();
  });
  reduce.addEventListener('change', () => {
    requested = false;
    if (reduce.matches) {
      angle = hero ? -10 : 0;
      render();
    }
    update();
  });
  document.addEventListener('visibilitychange', update);

  stage.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || root.dataset.motionState === 'off') return;
    start = {id: event.pointerId, x: event.clientX, y: event.clientY, angle};
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', event => {
    if (start?.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) > 6) {
      angle = (start.angle + dx * .65) % 360;
      render();
    }
  });
  stage.addEventListener('pointerup', event => {
    if (start?.id !== event.pointerId) return;
    if (Math.abs(event.clientX - start.x) < 6 && Math.abs(event.clientY - start.y) < 6) {
      angle = (angle + 30) % 360;
      render();
    }
    start = null;
  });
  stage.addEventListener('lostpointercapture', () => { start = null; });

  render();
  update();
  control.hidden = false;
});
