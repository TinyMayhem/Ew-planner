import {symbolSvg,labels} from './pfp-symbols.js';
// PFP Studio: no fake graphic generator, no stored images, real AI calls only when server enables them.
const $=id=>document.getElementById(id);
const elements={form:$('pfpForm'),theme:$('pfpTheme'),file:$('pfpImage'),art:$('pfpArtboard'),status:$('pfpMessage'),mode:$('pfpMode'),download:$('pfpDownload'),button:$('pfpGenerate'),prompt:$('pfpPrompt'),copy:$('pfpCopy')};
let config={ready:false,activeTheme:'squad',themes:[]},sourceUrl=null,resultUrl=null,busy=false;

function show(message){elements.status.textContent=message;}
function release(){
 if(sourceUrl){URL.revokeObjectURL(sourceUrl);sourceUrl=null;}
 if(resultUrl){URL.revokeObjectURL(resultUrl);resultUrl=null;}
}
function showPicture(url,label){
 elements.art.replaceChildren();
 const img=document.createElement('img');img.alt=label;img.src=url;elements.art.append(img);
}
function showEmpty(){
 elements.art.replaceChildren();
 const empty=document.createElement('div');
 empty.className='pfp-empty';
 empty.textContent='Upload a reference image. This is an input preview only, not an AI result.';
 elements.art.append(empty);
}
function clearResult(){
 if(resultUrl){URL.revokeObjectURL(resultUrl);resultUrl=null;}
 elements.download.removeAttribute('href');elements.download.hidden=true;
 if(sourceUrl)showPicture(sourceUrl,'Original uploaded character, not AI-generated');
 else showEmpty();
}
function setMode(){
 elements.mode.textContent=config.ready?'AI image editing enabled':'AI not connected';
 elements.button.disabled=!config.ready||busy;
 elements.button.textContent=config.ready?'✨ Generate AI PFP':'AI generation not connected';
}
function promptText(){
 const theme=elements.theme.value;
 const chosenStyle=$('pfpStyle').value;
 const style={
 original:'Match the art style, proportions, medium and rendering of the uploaded image. Do not automatically turn the character chibi.',
 theme:'Use a polished, imaginative illustrated style for the theme.',
 anime:'Anime illustration.',chibi:'Expressive chibi illustration with cute compact proportions.',
 comic:'Bold, colorful comic-book illustration.',photorealistic:'Photorealistic rendering.',
 '3d':'Stylized 3D render.',watercolor:'Soft painterly watercolor.'
 }[chosenStyle]||'Match the art style of the uploaded image.';
 const clothing=$('pfpOutfit').value==='keep'?'Preserve the original outfit.':'Give the character an outfit matching the theme.';
 let scene='';
 if(theme==='squad'){
  const units={tank:'the supplied simplified light-cyan tank icon, with its upper turret and lower body with three circular holes',aircraft:'the supplied simplified light-cyan diagonal airplane icon',missile:'the supplied simplified light-cyan missile-launcher truck icon with angled launcher and cutout window'};
  const poses={surprise:'interacting playfully with',riding:'riding',clinging:'clinging to',popping:'popping out from behind',hugging:'hugging',lounging:'lounging on'};
  scene='Create a dynamic square profile picture of the character '+(poses[$('pfpPose').value]||poses.surprise)+' '+(units[$('pfpSquad').value]||units.tank)+'. Retain the flat pale-cyan icon shape on its vivid cyan-to-blue background. Do not replace the icon with a realistic vehicle, redesign its silhouette, add invented game logos, or force a chibi style. The character can drape over, hug, peek behind or perch on the icon without hiding the symbol.';
 }else if(theme==='starter'){
  scene='Create a character-centered starter-pack composition with favourite things: '+($('pfpFavourites').value.trim()||'[Add favourite things]')+'. Make the items recognizable.';
 }else if(theme==='royalty'){
  scene='Create a fantasy royalty portrait of the character as a '+$('pfpRole').value+'. Rich forest green and warm gold accents.';
 }
 return 'Use my uploaded image as the character reference. Preserve the character’s recognisable face, skin tone, hairstyle, key accessories and identity. If the image is a character reference sheet, create ONE newly posed character in ONE scene. Do NOT reproduce the turnaround sheet, a collage, expression samples or an image grid. '+style+' '+scene+' '+clothing+' Square 1:1 Discord profile picture; keep the character clearly visible, avoid unwanted frames, text and watermarks.';
}
function updatePrompt(){elements.prompt.value=promptText();}
function updateSymbolReference(){
 const unit=$('pfpSquad').value;
 const svg=symbolSvg(unit);
 $('pfpSymbolImage').src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
 $('pfpSymbolName').textContent=(labels[unit]||'Squad')+' symbol';
}
function updateTheme(){
 const id=elements.theme.value;
 for(const [theme,section] of [['squad','pfpSquadFields'],['starter','pfpStarterFields'],['royalty','pfpRoyaltyFields']])$(section).hidden=id!==theme;
 $('pfpThemeDescription').textContent=config.themes.find(t=>t.id===id)?.subtitle||'';
 updatePrompt();updateSymbolReference();clearResult();
}
function validate(){
 const file=elements.file.files?.[0];
 if(!file)throw Error('Upload your character picture first.');
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPG or WebP image.');
 if(file.size>3000000||file.size<100)throw Error('Upload an image under 3 MB.');
 if(elements.theme.value==='starter'&&!$('pfpFavourites').value.trim())throw Error('Tell us at least one favourite thing.');
 return file;
}
async function pngSymbolReference(unit){
 const img=new Image();
 const data='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(symbolSvg(unit));
 img.src=data;
 await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('The unit reference could not load.'));});
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
 const context=canvas.getContext('2d');
 if(!context)throw Error('This browser cannot prepare the unit reference.');
 context.drawImage(img,0,0,512,512);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
 if(!blob)throw Error('Unable to prepare the unit reference.');
 return blob;
}
function imageFromBase64(encoded,mime){
 const raw=atob(encoded),bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 return new Blob([bytes],{type:mime});
}
function offerDownload(blob,mime){
 if(resultUrl)URL.revokeObjectURL(resultUrl);
 resultUrl=URL.createObjectURL(blob);
 showPicture(resultUrl,'AI-generated weekly PFP');
 elements.download.href=resultUrl;
 elements.download.download='utw-'+elements.theme.value+'-pfp.'+(mime==='image/png'?'png':'webp');
 elements.download.hidden=false;
 show('AI image generated. Download before leaving because Members Den does not save images.');
}
async function generate(event){
 event.preventDefault();
 if(busy)return;
 if(!config.ready){show('AI generation is not connected. Copy the prompt and upload your original photo to ChatGPT to test it.');return;}
 let file;try{file=validate();}catch(error){show(error.message);return;}
 busy=true;setMode();clearResult();show('Requesting an AI image edit...');
 try{
  if(elements.theme.value!==config.activeTheme)throw Error('This is not the active theme.');
  const form=new FormData(elements.form);form.set('image',file,file.name);
  if(elements.theme.value==='squad'){
   const symbol=await pngSymbolReference($('pfpSquad').value);
   form.set('icon',symbol,'squad-reference.png');
  }
  const response=await fetch('/api/pfp-studio',{method:'POST',credentials:'same-origin',cache:'no-store',body:form});
  const data=await response.json();
  if(!response.ok||!data.ok)throw Error(data.error||'The image service is unavailable.');
  const mime=data.mime||'image/webp';
  offerDownload(imageFromBase64(data.image,mime),mime);
 }catch(error){show(error.message||'Could not generate an image.');}
 finally{busy=false;setMode();}
}
function previewOnly(){
 const section=$('trains');if(section)section.hidden=true;
 const gate=$('memberGate'),content=$('memberContent');
 const apply=()=>{if(content.hidden)content.hidden=false;if(!gate.hidden)gate.hidden=true;};
 apply();
 new MutationObserver(apply).observe(content,{attributes:true,attributeFilter:['hidden']});
}
async function copyPrompt(){
 try{
  await navigator.clipboard.writeText(elements.prompt.value);
  show('AI instructions copied. Upload the character image into ChatGPT along with those instructions to test an actual AI edit.');
 }catch{
  elements.prompt.focus();elements.prompt.select();
  show('Select and copy the instructions above, then upload your photo with them in ChatGPT.');
 }
}
async function init(){
 try{
  const response=await fetch('/api/pfp-studio',{cache:'no-store'});
  if(!response.ok)throw Error('Could not load studio settings.');
  config=await response.json();
  if(config.demoPreviewAllowed&&new URLSearchParams(location.search).get('pfpPreview')==='1')previewOnly();
 }catch{
  config={ready:false,activeTheme:'squad',themes:[
   {id:'squad',title:'Pick Your Squad',subtitle:'Choose a squad and pose.'},
   {id:'starter',title:'Your Starter Pack',subtitle:'Add favourite things.'},
   {id:'royalty',title:'UTW Royalty',subtitle:'Choose a royal role.'}
  ]};
 }
 elements.theme.replaceChildren();
 for(const theme of config.themes){
  if(config.ready&&theme.id!==config.activeTheme)continue;
  elements.theme.append(new Option(theme.title,theme.id));
 }
 elements.theme.value=config.activeTheme;setMode();updateTheme();
 if(!config.ready)show('AI generation is not connected. Your original photo stays on this device; use Copy instructions to test in ChatGPT.');
}
elements.theme.addEventListener('change',updateTheme);
for(const id of ['pfpSquad','pfpPose','pfpStyle','pfpOutfit','pfpRole','pfpFavourites']){
 $(id).addEventListener('change',()=>{updatePrompt();if(id==='pfpSquad')updateSymbolReference();});
 $(id).addEventListener('input',updatePrompt);
}
elements.file.addEventListener('change',()=>{
 if(sourceUrl){URL.revokeObjectURL(sourceUrl);sourceUrl=null;}
 clearResult();
 const file=elements.file.files?.[0];
 if(file&&file.size<=3000000&&['image/png','image/jpeg','image/webp'].includes(file.type)){
  sourceUrl=URL.createObjectURL(file);
  showPicture(sourceUrl,'Original uploaded character, not AI-generated');
  show(config.ready?'Image ready to use as the AI reference.':'This is only your original image. No AI edit has been performed.');
 }else if(file){show('Use a PNG, JPG or WebP image smaller than 3 MB.');}
});
elements.form.addEventListener('submit',generate);
elements.copy.addEventListener('click',copyPrompt);
$('pfpClear').addEventListener('click',()=>{
 elements.form.reset();release();updateTheme();show('Image preview and selections cleared.');
});
window.addEventListener('pagehide',release);
init();
