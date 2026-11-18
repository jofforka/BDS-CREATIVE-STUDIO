(()=>{'use strict';const title=document.getElementById('course-title'),summary=document.getElementById('course-summary'),details=document.getElementById('course-details');const id=new URLSearchParams(location.search).get('id');if(!id||!/^[a-z0-9-]{1,80}$/.test(id)){summary.textContent='Course not found.';return}fetch('content/academy-catalog.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('unavailable');return r.json()}).then(d=>{const c=(Array.isArray(d.courses)?d.courses:[]).find(c=>c.published===true&&c.slug===id);if(!c){summary.textContent='This course is not currently available.';return}document.title=c.title+' | BDS Academy';title.textContent=c.title;summary.textContent=c.summary;const p=document.createElement('p');p.textContent='Category: '+c.category;details.append(p);
if(Array.isArray(c.previewLessons)&&c.previewLessons.length){
  const section=document.createElement('section'), heading=document.createElement('h2');
  heading.textContent='Free preview lessons';
  section.append(heading);
  for(const lesson of c.previewLessons){
    if(!lesson||typeof lesson.title!=='string'||typeof lesson.text!=='string')continue;
    const heading=document.createElement('h3'), body=document.createElement('p');
    heading.textContent=lesson.title;
    body.textContent=lesson.text;
    section.append(heading,body);
  }
  details.append(section);
}
const note=document.createElement('p');note.textContent='Online enrolment and lesson access will become available after the secure student platform launches.';details.append(note)}).catch(()=>{summary.textContent='Course information is temporarily unavailable.'})})();