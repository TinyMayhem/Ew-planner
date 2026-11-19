import {powerFromInput,isImplicitMillions} from './thp-power.mjs';
const $=id=>document.getElementById(id);
const fmt=n=>Number(n).toLocaleString('en-CA');
async function request(url,options={}){
 const res=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(data.error||'Service unavailable. Please try again.');
 return data;
}
async function status(){
 try{
  const r=await request('/api/thp-update');
  $('thp-gate').hidden=!r.locked;
  $('thp-form-section').hidden=!!r.locked;
  $('thp-load-status').textContent=r.locked?'Same passcode as Buddy Board. No extra account needed.':'';
 }catch(e){
  $('thp-gate').hidden=false;$('thp-form-section').hidden=true;
  $('thp-load-status').textContent=e.message;
 }
}
$('thp-gate-form').addEventListener('submit',async e=>{
 e.preventDefault();$('thp-gate-status').textContent='Checking passcode…';
 const button=e.currentTarget.querySelector('button');button.disabled=true;
 try{
  await request('/api/buddies',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action:'pageLogin',password:$('thp-passcode').value})
  });
  $('thp-passcode').value='';$('thp-gate-status').textContent='';
  await status();
 }catch(error){
  $('thp-gate-status').className='thp-error';$('thp-gate-status').textContent=error.message;
 }finally{button.disabled=false}
});
for(const [id,preview] of [['thp-squad-power','thp-squad-preview'],['thp-hero-power','thp-hero-preview']]){
 $(id).addEventListener('input',()=>{
  const raw=$(id).value,parsed=powerFromInput(raw);
  $(preview).textContent=!raw?(id==='thp-squad-power'?'Example: 52.78M = 52,780,000':'Open Power Details → Hero Power, not overall commander power'):
   parsed!==null?(isImplicitMillions(raw)?raw.trim()+' = '+fmt(parsed)+' power (millions)':'Saved as '+fmt(parsed)+' power'):'Please enter a valid amount like 52.78 or 52.78M';
 });
}
$('thp-proof').addEventListener('change',()=>{
 const file=$('thp-proof').files[0];
 $('thp-proof-preview').textContent=!file?'':file.size>3145728?'This image is too big. The maximum is 3 MB.':'Attached: '+file.name;
});
let suggestSeq=0,suggestTimer;
const choices=$('thp-name-suggestions');
function closeSuggestions(){choices.hidden=true;choices.replaceChildren();$('thp-game-name').setAttribute('aria-expanded','false')}
$('thp-game-name').addEventListener('input',()=>{
 clearTimeout(suggestTimer);
 const value=$('thp-game-name').value.trim(),seq=++suggestSeq;
 if(value.length<2){closeSuggestions();return}
 suggestTimer=setTimeout(async()=>{
  try{
   const data=await request('/api/thp-update?suggest='+encodeURIComponent(value));
   if(seq!==suggestSeq||document.activeElement!==$('thp-game-name'))return;
   choices.replaceChildren();
   for(const item of data.matches||[]){
    const btn=document.createElement('button');btn.type='button';btn.textContent=item.name;
    btn.addEventListener('pointerdown',e=>e.preventDefault());
    btn.addEventListener('click',()=>{$('thp-game-name').value=item.name;closeSuggestions()});
    choices.append(btn);
   }
   choices.hidden=!choices.childElementCount;
   $('thp-game-name').setAttribute('aria-expanded',choices.hidden?'false':'true');
  }catch{closeSuggestions()}
 },220);
});
$('thp-game-name').addEventListener('keydown',e=>{if(e.key==='Escape')closeSuggestions()});
document.addEventListener('click',e=>{if(!e.target.closest('.thp-name-wrap'))closeSuggestions()});
$('thp-member-form').addEventListener('submit',async event=>{
 event.preventDefault();
 const form=event.currentTarget,button=$('thp-submit'),notice=$('thp-submit-status');
 notice.className='';notice.textContent='';
 const fd=new FormData(form);
 const hero=powerFromInput(fd.get('heroPower')),squad=powerFromInput(fd.get('squadPower'));
 if(hero===null||squad===null){notice.className='thp-error';notice.textContent='Check both power numbers. Values like 58.02 and 159.98 are in millions.';return}
 if(!form.reportValidity())return;
 const img=$('thp-proof').files[0];
 if(img?.size>3145728){notice.className='thp-error';notice.textContent='Please choose a screenshot smaller than 3 MB.';return}
 button.disabled=true;button.textContent='Sending to R4…';
 try{
  const result=await request('/api/thp-update',{method:'POST',body:fd});
  form.reset();closeSuggestions();
  $('thp-proof-preview').textContent='';$('thp-squad-preview').textContent='58.02 = 58,020,000. Decimals without M mean millions.';
  $('thp-hero-preview').textContent='159.98 = 159,980,000. Use Hero Power, not total commander power.';
  notice.className='';notice.textContent='✓ '+result.message+' Your current tracker data stays unchanged until approved.';
  notice.scrollIntoView({behavior:'smooth',block:'nearest'});
 }catch(e){notice.className='thp-error';notice.textContent=e.message}
 finally{button.disabled=false;button.textContent='Send THP Update'}
});
void status();
