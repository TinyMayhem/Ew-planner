// Images stay in browser memory. No uploads happen in demo mode and no local/session storage is used.
const $=id=>document.getElementById(id);
const elements={form:$('pfpForm'),theme:$('pfpTheme'),file:$('pfpImage'),art:$('pfpArtboard'),status:$('pfpMessage'),mode:$('pfpMode'),download:$('pfpDownload'),button:$('pfpGenerate')};
let config={ready:false,activeTheme:'squad',themes:[]},sourceUrl=null,resultUrl=null,busy=false;
const themeDetails={
 squad:{tag:'SQUAD',label:()=>({tank:'TANK',aircraft:'AIRCRAFT',missile:'MISSILE'})[$('pfpSquad').value]||'SQUAD',emoji:()=>({tank:'🛡',aircraft:'✈',missile:'🚀'})[$('pfpSquad').value]||'✦'},
 starter:{tag:'STARTER PACK',label:()=>($('pfpFavourites').value.trim().slice(0,44)||'FAVOURITE THINGS'),emoji:()=> '♡'},
 royalty:{tag:'ROYALTY',label:()=> $('pfpRole').selectedOptions[0]?.textContent.toUpperCase()||'ROYALTY',emoji:()=> '♛'}
};
const show=(message)=>{elements.status.textContent=message;};
function release(){
 if(sourceUrl){URL.revokeObjectURL(sourceUrl);sourceUrl=null;}
 if(resultUrl){URL.revokeObjectURL(resultUrl);resultUrl=null;}
}
function clearResult(message){
 if(resultUrl){URL.revokeObjectURL(resultUrl);resultUrl=null;}
 elements.download.removeAttribute('href');elements.download.hidden=true;
 elements.art.replaceChildren();
 elements.art.append(Object.assign(document.createElement('div'),{className:'pfp-empty',textContent:'Your PFP preview will appear here.'}));
 if(message)show(message);
}
function showPicture(url,label){
 elements.art.replaceChildren();
 const img=document.createElement('img');img.alt=label;img.src=url;elements.art.append(img);
}
function updateTheme(){
 const id=elements.theme.value;
 for(const [theme,section] of [['squad','pfpSquadFields'],['starter','pfpStarterFields'],['royalty','pfpRoyaltyFields']])$(section).hidden=id!==theme;
 $('pfpThemeDescription').textContent=config.themes.find(t=>t.id===id)?.subtitle||'';
 clearResult('Choose an image and make your PFP. Nothing is stored.');
}
function validate(){
 const file=elements.file.files?.[0];
 if(!file)throw Error('Upload your character picture first.');
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPG or WebP image.');
 if(file.size>3000000||file.size<100)throw Error('Upload an image under 3 MB.');
 if(elements.theme.value==='starter'&&!$('pfpFavourites').value.trim())throw Error('Tell us at least one favourite thing.');
 return file;
}
function drawCentered(ctx,img,x,y,w,h){
 const scale=Math.min(w/img.width,h/img.height);
 const width=img.width*scale,height=img.height*scale;
 ctx.drawImage(img,x+(w-width)/2,y+(h-height)/2,width,height);
}
async function demoComposite(file){
 const bitmap=await createImageBitmap(file);
 try{
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image preview is unavailable on this device.');
  const palettes={squad:['#294e6b','#8bbbd8','#f7df93'],starter:['#6f447e','#dfa4ba','#f7db9a'],royalty:['#173d33','#62856c','#f6d78c']};
  const colors=palettes[elements.theme.value]||palettes.squad;
  const bg=ctx.createLinearGradient(0,0,1024,1024);bg.addColorStop(0,colors[0]);bg.addColorStop(1,colors[1]);ctx.fillStyle=bg;ctx.fillRect(0,0,1024,1024);
  ctx.globalAlpha=.22;ctx.fillStyle=colors[2];
  for(let i=0;i<24;i++){const x=(i*349+83)%1019,y=(i*193+43)%1024,r=7+(i%5)*9;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;ctx.fillStyle='#fffbec';ctx.beginPath();ctx.roundRect(104,130,816,762,38);ctx.fill();
  ctx.save();ctx.beginPath();ctx.roundRect(121,147,782,728,28);ctx.clip();
  ctx.fillStyle='#eee9db';ctx.fillRect(121,147,782,728);
  drawCentered(ctx,bitmap,137,161,750,697);ctx.restore();
  ctx.fillStyle='#15382e';ctx.beginPath();ctx.roundRect(85,31,854,102,25);ctx.fill();
  ctx.fillStyle='#fff2c8';ctx.font='bold 33px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText('UTW  •  PFP STUDIO  •  DEMO',512,95);
  ctx.fillStyle='#15382e';ctx.beginPath();ctx.roundRect(160,858,704,125,27);ctx.fill();
  ctx.font='bold 40px system-ui,sans-serif';ctx.fillStyle=colors[2];
  ctx.fillText(String(themeDetails[elements.theme.value].label()).slice(0,28),512,933,640);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw Error('The preview image could not be created.');
  return {blob,mime:'image/png'};
 }finally{bitmap.close();}
}
function imageFromBase64(encoded,mime){
 const raw=atob(encoded),bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 return new Blob([bytes],{type:mime});
}
function offerDownload(blob,mime,isDemo){
 if(resultUrl)URL.revokeObjectURL(resultUrl);
 resultUrl=URL.createObjectURL(blob);
 showPicture(resultUrl,isDemo?'Demo composite, not an AI-generated image':'AI-created weekly PFP');
 elements.download.href=resultUrl;elements.download.download='utw-'+elements.theme.value+'-pfp.'+(mime==='image/png'?'png':'webp');
 elements.download.hidden=false;
 show(isDemo?'Demo mock-up ready! Your source image stayed on this device. AI editing is not enabled yet.':'Your AI PFP is ready. Download it before leaving; it is not saved by Members Den.');
}
async function generate(event){
 event.preventDefault();if(busy)return;
 let file;try{file=validate();}catch(error){show(error.message);return;}
 busy=true;elements.button.disabled=true;elements.button.textContent='Creating your PFP...';clearResult('Working on your PFP...');
 try{
  if(!config.ready){
   const result=await demoComposite(file);
   offerDownload(result.blob,result.mime,true);
  }else{
   if(elements.theme.value!==config.activeTheme)throw Error('This weekly theme is not active.');
   const form=new FormData(elements.form);
   form.set('image',file,file.name);
   const response=await fetch('/api/pfp-studio',{method:'POST',credentials:'same-origin',cache:'no-store',body:form});
   const data=await response.json();
   if(!response.ok||!data.ok)throw Error(data.error||'The image service is unavailable.');
   const blob=imageFromBase64(data.image,data.mime||'image/webp');
   offerDownload(blob,data.mime||'image/webp',false);
  }
 }catch(error){show(error.message||'Could not make your PFP. Try a smaller image.');}
 finally{busy=false;elements.button.disabled=false;elements.button.textContent='✨ Make my PFP';}
}
function previewOnly(){
 const section=$('trains');if(section)section.hidden=true;
 const gate=$('memberGate'),content=$('memberContent');
 const apply=()=>{if(content.hidden)content.hidden=false;if(!gate.hidden)gate.hidden=true;};
 apply();
 // Other member modules may finish fetching after this one; keep only this demo shell visible.
 new MutationObserver(apply).observe(content,{attributes:true,attributeFilter:['hidden']});
}
async function init(){
 try{
  const response=await fetch('/api/pfp-studio',{cache:'no-store'});
  if(!response.ok)throw Error('Could not load the studio settings.');
  config=await response.json();
  if(config.demoPreviewAllowed&&new URLSearchParams(location.search).get('pfpPreview')==='1')previewOnly();
  elements.mode.textContent=config.ready?'AI beta enabled':'Safe demo mode';
  $('pfpTheme').replaceChildren();
  for(const theme of config.themes){
   if(config.ready&&theme.id!==config.activeTheme)continue;
   const option=new Option(theme.title,theme.id);
   elements.theme.append(option);
  }
  elements.theme.value=config.activeTheme;updateTheme();
  if(!config.ready)show('Demo mode: Make my PFP creates a basic graphic mock-up locally, not an AI edit. No photo is uploaded.');
 }catch(error){
  elements.mode.textContent='Demo configuration unavailable';
  config.themes=[{id:'squad',title:'Pick Your Squad',subtitle:'Choose your squad and pose.'},{id:'starter',title:'Your Starter Pack',subtitle:'Show your favourite things.'},{id:'royalty',title:'UTW Royalty',subtitle:'Choose your royal role.'}];
  elements.theme.replaceChildren(...config.themes.map(theme=>new Option(theme.title,theme.id)));updateTheme();
  show('Offline demo available. Your image stays on this device.');
 }
}
elements.theme.addEventListener('change',updateTheme);
elements.file.addEventListener('change',()=>{
 clearResult();
 if(sourceUrl){URL.revokeObjectURL(sourceUrl);sourceUrl=null;}
 const file=elements.file.files?.[0];
 if(file&&file.size<=3000000&&['image/png','image/jpeg','image/webp'].includes(file.type)){
  sourceUrl=URL.createObjectURL(file);showPicture(sourceUrl,'Your uploaded character preview');
  show('Photo selected. Pick your options and make your PFP.');
 }else if(file){show('Use a PNG, JPG or WebP image smaller than 3 MB.');}
});
elements.form.addEventListener('submit',generate);
$('pfpClear').addEventListener('click',()=>{elements.form.reset();release();updateTheme();show('Everything cleared from this page.');});
window.addEventListener('pagehide',release);
init();
