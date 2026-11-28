(() => {
  const services = {
    photography: {
      title: 'Photography',
      booking: 'Photography',
      description: 'Portraits, editorials and celebrations, photographed with intention.',
      detail: ['Photography showcase', 'photography.html'],
      frames: ['photography', 'nigerian-wedding', 'branding', 'content-creation', 'cinematography'],
    },
    'music-production': {
      title: 'Music production',
      booking: 'Audio Recording & Production',
      description: 'Studio recording, production and mixing for music, spoken word and podcasts.',
      detail: ['Sound showcase', 'sound.html'],
      frames: ['music-production', 'cinematography', 'content-creation', 'academy', 'photography'],
    },
    'content-creation': {
      title: 'Content creation',
      booking: 'Content Studio',
      description: 'A studio for product stories, social content and creator-led shoots.',
      frames: ['content-creation', 'branding', 'cinematography', 'photography', 'music-production'],
    },
    weddings: {
      title: 'Pre-wedding photography',
      booking: 'Pre-wedding Photography',
      description: 'Portraits for the two of you, with room for the traditions that matter to you.',
      detail: ['Photography showcase', 'photography.html'],
      frames: ['nigerian-wedding', 'photography', 'cinematography', 'branding', 'content-creation'],
    },
    cinematography: {
      title: 'Cinematography',
      booking: 'Video & Cinematography',
      description: 'Films for events, campaigns and stories that deserve to be seen in motion.',
      detail: ['Film showcase', 'film.html'],
      frames: ['cinematography', 'photography', 'content-creation', 'music-production', 'academy'],
    },
    branding: {
      title: 'Branding',
      booking: 'Branding & Creative Production',
      description: 'Visual direction, image-making and production for brands with a clear point of view.',
      detail: ['Creative direction', 'brand.html'],
      frames: ['branding', 'content-creation', 'photography', 'cinematography', 'music-production'],
    },
    academy: {
      title: 'BDS Academy',
      booking: 'BDS Academy',
      description: 'Hands-on training in photography, filmmaking, editing and sound.',
      detail: ['Browse courses', 'academy.html'],
      frames: ['academy', 'photography', 'cinematography', 'music-production', 'content-creation'],
    },
  };

  const key = new URLSearchParams(location.search).get('service');
  if (!Object.hasOwn(services, key)) return;

  const service = services[key];
  const gallery = document.querySelector('.service-gallery');
  const rotor = gallery.querySelector('.service-rotor');
  const control = gallery.querySelector('.studio-pause');
  document.title = service.title + ' | BDS Creative Studios';
  document.querySelector('#service-title').textContent = service.title;
  document.querySelector('#service-description').textContent = service.description;
  document.querySelector('#studio-booking').href = 'booking.html?' + new URLSearchParams({service: service.booking});

  if (service.detail) {
    const link = document.querySelector('.studio-detail');
    const [label, href] = service.detail;
    link.textContent = label;
    link.href = href;
    link.hidden = false;
  }

  service.frames.forEach((frame, index) => {
    const image = document.createElement('img');
    image.className = 'service-frame';
    image.alt = '';
    image.width = 960;
    image.height = 640;
    image.decoding = 'async';
    image.srcset = 'assets/imagery/' + frame + '-480.webp 480w, assets/imagery/' + frame + '.webp 960w';
    image.sizes = '(max-width: 700px) 62vw, 480px';
    image.src = 'assets/imagery/' + frame + '-480.webp';
    image.style.setProperty('--frame-angle', index * 360 / service.frames.length + 'deg');
    if (index === 0) image.fetchPriority = 'high';
    rotor.append(image);
  });
  gallery.hidden = false;

})();
