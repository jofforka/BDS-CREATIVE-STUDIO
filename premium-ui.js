(() => {
'use strict';
const header=document.querySelector('.site-header');
const top=document.createElement('button');top.type='button';top.className='bds-back-top';top.setAttribute('aria-label','Back to top');top.title='Back to top';top.textContent='↑';document.body.append(top);
const nav=document.querySelector('.site-nav'),toggle=document.querySelector('.menu-toggle');
const closeMenu=()=>{nav?.classList.remove('open');toggle?.setAttribute('aria-expanded','false');toggle?.setAttribute('aria-label','Open navigation')};
const update=()=>{const y=window.scrollY;header?.classList.toggle('is-scrolled',y>28);top.classList.toggle('is-visible',y>650)};
window.addEventListener('scroll',update,{passive:true});update();
top.addEventListener('click',()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&toggle?.getAttribute('aria-expanded')==='true'){closeMenu();toggle.focus()}});
document.addEventListener('pointerdown',event=>{if(toggle?.getAttribute('aria-expanded')==='true'&&!nav?.contains(event.target)&&!toggle.contains(event.target))closeMenu()});
nav?.querySelectorAll('a').forEach(link=>{
 try{const url=new URL(link.href);const page=location.pathname.split('/').pop()||'index.html';if(url.pathname.split('/').pop()===page&&!url.hash)link.setAttribute('aria-current','page')}catch{}
});
})();
(()=>{'use strict';const h=document.querySelector('#hero-heading'),hero=document.querySelector('.hero');if(!h||!hero)return;const mq=matchMedia('(prefers-reduced-motion: reduce)');const label=h.textContent.replace(/\s+/g,' ').trim();h.setAttribute('aria-label','Stories worth feeling.');let i=0;for(const el of h.querySelectorAll('.hero-motion-line,.hero-motion-word')){const value=el.textContent;el.replaceChildren();el.setAttribute('aria-hidden','true');for(const ch of value){const span=document.createElement('span');span.className='bds-letter';span.style.setProperty('--letter-index',String(i++));span.textContent=ch;el.append(span)}}const button=document.createElement('button');button.type='button';button.className='bds-motion-control';hero.append(button);let paused=false;function update(){const off=paused||mq.matches||document.hidden;document.body.classList.toggle('bds-motion-off',off);button.textContent=paused?'Play motion':'Pause motion';button.setAttribute('aria-pressed',String(paused));button.hidden=mq.matches}button.addEventListener('click',()=>{paused=!paused;update()});document.addEventListener('visibilitychange',update);if(mq.addEventListener)mq.addEventListener('change',update);update()})();
