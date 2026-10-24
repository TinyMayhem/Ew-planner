const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data={files:[],admin:false,ready:false},previewURL;
const fileURL=(path,download=false)=>'/api/comics?file='+encodeURIComponent(path)+(download?'&download=1':'');
async function command(body){const response=await fetch('/api/comics',{method:'POST',headers:body instanceof FormData?{}:{'Content-Type':'application/json'},body:body instanceof FormData?body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw Error(result.error||'Could not save. Try again.');return result;}
function render(){
 const query=$('comicSearch').value.trim().toLowerCase();
 const files=data.files.filter(f=>[f.title,f.caption].join(' ').toLowerCase().includes(query));
 $('comicGallery').innerHTML=files.map(f=>'<article class="panel comic-card"><button class="comic-cover" data-read="'+esc(f.path)+'" aria-label="Read '+esc(f.title)+'"><img src="'+fileURL(f.path)+'" alt="'+esc(f.title)+'" loading="lazy" decoding="async"></button><div class="comic-card-copy">'+(f.createdAt?'<p class="comic-date">'+esc(new Date(f.createdAt).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}))+'</p>':'')+'<h2>'+esc(f.title)+'</h2>'+(f.caption?'<p>'+esc(f.caption)+'</p>':'')+'<div class="actions"><button class="btn primary" data-read="'+esc(f.path)+'">Read comic</button><a class="btn pale" download href="'+fileURL(f.path,true)+'">Download ↓</a></div></div></article>').join('');
 $('comicDesk').classList.toggle('hidden',!data.admin);
 $('comicEmpty').classList.toggle('hidden',!data.ready||data.files.length>0);
 $('comicStatus').textContent=!data.ready?(data.error||'Could not load comics. Try Refresh.'):data.files.length?(files.length+' comic'+(files.length===1?'':'s')+' shown'+(!files.length?' · Try another search.':'')):'The collection is ready for its first adventure.';
}
async function refresh(){try{const response=await fetch('/api/comics',{cache:'no-store'});data=await response.json();if(!Array.isArray(data.files))data.files=[];render();}catch{$('comicStatus').textContent='Could not load comics. Try Refresh.';}}
$('comicSearch').addEventListener('input',render);$('refreshComics').onclick=refresh;
$('manageComics').onclick=()=>data.admin?$('comicDesk').scrollIntoView():$('comicLogin').showModal();
$('cancelComicLogin').onclick=()=>$('comicLogin').close();
$('comicLoginForm').onsubmit=async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{await command({action:'login',password:$('comicPassword').value});$('comicPassword').value='';$('comicLoginMessage').textContent='';$('comicLogin').close();await refresh();$('comicDesk').scrollIntoView();}catch(error){$('comicLoginMessage').textContent=error.message;}finally{button.disabled=false;}};
$('comicLogout').onclick=async()=>{try{await command({action:'logout'});await refresh();}catch(error){$('comicUploadMessage').textContent=error.message;}};
$('comicFile').onchange=()=>{if(previewURL)URL.revokeObjectURL(previewURL);const file=$('comicFile').files[0];$('comicPreview').classList.toggle('hidden',!file);if(file){previewURL=URL.createObjectURL(file);$('comicPreview').src=previewURL;}};
$('comicUploadForm').onsubmit=async event=>{event.preventDefault();const file=$('comicFile').files[0];if(!file||file.size>3*1024*1024){$('comicUploadMessage').textContent='Choose an image of 3 MB or smaller.';return;}$('publishComic').disabled=true;$('comicUploadMessage').textContent='Publishing…';try{const form=new FormData();form.set('file',file);form.set('title',$('comicTitle').value);form.set('caption',$('comicCaption').value);await command(form);$('comicUploadForm').reset();$('comicPreview').classList.add('hidden');if(previewURL)URL.revokeObjectURL(previewURL);$('comicUploadMessage').textContent='Published! The chickens have entered it into evidence.';await refresh();}catch(error){$('comicUploadMessage').textContent=error.message;}finally{$('publishComic').disabled=false;}};
document.addEventListener('click',event=>{const button=event.target.closest('[data-read]');if(!button)return;const comic=data.files.find(f=>f.path===button.dataset.read);if(!comic)return;$('readerTitle').textContent=comic.title;$('readerCaption').textContent=comic.caption||'';$('readerImage').src=fileURL(comic.path);$('readerImage').alt=comic.title;$('readerOriginal').href=fileURL(comic.path);$('readerDownload').href=fileURL(comic.path,true);$('comicReader').showModal();});
$('closeComicReader').onclick=()=>$('comicReader').close();
await refresh();
