(() => {
  'use strict';
  const section = document.querySelector('.showcase-visual');
  const department = document.body.dataset.department;
  if (!section || !['photography','film','sound'].includes(department)) return;
  const heroVisual = document.querySelector('.showcase-visual');
  const allowedTypes = {photography:['image'],film:['video','image'],sound:['audio','video','image']};
  const safeMedia = value => typeof value === 'string' && (/^assets\/(?:portfolio|imagery)\/[a-z0-9/_-]+\.(jpg|jpeg|png|webp|mp4|mp3|ogg)$/i.test(value) || /^https:\/\/[^\s]+$/i.test(value));
  const safeExternal = value => {
    if (typeof value !== 'string') return null;
    try {const url = new URL(value);return url.protocol === 'https:' && url.username === '' && url.password === '' ? url.href : null;} catch {return null;}
  };
  const make = (tag, className, text) => {const el=document.createElement(tag);if(className)el.className=className;if(text)el.textContent=text;return el;};
  let lastTrigger=null;
  const viewer = document.createElement('dialog');
  viewer.className = 'portfolio-viewer';
  viewer.setAttribute('aria-label','Project media viewer');
  const close = make('button','viewer-close','Close ×');close.type='button';close.addEventListener('click',()=>viewer.close());
  const viewerContent = make('div','viewer-content');
  viewer.append(close,viewerContent);
  viewer.addEventListener('click',event=>{if(event.target===viewer)viewer.close()});
  viewer.addEventListener('close',()=>{viewerContent.replaceChildren();lastTrigger?.focus();});
  document.body.append(viewer);
  const mediaFor = (project,preview=false) => {
    const type=project.type,src=project.media;
    if(!safeMedia(src))return null;
    let element;
    if(type==='image'){element=document.createElement('img');element.src=src;element.alt=project.alt||project.title;element.loading=preview?'lazy':'eager';}
    else if(type==='video'){element=document.createElement('video');element.src=src;element.controls=!preview;element.muted=preview;element.playsInline=true;element.preload='metadata';if(preview && safeMedia(project.poster))element.poster=project.poster;}
    else if(type==='audio'){if(preview){element=make('div','audio-preview','♫');element.setAttribute('aria-hidden','true');}else{element=document.createElement('audio');element.src=src;element.controls=true;element.preload='none';}}
    return element;
  };
  const displayProject = project => {
    viewerContent.replaceChildren();
    const media=mediaFor(project);if(media)viewerContent.append(media);
    if(project.demo===true)viewerContent.append(make('p','viewer-demo-label','Concept media'));viewerContent.append(make('h2','',project.title));
    if(project.description)viewerContent.append(make('p','',project.description));
    const url=safeExternal(project.sourceUrl);
    if(url){const link=make('a','source-link','View original publication ↗');link.href=url;link.target='_blank';link.rel='noopener noreferrer';viewerContent.append(link);}
    lastTrigger=document.activeElement;viewer.showModal();
  };
  const render = content => {
    if(!content || !Array.isArray(content.projects))return;
    const projects=content.projects.filter(p=>p && p.published===true && p.department===department && typeof p.title==='string' && p.title.length>0 && allowedTypes[department].includes(p.type) && safeMedia(p.media));
    const main=content.departmentHeroes?.[department];
    if(main && safeMedia(main.media) && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(main.media)){
      heroVisual.style.backgroundImage='url("'+main.media.replace(/["\\]/g,'')+'")';
      heroVisual.classList.add('has-custom-hero');
      heroVisual.setAttribute('aria-label',main.alt||department+' department featured image');
    }
    if(projects.length){
      const categories=[...new Set(projects.map(p=>p.category).filter(c=>typeof c==='string'&&c.length<50))];
      const filters=make('div','filter-tabs');filters.setAttribute('aria-label','Filter projects');
      const gallery=make('div','portfolio-grid');gallery.setAttribute('aria-live','polite');
      const show=category=>{
        gallery.replaceChildren();
        projects.filter(p=>category==='All'||p.category===category).forEach(project=>{
          const card=make('button','portfolio-project');card.type='button';card.setAttribute('aria-label','Open '+project.title);
          const frame=make('div','project-frame');const media=mediaFor(project,true);if(media)frame.append(media);if(project.demo===true)frame.append(make('span','demo-chip','Concept'));
          const details=make('div','project-details');details.append(make('span','',project.category||department),make('strong','',project.title),make('span','',''));
          details.lastElementChild.textContent='↗';card.append(frame,details);card.addEventListener('click',()=>displayProject(project));gallery.append(card);
        });
        filters.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===category)));
      };
      for(const category of ['All',...categories]){
        const button=make('button','',category);button.type='button';button.dataset.filter=category;button.addEventListener('click',()=>show(category));filters.append(button);
      }
      heroVisual.classList.add('has-portfolio');
      heroVisual.removeAttribute('role');
      heroVisual.removeAttribute('aria-label');
      heroVisual.append(gallery,filters);
      show('All');
    }
  };
  fetch('content/portfolio.json',{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error('Portfolio content unavailable');return response.json()}).then(render).catch(()=>{ /* Keep the honest empty state; never show unverified projects. */ });
})();
