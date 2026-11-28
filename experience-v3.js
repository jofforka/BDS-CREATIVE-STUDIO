(() => {
  const picker = document.getElementById('experience-picker');
  const service = document.getElementById('service');
  if (!picker || !service) return;

  const summary = picker.querySelector('summary');
  const options = picker.querySelector('#experience-grid');
  const title = summary.querySelector('.experience-current-name');
  const preview = summary.querySelector('img');
  const error = document.getElementById('experience-error');
  const buttons = new Map([...options.querySelectorAll('button[data-service]')].map(button => [button.dataset.service, button]));

  for (const [name, button] of buttons) button.setAttribute('aria-label', name);

  function sync() {
    const selected = buttons.get(service.value);
    for (const [value, button] of buttons) button.setAttribute('aria-pressed', String(value === service.value));
    title.textContent = service.value ? service.selectedOptions[0].textContent : 'Select a service';
    const image = selected?.querySelector('img');
    preview.hidden = !image;
    if (image) preview.src = image.getAttribute('src');
    else preview.removeAttribute('src');
    if (service.value) {
      summary.removeAttribute('aria-invalid');
      summary.removeAttribute('aria-describedby');
      error.hidden = true;
    }
  }

  function addRateCategories() {
    for (const option of service.options) {
      if (!option.value || buttons.has(option.value)) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'experience-card experience-text-option';
      button.dataset.service = option.value;
      const label = document.createElement('span');
      label.textContent = option.textContent;
      button.append(label);
      options.append(button);
      buttons.set(option.value, button);
    }
    sync();
  }

  options.addEventListener('click', event => {
    const button = event.target.closest('button[data-service]');
    if (!button) return;
    service.value = button.dataset.service;
    service.dispatchEvent(new Event('change', {bubbles: true}));
    picker.open = false;
    summary.focus();
  });
  picker.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !picker.open) return;
    event.preventDefault();
    picker.open = false;
    summary.focus();
  });
  document.addEventListener('pointerdown', event => {
    if (!picker.contains(event.target)) picker.open = false;
  });
  service.addEventListener('change', sync);
  service.addEventListener('invalid', event => {
    event.preventDefault();
    summary.setAttribute('aria-invalid', 'true');
    summary.setAttribute('aria-describedby', 'experience-error');
    error.hidden = false;
    picker.open = true;
    summary.focus();
  });

  const requested = new URLSearchParams(location.search).get('service');
  if ([...service.options].some(option => option.value && option.value === requested)) {
    service.value = requested;
    service.dispatchEvent(new Event('change', {bubbles: true}));
  }
  addRateCategories();
  new MutationObserver(addRateCategories).observe(service, {childList: true});
  service.hidden = true;
  document.querySelector('label[for="service"]').hidden = true;
  picker.hidden = false;
})();
