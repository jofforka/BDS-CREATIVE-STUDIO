(() => {
'use strict';
const owner='jofforka',repo='BDS-CREATIVE-STUDIO',branch='main',path='content/portfolio.json';
const $=id=>document.getElementById(id);
let token='',data=null,sha='',busy=false;
const msg=(text,error=false)=>{$('message').textContent=text;$('message').style.color=error?'#f1a49a':'#d8ad67'};
const api=async(path,options={})=>{
 const res=await fetch('https://api.github.com/repos/'+owner+'/'+repo+'/'+path,{
  ...options,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28',...(options.headers||{})}});
 const result=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(result.message||'GitHub returned '+res.status);
 return result;
};
const decode=base64=>new TextDecoder().decode(Uint8Array.from(atob(base64.replace(/\s/g,'')),c=>c.charCodeAt(0)));
const encode=text=>{const bytes=new TextEncoder().encode(text);let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(str)};
const slug=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const cleanUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}};
const safeImage=value=>typeof value==='string' && (/^assets\/portfolio\/[a-z0-9/_-]+\.(jpg|jpeg|png|webp)$/i.test(value) || (cleanUrl(value) && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(value)));
const renderHero=()=>{const hero=data.departmentHeroes?.[$('hero-department').value]||{};$('hero-url').value=hero.media||'';$('hero-alt').value=hero.alt||'';$('hero-file').value='';};
const reset=()=>{$('editor').reset();$('project-id').value='';$('media-url').value='';$('published').checked=true;$('save').textContent='Save project'};
const render=()=>{
 const list=$('projects');list.replaceChildren();
 for(const p of data.projects||[]){
  const item=document.createElement('article');item.className='project';
  const info=document.createElement('div');const title=document.createElement('strong');title.textContent=p.title;
  const details=document.createElement('p');details.textContent=[p.department,p.type,p.category,p.published?'Published':'Hidden',p.demo?'Demo':''].filter(Boolean).join(' · ');
  info.append(title,details);
  const buttons=document.createElement('div');buttons.className='actions';
  const edit=document.createElement('button');edit.textContent='Edit';edit.className='secondary';edit.onclick=()=>{
   $('project-id').value=p.id;$('department').value=p.department;$('media-type').value=p.type;$('project-title').value=p.title;$('category').value=p.category||'';$('description').value=p.description||'';$('alt').value=p.alt||'';$('media-url').value=p.media||'';$('published').checked=p.published===true;$('demo').checked=p.demo===true;$('media-file').value='';$('save').textContent='Update project';$('editor').scrollIntoView({behavior:'smooth',block:'center'});
  };
  const del=document.createElement('button');del.textContent='Remove';del.className='danger';del.onclick=async()=>{
   if(!confirm('Remove "'+p.title+'" from the portfolio? This removes the listing, not the underlying media file.'))return;
   await commit(d=>{d.projects=d.projects.filter(x=>x.id!==p.id)},'Remove BDS portfolio project '+p.id);
  };
  buttons.append(edit,del);item.append(info,buttons);list.append(item);
 }
};
const refresh=async()=>{
 const result=await api('contents/'+path+'?ref='+branch);
 sha=result.sha;data=JSON.parse(decode(result.content));render();renderHero();
};
const commit=async(change,message,alreadyBusy=false)=>{
 if(busy&&!alreadyBusy)return;busy=true;$('save').disabled=true;$('hero-save').disabled=true;$('hero-clear').disabled=true;
 try{
  await refresh();change(data);data.updatedAt=new Date().toISOString().slice(0,10);
  await api('contents/'+path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,content:encode(JSON.stringify(data,null,2)+'\n'),sha,branch})});
  await refresh();reset();msg('Saved to GitHub. The public gallery will update after deployment completes.');
 }catch(error){msg(error.message,true)}finally{busy=false;$('save').disabled=false;$('hero-save').disabled=false;$('hero-clear').disabled=false}
};
const upload=async(file)=>{
 if(file.size>15*1024*1024)throw Error('File exceeds the 15 MB browser upload limit. Compress it or use a hosted HTTPS media URL.');
 const allowed={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','audio/mpeg':'mp3','audio/ogg':'ogg'};
 const ext=allowed[file.type];if(!ext)throw Error('Unsupported media format');
 const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
 for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 const location='assets/portfolio/'+slug()+'.'+ext;
 await api('contents/'+location,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Upload BDS portfolio media',content:btoa(binary),branch})});
 return location;
};
$('connect').addEventListener('submit',async event=>{
 event.preventDefault();token=$('token').value.trim();$('token').value='';
 try{await refresh();$('workspace').hidden=false;$('connect').hidden=true;msg('Connected. Your GitHub token is held in memory only.')}catch(error){token='';msg('Connection failed: '+error.message,true)}
});
$('reset').onclick=reset;
$('hero-department').addEventListener('change',renderHero);
$('hero-editor').addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;
 const department=$('hero-department').value,file=$('hero-file').files[0];
 let media=$('hero-url').value.trim();const alt=$('hero-alt').value.trim();
 if(!file&&!safeImage(media)){msg('Select a JPG, PNG or WebP image or provide a valid image URL.',true);return}
 if(file&&!['image/jpeg','image/png','image/webp'].includes(file.type)){msg('Main image must be JPG, PNG or WebP.',true);return}
 busy=true;$('hero-save').disabled=true;$('hero-clear').disabled=true;$('save').disabled=true;
 try{
  if(file){msg('Uploading featured image…');media=await upload(file)}
  await commit(d=>{d.departmentHeroes=d.departmentHeroes||{};d.departmentHeroes[department]={media,alt};},'Update '+department+' department main image',true);
 }catch(error){msg(error.message,true)}finally{busy=false;$('hero-save').disabled=false;$('hero-clear').disabled=false;$('save').disabled=false}
});
$('hero-clear').addEventListener('click',async()=>{
 const department=$('hero-department').value;
 if(!confirm('Clear the custom main image for '+department+'? The default hero image will be used.'))return;
 await commit(d=>{d.departmentHeroes=d.departmentHeroes||{};delete d.departmentHeroes[department]},'Clear '+department+' department main image');
});
$('editor').addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;
 const id=$('project-id').value,existing=data.projects.find(p=>p.id===id);
 const type=$('media-type').value,department=$('department').value;
 if((department==='photography'&&type!=='image')||(department==='film'&&type==='audio')){msg('This media type is not supported in that department.',true);return}
 const file=$('media-file').files[0];let media=$('media-url').value.trim()||existing?.media||'';
 if(!file&&!media){msg('Choose a media file or enter a media URL.',true);return}
 if(!file&&!(/^assets\/portfolio\/[a-z0-9/_-]+\.(jpg|jpeg|png|webp|mp4|mp3|ogg)$/i.test(media)||cleanUrl(media))){msg('Media must be a valid HTTPS URL or a portfolio asset.',true);return}
 busy=true;$('save').disabled=true;
 try{
  if(file){msg('Uploading media to GitHub…');media=await upload(file)}
  const project={id:id||slug(),department,category:$('category').value.trim(),type,title:$('project-title').value.trim(),description:$('description').value.trim(),alt:$('alt').value.trim(),media,demo:$('demo').checked,published:$('published').checked};
  await commit(d=>{const index=d.projects.findIndex(p=>p.id===project.id);if(index<0)d.projects.push(project);else d.projects[index]={...d.projects[index],...project}},(id?'Update':'Add')+' BDS portfolio project '+project.id,true);
 }catch(error){msg(error.message,true);busy=false;$('save').disabled=false}
});
})();