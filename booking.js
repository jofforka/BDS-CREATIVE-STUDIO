(()=>{'use strict';
const form=document.getElementById('booking-form'),date=document.getElementById('session-date'),status=document.getElementById('booking-status'),review=document.getElementById('checkout-review'),summary=document.getElementById('checkout-summary'),link=document.getElementById('checkout-whatsapp'),choice=document.getElementById('package-choice'),source=document.getElementById('rate-source');
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function invalidate(){review.hidden=true;link.removeAttribute('href');summary.replaceChildren()}
date.min=today();form.addEventListener('input',invalidate);form.addEventListener('change',invalidate);
document.getElementById('checkout-edit').addEventListener('click',()=>{invalidate();document.getElementById('service').focus()});
form.addEventListener('submit',e=>{e.preventDefault();invalidate();date.min=today();if(!form.reportValidity())return;if(date.value<today()){status.textContent='Choose today or a future date.';return}
const data=new FormData(form);const standard=data.get('requestType')==='package';if(standard&&source.textContent.includes('Loading')){status.textContent='Please wait for the current rates.';return}
const selected=standard&&!choice.disabled&&choice.value?choice.selectedOptions[0].textContent:'Custom quotation required';
const fields=[['Name',data.get('name')],['WhatsApp',data.get('contact')],['Email',data.get('email')],['Service',data.get('service')],['Package and indicative rate',selected],['Preferred date',data.get('date')],['Preferred time (WAT)',data.get('time')],['Estimated duration',data.get('duration')],['Project details',data.get('details')]];
for(const [label,value] of fields){if(!value)continue;const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;summary.append(dt,dd)}
const message='Hello BDS Creative Studios, I would like to arrange payment and confirm availability for this booking request.\n\n'+fields.filter(([,v])=>v).map(([k,v])=>k+': '+v).join('\n')+'\n\nPlease confirm the final price, deposit and payment instructions. I understand this request is not yet paid or confirmed.';
link.href='https://wa.me/2348126376135?text='+encodeURIComponent(message);review.hidden=false;status.textContent='Review your details before continuing to WhatsApp.';document.getElementById('checkout-heading').focus()});
link.addEventListener('click',()=>{status.textContent='Send the prepared message in WhatsApp to arrange payment. Your booking is not yet confirmed.'});
})();