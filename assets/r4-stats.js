
(()=>{'use strict';
const $=id=>document.getElementById(id), fmt=n=>Number(n).toLocaleString('en-CA');
const state={data:null,week:'',csv:null,head:[],matrix:[],candidates:[]};
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
function lines(target,rows,limit=10){
 const root=$(target);root.replaceChildren();if(!rows.length){root.append(elEmpty('No CSV data for this period yet.'));return}
 rows.slice(0,limit).forEach((r,i)=>{const line=text('div',null,'stat-line');line.append(text('span','#'+(i+1),'stat-rank'));
 const mid=text('div');mid.append(text('strong',memberName(r.id)));if(r.dup)mid.append(text('small','Multiple aliases in one snapshot, highest value used'));line.append(mid,text('span',fmt(r.points),'stat-points'));root.append(line)});
}
function statBox(label,value){const box=text('div',null,'stat-summary');box.append(text('b',value),text('span',label));return box}
function overview(){
 const d=state.data,week=state.week,donations=ranking('donations_weekly',week),vs=ranking('vs_weekly',week);
 const unique=new Set(d.values.map(v=>d.aliases.find(a=>a.alias_key===v.alias_key)?.member_id).filter(Boolean));
 setContent('summary',statBox('Members in directory',fmt(d.members.length)),statBox('Members with active CSV stats',fmt(unique.size)),statBox('DS records this week',fmt(d.ds.length)));
 lines('weekly-vs',vs);lines('weekly-donations',donations);
 const select=$('daily-date'),old=select.value;select.replaceChildren();for(let i=0;i<7;i++){const v=dateAdd(week,i);select.append(new Option(v,v))}
 select.value=[...select.options].some(o=>o.value===old)?old:serverToday()>=week&&serverToday()<=dateAdd(week,6)?serverToday():week;
 lines('daily-vs',ranking('vs_daily',select.value),20);
}
function imports(){
 const root=$('imports');root.replaceChildren();if(!state.data.imports.length){root.append(elEmpty('No active imports yet.'));return}
 const wrap=text('div',null,'stat-scroll'),table=text('table',null,'stat-table'),head=text('tr');
 ['Metric','Period','Rows','Filename','Saved'].forEach(x=>head.append(text('th',x)));
 const thead=text('thead');thead.append(head);table.append(thead);
 for(const imp of state.data.imports.slice().sort((a,b)=>a.period.localeCompare(b.period))){
  const tr=text('tr');[imp.metric.replaceAll('_',' '),imp.period,imp.row_count,imp.filename,new Date(imp.created_at).toLocaleString()].forEach(v=>tr.append(text('td',v)));table.append(tr)
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
  const a=text('a','Open original screenshot');a.href='/api/r4-stats?image='+encodeURIComponent(d.id);a.target='_blank';a.rel='noopener';const image=document.createElement('img');image.src=a.href;image.alt='DS evidence screenshot';image.loading='lazy';image.className='stat-evidence';a.prepend(image);card.append(a);root.append(card);
 }
}
const activeException=(id,source,date)=>state.data.exceptions.filter(x=>x.active&&x.member_id===id&&x.starts_on<=date&&x.ends_on>=date&&(x.scope==='all'||x.scope===source));
const recentAwards=(id,date)=>state.data.awards.filter(x=>x.member_id===id&&x.train_date<=date&&x.train_date>=dateAdd(date,-7));
function suggested(){
 const source=$('train-source').value,date=$('train-date').value,week=monday(date);
 if(!validDate(date)||week!==state.week)return [];
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
  const button=text('button','Clear exception','stat-button');button.addEventListener('click',()=>action(async()=>{if(!confirm('Clear this exception?'))return;await post({action:'clear_exception',id:x.id})},'Exception updated.'));
  line.append(button);root.append(line);
 }
}
function trainHistory(){
 const root=$('train-history');root.replaceChildren();if(!state.data.awards.length){root.append(elEmpty('No train assignments in this window.'));return}
 for(const award of state.data.awards){const row=text('div',null,'stat-row');row.append(text('strong',award.train_date+' · '+award.slot+' · '+memberName(award.member_id)));row.append(text('p',award.source.toUpperCase()+(award.reason?' · '+award.reason:''),'stat-muted'));
  const button=text('button','Remove mistaken assignment','stat-button');button.addEventListener('click',()=>{if(confirm('Delete this train assignment?'))action(()=>post({action:'delete_award',id:award.id}),'Assignment removed.')});row.append(button);root.append(row)
 }
}
function render(){if(!state.data)return;overview();imports();memberFields();dsHistory();exceptionList();trainHistory();candidates()}
async function load(){
 const week=$('week').value;
 if(!validDate(week)||monday(week)!==week){notice('Select a Monday for the week.',true);return}
 state.week=week;$('sync').textContent='Loading…';
 try{const r=await fetch('/api/r4-stats?week='+encodeURIComponent(week),{credentials:'same-origin',cache:'no-store'});if(r.status===401){location.href='/r4-planner';return}const data=await r.json();if(!r.ok)throw Error(data.error||'Data unavailable');state.data=data;render();$('sync').textContent='Synced · '+new Date().toLocaleTimeString()}catch(e){$('sync').textContent='Unavailable';notice(e.message,true)}
}
function csvParse(input){
 const raw=input.replace(/^\uFEFF/,'');const first=raw.split(/\r?\n/).find(l=>l.trim())||'';
 const counts=[',',';','\t'].map(delimiter=>({delimiter,count:first.split(delimiter).length}));
 const delimiter=counts.sort((a,b)=>b.count-a.count)[0].delimiter;
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<raw.length;i++){const c=raw[i],next=raw[i+1];
  if(c==='"'){if(quoted&&next==='"'){field+='"';i++}else quoted=!quoted}
  else if(c===delimiter&&!quoted){row.push(field);field=''}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&next==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field=''}
  else field+=c;
 }
 if(quoted)throw Error('CSV contains an unclosed quoted field.');
 row.push(field);if(row.some(x=>x.trim()))rows.push(row);
 if(rows.length<2)throw Error('CSV requires a header row and at least one member.');
 const columns=rows[0].map((x,i)=>x.trim()||'Column '+(i+1));return {head:columns,matrix:rows.slice(1)};
}
function csvPreview(){
 const m=$('col-name').value,p=$('col-points').value,preview=$('csv-preview');preview.replaceChildren();
 const wrap=text('div',null,'stat-scroll'),table=text('table',null,'stat-table');const head=text('tr');['Name','Points / donations'].forEach(x=>head.append(text('th',x)));table.append(head);
 state.matrix.slice(0,5).forEach(row=>{const tr=text('tr');[row[m],row[p]].forEach(x=>tr.append(text('td',x||'')));table.append(tr)});wrap.append(table);
 preview.append(text('p','Previewing '+state.matrix.length+' rows, first 5 shown.','stat-muted'),wrap);
}
async function csvChanged(){
 const file=$('csv-file').files[0];state.csv=null;$('mapping').hidden=true;if(!file)return;
 try{
  if(file.size>1024*1024)throw Error('CSV must be under 1 MB');
  const parsed=csvParse(await file.text());state.csv=file;state.head=parsed.head;state.matrix=parsed.matrix;
  const fill=(id)=>{const el=$(id);el.replaceChildren();parsed.head.forEach((h,i)=>el.append(new Option(h,String(i))))};
  fill('col-name');fill('col-points');
  const find=pattern=>parsed.head.findIndex(h=>pattern.test(h.toLowerCase()));
  let n=find(/name|commander|player|nickname|member|ign/),p=find(/points|score|donat|contribut|total/);
  $('col-name').value=String(n<0?0:n);$('col-points').value=String(p<0?Math.min(1,parsed.head.length-1):p);
  $('mapping').hidden=false;csvPreview();
 }catch(e){notice(e.message,true)}
}
function uploadRows(){
 const n=Number($('col-name').value),p=Number($('col-points').value);
 if(n===p)throw Error('Choose different name and points columns');
 const rows=[],seen=new Set();
 for(const [i,row] of state.matrix.entries()){
  const name=String(row[n]||'').trim().replace(/\s+/g,' '),raw=String(row[p]||'').trim().replace(/[\s,]/g,''),points=Number(raw);
  if(!name||name.length>60||!/^\d+(?:\.0+)?$/.test(raw)||!Number.isSafeInteger(points))throw Error('Invalid member name or points in CSV row '+(i+2)+'. Check your column choices.');
  const k=normalize(name);if(seen.has(k))throw Error('Duplicate name in CSV row '+(i+2)+': '+name);
  seen.add(k);rows.push({name,points});
 }
 if(rows.length>500)throw Error('CSV cannot exceed 500 members');
 return rows;
}
async function saveCsv(){
 if(!state.csv)throw Error('Choose a CSV first');
 const metric=$('metric').value,period=$('period').value;
 if(!validDate(period)||(metric!=='vs_daily'&&monday(period)!==period))throw Error('Weekly uploads must use a Monday date');
 const rows=uploadRows();
 const result=await post({action:'import',metric,period,filename:state.csv.name,rows});
 return result;
}
function changePeriod(){
 const metric=$('metric').value;
 $('period').value=metric==='vs_daily'?serverToday():state.week;
}
function wire(){
 const today=serverToday(),week=monday(today);
 $('week').value=week;$('period').value=today;$('ds-date').value=today;$('train-date').value=today;$('exception-start').value=today;$('exception-end').value=today;
 $('reload').addEventListener('click',load);
 $('week').addEventListener('change',()=>{$('period').value=$('metric').value==='vs_daily'?today:$('week').value;$('train-date').value=$('week').value;$('ds-date').value=$('week').value;load()});
 document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===button));document.querySelectorAll('.stat-tab').forEach(p=>p.hidden=p.id!=='tab-'+button.dataset.tab)}));
 $('daily-date').addEventListener('change',()=>lines('daily-vs',ranking('vs_daily',$('daily-date').value),20));
 $('metric').addEventListener('change',changePeriod);$('csv-file').addEventListener('change',csvChanged);
 $('col-name').addEventListener('change',csvPreview);$('col-points').addEventListener('change',csvPreview);
 $('import').addEventListener('click',()=>action(saveCsv,'CSV imported successfully. Refresh rankings and review any new member names.'));
 $('member-search').addEventListener('input',directory);
 $('merge').addEventListener('click',()=>{const from=$('merge-from').value,to=$('merge-to').value;
  if(!from||!to||from===to){notice('Choose different records.',true);return}
  if(confirm('Permanently merge '+memberName(from)+' into '+memberName(to)+'? This also merges DS results and train history.'))action(()=>post({action:'merge',source:from,target:to}),'Member records merged. Historic points now follow the correct person.');
 });
 $('alias-save').addEventListener('click',()=>action(()=>post({action:'alias',member_id:$('alias-member').value,alias:$('alias-name').value}),'Nickname added to the member.'));
 $('ds-form').addEventListener('submit',event=>{event.preventDefault();action(()=>{const form=new FormData($('ds-form'));form.set('action','ds');return post(form,true)},'DS evidence and podium saved.')});
 $('train-source').addEventListener('change',candidates);$('train-date').addEventListener('change',candidates);
 $('award').addEventListener('click',()=>{const source=$('train-source').value,date=$('train-date').value,id=$('train-member').value,reason=$('train-reason').value.trim();
  if(!id||!date){notice('Select member and date.',true);return}
  const blocked=activeException(id,source,date);
  if(blocked.length&&(!reason||!confirm('This player has an active exception. Save a manual override with the stated reason?'))){notice('An override reason and confirmation are required for an excepted member.',true);return}
  action(()=>post({action:'award',train_date:date,slot:$('train-slot').value,member_id:id,source,reason}), 'Train assignment recorded.');
 });
 $('exception-save').addEventListener('click',()=>action(()=>post({action:'exception',member_id:$('exception-member').value,scope:$('exception-scope').value,starts_on:$('exception-start').value,ends_on:$('exception-end').value,reason:$('exception-reason').value}), 'Exception saved.'));
 load();
}
wire();
})();
