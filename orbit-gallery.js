(() => {
  'use strict';
  const gallery = document.querySelector('.showcase-gallery');
  if (!gallery) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let stage = null, controls = null, angle = 0, last = 0, frame = 0, paused = reduce.matches;
  let cards = [], holding = false;
  const makeButton = (label, text) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'orbit-control';
    button.setAttribute('aria-label',label);button.textContent = text;return button;
  };
  const position = () => {
    if (!stage || !cards.length) return;
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
    if (!paused && !holding && !document.hidden && !document.querySelector('.portfolio-viewer[open]')) angle+=dt*.00015;
    position();frame=requestAnimationFrame(animate);
  };
  const setup = () => {
    const grid=gallery.querySelector('.portfolio-grid');
    if(!grid || grid===stage)return;
    if(stage)stage.classList.remove('orbit-stage');
    stage=grid;stage.classList.add('orbit-stage');
    if(controls)controls.remove();
    controls=document.createElement('div');controls.className='orbit-toolbar';
    const prev=makeButton('Rotate gallery left','←');
    const pause=makeButton('Pause gallery rotation',paused?'Play rotation':'Pause rotation');
    const next=makeButton('Rotate gallery right','→');
    const status=document.createElement('span');status.textContent='ROTATING 3D GLOBE · SELECT ANY PROJECT TO EXPLORE';
    prev.addEventListener('click',()=>{angle-=Math.PI/3;position()});
    next.addEventListener('click',()=>{angle+=Math.PI/3;position()});
    pause.addEventListener('click',()=>{paused=!paused;pause.textContent=paused?'Play rotation':'Pause rotation';pause.setAttribute('aria-label',paused?'Play gallery rotation':'Pause gallery rotation')});
    controls.append(prev,pause,next,status);stage.after(controls);
    stage.addEventListener('pointerdown',()=>{holding=true});
    window.addEventListener('pointerup',()=>{holding=false});
    window.addEventListener('pointercancel',()=>{holding=false});
    window.addEventListener('blur',()=>{holding=false});
    const observer=new MutationObserver(()=>{cards=Array.from(stage.children).filter(el=>el.classList.contains('portfolio-project'));position()});
    observer.observe(stage,{childList:true});
    cards=Array.from(stage.children).filter(el=>el.classList.contains('portfolio-project'));position();
  };
  const watch=new MutationObserver(()=>setup());
  watch.observe(gallery,{childList:true,subtree:false});
  reduce.addEventListener?.('change',event=>{paused=event.matches;if(controls){const button=controls.children[1];button.textContent=paused?'Play rotation':'Pause rotation';button.setAttribute('aria-label',paused?'Play gallery rotation':'Pause gallery rotation')}});
  window.addEventListener('resize',position,{passive:true});
  setup();frame=requestAnimationFrame(animate);
})();
