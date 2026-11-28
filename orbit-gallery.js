(() => {
  'use strict';
  const gallery = document.querySelector('.showcase-visual');
  if (!gallery) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let stage = null, controls = null, angle = 0, last = 0, frame = 0, paused = true;
  let isOrbit = false;
  let cards = [], holding = false, visible = true, focused = false, dirty = true;
  const makeButton = (label, text) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'orbit-control';
    button.setAttribute('aria-label',label);button.textContent = text;return button;
  };
  const position = () => {
    if (!isOrbit || !stage || !cards.length) return;
    dirty=false;
    const width=stage.clientWidth, height=stage.clientHeight;
    const radiusX=Math.min(width*.32,340), radiusY=Math.min(height*.32,175);
    const n=cards.length;
    // Fibonacci sphere: even distribution over the entire globe, not a flat ring.
    const goldenAngle=Math.PI*(3-Math.sqrt(5));
    cards.forEach((card,index)=>{
      const latitude=1-2*(index+.5)/n;
      const ring=Math.sqrt(Math.max(0,1-latitude*latitude));
      const longitude=index*goldenAngle+angle;
      const x=Math.cos(longitude)*ring;
      const z=Math.sin(longitude)*ring;
      const y=latitude;
      const scale=.54+(z+1)*.19;
      const dx=x*radiusX,dy=y*radiusY;
      card.style.transform='translate(-50%,-50%) translate3d('+dx.toFixed(2)+'px,'+dy.toFixed(2)+'px,'+(z*260).toFixed(2)+'px) scale('+scale.toFixed(3)+')';
      card.style.zIndex=String(Math.round((z+1)*100));
      card.style.opacity=String(.33+(z+1)*.33);
      card.style.filter='brightness('+(0.58+(z+1)*.21).toFixed(2)+')';
    });
  };
  const animate = now => {
    const dt=last?Math.min(now-last,60):0;last=now;
    const moving=!paused&&!holding&&!focused&&visible&&!document.hidden&&!document.querySelector('.portfolio-viewer[open]');
    if(moving)angle+=dt*.00015;
    if(moving||dirty)position();
    frame=requestAnimationFrame(animate);
  };
  const setup = () => {
    const grid=gallery.querySelector('.portfolio-grid');
    if(!grid || grid===stage)return;
    if(stage)stage.classList.remove('orbit-stage');
    stage=grid;
    stage.classList.toggle('orbit-stage',isOrbit);dirty=true;
    if(controls)controls.remove();
    controls=document.createElement('div');controls.className='orbit-toolbar';
    const prev=makeButton('Rotate gallery left','←');
    const pause=makeButton('Play gallery rotation','Play rotation');
    const next=makeButton('Rotate gallery right','→');
    prev.addEventListener('click',()=>{angle-=Math.PI/3;dirty=true;position()});
    next.addEventListener('click',()=>{angle+=Math.PI/3;dirty=true;position()});
    pause.addEventListener('click',()=>{paused=!paused;pause.textContent=paused?'Play rotation':'Pause rotation';pause.setAttribute('aria-label',paused?'Play gallery rotation':'Pause gallery rotation')});
    const view=makeButton('3D gallery view','3D view');
    view.setAttribute('aria-pressed',String(isOrbit));
    const rotation=[prev,pause,next];
    rotation.forEach(button=>button.hidden=!isOrbit);
    view.addEventListener('click',()=>{
      isOrbit=!isOrbit;
      stage.classList.toggle('orbit-stage',isOrbit);
      view.setAttribute('aria-pressed',String(isOrbit));
      rotation.forEach(button=>button.hidden=!isOrbit);
      if(isOrbit){
        dirty=true;
        last=0;
        position();
        frame=requestAnimationFrame(animate);
      }else{
        cancelAnimationFrame(frame);
        paused=true;
        pause.textContent='Play rotation';
        pause.setAttribute('aria-label','Play gallery rotation');
        cards.forEach(card=>['transform','z-index','opacity','filter'].forEach(property=>card.style.removeProperty(property)));
      }
    });
    controls.append(view,prev,pause,next);stage.after(controls);
    stage.addEventListener('pointerdown',()=>{holding=true});
    stage.addEventListener('focusin',()=>{focused=true});
    stage.addEventListener('focusout',()=>{focused=false});
    window.addEventListener('pointerup',()=>{holding=false});
    window.addEventListener('pointercancel',()=>{holding=false});
    window.addEventListener('blur',()=>{holding=false});
    const observer=new MutationObserver(()=>{cards=Array.from(stage.children).filter(el=>el.classList.contains('portfolio-project'));dirty=true;position()});
    observer.observe(stage,{childList:true});
    cards=Array.from(stage.children).filter(el=>el.classList.contains('portfolio-project'));position();
  };
  const watch=new MutationObserver(()=>setup());
  watch.observe(gallery,{childList:true,subtree:false});
  reduce.addEventListener?.('change',event=>{if(!event.matches)return;paused=true;if(controls){const button=controls.children[2];button.textContent=paused?'Play rotation':'Pause rotation';button.setAttribute('aria-label',paused?'Play gallery rotation':'Pause gallery rotation')}});
  const visibilityObserver=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;dirty=true},{threshold:0});
  visibilityObserver.observe(gallery);
  window.addEventListener('resize',()=>{dirty=true;position()},{passive:true});
  setup();
})();
