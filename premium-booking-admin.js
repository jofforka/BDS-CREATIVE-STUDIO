(() => {
'use strict';
const form=document.querySelector('#booking-form');
if(form){
 const service=new URLSearchParams(location.search).get('service');
 const select=document.querySelector('#service');
 if(service&&select){const normalized=service.toLowerCase();const match=Array.from(select.options).find(option=>option.value.toLowerCase()===normalized||option.textContent.toLowerCase().includes(normalized));if(match)select.value=match.value;}
 const date=document.querySelector('#session-date');
 const updateDate=()=>{const d=new Date();const today=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');date.min=today};
 updateDate();window.addEventListener('pageshow',updateDate);
 const inputs=form.querySelectorAll('input,select,textarea');
 inputs.forEach(el=>{el.addEventListener('invalid',()=>el.setAttribute('aria-invalid','true'));el.addEventListener('input',()=>el.removeAttribute('aria-invalid'))});
}
const admin=document.querySelector('.bds-admin');
if(admin){
 const file=document.querySelector('#media-file');
 const message=document.querySelector('#message');
 file?.addEventListener('change',()=>{const f=file.files?.[0];if(f&&f.size>15*1024*1024){message.textContent='This file exceeds the 15 MB upload limit. Compress it or provide an HTTPS media URL.';message.style.color='#f1a49a';file.value=''}});
}
})();