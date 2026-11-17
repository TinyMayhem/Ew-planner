import {matchRoster} from './r4-ocr-parser.mjs';
import {parsePollOcrText,parsePollCsv} from './r4-poll-parser.mjs';
import {languagesForOcr} from './r4-ocr-languages.mjs';

const $=id=>document.getElementById(id), node=(tag,value,cls)=>{const e=document.createElement(tag);if(value!==undefined&&value!==null)e.textContent=String(value);if(cls)e.className=cls;return e};
const types={svs:'SVS',trade_post:'Trade Post',wednesday_war:'Wednesday War',saturday_war:'Saturday War'};
const today=()=>{const f=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Noronha',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(f.map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day};
const tidy=s=>String(s||'').normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const store={events:[],members:[],aliases:[],current:null,preview:[],imageUrls:[],report:null,busy:false};
const msg=(s,error=false)=>{$('poll-notice').textContent=s;$('poll-notice').classList.toggle('error',error)};
async function api(url,body){
 const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const data=await r.json().catch(()=>({}));
 if(r.status===401||r.status===403){throw Error('Individual UTW R4 sign-in required. Sign in again at the R4 Command Centre.')}
 if(!r.ok)throw Error(data.error||'Request failed ('+r.status+')');
 return data;
}
const fetchEvents=()=>api('/api/r4-polls');
const post=body=>api('/api/r4-polls',body);
const byId=id=>store.members.find(m=>m.id===id),nameOf=id=>byId(id)?.display_name||store.current?.poll.roster.find(m=>m.id===id)?.name||'Former member';
function matchedMembers(query,eligible=false){
 const q=tidy(query),roster=new Set(store.current?.poll.roster.map(m=>m.id)||[]);
 return store.members.filter(m=>(!eligible||roster.has(m.id))&&(!q||tidy(m.display_name).includes(q)||store.aliases.some(a=>a.member_id===m.id&&tidy(a.alias).includes(q))));
}
function fillMemberSelect(id,query='',eligible=false){
 const select=$(id);if(!select)return;
 const previous=select.value,match=matchedMembers(query,eligible).slice(0,150);
 select.replaceChildren(new Option('Choose member…',''));
 for(const m of match)select.append(new Option(m.display_name+(m.archived_at?' (archived)':''),m.id));
 if(match.some(m=>m.id===previous))select.value=previous;
}
function listEvents(){
 const current=$('poll-select').value;
 $('poll-select').replaceChildren(new Option('Choose existing poll…',''));
 for(const p of store.events){
  $('poll-select').append(new Option(p.event_date+' · '+(types[p.event_type]||p.event_type)+' · '+p.title+' ('+p.status+')',p.id));
 }
 if(store.events.some(p=>p.id===current))$('poll-select').value=current;
}
async function reload(){
 const data=await fetchEvents();
 store.events=data.events||[];store.members=data.members||[];store.aliases=data.aliases||[];
 listEvents();fillMemberSelect('poll-roster-member');fillMemberSelect('poll-manual-member');
}
async function openPoll(id){
 if(!id)return;
 const data=await api('/api/r4-polls?poll='+encodeURIComponent(id));
 store.current=data;$('poll-select').value=id;$('poll-workspace').hidden=false;
 clearPreview();drawPoll();
}
async function change(operation,payload){
 if(store.busy||!store.current)throw Error('Choose a poll first');
 const p=store.current.poll;store.busy=true;
 try{
  const result=await post({action:'change',poll_id:p.id,revision:p.revision,operation,payload});
  await openPoll(p.id);
  return result;
 }catch(e){if(/changed since/i.test(e.message))await openPoll(p.id).catch(()=>{});throw e}
 finally{store.busy=false}
}
function listNames(target,names){
 const out=$(target);out.replaceChildren();
 if(!names.length){out.append(node('p','No members','stat-muted'));return}
 for(const v of names)out.append(node('div',v,''));
}
function drawPoll(){
 const {poll,votes,changes}=store.current,eligible=new Set(poll.roster.map(m=>m.id));
 const members=new Map(poll.roster.map(m=>[m.id,m.name]));
 const by=new Map(votes.filter(v=>eligible.has(v.member_id)).map(v=>[v.member_id,v]));
 const buckets={yes:[],no:[],maybe:[]},missing=[];
 for(const p of poll.roster){
  const vote=by.get(p.id);
  if(!vote)missing.push(nameOf(p.id)||p.name);
  else buckets[vote.response].push({name:nameOf(p.id)||p.name,...vote});
 }
 $('poll-active-type').textContent=types[poll.event_type]||poll.event_type;
 $('poll-active-title').textContent=poll.title;
 $('poll-active-info').textContent=poll.event_date+' · VS roster '+(poll.roster_date||'not recorded')+' · '+poll.roster.length+' eligible · Last edit: '+(poll.updated_by||'')+' · Revision '+poll.revision;
 const final=changes.find(c=>c.action==='finalize');
 const amended=poll.status==='finalized'&&final&&changes.some(c=>['manual_vote','uploaded_vote','eligibility'].includes(c.action)&&c.id>final.id);
 $('poll-status').textContent=amended?'Amended':poll.status==='finalized'?'Finalized':poll.status==='review'?'Reviewing':'Draft';
 $('poll-status').className='poll-status '+(amended?'amended':poll.status);
 for(const t of ['yes','no','maybe'])$('poll-count-'+t).textContent=buckets[t].length;
 $('poll-count-missing').textContent=missing.length;
 $('poll-review-yes').checked=!!poll.reviewed_yes;
 $('poll-review-no').checked=!!poll.reviewed_no;
 $('poll-review-maybe').checked=!!poll.reviewed_maybe;
 $('poll-roster-warning').hidden=!!poll.roster.length;
 $('poll-roster-warning').textContent='No VS roster was available. Add eligible members before finalizing.';
 $('poll-roster-source').textContent='Roster frozen from '+poll.roster_source+' ('+(poll.roster_date||'unknown date')+'). Add or exclude members here without rewriting historical VS data.';
 $('poll-missing-note').textContent=poll.status==='finalized'?'Verified no-response list, based on this poll’s eligible roster.':'Provisional list. Finalize all three reviewed categories first.';
 listNames('poll-missing',missing);
 for(const category of ['yes','no','maybe']){
  const root=$('poll-votes-'+category);root.replaceChildren();
  for(const p of buckets[category].sort((a,b)=>a.name.localeCompare(b.name))){
   const row=node('div',null,'poll-vote-row');
   row.append(node('strong',p.name),node('small',p.source+(p.updated_by?' · '+p.updated_by:'')));
   root.append(row);
  }
  if(!buckets[category].length)root.append(node('p','No votes recorded','stat-muted'));
 }
 const history=$('poll-history');history.replaceChildren();
 for(const c of changes.slice(0,80)){
  const row=node('div',null,'poll-history-item');
  const desc=[c.action.replaceAll('_',' '),c.member_id?nameOf(c.member_id):'',c.old_response&&c.new_response?(c.old_response+' → '+c.new_response):(c.new_response||'')].filter(Boolean).join(' · ');
  row.append(node('strong',desc),node('small',(c.actor||'R4')+' · '+new Date(c.created_at).toLocaleString()));
  if(c.details?.note)row.append(node('small',c.details.note));
  history.append(row);
 }
 if(!changes.length)history.append(node('p','No edits yet.','stat-muted'));
 fillMemberSelect('poll-manual-member',$('poll-manual-search').value,true);
 fillMemberSelect('poll-roster-member',$('poll-roster-search').value,false);
 $('poll-finalize').disabled=!(poll.reviewed_yes&&poll.reviewed_no&&poll.reviewed_maybe&&poll.roster.length)||poll.status==='finalized';
}
function clearPreview(){
 for(const url of store.imageUrls)URL.revokeObjectURL(url);
 store.imageUrls=[];store.preview=[];$('poll-review-list').replaceChildren();
 $('poll-review-panel').hidden=true;
 const thumbs=$('poll-image-thumbs');if(thumbs)thumbs.remove();
}
const asRow=(name,response,source)=>{
 const match=matchRoster(name,store.members,store.aliases);
 return {name,response,source,member_id:match.type==='exact'?match.id:'',suggestion:match.id||'',confidence:match.type};
};
function preparePreview(rows){
 clearPreview();
 store.preview=rows.map(x=>({...asRow(x.name,x.response,x.source),deleted:false}));
 if(store.preview.length>250){msg('Limit each upload to 250 names.',true);clearPreview();return}
 $('poll-review-panel').hidden=false;
 drawPreview();
 msg(store.preview.length+' extracted rows ready for R4 review. Nothing has been saved.');
}
function drawPreview(){
 const root=$('poll-review-list');root.replaceChildren();
 const active=store.current?.poll.roster||[];
 const allowed=new Set(active.map(m=>m.id));
 for(const [i,item] of store.preview.entries()){
  if(item.deleted)continue;
  const row=node('div',null,'poll-review-entry'+(!item.member_id||!allowed.has(item.member_id)?' issue':''));
  const inputLabel=node('label','Recognized name');
  const input=node('input');input.value=item.name;input.maxLength=90;
  input.onchange=()=>{item.name=input.value.trim();const m=matchRoster(item.name,store.members,store.aliases);item.member_id=m.type==='exact'?m.id:'';item.suggestion=m.id||'';item.confidence=m.type;drawPreview()};
  inputLabel.append(input);
  const memberLabel=node('label','Confirm member');
  const select=node('select');select.append(new Option('Select member (required)',''));
  for(const m of active.slice().sort((a,b)=>nameOf(a.id).localeCompare(nameOf(b.id))))select.append(new Option(nameOf(m.id),m.id));
  select.value=item.member_id||'';select.onchange=()=>{item.member_id=select.value;item.confidence='confirmed';drawPreview()};
  memberLabel.append(select);
  const status=node('div',null,'poll-review-indicator');
  status.append(node('small',!item.member_id?item.suggestion?'Check suggestion: '+nameOf(item.suggestion):'Unmatched: select a member':item.confidence==='matched'?'Exact nickname match':'R4 confirmed'));
  const opts=node('select');for(const response of ['yes','no','maybe'])opts.append(new Option(response.toUpperCase(),response));
  opts.value=item.response;opts.onchange=()=>{item.response=opts.value};
  const del=node('button','Remove','stat-button');del.type='button';del.onclick=()=>{item.deleted=true;drawPreview()};
  const actions=node('div',null);actions.append(status,opts,del);
  row.append(inputLabel,memberLabel,actions);root.append(row);
 }
 if(!root.childElementCount)root.append(node('p','No rows left. Add a name or discard this preview.','stat-muted'));
}
const libraryUrl='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let runtime=null,loading=null;
async function loadOcr(){
 if(runtime)return runtime;
 if(!loading)loading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=libraryUrl;script.async=true;
  script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(Error('OCR could not initialize'));
  script.onerror=()=>reject(Error('OCR library could not load. Try CSV instead.'));document.head.append(script);
 });
 try{runtime=await loading;return runtime}catch(e){loading=null;throw e}
}
async function cropNames(file){
 const bitmap=await createImageBitmap(file);
 try{
  // Game's Voting Members popup puts the commander name and Power line on the right.
  const x=Math.round(bitmap.width*.22),y=Math.round(bitmap.height*.26);
  const w=Math.round(bitmap.width*.75),h=Math.round(bitmap.height*.49);
  const canvas=document.createElement('canvas');const scale=Math.min(2.3,1400/w);
  canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(bitmap,x,y,Math.min(w,bitmap.width-x),Math.min(h,bitmap.height-y),0,0,canvas.width,canvas.height);
  return canvas;
 }finally{bitmap.close()}
}
async function scanImages(){
 if(!store.current)return msg('Select a poll first.',true);
 const files=[...$('poll-images').files],response=$('poll-upload-response').value;
 if(!files.length||files.length>15)return msg('Choose 1 to 15 screenshots.',true);
 if(files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>16*1024*1024))return msg('Use JPG, PNG or WebP screenshots smaller than 16 MB each.',true);
 $('poll-scan').disabled=true;
 let worker=null;
 try{
  const libs=languagesForOcr($('poll-lang').value,store.members,store.aliases);
  $('poll-extract-status').textContent='Loading OCR languages: '+libs.join(', ')+'…';
  const ocr=await loadOcr();worker=await ocr.createWorker(libs,1);
  const rows=[],texts=[];
  for(let i=0;i<files.length;i++){
   $('poll-extract-status').textContent='Reading '+(i+1)+' of '+files.length+': '+files[i].name;
   const crop=await cropNames(files[i]);
   const result=await worker.recognize(crop);
   const raw=result?.data?.text||'';texts.push(raw);
   const found=parsePollOcrText(raw,store.members,store.aliases);
   rows.push(...found.map(x=>({name:x.name,response,source:'screenshot'})));
  }
  // Don't throw away names when the overlap appears on several screenshots.
  const seen=new Set(),dedup=[];
  for(const r of rows){const k=tidy(r.name);if(k&&!seen.has(k)){seen.add(k);dedup.push(r)}}
  if(!dedup.length)throw Error('No player names detected. Try a clearer screenshot, or use CSV/manual entry.');
  preparePreview(dedup);
  for(const f of files)store.imageUrls.push(URL.createObjectURL(f));
  const root=$('poll-review-panel'),thumbs=node('div',null,'poll-thumbnails');thumbs.id='poll-image-thumbs';
  for(const url of store.imageUrls){const img=document.createElement('img');img.src=url;img.alt='Original voting screenshot for review';img.loading='lazy';thumbs.append(img)}
  root.insertBefore(thumbs,$('poll-review-list'));
  $('poll-extract-status').textContent='OCR found '+dedup.length+' unique name(s). Compare with screenshots and confirm each entry before saving.';
 }catch(e){msg(e.message,true);$('poll-extract-status').textContent='Could not complete scan. You can upload CSV or enter votes manually.'}
 finally{await worker?.terminate().catch(()=>{});$('poll-scan').disabled=false}
}
async function readCsv(){
 const f=$('poll-csv').files[0];if(!f)return msg('Choose a CSV first.',true);
 if(f.size>200000)return msg('CSV must be under 200 KB.',true);
 try{
  const raw=await f.text();const rows=parsePollCsv(raw,$('poll-upload-response').value);
  preparePreview(rows.map(x=>({...x,source:'csv'})));
  $('poll-extract-status').textContent=rows.length+' CSV names loaded. Review every match before saving.';
 }catch(e){msg(e.message,true)}
}
function validatedPreview(){
 const rows=store.preview.filter(x=>!x.deleted);if(!rows.length)throw Error('Add at least one name');
 const roster=new Set(store.current.poll.roster.map(m=>m.id));
 const seen=new Map(),unique=[];
 const current=new Map(store.current.votes.map(x=>[x.member_id,x]));
 for(const r of rows){
  if(!r.member_id||!roster.has(r.member_id))throw Error('Resolve '+r.name+' to an eligible member first');
  if(!['yes','no','maybe'].includes(r.response))throw Error('Choose Yes, No or Maybe');
  const prior=seen.get(r.member_id);
  if(prior){if(prior!==r.response)throw Error(nameOf(r.member_id)+' appears in two response categories in this upload');continue}
  seen.set(r.member_id,r.response);
  const existing=current.get(r.member_id);
  if(existing&&existing.response!==r.response)throw Error(nameOf(r.member_id)+' already voted '+existing.response+'. Use manual correction instead.');
  unique.push(r);
 }
 return unique;
}
async function savePreview(){
 try{
  const rows=validatedPreview();
  const responses=[...new Set(rows.map(x=>x.response))];
  // Commit each reviewed category through the versioned API. All three remain audited.
  for(const category of responses){
   const items=rows.filter(r=>r.response===category).map(r=>({member_id:r.member_id,source:r.source,note:''}));
   await change('votes',{response:category,mode:$('poll-upload-mode').value,items});
  }
  clearPreview();$('poll-extract-status').textContent='';
  msg('Saved '+rows.length+' unique reviewed votes. Confirm the category checkboxes when all uploads are done.');
 }catch(e){msg(e.message,true)}
}
async function safeChange(operation,payload,success){
 try{await change(operation,payload);msg(success)}catch(e){msg(e.message,true)}
}
async function copyMissing(){
 if(!store.current)return;
 const p=store.current.poll,voted=new Set(store.current.votes.map(v=>v.member_id));
 const missing=p.roster.filter(m=>!voted.has(m.id)).map(m=>nameOf(m.id));
 const content=[p.title+' · '+p.event_date,p.status==='finalized'?'Unanswered poll':'PROVISIONAL missing responses','',...missing].join('\n');
 try{await navigator.clipboard.writeText(content);msg('Copied '+missing.length+' names.')}catch(e){msg('Clipboard unavailable. Select and copy names from the list.',true)}
}
function csvTemplate(){
 const content='member_name,response\r\n"Texas Bandit",Yes\r\n"Sorree Baba",No\r\n"Member Example",Maybe\r\n';
 const file=new Blob(['\uFEFF'+content],{type:'text/csv;charset=utf-8'});downloadBlob(file,'utw-poll-sample.csv');
}
function downloadBlob(blob,filename){
 const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function openExport(kind,id=''){
 const url='/api/r4-polls?export='+kind+(id?'&id='+encodeURIComponent(id):'');
 window.location.assign(url);
}
async function drawReport(){
 const from=$('poll-report-from').value,to=$('poll-report-to').value,type=$('poll-report-type').value;
 const params=new URLSearchParams({report:'1',type});if(from)params.set('from',from);if(to)params.set('to',to);
 $('poll-report-status').textContent='Loading finalized poll history…';
 try{
  store.report=await api('/api/r4-polls?'+params);
  $('poll-report-results').hidden=false;
  const {summary,profiles}=store.report,root=$('poll-report-summary');root.replaceChildren();
  for(const [label,value] of [['Finalized polls',summary.polls],['Yes votes',summary.yes],['No votes',summary.no],['No responses',summary.missing]]){
   const b=node('div');b.append(node('strong',value),node('small',label));root.append(b);
  }
  const min=Number($('poll-report-min').value)||3;
  function listing(target,arr,score){
   const root=$(target);root.replaceChildren();
   for(const m of arr.slice(0,40)){
    const line=node('div',null,'poll-report-row');line.append(node('strong',m.name));
    line.append(node('span',score(m)));root.append(line);
   }
   if(!arr.length)root.append(node('p','Not enough reviewed polls to rank members yet.','stat-muted'));
  }
  listing('poll-report-no',profiles.filter(x=>x.eligible>=min&&x.responded>0&&x.no>0).sort((a,b)=>b.noRate-a.noRate||b.no-a.no),m=>(Math.round(m.noRate*100)+'% No · '+m.no+' of '+m.responded+' answers'));
  listing('poll-report-nonresponders',profiles.filter(x=>x.eligible>=min&&x.missing>0).sort((a,b)=>b.missing/a.eligible-a.missing/b.eligible||b.missing-a.missing),m=>(m.missing+' missing of '+m.eligible+' polls ('+Math.round(m.missing/m.eligible*100)+'%)'));
  const old=$('poll-report-member').value,select=$('poll-report-member');select.replaceChildren(new Option('Choose member…',''));
  for(const person of profiles.filter(x=>!tidy($('poll-report-search').value)||tidy(x.name).includes(tidy($('poll-report-search').value))).sort((a,b)=>a.name.localeCompare(b.name)))
   select.append(new Option(person.name,person.id));
  if(profiles.some(x=>x.id===old))select.value=old;renderProfile();
  const prior=document.getElementById('poll-trends');if(prior)prior.remove();
  const trend=node('div',null,'poll-trends');trend.id='poll-trends';trend.append(node('h3','Voting trends by event'));
  for(const [kind,data] of Object.entries(summary.byType)){
   const row=node('div',null,'poll-report-row');row.append(node('strong',types[kind]||kind),node('span',data.polls+' polls · '+data.yes+' Yes · '+data.no+' No · '+data.maybe+' Maybe · '+data.missing+' no response'));trend.append(row);
  }
  $('poll-report-summary').after(trend);
  $('poll-report-status').textContent=summary.polls+' finalized polls analyzed. Only eligible roster members were counted.';
 }catch(e){$('poll-report-status').textContent=e.message}
}
function renderProfile(){
 const root=$('poll-profile');root.replaceChildren();
 const profile=store.report?.profiles.find(p=>p.id===$('poll-report-member').value);
 if(!profile)return;
 const card=node('div',null,'poll-profile');
 card.append(node('h4',profile.name+' · '+profile.eligible+' eligible polls'));
 card.append(node('p',profile.yes+' Yes · '+profile.no+' No · '+profile.maybe+' Maybe · '+profile.missing+' No Response · '+profile.late+' manual/late replies'));
 const table=node('table'),head=node('tr');
 for(const label of ['Event','Date','Vote'])head.append(node('th',label));table.append(head);
 for(const p of profile.events.sort((a,b)=>b.event_date.localeCompare(a.event_date)).slice(0,60)){
  const line=node('tr');line.append(node('td',types[p.event_type]||p.event_type),node('td',p.event_date),node('td',p.response.toUpperCase()+(p.source==='manual'?' (manual)':'')));table.append(line);
 }
 card.append(table);root.append(card);
}
function init(){
 $('poll-date').value=today();
 $('poll-title').value=types[$('poll-type').value];
 $('poll-type').onchange=()=>{$('poll-title').value=types[$('poll-type').value]};
 $('poll-create').onclick=async()=>{
  const payload={action:'create',event_type:$('poll-type').value,event_date:$('poll-date').value,title:$('poll-title').value.trim()};
  try{const data=await post(payload);await reload();await openPoll(data.poll.id);msg('Poll created with the latest saved VS roster.')}catch(e){msg(e.message,true)}
 };
 $('poll-select').onchange=e=>openPoll(e.target.value).catch(x=>msg(x.message,true));
 $('poll-refresh').onclick=()=>reload().then(()=>msg('Poll list updated.')).catch(e=>msg(e.message,true));
 $('poll-refresh-open').onclick=()=>openPoll(store.current?.poll.id).then(()=>msg('Poll refreshed.')).catch(e=>msg(e.message,true));
 $('poll-scan').onclick=scanImages;
 $('poll-csv-read').onclick=readCsv;$('poll-csv-template').onclick=csvTemplate;
 $('poll-add-review-row').onclick=()=>{store.preview.push({name:'',member_id:'',response:$('poll-upload-response').value,source:'manual',confidence:'unmatched',deleted:false});drawPreview()};
 $('poll-save-upload').onclick=savePreview;$('poll-clear-preview').onclick=clearPreview;
 for(const c of ['yes','no','maybe'])$('poll-review-'+c).onchange=async e=>{
  const checked=e.target.checked;await safeChange('review',{category:c,reviewed:checked},c.toUpperCase()+' review status saved.');
 };
 $('poll-finalize').onclick=()=>safeChange('finalize',{},'Poll finalized. Missing responders are now verified.');
 $('poll-copy-missing').onclick=copyMissing;
 $('poll-export').onclick=()=>store.current&&openExport('poll',store.current.poll.id);
 $('poll-export-history').onclick=()=>store.current&&openExport('history',store.current.poll.id);
 $('poll-export-backup').onclick=()=>openExport('backup');
 $('poll-manual-search').oninput=e=>fillMemberSelect('poll-manual-member',e.target.value,true);
 $('poll-roster-search').oninput=e=>fillMemberSelect('poll-roster-member',e.target.value,false);
 $('poll-manual-save').onclick=async()=>{
  const member=$('poll-manual-member').value,response=$('poll-manual-response').value,note=$('poll-manual-note').value.trim();
  if(!member)return msg('Choose an eligible member.',true);
  await safeChange('votes',{response,mode:'manual',items:[{member_id:member,source:'manual',note}]},'Late vote or correction saved with R4 history.');
  $('poll-manual-note').value='';
 };
 for(const mode of ['add','remove'])$('poll-roster-'+mode).onclick=async()=>{
  const id=$('poll-roster-member').value;if(!id)return msg('Select a member.',true);
  if(!confirm((mode==='add'?'Include ':'Exclude ')+nameOf(id)+' for this poll? This changes the eligible nonresponse roster, not historical VS data.'))return;
  await safeChange('eligibility',{mode,member_id:id},'Poll roster updated.');
 };
 $('poll-run-report').onclick=drawReport;
 $('poll-report-member').onchange=renderProfile;
 $('poll-report-search').oninput=()=>{
  const select=$('poll-report-member'),prior=select.value,q=tidy($('poll-report-search').value);
  select.replaceChildren(new Option('Choose member…',''));
  for(const m of store.report?.profiles||[])if(tidy(m.name).includes(q))select.append(new Option(m.name,m.id));
  if([...select.options].some(o=>o.value===prior))select.value=prior;renderProfile();
 };
 $('poll-report-min').onchange=()=>{if(store.report)drawReport()};
 reload().then(()=>{msg('Poll Tracker ready. Create a poll or open an existing one.');if(location.hash==='#reports'){$('poll-report-section').scrollIntoView();drawReport()}}).catch(e=>msg(e.message,true));
}
init();
