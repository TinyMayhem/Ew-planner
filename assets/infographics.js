import {sortInfographics} from './infographics-sort.mjs';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data={files:[],seasons:[],admin:false},selected='all';
const chosenInfographicVariants=new Map();
const fileURL=(file,download=false)=>(download?file.downloadUrl:file.viewUrl)||file.url||('/api/infographics?file='+encodeURIComponent(file.path)+(download?'&download=1':''));
async function command(body){const r=await fetch('/api/infographics',{method:'POST',headers:body instanceof FormData?{}:{'Content-Type':'application/json'},body:body instanceof FormData?body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw Error(result.error||'Request failed.');return result;}
function render(){
 if(selected!=='all'&&!data.seasons.includes(selected==='general'?null:Number(selected)))selected='all';
 $('seasons').innerHTML=data.seasons.length?'<button data-season="all" aria-pressed="'+(selected==='all')+'">All guides</button>'+data.seasons.map(season=>{const key=season===null?'general':String(season);return '<button data-season="'+key+'" aria-pressed="'+(key===String(selected))+'">'+(season===null?'General guides':'Season '+season)+'</button>';}).join(''):'';
 const search=$('search').value.toLowerCase().trim();
 const files=data.files.filter(f=>(selected==='all'||(selected==='general'?f.season===null:Number(selected)===f.season))&&[f.title,f.group,f.language,f.version,f.description,...(f.tags||[])].join(' ').toLowerCase().includes(search));
 const groups=new Map();
 for(const f of files){const key=f.season===4&&f.group?'s4:'+f.group:'single:'+f.path;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(f);}
 const cards=[...groups].map(([key,group])=>{
  const variants=[...group].sort((a,b)=>Number(b.language==='English')-Number(a.language==='English')||String(a.language||'').localeCompare(String(b.language||''))||String(a.version||'').localeCompare(String(b.version||'')));
  const chosen=variants.find(f=>f.path===chosenInfographicVariants.get(key))||variants[0];
  const name=variants.length>1?chosen.group:chosen.title;
  const preview=chosen.url||fileURL(chosen);
  const view=fileURL(chosen);
  const download=fileURL(chosen,true);
  const languagePicker=variants.length>1?'<div class="field" style="margin:9px 0"><label for="variant-'+esc(key).replace(/[^A-Za-z0-9_-]/g,'-')+'" class="small">Choose language / version</label><select class="infographic-language" data-group="'+esc(key)+'" id="variant-'+esc(key).replace(/[^A-Za-z0-9_-]/g,'-')+'" style="width:100%;padding:9px;border-radius:8px;background:#fffdf4;color:#233b31;border:1px solid #c6b78a">'+variants.map(v=>'<option value="'+esc(v.path)+'"'+(v.path===chosen.path?' selected':'')+'>'+esc([v.language||'English',v.version].filter(Boolean).join(' · '))+'</option>').join('')+'</select></div>':(chosen.language&&chosen.language!=='English'?'<p class="small muted">Language: '+esc(chosen.language)+'</p>':'');
  return '<article class="infographic-card">'+(chosen.type==='pdf'?'<div class="pdf-preview" aria-hidden="true">PDF GUIDE</div>':'<img class="file-preview" src="'+esc(preview)+'" alt="'+esc(name)+' infographic, '+esc(chosen.language||'English')+'" loading="lazy" decoding="async">')+'<span class="eyebrow">'+(chosen.season===null?'General guide':'Season '+chosen.season)+'</span><h3>'+esc(name)+'</h3>'+languagePicker+(chosen.description?'<p class="small">'+esc(chosen.description)+'</p>':'')+(chosen.tags?.length?'<p class="small muted">'+chosen.tags.map(t=>'<span class="badge">'+esc(t)+'</span>').join(' ')+'</p>':'')+'<p class="small muted">'+chosen.type.toUpperCase()+(chosen.size?' · '+Math.round(chosen.size/1024)+' KB':'')+(chosen.viewUrl?' · Original on Google Drive':'')+'</p><div class="actions"><a class="btn primary" '+(chosen.downloadUrl?'target="_blank" rel="noopener" ':'download ')+'href="'+esc(download)+'">Download ↓</a><a class="btn pale" href="'+esc(view)+'" target="_blank" rel="noopener">View ↗</a>'+(data.admin&&!chosen.url?'<button class="btn pale" data-remove="'+esc(chosen.path)+'">Remove</button>':'')+'</div></article>';
 });
 $('files').innerHTML=cards.join('');
 $('empty').classList.toggle('hidden',data.files.length>0||!data.ready);
 $('uploadDesk').classList.toggle('hidden',!data.admin);
 $('status').textContent=data.ready?(data.files.length?(cards.length+' topic'+(cards.length===1?'':'s')+' shown'+(cards.length!==files.length?' · '+files.length+' infographic versions':'')+(!files.length?' · Try another search or season.':'')):'No uploaded guides yet.'):data.error||'Connecting to the library…';
}
async function refresh(){try{
 const results=await Promise.allSettled([fetch('/api/infographics',{cache:'no-store'}).then(r=>r.json()),fetch('/assets/infographics/catalog.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}),fetch('/assets/infographics/season-4/catalog.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();})]);
 const live=results[0].status==='fulfilled'?results[0].value:{ready:false,files:[],admin:false};
 const imported=results[1].status==='fulfilled'&&Array.isArray(results[1].value)?results[1].value:[];
 const season4=results[2].status==='fulfilled'&&Array.isArray(results[2].value)?results[2].value:[];
 const all=[...imported,...season4,...(live.files||[])],seen=new Set();
 const files=sortInfographics(all.filter(f=>{if(seen.has(f.path))return false;seen.add(f.path);return true;}));
 data={...live,ready:live.ready||imported.length>0||season4.length>0,files,seasons:[...new Set(files.map(f=>f.season))]};
 render();
 }catch{$('status').textContent='Could not load the library. Try Refresh.';}}
$('search').addEventListener('input',render);$('refresh').onclick=refresh;$('manage').onclick=()=>{if(data.admin){$('uploadDesk').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}else $('adminLogin').showModal();};$('cancel').onclick=()=>$('adminLogin').close();
$('loginForm').onsubmit=async e=>{e.preventDefault();try{await command({action:'login',password:$('password').value});$('password').value='';$('adminLogin').close();await refresh();$('uploadDesk').scrollIntoView();}catch(error){$('loginMessage').textContent=error.message;}};
$('logout').onclick=async()=>{try{await command({action:'logout'});await refresh();}catch(error){$('uploadMessage').textContent=error.message;}};
$('general').addEventListener('change',()=>{$('season').disabled=$('general').checked;$('season').required=!$('general').checked;});
$('uploadForm').onsubmit=async e=>{e.preventDefault();const file=$('file').files[0];if(!file||file.size>3*1024*1024){$('uploadMessage').textContent='Choose a file of 3 MB or smaller.';return;}$('upload').disabled=true;$('uploadMessage').textContent='Uploading…';try{const form=new FormData();form.set('file',file);form.set('title',$('title').value);form.set('season',$('general').checked?'general':$('season').value);await command(form);$('file').value='';$('title').value='';$('general').checked=false;$('season').disabled=false;$('season').required=true;$('uploadMessage').textContent='Uploaded. The guide is now in its category.';await refresh();}catch(error){$('uploadMessage').textContent=error.message;}finally{$('upload').disabled=false;}};
document.addEventListener('click',async e=>{const button=e.target.closest('button');if(!button)return;if(button.dataset.season){selected=button.dataset.season;render();}if(button.dataset.remove&&confirm('Remove this uploaded guide? This cannot be undone.')){try{await command({action:'remove',path:button.dataset.remove});await refresh();}catch(error){$('status').textContent=error.message;}}});document.addEventListener('change',event=>{const picker=event.target.closest('.infographic-language');if(!picker)return;chosenInfographicVariants.set(picker.dataset.group,picker.value);render();});
await refresh();
