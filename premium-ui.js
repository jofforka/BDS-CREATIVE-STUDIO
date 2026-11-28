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

(() => {
  const hero = document.querySelector('.studio-home .hero');
  if (!hero) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const resetPointer = () => {
    for (const name of ['--hero-shift-x','--hero-shift-y','--hero-light-x','--hero-light-y','--film-tilt-x','--film-tilt-y']) {
      hero.style.removeProperty(name);
    }
  };
  hero.addEventListener('pointermove', event => {
    if (reduceMotion.matches || hero.dataset.motionState !== 'playing' || event.pointerType === 'touch') return;
    const bounds = hero.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    hero.style.setProperty('--hero-shift-x', ((x - .5) * -18).toFixed(2) + 'px');
    hero.style.setProperty('--hero-shift-y', ((y - .5) * -14).toFixed(2) + 'px');
    hero.style.setProperty('--hero-light-x', (57 + x * 32).toFixed(1) + '%');
    hero.style.setProperty('--hero-light-y', (27 + y * 32).toFixed(1) + '%');
    hero.style.setProperty('--film-tilt-x', ((.5 - y) * 18).toFixed(2) + 'deg');
    hero.style.setProperty('--film-tilt-y', ((x - .5) * 23).toFixed(2) + 'deg');
  }, {passive:true});
  hero.addEventListener('pointerleave', resetPointer);
  hero.addEventListener('pointercancel', resetPointer);
  reduceMotion.addEventListener('change', resetPointer);
  hero.querySelector('[data-turntable-control]').addEventListener('click', resetPointer);
})();
