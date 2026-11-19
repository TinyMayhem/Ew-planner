import {readThpFile,parsedThpRows,isRealDate} from './r4-thp-import.mjs';
import {orderThpPeople} from './r4-thp-order.mjs';

(()=>{
'use strict';
const $=id=>document.getElementById(id);
const text=(tag,content,cls)=>{
 const el=document.createElement(tag);
 if(content!==undefined&&content!==null)el.textContent=String(content);
 if(cls)el.className=cls;return el;
};
const fmt=n=>Number(n).toLocaleString('en-CA');
const norm=n=>String(n||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const sourceRoster=new Map();
const state={date:'',roster:[],records:[],latest:[],squads:[],source:'',ready:false,files:[]};
const daily=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Noronha',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let requestSequence=0;
const escapeId=id=>String(id);
const recordMap=rows=>new Map(rows.map(r=>[String(r.source_member_id),r]));
const people=()=>{
 const list=state.roster.length?state.roster:[...state.latest,...state.records].map(r=>({id:r.source_member_id,name:r.member_name}));
 const used=new Set();
 return orderThpPeople(list.filter(r=>{const id=String(r?.id||'');if(!id||!r?.name||used.has(id))return false;used.add(id);return true}),state.latest);
};
const parsePower=raw=>{
 const match=String(raw||'').replaceAll(',','').replace(/\s+/g,'').match(/^(\d+(?:\.\d+)?)([kmb])?$/i);
 if(!match)return null;const f={k:1e3,m:1e6,b:1e9}[String(match[2]||'').toLowerCase()]||1;
 const n=Number(match[1])*f;return Number.isSafeInteger(n)&&n>=0?Math.round(n):null;
};
async function requestJson(url,body){
 const opt=body?{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}
  :{credentials:'same-origin',cache:'no-store'};
 const response=await fetch(url,opt);
 if(response.status===401){location.href='/r4-planner';throw Error('R4 login expired')}
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.error||'Data unavailable');
 return data;
}
function renderMembers(){
 const root=$('thp-list'),summary=$('thp-summary'),status=$('thp-source');
 if(!root||!summary||!status)return;
 const roster=people(),exact=recordMap(state.records),last=recordMap(state.latest),squads=recordMap(state.squads);
 const searched=norm($('thp-search').value),shown=roster.filter(r=>norm(r.name).includes(searched));
 const available=roster.filter(m=>last.has(String(m.id)));
 const total=available.reduce((n,m)=>n+Number(last.get(String(m.id)).thp),0);
 summary.replaceChildren();
 for(const [title,value] of [
  ['Members on VS roster',fmt(roster.length)],
  ['Members with saved THP',fmt(available.length)+' / '+fmt(roster.length)],
  ['No THP recorded yet',fmt(roster.length-available.length)],
  ['Latest saved THP total',fmt(total)]
 ]){const box=text('div',null,'stat-summary');box.append(text('b',value),text('span',title));summary.append(box)}
 status.textContent=state.roster.length
  ?'Roster: '+(state.source||'Alliance Duel')+'. Each member displays their latest recorded THP and last update date. The date picker is only for adding, editing, or clearing a dated THP entry. No daily updates needed.'
  :'Live roster not available. Showing saved THP names; try refreshing the Alliance Duel connection.';
 root.replaceChildren();
 if(!shown.length){root.append(text('p',searched?'No matching names.':'No VS roster or saved THP records available.','stat-empty'));return}
 for(const member of shown){
  const id=escapeId(member.id),current=exact.get(id),prior=last.get(id),squad=squads.get(id);
  const row=text('div',null,'stat-thp-row'+(prior?'':' stat-thp-missing'));
  const info=text('div',null,'stat-thp-person');
  info.append(text('strong',member.name));
  if(prior)info.append(text('span',fmt(prior.thp)+' THP','stat-thp-value'));
  else info.append(text('span','THP not recorded','stat-thp-unrecorded'));
  if(squad)info.append(text('small','Main squad: '+(squad.squad_type?({tank:'Tank',air:'Air',missile:'Missile'}[squad.squad_type]):'Unspecified')+(squad.squad_power===null?'':' · '+fmt(squad.squad_power)+' power'),'stat-muted'));

  if(prior){
   info.append(text('small','Last THP update: '+prior.recorded_on,'stat-thp-last-date'));
   if(prior.updated_at)info.append(text('small','Saved/edited: '+new Date(prior.updated_at).toLocaleString()+(prior.entry_source?' · '+prior.entry_source:''),'stat-muted'));
  }else info.append(text('small','No THP recorded yet.','stat-muted'));
  const controls=text('div',null,'stat-thp-controls'),input=document.createElement('input');
  input.type='text';input.inputMode='decimal';input.autocomplete='off';input.maxLength=35;
  input.setAttribute('aria-label','THP for '+member.name+' on selected edit date '+state.date);
  input.placeholder='THP for '+state.date+' (e.g. 142M)';input.value=current?fmt(current.thp):'';
  const save=text('button','Save THP','stat-button primary'),clear=text('button','Clear','stat-button');
  save.type='button';clear.type='button';clear.disabled=!current;save.disabled=!state.ready;
  const feedback=text('small','','stat-thp-feedback');feedback.setAttribute('role','status');
  async function change(mode){
   if(mode==='clear'&&!confirm('Remove the '+state.date+' THP value for '+member.name+'?'))return;
   const power=mode==='save'?parsePower(input.value):null;
   if(mode==='save'&&power===null){feedback.textContent='Enter a number, such as 142000000 or 142M.';return}
   save.disabled=true;clear.disabled=true;feedback.textContent='Saving…';
   try{
    const result=await requestJson('/api/r4-stats',{action:'member_thp',mode,
     source_member_id:id,member_name:String(member.name),recorded_on:state.date,
     entry_source:'manual',...(mode==='save'?{thp:power}:{})});
    state.records=state.records.filter(r=>String(r.source_member_id)!==id);
    if(result.record)state.records.push(result.record);
    // Refresh both exact and last-known snapshots after saving or clearing.
    await refreshSnapshot();renderMembers();
   }catch(e){feedback.textContent=e.message;save.disabled=false;clear.disabled=!current}
  }
  save.addEventListener('click',()=>void change('save'));
  clear.addEventListener('click',()=>void change('clear'));
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void change('save')}});
  controls.append(text('small','Entry date: '+state.date+(current?' · existing entry':' · new entry'),'stat-muted'),input,save,clear,feedback);
  const squadControls=text('div',null,'stat-squad-controls');
  const typeLabel=text('label','Main squad (optional)'),typeSelect=document.createElement('select');
  typeSelect.setAttribute('aria-label','Main squad type for '+member.name);
  for(const [value,label] of [['','Not specified'],['tank','Tank'],['air','Air'],['missile','Missile']])
   typeSelect.append(new Option(label,value));
  typeSelect.value=squad?.squad_type||'';
  typeLabel.append(typeSelect);
  const powerLabel=text('label','Squad power (optional)'),powerInput=document.createElement('input');
  powerInput.type='text';powerInput.inputMode='decimal';powerInput.maxLength=35;powerInput.autocomplete='off';
  powerInput.placeholder='e.g. 35.5M';powerInput.value=squad?.squad_power===null||squad?.squad_power===undefined?'':fmt(squad.squad_power);
  powerInput.setAttribute('aria-label','Main squad power for '+member.name);
  powerLabel.append(powerInput);
  const saveSquad=text('button','Save squad','stat-button'),squadFeedback=text('small','','stat-squad-feedback');
  saveSquad.type='button';saveSquad.disabled=!state.ready;squadFeedback.setAttribute('role','status');
  async function saveSquadFields(){
   const raw=powerInput.value.trim(),power=raw?parsePower(raw):null;
   if(raw&&power===null){squadFeedback.textContent='Enter a whole number such as 35.5M, or leave blank.';return}
   saveSquad.disabled=true;squadFeedback.textContent='Saving…';
   try{
    await requestJson('/api/r4-stats',{action:'member_squad',
     source_member_id:id,member_name:String(member.name),
     squad_type:typeSelect.value||null,squad_power:power});
    await refreshSnapshot();
    const notice=$('thp-squad-notice');if(notice)notice.textContent='Saved optional squad details for '+member.name+'.';
   }catch(e){squadFeedback.textContent=e.message;saveSquad.disabled=false}
  }
  saveSquad.addEventListener('click',()=>void saveSquadFields());
  powerInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void saveSquadFields()}});
  squadControls.append(typeLabel,powerLabel,saveSquad,squadFeedback);
  const editors=text('div',null,'stat-thp-editors');editors.append(controls,squadControls);
  row.append(info,editors);root.append(row);
 }
}
async function refreshSnapshot(){
 const date=state.date,sequence=++requestSequence;
 const data=await requestJson('/api/r4-stats?member_thp=1&date='+encodeURIComponent(date));
 if(sequence!==requestSequence)return;
 state.records=data.records||[];state.latest=data.latest||[];state.squads=data.squads||[];state.ready=true;
 renderMembers();
 document.dispatchEvent(new CustomEvent('r4-thp-changed',{detail:{date}}));
}
async function refreshRoster(){
 const week=$('week')?.value;
 if(!week)return;
 const result=await requestJson('/api/r4-stats?duel_scores=1&week='+encodeURIComponent(week));
 state.roster=Array.isArray(result.roster)?result.roster:[];
 state.source=result.source||'Alliance Duel';
 for(const person of state.roster)sourceRoster.set(String(person.id),person);
}
async function refreshAll(){
 $('thp-source').textContent='Loading dated THP and VS roster…';
 const [snapshot,roster]=await Promise.allSettled([refreshSnapshot(),refreshRoster()]);
 if(snapshot.status==='rejected'){state.ready=false;$('thp-source').textContent='THP storage unavailable: '+snapshot.reason.message}
 if(roster.status==='rejected')$('thp-source').textContent='VS member names unavailable ('+roster.reason.message+'). Saved THP entries still work.';
 renderMembers();renderFiles();
}
function addOption(select,value,label){select.append(new Option(label,String(value)))}
function selectColumn(file,kind,changed){
 const label=text('label',kind==='name'?'Player name column':'THP column'),sel=document.createElement('select');
 for(const [i,head] of file.data.head.entries())addOption(sel,i,head);
 sel.value=String(file[kind+'Col']);sel.addEventListener('change',()=>{file[kind+'Col']=Number(sel.value);file.overrides.clear();changed()});
 label.append(sel);return label;
}
function fileRows(file){
 const parsed=parsedThpRows({matrix:file.data.matrix,nameCol:file.nameCol,thpCol:file.thpCol},state.roster);
 const final=[...parsed.rows],taken=new Set(final.map(r=>r.source_member_id));
 const problems=[];
 for(const miss of parsed.unmatched){
  const mapped=file.overrides.get(miss.line);
  const source=state.roster.find(x=>String(x.id)===String(mapped));
  if(!source||miss.thp===null){problems.push(miss);continue}
  if(taken.has(String(source.id))){problems.push({...miss,reason:'This member already appears in the file'});continue}
  taken.add(String(source.id));
  final.push({source_member_id:String(source.id),member_name:source.name,thp:miss.thp});
 }
 return {rows:final,problems,error:parsed.error};
}
function renderFiles(){
 const root=$('thp-upload-queue');if(!root)return;root.replaceChildren();
 const upload=$('thp-upload-all');upload.disabled=!state.ready||!state.roster.length||!state.files.length;
 if(!state.files.length){root.append(text('p','No files selected. Choose multiple files to give each its own THP date.','stat-muted'));return}
 for(const file of state.files){
  const card=text('article',null,'stat-card stat-thp-import'),heading=text('div',null,'stat-inline');
  heading.append(text('strong',file.file.name));
  const remove=text('button','Remove','stat-button');remove.type='button';remove.addEventListener('click',()=>{state.files=state.files.filter(f=>f!==file);renderFiles()});heading.append(remove);
  card.append(heading);
  if(file.error){card.append(text('p',file.error,'stat-flag blocked'));root.append(card);continue}
  const form=text('div',null,'stat-fields'),dateLabel=text('label','Measurement date'),date=document.createElement('input');
  date.type='date';date.value=file.date;date.addEventListener('change',()=>{file.date=date.value;renderFiles()});dateLabel.append(date);
  form.append(dateLabel,selectColumn(file,'name',renderFiles),selectColumn(file,'thp',renderFiles));card.append(form);
  const result=fileRows(file),status=text('p',null,'stat-muted');
  status.textContent=result.rows.length+' matched · '+result.problems.length+' need review · date '+(file.date||'not set')+(file.status?' · '+file.status:'');
  card.append(status);
  if(!isRealDate(file.date))card.append(text('p','Select a valid date before uploading.','stat-flag blocked'));
  for(const problem of result.problems.slice(0,30)){
   const line=text('div',null,'stat-thp-unmatched'),description=text('span',problem.name+' · '+problem.reason+' · '+(problem.thp===null?'invalid THP':fmt(problem.thp)));
   line.append(description);
   if(problem.thp!==null){
    const selector=document.createElement('select');addOption(selector,'','Choose matching VS member');
    for(const member of state.roster)addOption(selector,member.id,member.name);
    selector.value=file.overrides.get(problem.line)||'';
    selector.addEventListener('change',()=>{file.overrides.set(problem.line,selector.value);renderFiles()});
    line.append(selector);
   }
   card.append(line);
  }
  if(result.problems.length>30)card.append(text('p','Resolve additional unmatched rows by selecting a more accurate name/THP column or editing the source file.','stat-muted'));
  if(file.status==='uploaded')card.append(text('p','Saved successfully on '+file.date,'stat-muted'));
  root.append(card);
 }
}
async function queue(files){
 if(files.length>20){$('thp-upload-status').textContent='Select up to 20 files per batch.';return}
 state.files=[];
 for(const file of files){
  try{
   const data=await readThpFile(file);
   state.files.push({file,data,nameCol:data.nameCol,thpCol:data.thpCol,date:data.date||state.date,overrides:new Map(),status:''});
  }catch(e){state.files.push({file,error:e.message,status:'Invalid'})}
 }
 renderFiles();
}
async function uploadAll(){
 const button=$('thp-upload-all');button.disabled=true;
 let successful=0,failed=0;
 for(const file of state.files){
  if(file.error||file.status==='uploaded')continue;
  const result=fileRows(file);
  if(!isRealDate(file.date)||result.error||result.problems.length||!result.rows.length){
   file.status='Needs correction before upload';failed++;continue;
  }
  file.status='Uploading…';renderFiles();
  try{
   await requestJson('/api/r4-stats',{
    action:'member_thp',mode:'bulk',recorded_on:file.date,
    entry_source:file.file.name.slice(0,180),rows:result.rows
   });
   successful++;file.status='uploaded';
  }catch(e){file.status=e.message;failed++}
  renderFiles();
 }
 $('thp-upload-status').textContent=successful+' file(s) saved; '+failed+' need correction. Missing roster members can be filled manually for each selected date.';
 await refreshSnapshot().catch(()=>{});
 renderFiles();
}
function start(){
 state.date=daily();$('thp-date').value=state.date;
 $('thp-date').addEventListener('change',()=>{if(!isRealDate($('thp-date').value))return;state.date=$('thp-date').value;void refreshSnapshot()});
 $('thp-search').addEventListener('input',renderMembers);
 $('thp-refresh').addEventListener('click',()=>void refreshAll());
 $('thp-files').addEventListener('change',e=>void queue([...e.target.files]));
 $('thp-upload-all').addEventListener('click',()=>void uploadAll());
 $('week')?.addEventListener('change',()=>void refreshRoster().then(()=>{renderMembers();renderFiles()}).catch(()=>{}));
 document.querySelector('[data-tab="thp"]')?.addEventListener('click',()=>void refreshAll());
 if(new URLSearchParams(location.search).get('thp')==='1')
  window.addEventListener('load',()=>document.querySelector('[data-tab="thp"]')?.click(),{once:true});
 void refreshAll();
}
if($('thp-date'))start();
})();