// Read-only Train Desk search for a player's full train history and the
// longest documented wait between two members. Separate from eligibility.
import {matchConductors} from './r4-conductor-search.mjs';

const asDate=(str)=>new Date(str+'T12:00:00Z');
const dayDiff=(date,today)=>date?Math.max(0,Math.round((asDate(today)-asDate(date))/86400000)):null;
const displayDays=days=>days===null?'No linked record':days===0?'Today':days===1?'1 day ago':days+' days ago';
const titleCase=role=>role==='vip'?'VIP':'Conductor';
const create=(tag,value,cls)=>{
 const el=document.createElement(tag);
 if(value!==undefined&&value!==null)el.textContent=String(value);
 if(cls)el.className=cls;
 return el;
};
export function initTrainHistoryChecker({getMembers,getAliases}){
 const firstInput=document.getElementById('train-check-first');
 const secondInput=document.getElementById('train-check-second');
 const firstList=document.getElementById('train-check-first-list');
 const secondList=document.getElementById('train-check-second-list');
 const status=document.getElementById('train-check-status');
 const root=document.getElementById('train-check-results');
 const role=document.getElementById('train-check-role');
 const refreshButton=document.getElementById('train-check-refresh');
 const clearButton=document.getElementById('train-check-clear');
 if(!firstInput||!secondInput||!root)return {refresh(){}};
 let firstId='',secondId='',sequence=0,loaded=false;
 const choices=()=>getMembers().map(m=>({id:m.id,name:m.display_name}));
 const findName=id=>choices().find(m=>m.id===id)?.name||null;
 const pickers=[];
 function picker(input,list,select){
  let results=[],active=-1;
  const close=()=>{list.hidden=true;list.replaceChildren();results=[];active=-1;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant')};
  function show(){
   results=matchConductors(choices(),getAliases(),input.value,12);
   active=-1;list.replaceChildren();
   if(!results.length)list.append(create('p','No matching member or nickname.','train-check-no-match'));
   results.forEach((result,index)=>{
    const button=create('button',null,'train-check-option');
    button.type='button';button.id=list.id+'-'+index;button.setAttribute('role','option');
    button.setAttribute('aria-selected','false');
    button.append(create('strong',result.name));
    if(result.aliasMatch)button.append(create('small','Previously: '+result.aliasMatch));
    button.addEventListener('mousedown',e=>e.preventDefault());
    button.addEventListener('click',()=>{input.value=result.name;select(result.id);close();});
    list.append(button);
   });
   list.hidden=false;input.setAttribute('aria-expanded','true');
  }
  const mark=n=>{
   if(!results.length)return;
   active=(n+results.length)%results.length;
   [...list.querySelectorAll('[role="option"]')].forEach((btn,i)=>{
    btn.setAttribute('aria-selected',String(i===active));
    if(i===active){
     input.setAttribute('aria-activedescendant',btn.id);
     btn.scrollIntoView({block:'nearest'});
    }
   });
  };
  input.addEventListener('focus',show);
  input.addEventListener('input',()=>{
   select('',false);
   show();
  });
  input.addEventListener('keydown',e=>{
   if(e.key==='Escape'){close();return}
   if(e.key==='Tab'){close();return}
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();if(list.hidden)show();
    mark(active<0?(e.key==='ArrowDown'?0:results.length-1):active+(e.key==='ArrowDown'?1:-1));
   }
   if(e.key==='Enter'&&!list.hidden&&results.length){
    e.preventDefault();select(results[active<0?0:active].id);
    input.value=findName(results[active<0?0:active].id)||results[active<0?0:active].name;
    close();
   }
  });
  pickers.push({input,list,close});
  return {close};
 }
 picker(firstInput,firstList,(id,loadNow=true)=>{
  firstId=id;
  if(loadNow)void load();
  else{sequence++;root.replaceChildren();status.textContent='Select a player from the suggestions to see their train history.'}
 });
 picker(secondInput,secondList,(id,loadNow=true)=>{
  secondId=id;
  if(loadNow)void load();
  else{sequence++;if(firstId)status.textContent='Select the second player to compare, or clear this field to see one player.'}
 });
 document.addEventListener('pointerdown',e=>{
  for(const p of pickers)if(!p.input.parentElement.contains(e.target))p.close();
 });
 function lastSummary(container,title,date,today){
  const box=create('div',null,'train-check-stat');
  box.append(create('small',title),create('strong',date||'Not recorded'));
  box.append(create('span',displayDays(dayDiff(date,today))));
  container.append(box);
 }
 function details(section,entries,title,empty){
  const details=create('details',null,'train-check-details');
  const summary=create('summary',title+' ('+entries.length+')');
  details.append(summary);
  if(!entries.length){details.append(create('p',empty,'stat-muted'));section.append(details);return}
  const list=create('div',null,'train-check-entries');
  for(const r of entries){
   const row=create('div',null,'train-check-entry');
   const heading=create('div',null,'train-check-entry-heading');
   heading.append(create('strong',r.date+' · '+titleCase(r.role)),create('small','Stage '+r.stage+' · '+r.origin));
   row.append(heading,create('div',r.slot||'Train','train-check-slot'));
   row.append(create('small',(r.role==='vip'?'Conductor: ':'VIP: ')+(r.withName||'Not recorded')+' · '+(r.source||'unspecified'),'stat-muted'));
   list.append(row);
  }
  details.append(list);section.append(details);
 }
 function personCard(record,today){
  const card=create('article',null,'train-check-person');
  card.append(create('h3',record.name));
  const stats=create('div',null,'train-check-stats');
  lastSummary(stats,'Last train, either role',record.lastAny,today);
  lastSummary(stats,'Last conductor',record.lastConductor,today);
  lastSummary(stats,'Last VIP',record.lastVip,today);
  card.append(stats);
  card.append(create('p',record.total+' matched past train record'+(record.total===1?'':'s')+
   ' · '+record.conductorCount+' conductor · '+record.vipCount+' VIP','train-check-counts'));
  details(card,record.history,'Recorded train history','No linked conductor or VIP train entries in the saved archive.');
  if(record.future?.length)details(card,record.future,'Future scheduled assignments','No upcoming assignments.');
  return card;
 }
 function comparisonCard(data){
  const a=data.first,b=data.second,c=data.comparison;
  const box=create('section',null,'train-check-comparison');
  const label=data.role==='vip'?'VIP only':data.role==='conductor'?'Conductor only':'Either role';
  box.append(create('strong','Who has waited longer? · '+label,'train-check-comparison-title'));
  const comparisonField=data.role==='vip'?'lastVip':data.role==='conductor'?'lastConductor':'lastAny';
  const split=create('div',null,'train-check-compare-grid');
  for(const person of [a,b]){
   const pane=create('div',null,'train-check-compare-person'+(c?.winnerId===person.memberId?' train-check-longest':''));
   pane.append(create('strong',person.name),create('span',displayDays(dayDiff(person[comparisonField],data.today))));
   pane.append(create('small',person[comparisonField]?'Last: '+person[comparisonField]:'No linked record'));
   split.append(pane);
  }
  box.append(split);
  if(c){
   const verdict=c.tie?'Recorded wait: tie':(c.winnerId===a.memberId?a.name:b.name)+' has the longer documented wait.';
   box.append(create('p',verdict,'train-check-verdict'));
   box.append(create('p',c.message+(c.gapDays!==undefined?' · '+c.gapDays+' days between their last recorded turns.':''),'stat-muted'));
   if(c.unverified)box.append(create('p','Verify old nicknames with R4 before treating a missing record as proof the player never rode.','train-check-caution'));
  }
  return box;
 }
 function draw(data){
  root.replaceChildren();
  if(data.second)root.append(comparisonCard(data));
  const cols=create('div',null,'train-check-results-grid');
  cols.append(personCard(data.first,data.today));
  if(data.second)cols.append(personCard(data.second,data.today));
  root.append(cols);
  const notes=create('p',null,'stat-muted');
  notes.textContent='Records checked across all saved stages through '+data.today+' (server time). '+
   (data.earliestRecordedDate?'Earliest saved train: '+data.earliestRecordedDate+'. ':'')+
   (data.unlinkedLegacyCount?'The archive has '+data.unlinkedLegacyCount+' historical role name'+(data.unlinkedLegacyCount===1?'':'s')+' that could not be linked; check aliases before relying on missing history. ':'')+
   'Longer wait does not override conductor Stage limits, weekly VIP limits, R4 exceptions or hive eligibility.';
  root.append(notes);
 }
 async function load(){
  const id=firstId,second=secondId;
  const requestId=++sequence;
  if(!id){
   root.replaceChildren();
   status.textContent='Search by in-game name or historical nickname, then choose a player to see their saved trains.';
   return;
  }
  if(id===second){
   root.replaceChildren();
   status.textContent='Choose two different players to compare.';
   return;
  }
  const qs=new URLSearchParams({train_history_checker:'1',first:id,role:role.value});
  if(second)qs.set('second',second);
  status.textContent='Checking complete train history…';
  try{
   const res=await fetch('/api/r4-stats?'+qs,{credentials:'same-origin',cache:'no-store'});
   const data=await res.json().catch(()=>({}));
   if(requestId!==sequence)return;
   if(res.status===401){location.href='/r4-planner';return}
   if(!res.ok)throw Error(data.error||'Train checker unavailable');
   draw(data);
   status.textContent='Records checked as of '+data.today+' (server time).';
  }catch(e){
   if(requestId!==sequence)return;
   root.replaceChildren();
   status.textContent=e.message||'Unable to check train history';
  }
 }
 role.addEventListener('change',()=>void load());
 refreshButton.addEventListener('click',()=>void load());
 clearButton.addEventListener('click',()=>{
  secondId='';secondInput.value='';pickers[1].close();
  void load();
 });
 return {refresh(){
  const roster=choices();
  if(!loaded){loaded=true;status.textContent='Start typing a member name to check their train history.'}
  if(firstId){
   if(!roster.some(m=>m.id===firstId)){firstId='';firstInput.value='';}
   else firstInput.value=findName(firstId);
  }
  if(secondId){
   if(!roster.some(m=>m.id===secondId)){secondId='';secondInput.value='';}
   else secondInput.value=findName(secondId);
  }
  if(firstId)void load();
 }};
}
