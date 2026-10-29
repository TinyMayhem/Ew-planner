import {csvForReport,guessColumn,targetFromCsvDate,validTarget,rowsFromCsv} from './r4-csv-utils.mjs';
import {archivedWeeks,vsWeekSlots,vsLeaderboard,weekOf,scoreFlag} from './r4-vs-archive.mjs';

(()=>{'use strict';
const $=id=>document.getElementById(id), fmt=n=>Number(n).toLocaleString('en-CA');
const state={data:null,week:'',season:'post-s5',archiveImports:[],csvQueue:[],candidates:[]};
let csvBusy=false,nextCsvId=0;
const text=(tag,content,cls)=>{const el=document.createElement(tag);if(content!==undefined&&content!==null)el.textContent=String(content);if(cls)el.className=cls;return el};
const dateAdd=(s,days)=>new Date(Date.parse(s+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
const serverToday=()=>{const d=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Noronha',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const v=Object.fromEntries(d.map(x=>[x.type,x.value]));return v.year+'-'+v.month+'-'+v.day};
const monday=d=>dateAdd(d,-(new Date(d+'T00:00:00Z').getUTCDay()+6)%7);
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&!Number.isNaN(Date.parse(d+'T00:00:00Z'));
const normalize=n=>String(n||'').trim().replace(/\s+/g,' ').normalize('NFKC').toLowerCase();
const members=()=>state.data?.members||[];
const aliases=()=>state.data?.aliases||[];
const byId=id=>members().find(m=>m.id===id);
const memberName=id=>byId(id)?.display_name||'Unknown member';
const elEmpty=msg=>text('p',msg,'stat-empty');
const setContent=(id,...nodes)=>$(id).replaceChildren(...nodes);
const notice=(message,error=false)=>{const n=$('notice');n.hidden=!message;n.className='stat-notice'+(error?' error':'');n.textContent=message||'';if(message)n.scrollIntoView({block:'nearest'})};
async function post(body,multipart=false){notice('');const r=await fetch('/api/r4-stats',{method:'POST',credentials:'same-origin',headers:multipart?{}:{'Content-Type':'application/json'},body:multipart?body:JSON.stringify(body)});const data=await r.json().catch(()=>({}));if(r.status===401){location.href='/r4-planner';throw Error('R4 sign-in expired')}if(!r.ok)throw Error(data.error||'Could not save the change');return data}
async function action(fn,success){try{await fn();await load();notice(success)}catch(e){notice(e.message,true)}}
const opt=(id,includeBlank=false)=>{const select=$(id),old=select.value;select.replaceChildren();if(includeBlank){const o=new Option('Not recorded','');select.append(o)}for(const m of members())select.append(new Option(m.display_name,m.id));if([...select.options].some(o=>o.value===old))select.value=old};
function ranking(metric,period){
 const imp=state.data.imports.find(x=>x.metric===metric&&x.period===period);
 if(!imp)return [];
 const aliasMember=new Map(aliases().map(a=>[a.alias_key,a.member_id]));
 const map=new Map();
 for(const v of state.data.values.filter(v=>v.import_id===imp.id)){
  const id=aliasMember.get(v.alias_key);if(!id)continue;
  const points=Number(v.points);
  if(!map.has(id)||points>map.get(id).points)map.set(id,{id,points,dup:map.has(id)});
  else map.get(id).dup=true;
 }
 return [...map.values()].sort((a,b)=>b.points-a.points||memberName(a.id).localeCompare(memberName(b.id)));
}
function lines(target,rows,limit=10,metric=null){
 const root=$(target);root.replaceChildren();if(!rows.length){root.append(elEmpty('No CSV data for this period yet.'));return}
 rows.slice(0,limit).forEach((r,i)=>{const line=text('div',null,'stat-line');line.append(text('span','#'+(i+1),'stat-rank'));
 const mid=text('div');mid.append(text('strong',memberName(r.id)));if(r.dup)mid.append(text('small','Multiple aliases in one snapshot, highest value used'));if(metric&&scoreFlag(metric,r.points))mid.append(text('small','Below '+(metric==='vs_daily'?'7.2M':'42M'),'stat-vs-low'));line.append(mid,text('span',fmt(r.points),'stat-points'));root.append(line)});
}
function statBox(label,value){const box=text('div',null,'stat-summary');box.append(text('b',value),text('span',label));return box}
function overview(){
 const d=state.data,week=state.week,donations=ranking('donations_weekly',week),vs=ranking('vs_weekly',week);
 const unique=new Set(d.values.map(v=>d.aliases.find(a=>a.alias_key===v.alias_key)?.member_id).filter(Boolean));
 setContent('summary',statBox('Members in directory',fmt(d.members.length)),statBox('Members with active CSV stats',fmt(unique.size)),statBox('DS records this week',fmt(d.ds.length)));
 lines('weekly-vs',vs,10,'vs_weekly');lines('weekly-donations',donations);
 const select=$('daily-date'),old=select.value;select.replaceChildren();for(let i=0;i<7;i++){const v=dateAdd(week,i);select.append(new Option(v,v))}
 select.value=[...select.options].some(o=>o.value===old)?old:serverToday()>=week&&serverToday()<=dateAdd(week,6)?serverToday():week;
 lines('daily-vs',ranking('vs_daily',select.value),20,'vs_daily');
}
function showTab(tab){
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 document.querySelectorAll('.stat-tab').forEach(p=>p.hidden=p.id!=='tab-'+tab);
}
function archive(){
 const root=$('vs-weeks');root.replaceChildren();
 const weeks=archivedWeeks(state.archiveImports);
 if(!weeks.length)root.append(elEmpty('No saved VS reports for this season yet. Upload a daily or weekly VS CSV to start an archive.'));
 for(const w of weeks){
  const button=text('button',null,'stat-week-choice'+(w.week===state.week?' selected':''));
  button.type='button';button.setAttribute('aria-pressed',String(w.week===state.week));
  button.append(text('strong','Week of '+w.week),text('small',w.dailyCount+'/6 days · '+(w.hasWeekly?'Weekly total saved':'Weekly total missing')));
  button.addEventListener('click',async()=>{$('week').value=w.week;await load();showTab('vsarchive')});
  root.append(button);
 }
 const results=$('vs-week-results'),expanded=new Set([...results.querySelectorAll('details[open]')].map(x=>x.dataset.slot));
 results.replaceChildren();$('vs-week-title').textContent='Week of '+state.week;
 const slots=vsWeekSlots(state.week,state.data?.imports||[]);
 for(const slot of slots){
  const details=text('details',null,'stat-vs-slot');details.dataset.slot=slot.metric+'|'+slot.period;
  const summary=text('summary',null,'stat-vs-summary');
  const heading=text('div',null,'stat-vs-name');
  heading.append(text('strong',slot.label),text('small',slot.metric==='vs_daily'?slot.period:'Monday '+slot.period+' to Sunday '+dateAdd(slot.period,6)));
  const info=text('div',null,'stat-vs-status');
  if(!slot.import){
   info.append(text('span','Not recorded','stat-vs-absent'));
   summary.append(heading,info);details.append(summary,text('p','No CSV uploaded for this result. This is missing data, not a failed score.','stat-muted'));
  }else{
   const rows=vsLeaderboard(state.data,slot.metric,slot.period);
   const flagged=rows.filter(x=>x.belowTarget).length;
   info.append(text('span',fmt(rows.length)+' members','stat-vs-members'));
   info.append(text('span',flagged+' below '+(slot.metric==='vs_daily'?'7.2M':'42M'),flagged?'stat-vs-low':'stat-vs-clear'));
   summary.append(heading,info);details.append(summary);
   const content=text('div',null,'stat-vs-detail');
   content.append(text('p','Recorded from '+slot.import.filename+' · '+new Date(slot.import.created_at).toLocaleString()+' · All '+rows.length+' member results','stat-muted'));
   const wrap=text('div',null,'stat-scroll'),table=text('table',null,'stat-table stat-vs-table'),thead=text('thead'),hr=text('tr');
   for(const name of ['Rank','Member','VS score','Target'])hr.append(text('th',name));
   thead.append(hr);table.append(thead);
   const tbody=text('tbody');
   for(const entry of rows){
    const tr=text('tr',null,entry.belowTarget?'stat-vs-under':'');
    tr.append(text('td','#'+entry.rank));
    const member=text('td');member.append(text('strong',entry.name));
    if(entry.duplicate)member.append(text('small','Aliases merged; highest score used','stat-muted'));
    tr.append(member,text('td',fmt(entry.points),'stat-vs-points'));
    const status=text('td');status.append(text('span',entry.belowTarget?'Below target':'Met target',entry.belowTarget?'stat-vs-low':'stat-vs-clear'));
    tr.append(status);tbody.append(tr);
   }
   table.append(tbody);wrap.append(table);content.append(wrap);details.append(content);
  }
  if(expanded.has(details.dataset.slot))details.open=true;
  results.append(details);
 }
}
function imports(){
 const root=$('imports');root.replaceChildren();if(!state.data.imports.length){root.append(elEmpty('No active imports yet.'));return}
 const wrap=text('div',null,'stat-scroll'),table=text('table',null,'stat-table'),head=text('tr');
 ['Metric','Period','Rows','Filename','Saved','Action'].forEach(x=>head.append(text('th',x)));
 const thead=text('thead');thead.append(head);table.append(thead);
 for(const imp of state.data.imports.slice().sort((a,b)=>a.period.localeCompare(b.period))){
  const tr=text('tr');[imp.metric.replaceAll('_',' '),imp.period,imp.row_count,imp.filename,new Date(imp.created_at).toLocaleString()].forEach(v=>tr.append(text('td',v)));const cell=text('td');const remove=text('button','Delete upload','stat-button');remove.type='button';remove.addEventListener('click',()=>{if(confirm('Remove '+imp.filename+' for '+imp.period+'? The owner can undo this in the audit log.'))action(()=>post({action:'delete_import',id:imp.id}),'Import removed and audited.')});cell.append(remove);tr.append(cell);table.append(tr)
 }wrap.append(table);root.append(wrap);
}
function directory(){
 const query=normalize($('member-search').value),root=$('directory');root.replaceChildren();
 const filtered=members().filter(m=>normalize(m.display_name).includes(query)||aliases().some(a=>a.member_id===m.id&&normalize(a.alias).includes(query)));
 for(const m of filtered.slice(0,300)){const card=text('div',null,'stat-person');card.append(text('b',m.display_name));card.append(text('span',aliases().filter(a=>a.member_id===m.id).map(a=>a.alias).join(' · ')||'No nicknames'));root.append(card)}
 if(!filtered.length)root.append(elEmpty('No matching members.'));
}
function memberFields(){
 for(const id of ['merge-from','merge-to','alias-member','ds-first','ds-second','ds-third','train-member','exception-member'])opt(id,id==='ds-second'||id==='ds-third');
 directory();
}
function dsHistory(){
 const root=$('ds-history');root.replaceChildren();const data=state.data.ds;if(!data.length){root.append(elEmpty('No DS results uploaded this week.'));return}
 for(const d of data){const card=text('article',null,'stat-row');
  card.append(text('strong',d.event_date+(d.opponent?' · vs '+d.opponent:'')));
  const ol=text('p','🥇 '+memberName(d.first_member)+(d.second_member?'  ·  🥈 '+memberName(d.second_member):'')+(d.third_member?'  ·  🥉 '+memberName(d.third_member):''));card.append(ol);
  if(d.notes)card.append(text('p',d.notes,'stat-muted'));
  const remove=text('button','Delete DS record','stat-button');remove.type='button';remove.addEventListener('click',()=>{if(confirm('Remove Desert Storm result from '+d.event_date+'? The owner can undo this.'))action(()=>post({action:'delete_ds',id:d.id}),'DS result removed and audited.')});card.append(remove);
  const a=text('a','Open original screenshot');a.href='/api/r4-stats?image='+encodeURIComponent(d.id);a.target='_blank';a.rel='noopener';const image=document.createElement('img');image.src=a.href;image.alt='DS evidence screenshot';image.loading='lazy';image.className='stat-evidence';a.prepend(image);card.append(a);root.append(card);
 }
}
const activeException=(id,source,date)=>state.data.exceptions.filter(x=>x.active&&x.member_id===id&&x.starts_on<=date&&x.ends_on>=date&&(x.scope==='all'||x.scope===source));
const recentAwards=(id,date)=>state.data.awards.filter(x=>x.member_id===id&&x.train_date<=date&&x.train_date>=dateAdd(date,-7));
function suggested(){
 const source=$('train-source').value,date=$('train-date').value;
 if(!validDate(date)||monday(date)!==state.week)return [];
 const week=state.week;
 if(source==='ds'){
  const ds=state.data.ds.filter(x=>x.event_date<=date).sort((a,b)=>b.event_date.localeCompare(a.event_date)||b.created_at.localeCompare(a.created_at))[0];
  return ds?[ds.first_member,ds.second_member,ds.third_member].filter(Boolean).map((id,i)=>({id,points:null,place:i+1,context:'DS on '+ds.event_date})):[];
 }
 if(source==='donations')return ranking('donations_weekly',week).slice(0,10).map((r,i)=>({...r,place:i+1}));
 if(source==='vs'){
  const dates=state.data.imports.filter(x=>x.metric==='vs_daily'&&x.period<=date).sort((a,b)=>b.period.localeCompare(a.period));
  const latest=dates[0]?.period;
  return latest?ranking('vs_daily',latest).slice(0,10).map((r,i)=>({...r,place:i+1,context:'VS on '+latest})):[];
 }
 return [];
}
function candidates(){
 const root=$('candidates'),date=$('train-date').value,source=$('train-source').value;root.replaceChildren();
 const candidate=suggested();state.candidates=candidate;
 if(source==='manual'){root.append(elEmpty('Manual choice. Select any member and add a reason.'));return}
 if(!candidate.length){root.append(elEmpty('No matching source results yet. Upload the relevant CSV or DS result, or choose Manual.'));return}
 let recommended=false;
 for(const c of candidate){const blocked=activeException(c.id,source,date),recent=recentAwards(c.id,date);
  const row=text('div',null,'stat-candidate');const info=text('div');info.append(text('strong','#'+c.place+' '+memberName(c.id)));
  if(c.points!==null)info.append(text('div',fmt(c.points)+' points','stat-muted'));
  if(c.context)info.append(text('div',c.context,'stat-muted'));
  if(blocked.length)info.append(text('div','Exception: '+blocked.map(x=>x.reason).join(' / '),'stat-flag blocked'));
  if(recent.length)info.append(text('div','Recently conducted: '+recent.map(x=>x.train_date).join(', '),'stat-flag'));
  if(!recommended&&!blocked.length){info.append(text('div','First candidate without an active exception','stat-muted'));recommended=true}
  const button=text('button','Choose','stat-button');button.type='button';button.addEventListener('click',()=>{$('train-member').value=c.id});
  row.append(info,button);root.append(row);
 }
 const first=candidate.find(c=>!activeException(c.id,source,date).length);
 if(first)$('train-member').value=first.id;
}
function exceptionList(){
 const root=$('exceptions');root.replaceChildren();const active=state.data.exceptions.filter(x=>x.active).sort((a,b)=>b.starts_on.localeCompare(a.starts_on));
 if(!active.length){root.append(elEmpty('No active exceptions.'));return}
 for(const x of active){const line=text('div',null,'stat-row');
  line.append(text('strong',memberName(x.member_id)+' · '+x.scope.toUpperCase()),text('p',x.starts_on+' to '+x.ends_on+' · '+x.reason,'stat-muted'));
  const button=text('button','Clear exception','stat-button');button.addEventListener('click',()=>{if(confirm('Clear this exception?'))action(()=>post({action:'clear_exception',id:x.id}),'Exception cleared.')});
  line.append(button);root.append(line);
 }
}
function trainHistory(){
 const root=$('train-history');root.replaceChildren();if(!state.data.awards.length){root.append(elEmpty('No train assignments in this window.'));return}
 for(const award of state.data.awards){const row=text('div',null,'stat-row');row.append(text('strong',award.train_date+' · '+award.slot+' · '+memberName(award.member_id)));row.append(text('p',award.source.toUpperCase()+(award.reason?' · '+award.reason:''),'stat-muted'));
  const button=text('button','Remove mistaken assignment','stat-button');button.addEventListener('click',()=>{if(confirm('Delete this train assignment?'))action(()=>post({action:'delete_award',id:award.id}),'Assignment removed.')});row.append(button);root.append(row)
 }
}
function render(){if(!state.data)return;overview();archive();imports();memberFields();dsHistory();exceptionList();trainHistory();candidates()}
async function load(){
 const week=$('week').value;state.season=$('season').value;
 if(!validDate(week)||monday(week)!==week){notice('Select a Monday for the week.',true);return}
 state.week=week;$('sync').textContent='Loading…';
 try{const [r,archiveResponse]=await Promise.all([fetch('/api/r4-stats?week='+encodeURIComponent(week)+'&season='+encodeURIComponent(state.season),{credentials:'same-origin',cache:'no-store'}),fetch('/api/r4-stats?archive=1&season='+encodeURIComponent(state.season),{credentials:'same-origin',cache:'no-store'})]);if(r.status===401||archiveResponse.status===401){location.href='/r4-planner';return}const [data,history]=await Promise.all([r.json(),archiveResponse.json()]);if(!r.ok)throw Error(data.error||'Data unavailable');if(!archiveResponse.ok)throw Error(history.error||'Archive unavailable');state.data=data;state.archiveImports=history.imports||[];const season=$('season');const prev=season.value;season.replaceChildren(...(data.seasons||[]).map(x=>new Option(x.label,x.id)));if([...season.options].some(x=>x.value===prev))season.value=prev;render();$('sync').textContent='Synced · '+new Date().toLocaleTimeString()}catch(e){$('sync').textContent='Unavailable';notice(e.message,true)}
}
function csvIssue(item){
 if(item.status==='invalid')return item.error;
 if(!validTarget(item.metric,item.period))return 'Select a valid date. Weekly VS and donations must use a Monday.';
 const clash=state.csvQueue.some(other=>other!==item&&other.status!=='invalid'&&other.metric===item.metric&&other.period===item.period);
 if(clash)return 'Another selected file uses the same stat type and date. Adjust one or remove the duplicate to avoid overwriting it.';
 try{rowsFromCsv(item.matrix,item.nameCol,item.pointsCol)}catch(e){return e.message}
 return '';
}
function csvField(caption,control){
 const label=text('label');label.append(text('span',caption),control);return label;
}
function csvSelect(values,selected,callback){
 const select=document.createElement('select');
 for(const [value,label] of values)select.append(new Option(label,String(value)));
 select.value=String(selected);select.addEventListener('change',()=>callback(select.value));
 return select;
}
function renderCsvQueue(){
 const root=$('csv-batch');root.replaceChildren();
 const total=state.csvQueue.length,uploaded=state.csvQueue.filter(e=>e.status==='uploaded').length;
 const failed=state.csvQueue.filter(e=>e.status==='failed').length;
 const pending=state.csvQueue.filter(e=>e.status!=='uploaded'&&e.status!=='invalid');
 const needsAttention=pending.filter(e=>csvIssue(e)).length+state.csvQueue.filter(e=>e.status==='invalid').length;
 for(const item of state.csvQueue){
  const card=text('article',null,'stat-batch-card');
  const heading=text('div',null,'stat-batch-heading'),title=text('div');
  title.append(text('strong',item.file.name),text('small',Math.ceil(item.file.size/1024)+' KB · '+(item.matrix?.length||0)+' members','stat-muted'));
  const remove=text('button','Remove','stat-button');remove.type='button';remove.disabled=csvBusy;
  remove.addEventListener('click',()=>{state.csvQueue=state.csvQueue.filter(e=>e!==item);renderCsvQueue()});
  heading.append(title,remove);card.append(heading);
  const issue=item.status==='uploaded'?'':csvIssue(item);
  const status=item.status==='uploaded'?'✓ Uploaded ('+item.result.rows+' members)':
   item.status==='uploading'?'Uploading…':item.status==='invalid'?'File needs attention: '+item.error:
   issue?'Fix before upload: '+issue:item.status==='failed'?'Upload failed: '+item.error:'Ready to upload';
  card.append(text('p',status,'stat-batch-state'+(issue||item.status==='failed'?' error':item.status==='uploaded'?' complete':'')));
  if(item.status!=='invalid'){
   const lock=csvBusy||item.status==='uploaded';
   const fields=text('div',null,'stat-fields');
   const metric=csvSelect([['vs_daily','VS Daily Results'],['vs_weekly','VS Weekly Total'],['donations_weekly','Donations Record']],item.metric,value=>{item.metric=value;item.period=targetFromCsvDate(value,item.detectedDate);if(item.status==='failed')item.status='ready';renderCsvQueue()});
   metric.disabled=lock;
   const day=text('div',item.detectedDate+(item.metric==='vs_daily'?'':' → Week of '+item.period),'stat-detected-date');
   const names=csvSelect(item.head.map((h,i)=>[i,h]),item.nameCol,value=>{item.nameCol=Number(value);if(item.status==='failed')item.status='ready';renderCsvQueue()});
   const points=csvSelect(item.head.map((h,i)=>[i,h]),item.pointsCol,value=>{item.pointsCol=Number(value);if(item.status==='failed')item.status='ready';renderCsvQueue()});
   names.disabled=lock;points.disabled=lock;
   fields.append(csvField('Stat type',metric),csvField('CSV report date',day),csvField('Name column',names),csvField('Points / total column',points));
   card.append(fields);
   const preview=text('details',null,'stat-batch-preview'),summary=text('summary','Preview first 5 rows');preview.append(summary);
   const wrap=text('div',null,'stat-scroll'),table=text('table',null,'stat-table');
   const thead=text('tr');['Name','Points / donations'].forEach(h=>thead.append(text('th',h)));table.append(thead);
   for(const row of item.matrix.slice(0,5)){const tr=text('tr');[row[item.nameCol],row[item.pointsCol]].forEach(x=>tr.append(text('td',x||'')));table.append(tr)}
   wrap.append(table);preview.append(wrap);card.append(preview);
  }
  root.append(card);
 }
 $('import').disabled=csvBusy||!pending.length;
 $('import').textContent=csvBusy?'Uploading / reading files…':pending.length?'Upload '+pending.length+' queued CSV'+(pending.length===1?'':'s'):'Choose CSV files to upload';
 $('clear-batch').disabled=csvBusy||!total;
 $('csv-file').disabled=csvBusy;
 $('season').disabled=csvBusy;
 $('metric').disabled=csvBusy;
 
 $('csv-batch-status').textContent=!total?'Select multiple CSV files above to start.':
  total+' selected · '+uploaded+' uploaded'+(needsAttention?' · '+needsAttention+' need fixes':'')+(failed?' · '+failed+' upload errors':'')+(csvBusy?' · Working through files one at a time':'');
}
async function csvChanged(){
 const input=$('csv-file'),files=[...input.files];input.value='';
 if(!files.length)return;
 if(csvBusy)return;
 const existing=new Set(state.csvQueue.map(e=>e.key));
 const next=[],skipped=[];
 for(const file of files){
  const key=file.name+'|'+file.size+'|'+file.lastModified;
  if(existing.has(key)){skipped.push(file.name+' (already selected)');continue}
  if(state.csvQueue.length+next.length>=20){skipped.push(file.name+' (20-file limit)');continue}
  existing.add(key);next.push({file,key,id:++nextCsvId,status:'reading'});
 }
 csvBusy=true;renderCsvQueue();
 for(const item of next){
  const metric=$('metric').value;
  Object.assign(item,{metric,detectedDate:'',period:'',head:[],matrix:[],nameCol:0,pointsCol:1,error:'',result:null});
  try{
   if(!/\.csv$/i.test(item.file.name))throw Error('Choose a CSV (.csv) file.');
   if(item.file.size>1024*1024)throw Error('CSV must be under 1 MB.');
   if(!item.file.size)throw Error('CSV is empty.');
   const parsed=csvForReport(await item.file.text());
   if(!parsed.date)throw Error(parsed.error||'Unable to find reporting date in CSV.');
   item.head=parsed.head;item.matrix=parsed.matrix;item.detectedDate=parsed.date;item.period=targetFromCsvDate(metric,item.detectedDate);
   item.nameCol=guessColumn(item.head,/name|commander|player|nickname|member|ign/,0);
   item.pointsCol=guessColumn(item.head,/points|score|donat|contribut|total/,Math.min(1,item.head.length-1));
   item.status='ready';
  }catch(e){item.status='invalid';item.error=e.message}
  state.csvQueue.push(item);
 }
 csvBusy=false;renderCsvQueue();
 if(skipped.length)notice(skipped.length+' file(s) skipped: '+skipped.slice(0,3).join('; ')+(skipped.length>3?'…':''),true);
 else notice(next.length+' file(s) added. Review each date, stat type and column mapping before uploading.');
}
async function uploadCsvQueue(){
 if(csvBusy)return;
 const pending=state.csvQueue.filter(item=>item.status!=='uploaded'&&item.status!=='invalid');
 const valid=pending.filter(item=>!csvIssue(item));
 if(!valid.length){notice('No valid queued files. Correct the highlighted errors or choose another CSV.',true);return}
 const season=state.season;
 csvBusy=true;renderCsvQueue();
 let saved=0,failed=0,stopped=false,latestVsWeek='';
 try{
  for(const item of valid){
   item.status='uploading';item.error='';renderCsvQueue();
   try{
    const rows=rowsFromCsv(item.matrix,item.nameCol,item.pointsCol);
    const result=await post({action:'import',season_id:season,metric:item.metric,period:item.period,filename:item.file.name,rows});
    item.status='uploaded';item.result=result;saved++;if(item.metric==='vs_daily'||item.metric==='vs_weekly'){const w=weekOf(item.period);if(w>latestVsWeek)latestVsWeek=w}
   }catch(e){
    item.status='failed';item.error=e.message;failed++;
    if(e.message.includes('sign-in expired')){stopped=true;break}
   }
   renderCsvQueue();
  }
 }finally{csvBusy=false;renderCsvQueue()}
 if(saved){if(latestVsWeek)$('week').value=latestVsWeek;await load();if(latestVsWeek)showTab('vsarchive')}
 const left=state.csvQueue.filter(item=>item.status!=='uploaded'&&item.status!=='invalid'&&csvIssue(item)).length+state.csvQueue.filter(item=>item.status==='invalid').length;
 notice(saved+' CSV'+(saved===1?'':'s')+' imported to '+season+'.'+(failed?' '+failed+' failed, with reasons shown beside the files.':'')+(left?' '+left+' need corrections.':'')+(stopped?' Sign in again before retrying.':''),!!failed||!!left);
}
function wire(){
 const today=serverToday(),week=monday(today);
 $('week').value=week;$('ds-date').value=today;$('train-date').value=today;$('exception-start').value=today;$('exception-end').value=today;
 $('reload').addEventListener('click',load);
 $('season').value='post-s5';$('season').addEventListener('change',load);
 $('season-report').addEventListener('click',async()=>{try{const response=await fetch('/api/r4-stats?report=1&season='+encodeURIComponent(state.season),{cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not generate report');const columns=['member_name','vs_daily_total','vs_weekly_total','donations_total','recorded_vs_days','recorded_vs_weeks','trains_awarded'];const csv=[columns.join(','),...(data.rows||[]).map(row=>columns.map(k=>'\"'+String(row[k]??'').replaceAll('"','""')+'\"').join(','))].join('\r\n');const object=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=object;a.download='utw-season-report-'+state.season+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(object),1500);notice('Season report downloaded.')}catch(e){notice(e.message,true)}});
 $('week').addEventListener('change',()=>{$('train-date').value=$('week').value;$('ds-date').value=$('week').value;load()});
 document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>showTab(button.dataset.tab)));
 $('vs-refresh').addEventListener('click',load);
 $('daily-date').addEventListener('change',()=>lines('daily-vs',ranking('vs_daily',$('daily-date').value),20,'vs_daily'));
 $('csv-file').addEventListener('change',csvChanged);
 renderCsvQueue();
 $('import').addEventListener('click',uploadCsvQueue);
 $('clear-batch').addEventListener('click',()=>{if(!csvBusy){state.csvQueue=[];renderCsvQueue();notice('')}});
 $('member-search').addEventListener('input',directory);
 $('merge').addEventListener('click',()=>{const from=$('merge-from').value,to=$('merge-to').value;
  if(!from||!to||from===to){notice('Choose different records.',true);return}
  if(confirm('Permanently merge '+memberName(from)+' into '+memberName(to)+'? This also merges DS results and train history.'))action(()=>post({action:'merge',source:from,target:to}),'Member records merged. Historic points now follow the correct person.');
 });
 $('alias-save').addEventListener('click',()=>action(()=>post({action:'alias',member_id:$('alias-member').value,alias:$('alias-name').value}),'Nickname added to the member.'));
 $('ds-form').addEventListener('submit',event=>{event.preventDefault();action(()=>{const form=new FormData($('ds-form'));form.set('action','ds');form.set('season_id',state.season);return post(form,true)},'DS evidence and podium saved.')});
 $('train-source').addEventListener('change',candidates);$('train-date').addEventListener('change',candidates);
 $('award').addEventListener('click',()=>{const source=$('train-source').value,date=$('train-date').value,id=$('train-member').value,reason=$('train-reason').value.trim();
  if(!id||!date){notice('Select member and date.',true);return}
  const blocked=activeException(id,source,date);
  if(blocked.length&&(!reason||!confirm('This player has an active exception. Save a manual override with the stated reason?'))){notice('An override reason and confirmation are required for an excepted member.',true);return}
  action(()=>post({action:'award',season_id:state.season,train_date:date,slot:$('train-slot').value,member_id:id,source,reason}), 'Train assignment recorded.');
 });
 $('exception-save').addEventListener('click',()=>action(()=>post({action:'exception',member_id:$('exception-member').value,scope:$('exception-scope').value,starts_on:$('exception-start').value,ends_on:$('exception-end').value,reason:$('exception-reason').value}), 'Exception saved.'));
 load();
}
wire();
})();
