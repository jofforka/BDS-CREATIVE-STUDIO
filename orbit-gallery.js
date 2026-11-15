(() => {
  'use strict';
  const gallery = document.querySelector('.showcase-gallery');
  if (!gallery) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let stage = null, controls = null, angle = 0, last = 0, frame = 0, paused = reduce.matches;
  let cards = [], hovered = false, focused = false;
  const makeButton = (label, text) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'orbit-control';
    button.setAttribute('aria-label',label);button.textContent = text;return button;
  };
  const position = () => {
    if (!stage || !cards.length) return;
    const width=stage.clientWidth, height=stage.clientHeight;
    const radiusX=Math.min(width*.32,360), radiusY=Math.min(height*.19,90);
    cards.forEach((card,index)=>{
      const theta=angle+index*2*Math.PI/cards.length;
      const depth=Math.cos(theta);
      const x=Math.sin(theta)*radiusX;
      const y=-Math.sin(theta)*radiusY;
      const scale=.73+(depth+1)*.135;
      card.style.transform='translate(-50%,-50%) translate3d('+x.toFixed(2)+'px,'+y.toFixed(2)+'px,'+(depth*210).toFixed(2)+'px) scale('+scale.toFixed(3)+')';
      card.style.zIndex=String(Math.round((depth+1)*100));
      card.style.opacity=String(.56+(depth+1)*.22);
    });
  };
  const animate = now => {
    const dt=last?Math.min(now-last,60):0;last=now;
    if (!paused && !hovered && !focused && !document.hidden && !gallery.querySelector('.portfolio-viewer[open]')) angle+=dt*.00015;
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
    const status=document.createElement('span');status.textContent='DRAG-FREE 360° SHOWCASE · SELECT TO EXPLORE';
    prev.addEventListener('click',()=>{angle-=Math.PI/3;position()});
    next.addEventListener('click',()=>{angle+=Math.PI/3;position()});
    pause.addEventListener('click',()=>{paused=!paused;pause.textContent=paused?'Play rotation':'Pause rotation';pause.setAttribute('aria-label',paused?'Play gallery rotation':'Pause gallery rotation')});
    controls.append(prev,pause,next,status);stage.after(controls);
    stage.addEventListener('mouseenter',()=>{hovered=true});
    stage.addEventListener('mouseleave',()=>{hovered=false});
    stage.addEventListener('focusin',()=>{focused=true});
    stage.addEventListener('focusout',()=>{focused=stage.contains(document.activeElement)});
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
