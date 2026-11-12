// R4 member THP lives in UTW's own database. Player names/IDs are read from
// the already connected Alliance Duel member roster or its saved backup.
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const state={roster:[],records:[],source:'',storageReady:false};
const fmt=value=>Number(value).toLocaleString('en-CA');
const normalize=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const element=(tag,value,cls)=>{
 const node=document.createElement(tag);
 if(value!==null&&value!==undefined)node.textContent=String(value);
 if(cls)node.className=cls;
 return node;
};
const parseThp=raw=>{
 const match=String(raw||'').replaceAll(',','').trim().match(/^([0-9]+(?:[.][0-9]+)?)[ ]*([kmb])?$/i);
 if(!match)return null;
 const factor={k:1000,m:1000000,b:1000000000}[String(match[2]||'').toLowerCase()]||1;
 const value=Number(match[1])*factor;
 return Number.isSafeInteger(value)&&value>=0?Math.round(value):null;
};
const recordMap=()=>new Map(state.records.map(r=>[String(r.source_member_id),r]));
function rows(){
 const source=state.roster.length?state.roster:state.records.map(r=>({id:r.source_member_id,name:r.member_name}));
 const seen=new Set();
 return source.filter(row=>{
  if(!row||!row.id||!row.name||seen.has(String(row.id)))return false;
  seen.add(String(row.id));return true;
 }).sort((a,b)=>String(a.name).localeCompare(String(b.name),undefined,{sensitivity:'base'}));
}
function render(){
 const list=$('thp-list'),summary=$('thp-summary'),source=$('thp-source');
 if(!list||!summary||!source)return;
 const people=rows(),map=recordMap(),search=normalize($('thp-search')?.value);
 const visible=people.filter(row=>normalize(row.name).includes(search));
 const saved=people.map(p=>map.get(String(p.id))).filter(Boolean);
 const total=saved.reduce((sum,r)=>sum+Number(r.thp),0);
 summary.replaceChildren();
 for(const [label,value] of [
  ['VS roster members',fmt(people.length)],
  ['THP entered',fmt(saved.length)+' / '+fmt(people.length)],
  ['Recorded alliance THP',fmt(total)]
 ]){const box=element('div',null,'stat-summary');box.append(element('b',value),element('span',label));summary.append(box)}
 source.textContent=state.roster.length
  ?'Names are from '+(state.source||'Alliance Duel')+'. THP is entered manually and saved in UTW.'
  :'Alliance Duel roster unavailable. Showing previously saved THP names only.';
 list.replaceChildren();
 if(!visible.length){list.append(element('p',search?'No names match your search.':'No VS member names or saved THP entries are available yet.','stat-empty'));return}
 for(const member of visible){
  const id=String(member.id),existing=map.get(id);
  const row=element('div',null,'stat-thp-row');
  const info=element('div',null,'stat-thp-person');
  info.append(element('strong',member.name));
  info.append(element('small',existing?'Last updated '+new Date(existing.updated_at).toLocaleString()+' · '+(existing.updated_by||'R4'):'THP not recorded yet','stat-muted'));
  const controls=element('div',null,'stat-thp-controls');
  const input=element('input');input.type='text';input.inputMode='decimal';input.maxLength=35;input.autocomplete='off';
  input.placeholder='e.g. 142M';input.value=existing?fmt(existing.thp):'';
  input.setAttribute('aria-label','THP for '+member.name);
  const save=element('button','Save','stat-button primary');save.type='button';save.disabled=!state.storageReady;
  const clear=element('button','Clear','stat-button');clear.type='button';clear.disabled=!state.storageReady||!existing;
  const feedback=element('small','','stat-thp-feedback');feedback.setAttribute('role','status');
  async function mutate(action){
   if(action==='clear'&&!confirm('Clear THP for '+member.name+'?'))return;
   const thp=action==='save'?parseThp(input.value):null;
   if(action==='save'&&thp===null){feedback.textContent='Use a whole number or a value like 142M.';return}
   save.disabled=true;clear.disabled=true;feedback.textContent='Saving…';
   try{
    const response=await fetch('/api/r4-thp',{
     method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({action,source_member_id:id,member_name:String(member.name),...(action==='save'?{thp}:{})})
    });
    const data=await response.json().catch(()=>({}));
    if(response.status===401){location.href='/r4-planner';return}
    if(!response.ok)throw Error(data.error||'THP could not be saved');
    state.records=state.records.filter(r=>String(r.source_member_id)!==id);
    if(data.record)state.records.push(data.record);
    render();
   }catch(err){feedback.textContent=err.message;save.disabled=false;clear.disabled=!existing}
  }
  save.addEventListener('click',()=>void mutate('save'));
  clear.addEventListener('click',()=>void mutate('clear'));
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void mutate('save')}});
  controls.append(input,save,clear,feedback);row.append(info,controls);list.append(row);
 }
}
async function requestJson(url){
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store'});
 if(response.status===401){location.href='/r4-planner';throw Error('R4 sign-in expired')}
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.error||'Unable to load member records');
 return data;
}
let version=0;
async function refresh(){
 const current=++version,week=$('week')?.value;
 $('thp-source').textContent='Loading member names and THP records…';
 const work=[
  requestJson('/api/r4-thp'),
  week?requestJson('/api/r4-stats?duel_scores=1&week='+encodeURIComponent(week)):Promise.reject(Error('Select a week first'))
 ];
 const [thp,duel]=await Promise.allSettled(work);
 if(current!==version)return;
 if(thp.status==='fulfilled'){
  state.records=Array.isArray(thp.value.records)?thp.value.records:[];
  state.storageReady=true;
 }else{state.storageReady=false}
 if(duel.status==='fulfilled'){
  state.roster=Array.isArray(duel.value.roster)?duel.value.roster:[];
  state.source=duel.value.source||'Alliance Duel';
 }else{state.roster=[]}
 render();
 if(thp.status==='rejected')$('thp-source').textContent='THP database unavailable: '+thp.reason.message+'. Please set up the private THP table.';
 else if(duel.status==='rejected')$('thp-source').textContent='VS roster currently unavailable: '+duel.reason.message+'. Existing THP entries remain accessible.';
}
$('thp-search')?.addEventListener('input',render);
$('thp-refresh')?.addEventListener('click',()=>void refresh());
$('week')?.addEventListener('change',()=>void refresh());
$('reload')?.addEventListener('click',()=>void refresh());
document.querySelector('[data-tab="thp"]')?.addEventListener('click',()=>void refresh());
if(new URLSearchParams(location.search).get('thp')==='1'){
 // A direct link into R4 Command can open this section after the main tab code wires up.
 window.addEventListener('load',()=>document.querySelector('[data-tab="thp"]')?.click(),{once:true});
}
void refresh();
})();