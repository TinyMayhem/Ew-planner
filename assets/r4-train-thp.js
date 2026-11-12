// Train guest designation only. Does not alter conductor/VIP eligibility.
(()=>{
'use strict';
const target=document.getElementById('train-thp-role');
if(!target)return;
const $=id=>document.getElementById(id);
const fmt=n=>Number(n).toLocaleString('en-CA');
const el=(tag,value,cls)=>{const result=document.createElement(tag);if(value!=null)result.textContent=String(value);if(cls)result.className=cls;return result};
const cache=new Map();
let seq=0;
async function asOf(date){
 if(cache.has(date))return cache.get(date);
 const req=fetch('/api/r4-stats?member_thp=1&date='+encodeURIComponent(date),{credentials:'same-origin',cache:'no-store'})
  .then(async r=>{const value=await r.json().catch(()=>({}));if(!r.ok)throw Error(value.error||'THP unavailable');return value})
  .catch(e=>{cache.delete(date);throw e});
 cache.set(date,req);return req;
}
function show(title,detail,warning=false){
 target.replaceChildren(el('strong',title,'train-pair-heading'),el('p',detail,warning?'stat-flag blocked':'stat-muted'));
}
async function update(){
 const current=++seq,date=$('train-date')?.value,driver=$('train-member')?.value,vip=$('train-vip')?.value;
 if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)){show('THP guest designation','Choose a train date.');return}
 if(!driver||!vip){show('THP guest designation','Choose a conductor and VIP to see the THP-based guest role.');return}
 if(driver===vip){show('THP guest designation','Conductor and VIP must be different members.',true);return}
 show('THP guest designation','Checking last recorded THP on or before '+date+'…');
 try{
  const values=await asOf(date);if(seq!==current)return;
  const mapped=new Map((values.mapped||[]).map(r=>[r.member_id,r]));
  const d=mapped.get(driver),v=mapped.get(vip);
  if(!d||!v){
   const missing=[!d?'conductor':'',!v?'VIP':''].filter(Boolean).join(' and ');
   show('THP guest designation unavailable','No matched THP for '+missing+' on or before '+date+'. Add dated THP or correct player aliases before assigning a guest role.',true);
   return;
  }
  const conductor=$('train-member')?.selectedOptions[0]?.textContent||'Conductor';
  const vipName=$('train-vip')?.selectedOptions[0]?.textContent||'VIP';
  const prefix=conductor+': '+fmt(d.thp)+' THP ('+d.recorded_on+') · '+vipName+': '+fmt(v.thp)+' THP ('+v.recorded_on+'). ';
  if(d.thp>v.thp)show('Suggested VIP role: Special Guest',prefix+'Conductor THP is higher than VIP THP. VIP is the Special Guest.');
  else if(d.thp<v.thp)show('Suggested VIP role: Guest Defender',prefix+'VIP THP is higher than conductor THP. VIP is the Guest Defender.');
  else show('Equal THP: no role preference',prefix+'The conductor and VIP have identical recorded THP.');
 }catch(e){if(seq===current)show('THP guest designation unavailable',e.message,true)}
}
let pending=false;
function schedule(){
 if(pending)return;pending=true;
 queueMicrotask(()=>{pending=false;void update()});
}
document.addEventListener('change',event=>{
 if(['train-date','train-member','train-vip'].includes(event.target?.id))schedule();
});
document.addEventListener('click',event=>{
 if(event.target?.closest?.('#candidates,#vip-candidates,#train-calendar'))schedule();
});
const observe=document.getElementById('candidates');
if(observe)new MutationObserver(schedule).observe(observe,{childList:true});
document.addEventListener('r4-thp-changed',()=>{cache.clear();schedule()});
schedule();
})();