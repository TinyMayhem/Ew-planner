# UTW R4 Command Center, Train Desk source only

Source: TinyMayhem/Ew-planner (default branch `main`, November 11, 2026).
This file contains **only Train Desk code and direct dependencies**, extracted from the existing R4 Command Center. It does not contain private Supabase data, keys, or production credentials.

**Important:** This is a developer handoff / source extraction, **not a standalone runnable drop-in**. The original implementation uses shared R4 page helpers, authentication, member directory, nicknames, VS and donation uploads, and Supabase tables. For integration, adapt those connections instead of assuming that copying this file alone will sync records.

## Original components and paths
- Train Desk UI: `lib/r4-stats-page.mjs`, section `#tab-trains`
- Browser logic: `assets/r4-stats.js`
- Styles: `assets/r4-stats.css`
- Calendar/repeat rules: `assets/r4-train-rules.mjs`
- Schedule: `assets/r4-train-schedule.mjs`
- Recommendations: `lib/train-advice.mjs`
- Back-end: `api/r4-stats.mjs`
- Database schema: `supabase/r4-train-conductor-vip.sql`

## 1. Train Desk interface (HTML from the original page)

```html
<section class="stat-tab" id="tab-trains" hidden><article class="stat-card"><div class="stat-inline"><div><h2>Five-week train calendar</h2><p class="stat-muted">Each Stage is 35 days, Monday to Sunday. Stage 16 includes a proposed Crum / Devi rotation in place of Plant based on Stage 15. Confirm it before assigning. Only Thursday and Saturday R4 conductor trains are exceptions to the five-week conductor limit. VIP limits still apply. Use Edit on any historic train to replace a conductor or VIP while preserving the original name and reason.</p></div><label>Calendar <select id="train-stage" aria-label="Train stage calendar"></select></label></div><p id="train-stage-dates" class="stat-muted"></p><div id="train-stage-warnings" class="stat-stack" role="status"></div><div id="train-editor" class="train-editor-panel" hidden></div><div id="train-calendar" class="train-calendar" aria-label="Five-week train schedule"></div><details class="train-rules"><summary>Da Rules · eligibility and no-show policy</summary><ul><li>Drivers and VIPs must be inside the hive.</li><li>Conductor: at most one driving assignment per person per five-week Stage, except R4 conductor trains on Thursday and Saturday, which have a separate lane. VIP: at most one VIP assignment per person per Monday-to-Sunday week across all trains, including R4. Conductor and VIP are independent roles.</li><li>Conducting a Thursday/Saturday R4 train does not prevent an otherwise eligible regular train. The R4 exception is for conductors only, never VIPs. Wednesday R4 votes remain separate from actual train assignments. An R4 train conductor turn does not prevent the same person from receiving an eligible DS train.</li><li>R4s cannot join roulette or donation trains and can be VIP passengers only once per week.</li><li>R3s and R2s may be VIP passengers once per week. R1s cannot be passengers.</li><li>Wednesday priority: someone who has never driven or been VIP, or a leadership participation prize.</li><li>Conductor winners must pass their Stage eligibility check. Saturday VS conductor is the highest eligible current-week VS scorer, with VIP going to the next eligible scorer who has not been VIP that week.</li><li>Roulette is for people who have not driven in the current calendar.</li><li>Ineligible winners give their place to the next person on the list. Ask R4s about exceptions.</li><li>Do not buy a paid train within four hours of reset.</li><li>For a no-show, wait until noon server time after reset, then use the agreed timer.</li></ul><p class="stat-muted">Hive location, R1 to R4 rank and live attendance are not stored by the Train Desk, so R4s must confirm those manually.</p></details></article><article class="stat-card"><h2>Train conductor + VIP schedule</h2><p class="stat-muted">Choose a train type or click a calendar date. Weekly VS and donation selections read their respective saved weekly score rankings and suggest both conductor and VIP. A previous VIP turn does not disqualify a conductor, and a previous conductor turn does not disqualify a VIP. For regular trains, the highest scorer who has not already conducted during the current five-week Stage is suggested. The next eligible lower-ranked scorer is suggested as VIP, with a one-VIP-per-week limit. Ranked suggestions show who was skipped and why. Saturday VS recommendations use the current week's uploaded VS weekly total. Other VS dates use the previous completed week's total. Daily scores are never substituted. R4 rotation holders are proposed from the calendar, not automatically confirmed. VS scores come from actual uploads. Thursday/Saturday R4 conductor trains are separate from normal conductor assignments. VIPs have no R4 exception. Use the VIP selection rule to prioritize someone who has not ridden VIP this five-week Stage.</p><div class="stat-fields"><label>Train date<input id="train-date" type="date"></label><label>Selection source<select id="train-source"><option value="ds">DS MVP / podium</option><option value="donations">Weekly donations</option><option value="vs">Weekly VS total (Saturday: current week)</option><option value="r4">R4 train (rotation)</option><option value="never">Never had a train / Wednesday priority</option><option value="manual">Manual / other</option></select></label><label>Train slot / label<input id="train-slot" value="Train 1" maxlength="50"></label></div><p id="train-donations-source" class="stat-muted" hidden>Weekly donations are currently based on uploaded records, not a live feed. <a href="/r4-planner?duel=1" target="_blank" rel="noopener">Open Alliance Duel</a> to review the original leaderboard. Direct syncing requires access to the Alliance Duel data source.</p><div id="train-pair-suggestion" aria-live="polite"></div><div id="candidates" class="stat-list" aria-live="polite"></div><div id="train-eligibility-warnings" class="stat-stack" role="alert" aria-live="polite"></div><div class="stat-fields"><label>Selected conductor<select id="train-member"></select></label><label>Selected VIP<select id="train-vip"></select></label><label>VIP selection rule<select id="train-vip-mode"><option value="weekly">Standard: no VIP this week</option><option value="stage">Never VIP this five-week Stage</option></select></label><label>Reason or override note<input id="train-reason" maxlength="500" placeholder="e.g. MVP already received a train"></label></div><div id="vip-candidates" class="stat-list" aria-live="polite"></div><button class="stat-button primary" id="award" type="button">Record conductor + VIP</button></article><article class="stat-card"><h2>Exception rules</h2><p class="stat-muted">Use dated exceptions to skip someone for all trains or only DS, donations or VS. Exceptions do not delete points or change the podium, and they are shown beside the rankings.</p><div class="stat-fields"><label>Member<select id="exception-member"></select></label><label>Applies to<select id="exception-scope"><option value="all">All sources</option><option value="ds">DS only</option><option value="donations">Donations only</option><option value="vs">VS only</option></select></label><label>Starts<input id="exception-start" type="date"></label><label>Ends<input id="exception-end" type="date"></label></div><label>Reason<input id="exception-reason" maxlength="300" placeholder="Explain the exception"></label><button class="stat-button" id="exception-save" type="button">Add exception</button><div id="exceptions"></div></article><article class="stat-card"><h2>Train assignment history</h2><p class="stat-muted">Includes editable Driver and VIP records for the selected five-week Stage. For screenshot history, use Edit on the calendar above and record the replacement reason.</p><div id="train-history"></div></article></section>
```

## 2. Train Desk browser functionality (original JavaScript excerpts)

These excerpts keep the actual Train Desk algorithms, editing controls and event listeners, with only the surrounding unrelated reports/CSV/DS-page blocks omitted. In the original app, `state.data` is loaded from `GET /api/r4-stats?week=...&season=...&train_stage=...`. The selected calendar should receive `members`, `aliases`, `awards`, `trainLegacy`, `exceptions` and `seasons`.

```javascript
// Shared frontend imports, state, helpers, and API helpers extracted from assets/r4-stats.js
import {csvForReport,guessColumn,targetFromCsvDate,validTarget,rowsFromCsv} from './r4-csv-utils.mjs';
import {archivedWeeks,vsWeekSlots,vsLeaderboard,vsMissingDaily,weekOf,scoreFlag} from './r4-vs-archive.mjs';
import {stageForDate,stageRange,trainWarnings,isR4Train,addDays as trainAddDays} from './r4-train-rules.mjs';
import {trainLabelForDate} from './r4-train-schedule.mjs';
import {initScreenshotWizard} from './r4-screenshot-wizard.mjs?version=auto90-v1-20261106';

(()=>{'use strict';
const $=id=>document.getElementById(id), fmt=n=>Number(n).toLocaleString('en-CA');
const state={data:null,week:'',season:'post-s5',trainStage:15,archiveImports:[],csvQueue:[],candidates:[]};
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
const departedOn=(id,date)=>!!id&&!!date&&(state.data?.exceptions||[]).some(x=>x.member_id===id&&x.active&&x.scope==='all'&&/^No longer in UTW\b/i.test(x.reason||'')&&x.starts_on<=date&&x.ends_on>=date);
const displayTrainName=raw=>{const alias=aliases().find(a=>normalize(a.alias)===normalize(raw));const canonical=byId(alias?.member_id)?.display_name;return canonical&&normalize(canonical)!==normalize(raw)?raw+' (now '+canonical+')':raw;};
const elEmpty=msg=>text('p',msg,'stat-empty');
const setContent=(id,...nodes)=>$(id).replaceChildren(...nodes);
const notice=(message,error=false)=>{const n=$('notice');n.hidden=!message;n.className='stat-notice'+(error?' error':'');n.textContent=message||'';if(message)n.scrollIntoView({block:'nearest'})};
async function post(body,multipart=false){notice('');const r=await fetch('/api/r4-stats',{method:'POST',credentials:'same-origin',headers:multipart?{}:{'Content-Type':'application/json'},body:multipart?body:JSON.stringify(body)});const data=await r.json().catch(()=>({}));if(r.status===401){location.href='/r4-planner';throw Error('R4 sign-in expired')}if(!r.ok)throw Error(data.error||'Could not save the change');return data}
async function action(fn,success){try{await fn();await load();notice(success)}catch(e){notice(e.message,true)}}
const opt=(id,includeBlank=false)=>{const select=$(id),old=select.value;select.replaceChildren();if(includeBlank){const o=new Option(id==='train-member'?'Choose conductor':id==='train-vip'?'Choose VIP':'Not recorded','');select.append(o)}for(const m of members()){if((id==='train-member'||id==='train-vip')&&departedOn(m.id,$('train-date')?.value||serverToday()))continue;select.append(new Option(m.display_name,m.id))}if([...select.options].some(o=>o.value===old))select.value=old};
function ranking(metric,period){

// Eligibility and recommendations (original lines 177-294)
const activeException=(id,source,date)=>state.data.exceptions.filter(x=>x.active&&x.member_id===id&&x.starts_on<=date&&x.ends_on>=date&&(x.scope==='all'||x.scope===source));
const recentAwards=(id,date,source,slot)=>state.data.awards.filter(x=>(x.member_id===id||x.vip_member_id===id)&&x.train_date<=date&&x.train_date>=dateAdd(date,-7)&&isR4Train(x)===isR4Train({source,slot}));
function inferTrainMode(label,savedSource=''){
 const v=String(label||'').toLowerCase();
 if(/^no vs train/.test(v))return 'manual';
 if(/no train for a while|never had|r4 vote/.test(v))return 'never';
 if(/top donat|donation/.test(v))return 'donations';
 if(/ds mvp|desert storm|event mvp|event top 2/.test(v))return 'ds';
 if(/\bvs\b|vs mvp|vs top|alliance star/.test(v))return 'vs';
 if(/^r4\s/i.test(v)||/^r5\s/i.test(v))return 'r4';
 return ['r4','ds','donations','vs'].includes(savedSource)?savedSource:'manual';
}
function nextRankedVip(advice,conductorId){
 const conductor=(advice?.candidates||[]).find(x=>x.id===conductorId);
 if(!advice?.scoreRanked||!conductor)return null;
 return (advice.vipCandidates||[]).find(x=>x.eligible&&x.id!==conductorId&&x.scoreRank>conductor.place)||null;
}
function showVipAdvice(advice,{autoSelect=false}={}){
 const root=$('vip-candidates'),pair=$('train-pair-suggestion');
 root.replaceChildren();pair.replaceChildren();
 if(!advice)return;
 const ranked=!!advice.scoreRanked,selectedDriver=$('train-member').value;
 const driver=advice.candidates?.find(x=>x.id===selectedDriver)||(!selectedDriver?advice.recommended:null);
 const suggestedVip=ranked?nextRankedVip(advice,driver?.id):null;
 if(autoSelect&&ranked)$('train-vip').value=suggestedVip?.id||'';
 if(ranked){
  const card=text('div',null,'train-pair-card');
  card.append(text('strong','Suggested pair from '+(advice.mode==='vs'?'weekly VS scores':'weekly donations'),'train-pair-heading'));
  if(driver){
   card.append(text('p','Conductor: #'+driver.place+' '+driver.name+' · '+fmt(driver.points)+' points','train-pair-line'));
   card.append(text('p',suggestedVip?'VIP: #'+suggestedVip.scoreRank+' '+suggestedVip.name+' · '+fmt(suggestedVip.points)+' points':
    'VIP: No eligible lower-ranked member found. Review the saved VIP history.','train-pair-line'));
  }else card.append(text('p','No eligible conductor found in the saved weekly ranking.','train-pair-line'));
  if(advice.sameDate?.length)card.append(text('p','A train is already saved on this date. Suggestions do not overwrite it.','stat-muted'));
  pair.append(card);
 }
 const fresh=advice.vipMode==='stage'&&advice.mode!=='vs';
 const pool=advice.vipCandidates||[];
 root.append(text('p',ranked?
  'VIP follows the next highest eligible '+(advice.mode==='vs'?'VS':'donation')+
   ' score below the conductor. No repeat VIP in the same week. '+(advice.vipEligibleCount||0)+' eligible.':
  (fresh?'VIPs with no VIP turn in Stage '+advice.stage:
   'VIPs who have not ridden this Monday-to-Sunday week')+
   ' · '+(advice.vipEligibleCount||0)+' eligible. Ranked by longest time since their last VIP turn, then archived VS appearances instead of alphabetical order.','stat-muted'));
 for(const v of pool.slice(0,25)){
  const samePerson=v.id===selectedDriver;
  const highlighted=ranked&&suggestedVip?.id===v.id;
  const row=text('div',null,'stat-candidate'+(v.eligible&&!samePerson?' train-vip-eligible':'')+(highlighted?' train-advice-favorite':''));
  const info=text('div');info.append(text('strong','#'+v.place+' '+v.name));
  if(ranked&&v.points!==null)info.append(text('div',fmt(v.points)+' '+(advice.mode==='vs'?'VS points':'donations'),'stat-muted'));
  if(highlighted)info.append(text('div','Suggested VIP · next eligible ranked score','train-advice-recommended'));
  for(const note of v.notes||[])info.append(text('div',note,'stat-muted'));
  for(const reason of v.reasons||[])info.append(text('div','Skipped: '+reason,'stat-flag blocked'));
  if(samePerson)info.append(text('div','Already selected as conductor','stat-flag blocked'));
  const button=text('button',v.eligible?'Choose VIP':'Override VIP','stat-button');
  button.type='button';button.disabled=samePerson;
  button.addEventListener('click',()=>{
   $('train-vip').value=v.id;
   if(!v.eligible&&v.reasons?.length)$('train-reason').value=('VIP override: '+v.reasons.join('; ')).slice(0,480);
   eligibilityWarnings();
  });
  row.append(info,button);root.append(row);
 }
 if(pool.length>25)root.append(text('p','Showing the first 25 suggestions. You can still pick any member from Selected VIP above.','stat-muted'));
}
async function candidates(){
 const root=$('candidates'),vipRoot=$('vip-candidates'),date=$('train-date').value,
  mode=$('train-source').value,slot=$('train-slot').value,vipMode=$('train-vip-mode').value;
 $('train-donations-source').hidden=mode!=='donations';
 const requestId=(state.adviceRequest||0)+1;state.adviceRequest=requestId;state.advice=null;
 root.replaceChildren();vipRoot.replaceChildren();
 if(!validDate(date)){root.append(elEmpty('Select a valid train date for recommendations.'));return}
 if(mode==='manual')root.append(elEmpty('Manual conductor choice: select a conductor, then choose a VIP below.'));
 else root.append(text('p','Checking saved train history and scores…','stat-muted'));
 vipRoot.append(text('p','Checking VIP history…','stat-muted'));
 try{
  const query=new URLSearchParams({train_advice:'1',date,mode,slot,vip_mode:vipMode,season:state.season});
  const response=await fetch('/api/r4-stats?'+query.toString(),{credentials:'same-origin',cache:'no-store'});
  const advice=await response.json();
  if(requestId!==state.adviceRequest)return;
  if(response.status===401){location.href='/r4-planner';return}
  if(!response.ok)throw Error(advice.error||'Recommendations unavailable');
  state.advice=advice;root.replaceChildren();
  root.append(text('p',advice.context,'stat-muted'));
   if(advice.excludedDepartedCount)root.append(text('p','Former UTW members are excluded from new recommendations. Their historical train entries are still kept.','stat-muted'));
  if(advice.sameDate?.length)root.append(text('p','Already saved for this date: '+advice.sameDate.map(x=>x.driver+' (VIP: '+x.vip+')').join(' / ')+'. Use Edit above to change an existing assignment.','stat-flag'));
  if(advice.substitution)root.append(text('p',advice.substitution,'train-advice-substitution'));
  if(advice.hostProposed)root.append(text('p','Stage 16 R4 rotation proposal, not a confirmed assignment. Verify with the R4 team.','stat-muted'));
  if(mode!=='manual'&&!advice.candidates?.length)root.append(elEmpty('No valid conductor ranking for this date yet. Upload the matching VS / donation / DS results, or select a conductor manually.'));
  for(const v of advice.candidates||[]){
   const row=text('div',null,'stat-candidate'+(v.eligible&&advice.recommended?.id===v.id?' train-advice-favorite':''));
   const info=text('div');info.append(text('strong','#'+v.place+' '+v.name));
   if(v.points!==null&&v.points!==undefined)info.append(text('div',fmt(v.points)+' points','stat-muted'));
   if(v.eligible&&advice.recommended?.id===v.id)info.append(text('div','Recommended pending R4 checks','train-advice-recommended'));
   for(const reason of v.reasons||[])info.append(text('div','Skipped: '+reason,'stat-flag blocked'));
   for(const note of v.notes||[])info.append(text('div',note,'stat-muted'));
   const button=text('button',v.eligible?'Choose':'Override','stat-button');button.type='button';
   button.addEventListener('click',()=>{
    $('train-member').value=v.id;
    if(!v.eligible&&v.reasons?.length)$('train-reason').value=('Manual override: '+v.reasons.join('; ')).slice(0,480);
    else if(advice.recommended?.id===v.id&&advice.substitution&&!$('train-reason').value.trim())$('train-reason').value=advice.substitution.slice(0,480);
    showVipAdvice(advice,{autoSelect:advice.scoreRanked});eligibilityWarnings();
   });
   row.append(info,button);root.append(row);
  }
  root.append(text('p',advice.limitations,'stat-muted'));
  if(advice.recommended&&!advice.sameDate?.length){
   if(mode==='r4')$('train-member').value=advice.recommended.id;
   if(advice.scoreRanked)$('train-member').value=advice.recommended.id;
  }
  showVipAdvice(advice,{autoSelect:!!advice.scoreRanked&&!advice.sameDate?.length});eligibilityWarnings();
 }catch(e){
  if(requestId===state.adviceRequest){
   root.replaceChildren(elEmpty(e.message||'Could not check train history'));
   vipRoot.replaceChildren(elEmpty('VIP history unavailable. Check records before picking a passenger.'));
  }
 }
}

// Train calendar, historical aliases, editable awards (original lines 306-458)
const trainLabel=['Top donation','DS MVP','R4 vote / participation','R4 choice','Roulette / R5 choice','R4 choice','VS MVP'];
const weekdays=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
// A small set of recognizable historical aliases makes the original spreadsheet
// comparable to renamed current members. Ambiguous names remain distinct.
const knownLegacyNames={
 'ganoosh':'gan00sh','devi':'đevi','neoo':'mynameisneoo',
 'frost':'frost','crum':'crum','rylis':'rylispro',
 'savvy':'savvyvandromee','xgamer':'xgamer20',
 'subzero':'subz3ro','izard':'iz4rd','leo':'leonob',
 'hippie':'tragicallyhippie','mo':'movich mo',
 'seabeast':'seabeast from wren','mxk':'mxk',
 'silentkiller':'silentkiller90z','sochwi':'sochwi당취평',
 'barber':'barber 이발사','minimum':'mininimum ᓚᘏᗢ',
 'gb':'mfkn gb','king todd0':'king toddo',
 'smotpoker':'commander smotpoker'
};
function legacyKey(value){
 const canonical=text=>normalize(text).normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'').replace(/[Øø]/g,'o');
 const k=canonical(value),alias=aliases().find(a=>canonical(a.alias)===k||canonical(a.alias_key)===k);
 // Treat historical conductor and VIP names as the same member after a confirmed nickname link.
 const linked=alias?byId(alias.member_id):null;
 if(linked)return canonical(linked.display_name);
 const current=members().find(m=>canonical(m.display_name)===k);
 if(current)return canonical(current.display_name);
 return knownLegacyNames[k]||k;
}
function trainRecords(){
 const liveDates=new Set((state.data?.awards||[]).map(a=>a.train_date));
 const legacy=(state.data?.trainLegacy||[]).filter(a=>!liveDates.has(a.train_date)).map(a=>({
  id:'legacy:'+a.train_date,train_date:a.train_date,member_id:legacyKey(a.driver_name),vip_member_id:legacyKey(a.vip_name),
  source:a.source,slot:a.selection_label,legacy:true,driverName:a.driver_name,vipName:a.vip_name,notes:a.notes,originalDriverName:a.original_driver_name,replacementReason:a.replacement_reason,updatedBy:a.updated_by
 }));
 const live=(state.data?.awards||[]).map(a=>({
  ...a,member_id:legacyKey(memberName(a.member_id)),vip_member_id:a.vip_member_id?legacyKey(memberName(a.vip_member_id)):'',
  driverName:memberName(a.member_id),vipName:a.vip_member_id?memberName(a.vip_member_id):'Not recorded',legacy:false
 }));
 return [...legacy,...live].sort((a,b)=>a.train_date.localeCompare(b.train_date));
}
function labelForTrainKey(key){
 const record=trainRecords().find(a=>a.member_id===key||a.vip_member_id===key);
 return record?(record.member_id===key?record.driverName:record.vipName):key;
}
function currentTrainWarnings(){
 if(!state.data)return [];
 const driver=$('train-member').value,vip=$('train-vip').value;
 if(!driver&&!vip)return [];
 const driverName=driver?memberName(driver):'',vipName=vip?memberName(vip):'';
 const label=key=>driver&&key===legacyKey(driverName)?driverName:vip&&key===legacyKey(vipName)?vipName:labelForTrainKey(key);
 return trainWarnings(trainRecords(),{train_date:$('train-date').value,member_id:driver?legacyKey(driverName):'',vip_member_id:vip?legacyKey(vipName):'',source:$('train-source').value,slot:$('train-slot').value},label);
}
function eligibilityWarnings(){
 const root=$('train-eligibility-warnings');root.replaceChildren();
 if(!state.data)return;
 const issues=currentTrainWarnings();
 if(issues.length){root.append(text('strong','⚠ '+issues.length+' train rule warning'+(issues.length===1?'':'s'),'train-warning-title'));issues.forEach(s=>root.append(text('p',s,'train-rule-warning')))}
 root.append(text('p','Conductor: once per five-week Stage, except R4 conductor trains on Thursday and Saturday. VIP: once per Monday-to-Sunday week across all trains. Optional VIP Stage mode prioritizes people who have not been VIP this Stage.','stat-muted'));
 root.append(text('p','R4 must also verify hive position, member rank, Wednesday first-timer preference and approved exceptions.','stat-muted'));
}

function openLegacyTrainEditor(award,card){
 const root=$('train-editor');if(!root.hidden&&root.dataset.date===award.train_date){root.hidden=true;root.replaceChildren();return}
 root.replaceChildren();root.dataset.date=award.train_date;root.hidden=false;
 const form=text('div',null,'train-edit train-legacy-editor');
 const title=text('strong','Edit '+award.train_date+' train','train-edit-heading');
 const known=document.createElement('datalist');known.id='train-names-'+award.train_date;
 const names=[...new Set([...members().map(m=>m.display_name),...(state.data?.trainLegacy||[]).flatMap(r=>[r.driver_name,r.vip_name])])].filter(Boolean);
 names.sort((a,b)=>a.localeCompare(b)).forEach(n=>known.append(new Option(n)));
 const field=(labelText,value)=>{const label=text('label',labelText),input=document.createElement('input');input.type='text';input.maxLength=100;input.value=value;input.setAttribute('list',known.id);label.append(input);form.append(label);return input};
 form.append(title,known);
 const driver=field('Actual conductor',award.driverName),vip=field('VIP passenger',award.vipName);
 const whyLabel=text('label','Reason for change'),why=document.createElement('select');
 for(const v of ['No-show','Leader adjustment','Correction','Other'])why.append(new Option(v,v));
 whyLabel.append(why);form.append(whyLabel);
 const detailLabel=text('label','Additional details (optional)'),detail=document.createElement('input');
 detail.type='text';detail.maxLength=250;detail.placeholder='e.g. Bob was unavailable and Spuddy took over';
 detailLabel.append(detail);form.append(detailLabel);
 if(award.originalDriverName)form.append(text('p','Original conductor: '+award.originalDriverName,'stat-muted'));
 const buttons=text('div',null,'train-editor-actions'),save=text('button','Save changed conductor / VIP','stat-button primary'),cancel=text('button','Cancel','stat-button');
 save.type='button';cancel.type='button';
 cancel.addEventListener('click',()=>{root.replaceChildren();root.hidden=true});
 save.addEventListener('click',()=>{
  const newDriver=driver.value.trim(),newVip=vip.value.trim();
  if(!newDriver||!newVip||normalize(newDriver)===normalize(newVip)){notice('Choose two different names for conductor and VIP.',true);return}
  if(newDriver===award.driverName&&newVip===award.vipName){notice('Change the conductor or VIP before saving.',true);return}
  const reason=why.value+(detail.value.trim()?': '+detail.value.trim():'');
  const proposed={...award,member_id:legacyKey(newDriver),vip_member_id:legacyKey(newVip)};
  const issues=trainWarnings(trainRecords().filter(a=>a.id!==award.id),proposed,labelForTrainKey);
  if(issues.length&&!confirm('Review potential rule conflicts:\\n\\n'+issues.join('\\n')+'\\n\\nSave this change anyway?'))return;
  action(()=>post({action:'update_legacy_train',train_date:award.train_date,expected_driver_name:award.driverName,expected_vip_name:award.vipName,driver_name:newDriver,vip_name:newVip,reason}), 'Train updated. Original driver and replacement reason retained in history.');
 });
 buttons.append(save,cancel);form.append(buttons);root.append(form);root.scrollIntoView({block:'center'});
}

function trainCalendar(){
 const editPanel=$('train-editor');editPanel.replaceChildren();editPanel.hidden=true;
 const root=$('train-calendar');root.replaceChildren();
 const range=stageRange(state.trainStage);$('train-stage-dates').textContent='Stage '+state.trainStage+' · '+range.start+' to '+range.end+' · 5 weeks / 35 days';
 const entries=trainRecords(),schedule=new Map();
 for(const item of entries){if(!schedule.has(item.train_date))schedule.set(item.train_date,[]);schedule.get(item.train_date).push(item)}
 const table=text('table',null,'train-grid'),thead=text('thead'),header=text('tr'),tbody=text('tbody');
 weekdays.forEach(day=>header.append(text('th',day)));thead.append(header);
 const stageIssues=[];
 for(let w=0;w<5;w++){
  const row=text('tr');
  for(let d=0;d<7;d++){
   const date=trainAddDays(range.start,w*7+d),td=text('td',null,'train-cell'),current=schedule.get(date)||[];
   const dateBtn=text('button',date.slice(5),'train-date-button');dateBtn.type='button';dateBtn.title='Select '+date+' for train planning';
   dateBtn.addEventListener('click',()=>{$('train-date').value=date;const slot=current[0]?.slot||trainLabelForDate(state.trainStage,date)||trainLabel[d];$('train-slot').value=slot;$('train-source').value=inferTrainMode(slot,current[0]?.source);opt('train-member',true);opt('train-vip',true);candidates();eligibilityWarnings();$('train-date').scrollIntoView({block:'center'})});
   td.append(dateBtn,text('small',current[0]?.slot||trainLabelForDate(state.trainStage,date)||trainLabel[d],'train-type'));
   for(const award of current){
    const item=text('div',null,'train-entry'+(award.legacy?' train-archive-entry':'')+(isR4Train(award)?' train-r4-entry':''));
    item.append(text('strong','D: '+(award.legacy?displayTrainName(award.driverName):award.driverName)),text('span','VIP: '+(award.legacy?displayTrainName(award.vipName):award.vipName)));
    if(award.legacy)item.append(text('small','Spreadsheet history','train-archive-note'));
    if(isR4Train(award))item.append(text('small','R4 train · separate eligibility','train-archive-note'));
    if(award.notes)item.append(text('small',award.notes,'train-archive-note'));
    if(award.originalDriverName&&award.originalDriverName!==award.driverName)item.append(text('small','Originally: '+award.originalDriverName,'train-archive-note'));
    if(award.replacementReason)item.append(text('small','Change: '+award.replacementReason,'train-archive-note'));
    if(award.legacy){const edit=text('button','Edit conductor / VIP','stat-button train-edit-button');edit.type='button';edit.addEventListener('click',()=>openLegacyTrainEditor(award,item));item.append(edit)}
    const previous=entries.filter(a=>a.train_date<award.train_date);
    const issues=trainWarnings(previous,award,labelForTrainKey);
    if(issues.length){item.classList.add('train-entry-warning');item.append(text('small','⚠ Review repeat recipient','train-issue'));stageIssues.push(...issues)}
    td.append(item);
   }
   if(!current.length)td.append(text('small','Unassigned','train-unassigned'));
   row.append(td);
  }
  tbody.append(row);
 }
 table.append(thead,tbody);root.append(table);
 const warnings=$('train-stage-warnings');warnings.replaceChildren();
 if(stageIssues.length){warnings.append(text('strong','⚠ '+stageIssues.length+' possible eligibility warning'+(stageIssues.length===1?'':'s')+' in this Stage','train-warning-title'));
  const details=document.createElement('details');const summary=text('summary','Review flagged historical assignments');details.append(summary);stageIssues.forEach(issue=>details.append(text('p',issue,'train-rule-warning')));warnings.append(details);
 }else warnings.append(text('p','No repeat-recipient warnings found in this Stage. Other eligibility checks still require R4 review.','stat-muted'));
}

function trainHistory(){
 const root=$('train-history');root.replaceChildren();if(!state.data.awards.length){root.append(elEmpty('The spreadsheet archive is displayed above. No editable train assignments have been added for this Stage.'));return}
 for(const award of state.data.awards){const row=text('div',null,'stat-row');row.append(text('strong',award.train_date+' · '+award.slot+' · Conductor: '+memberName(award.member_id)+' · VIP: '+(award.vip_member_id?memberName(award.vip_member_id):'Not recorded')));row.append(text('p',award.source.toUpperCase()+(award.reason?' · '+award.reason:''),'stat-muted'));
  const edit=text('button','Edit conductor / VIP','stat-button');edit.type='button';edit.addEventListener('click',()=>{
   const existing=row.querySelector('.train-edit');if(existing){existing.remove();return}
   const fields=text('div',null,'train-edit stat-fields');
   const makePicker=(labelText,selected)=>{const label=text('label',labelText),select=document.createElement('select');for(const m of members())select.append(new Option(m.display_name,m.id));if(selected)select.value=selected;label.append(select);fields.append(label);return select};
   const conductor=makePicker('Conductor',award.member_id);
   const vip=makePicker('VIP',award.vip_member_id);
   const why=text('label','Reason for replacement'),reason=document.createElement('input');reason.type='text';reason.maxLength=200;reason.placeholder='e.g. Bob did not show up';why.append(reason);fields.append(why);
   const save=text('button','Save conductor + VIP','stat-button primary');save.type='button';
   save.addEventListener('click',()=>{if(!conductor.value||!vip.value||conductor.value===vip.value){notice('Choose two different members for conductor and VIP.',true);return}if(conductor.value!==award.member_id&&!reason.value.trim()){notice('Please give a reason for changing the conductor.',true);return}const proposed={id:award.id,train_date:award.train_date,member_id:legacyKey(memberName(conductor.value)),vip_member_id:legacyKey(memberName(vip.value)),source:award.source,slot:award.slot};const issues=trainWarnings(trainRecords().filter(a=>a.id!==award.id),proposed,labelForTrainKey);if(issues.length&&!confirm('Review train warnings before editing:\n\n'+issues.join('\n')+'\n\nSave the change anyway?'))return;action(()=>post({action:'update_award',id:award.id,member_id:conductor.value,vip_member_id:vip.value,reason:reason.value.trim()}),'Train conductor and VIP updated, with change reason saved.')});
   fields.append(save);row.append(fields);
  });row.append(edit);
  const button=text('button','Remove mistaken assignment','stat-button');button.addEventListener('click',()=>{if(confirm('Delete this train assignment?'))action(()=>post({action:'delete_award',id:award.id}),'Assignment removed.')});row.append(button);root.append(row)
 }
}

// Event wiring for Train Desk. Add inside the original page's wire() function.
 $('train-stage').addEventListener('change',()=>{state.trainStage=Number($('train-stage').value);load()});
 $('train-source').addEventListener('change',()=>{
  const date=$('train-date').value,mode=$('train-source').value,slot=$('train-slot');
  if(mode==='never'&&!/no train|vote|roulette/i.test(slot.value))slot.value='Never had a train / participation';
  if(mode==='vs'&&validDate(date)&&new Date(date+'T00:00:00Z').getUTCDay()===6&&/^R4(?:\s|$)/i.test(slot.value))slot.value='Saturday VS top scores';
  if(mode==='r4'&&slot.value==='Saturday VS top scores')slot.value=trainLabelForDate(stageForDate(date),date)||'R4 train';
  if(mode==='vs'||mode==='donations'){$('train-member').value='';$('train-vip').value=''}
  candidates();eligibilityWarnings();
 });
 $('train-date').addEventListener('change',()=>{const date=$('train-date').value;if(!validDate(date))return;const stage=stageForDate(date);const label=trainLabelForDate(stage,date);if(label){$('train-slot').value=label;$('train-source').value=inferTrainMode(label)}if(stage!==state.trainStage){state.trainStage=stage;$('train-stage').value=String(stage);load()}else{opt('train-member',true);opt('train-vip',true);candidates();eligibilityWarnings()}});
 $('train-member').addEventListener('change',()=>{showVipAdvice(state.advice,{autoSelect:!!state.advice?.scoreRanked});eligibilityWarnings()});$('train-vip').addEventListener('change',eligibilityWarnings);$('train-vip-mode').addEventListener('change',()=>{candidates();eligibilityWarnings()});$('train-slot').addEventListener('change',()=>{candidates();eligibilityWarnings()});
 $('award').addEventListener('click',()=>{const mode=$('train-source').value,source=mode==='never'&&/^r4/i.test($('train-slot').value)?'r4':mode==='never'?'manual':mode,date=$('train-date').value,id=$('train-member').value,vipId=$('train-vip').value,reason=$('train-reason').value.trim();
  if(!id||!vipId||!date||id===vipId){notice('Select a date and two different members: conductor and VIP.',true);return}
   if(departedOn(id,date)||departedOn(vipId,date)){notice('A selected player is no longer in UTW. Choose an active member for this date.',true);return}
  const advice=state.advice?.date===date&&state.advice?.mode===mode&&state.advice?.vipMode===$('train-vip-mode').value?state.advice:null;
   const selected=advice?.candidates?.find(c=>c.id===id);
   if(selected&&!selected.eligible&&(!reason||!confirm('Saved train records flag this conductor:\\n'+selected.reasons.join('\\n')+'\\nSave override anyway?'))){notice('Add an override reason and confirm the eligibility warning.',true);return}
    const vipChoice=advice?.vipCandidates?.find(v=>v.id===vipId);
    if(vipChoice&&!vipChoice.eligible&&(!reason||!confirm('Saved train records flag this VIP:\\n'+vipChoice.reasons.join('\\n')+'\\nSave VIP override anyway?'))){notice('Add a VIP override reason and confirm the eligibility warning.',true);return}
   const blocked=[...activeException(id,source,date),...activeException(vipId,source,date)];
  if(blocked.length&&(!reason||!confirm('A selected player has an active exception. Save a manual override with the stated reason?'))){notice('An override reason and confirmation are required for an excepted member.',true);return}
  const warnings=currentTrainWarnings();if(warnings.length&&!confirm('Review train eligibility warnings:\n\n'+warnings.join('\n')+'\n\nRecord this assignment anyway?'))return;
  action(()=>post({action:'award',season_id:state.season,train_date:date,slot:$('train-slot').value,member_id:id,vip_member_id:vipId,source,reason}), 'Conductor and VIP recorded.');
 });
```

## 3. Train Desk CSS

Uses shared global CSS and R4 UI styles, but the rules below cover Train Desk-specific components.

```css
.stat-candidate{display:flex;justify-content:space-between;gap:14px;align-items:start;padding:12px 0;border-bottom:1px solid #e7d8bb}
.stat-candidate strong{color:#255b40}.stat-candidate .stat-button{flex-shrink:0}

/* Five-week train desk stage calendar */
.train-calendar{overflow-x:auto;border:1px solid #c8b68b;border-radius:14px;margin:14px 0 16px;background:#fffdf6}
.train-grid{width:100%;border-collapse:separate;border-spacing:0;min-width:770px;table-layout:fixed}
.train-grid th{padding:12px 6px;background:#234b39;color:#fff7df;text-align:center;font-size:13px}
.train-grid td{vertical-align:top;padding:9px 8px;border-right:1px solid #e3d4b3;border-bottom:1px solid #e3d4b3;min-height:106px}
.train-grid td:last-child{border-right:0}
.train-grid tbody tr:last-child td{border-bottom:0}
.train-date-button{display:block;border:0;border-radius:7px;background:#e7f1e6;color:#24533b;padding:5px 9px;font-size:13px;font-weight:800;cursor:pointer;text-align:left}
.train-date-button:hover,.train-date-button:focus-visible{outline:2px solid #c39749;background:#d4e7d3}
.train-type{display:block;color:#6c725c;font-size:10px;line-height:1.3;margin:7px 0}
.train-entry{display:flex;flex-direction:column;gap:3px;padding:7px 6px;margin-top:5px;border-radius:7px;background:#e9f0e4;color:#294f3b;overflow-wrap:anywhere;font-size:11px}
.train-entry strong{font-size:11px}
.train-entry-warning{border:1px solid #ca8c5f;background:#fff1df}
.train-issue,.train-rule-warning{color:#8b4125!important}
.train-issue{font-weight:750}
.train-unassigned{font-style:italic;color:#999586;font-size:10px}
.train-warning-title{color:#883d23;display:block;margin-top:8px}
#train-eligibility-warnings,#train-stage-warnings{margin:9px 0}
.train-rule-warning{font-size:13px;line-height:1.4;background:#fff0e5;border-left:3px solid #ce8d52;border-radius:5px;padding:7px 10px;margin:5px 0}
.train-rules{margin-top:13px;border:1px solid #d7c39b;border-radius:12px;padding:12px 15px;background:#fdf6e6}
.train-rules summary{cursor:pointer;color:#2d5742;font-weight:800}
.train-rules li{margin:5px 0;line-height:1.5;font-size:13px}
@media(max-width:760px){.train-grid{min-width:720px}.train-grid td{padding:7px 5px}.train-entry{padding:5px;font-size:10px}}


/* R4 trains are a separate eligibility category and not DS-blocking. */
.train-r4-entry{background:#efe8cb;border:1px solid #c0a260}
.train-archive-note{font-size:10px;line-height:1.4}
.train-edit-button{margin-top:5px;padding:6px 8px;font-size:11px;white-space:normal}
.train-editor-panel{border:1px solid #bba36c;background:#fff8e8;padding:16px;border-radius:14px;margin:13px 0}
.train-editor-panel[hidden]{display:none!important}
.train-legacy-editor{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:end}
.train-legacy-editor .train-edit-heading,.train-legacy-editor .stat-muted,.train-editor-actions{grid-column:1/-1}
.train-legacy-editor label{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:700;color:#355b46}
.train-legacy-editor input,.train-legacy-editor select{width:100%;min-width:0;border:1px solid #c9b58a;border-radius:8px;background:#fffdf6;color:#1f4734;font:inherit;padding:10px}
.train-editor-actions{display:flex;gap:9px;flex-wrap:wrap}
@media(max-width:600px){.train-legacy-editor{grid-template-columns:1fr}}

/* Train Desk recommendation evidence, ranked skips and proposed rotation. */
.train-advice-favorite{padding:12px;border:1px solid #adc29d;border-radius:10px;background:#f1f7ed;margin:8px 0}
.train-advice-recommended{font-size:12px;color:#2a6544;font-weight:800;margin:4px 0}
.train-advice-substitution{padding:12px 14px;border-radius:10px;border:1px solid #d8c599;background:#fbf2dc;color:#624c25;font-size:13px;line-height:1.45}
#candidates .stat-flag.blocked{display:block;width:fit-content;margin:5px 0 0}
#candidates .stat-candidate > div:first-child{min-width:0;flex:1}

/* Weekly score-based train pair: conductor first, next eligible scorer as VIP. */
#train-pair-suggestion:empty{display:none}
.train-pair-card{padding:13px 15px;margin:14px 0;border:1px solid #c7b58d;border-radius:11px;background:#fffdf7}
.train-pair-heading{display:block;font-size:14px;color:#29553e;margin-bottom:7px}
.train-pair-line{font-size:13px;line-height:1.5;margin:5px 0;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.train-pair-card .stat-muted{font-size:12px;margin:8px 0 0}
```

## 4. Train eligibility and Stage rules (complete file)

Original: `assets/r4-train-rules.mjs`

```javascript
// Pure train calendar and eligibility checks shared by the R4 Train Desk.
export const TRAIN_ANCHOR='2026-08-03';
export const TRAIN_BASE_STAGE=13;
const DAY=86400000;
const toTime=date=>Date.parse(date+'T00:00:00Z');
export const addDays=(date,days)=>new Date(toTime(date)+days*DAY).toISOString().slice(0,10);
export function stageRange(stage){
 if(!Number.isInteger(stage)||stage<7||stage>40)throw Error('Unsupported train calendar');
 // Stages 7 and 8 preceded a one-week break before Stage 9.
 const start=stage===7?'2025-12-29':stage===8?'2026-02-02':addDays(TRAIN_ANCHOR,(stage-TRAIN_BASE_STAGE)*35);
 return {stage,start,end:addDays(start,34)};
}
export function stageForDate(date){
 const timestamp=toTime(date);
 if(!Number.isFinite(timestamp))return TRAIN_BASE_STAGE;
 if(timestamp<toTime('2026-02-02'))return 7;
 if(timestamp<toTime('2026-03-16'))return 8;
 return Math.max(9,Math.min(40,TRAIN_BASE_STAGE+Math.floor((timestamp-toTime(TRAIN_ANCHOR))/(35*DAY))));
}
export const weekStart=date=>addDays(date,-((new Date(toTime(date)).getUTCDay()+6)%7));
export const trainRole=(award,id)=>award.member_id===id?'Driver':award.vip_member_id===id?'VIP':null;
// Only Thursday/Saturday R4 conductor trains use a separate eligibility lane.
// A Wednesday R4 vote is not a train assignment, and VIPs never use this lane.
export function isR4Train(award){
 const date=award?.train_date||award?.date;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return false;
 const day=new Date(date+'T00:00:00Z').getUTCDay();
 const label=String(award?.slot||award?.selection_label||'').trim();
 const source=String(award?.source||'').toLowerCase();
 // An explicitly selected VS / DS / donation train cannot inherit an
 // R4 exemption merely because its calendar date has an R4 default label.
 const actualR4=source==='r4'||(!source||source==='manual')&&/^R4(?:\s|$)/i.test(label);
 return (day===4||day===6)&&actualR4&&!/\bvote\b/i.test(label);
}
// Conductor and VIP are independent entitlements. Standard conductors are
// limited to one five-week Stage; VIPs are limited to one Monday-Sunday week,
// across ALL train types, even Thursday/Saturday R4 trains.
export function trainWarnings(awards,proposed,displayName=id=>id){
 const {train_date,member_id,vip_member_id,source,slot,id:editingId}=proposed;
 if(!train_date||(!member_id&&!vip_member_id))return [];
 const stage=stageForDate(train_date),range=stageRange(stage),weeklyStart=weekStart(train_date);
 const weeklyEnd=addDays(weeklyStart,6),r4Lane=isR4Train(proposed),warnings=[];
 const sameStage=awards.filter(a=>a.id!==editingId&&
   a.train_date>=range.start&&a.train_date<=range.end);
  const sameLane=sameStage.filter(a=>isR4Train(a)===r4Lane);
 const valid=id=>id&&String(id).trim().toLowerCase()!=='not recorded';
 if(valid(member_id)){
  const name=displayName(member_id);
  const previous=sameLane.filter(a=>a.member_id===member_id);
  for(const prior of previous){
   warnings.push(name+' already drove on '+prior.train_date+
    ' (Stage '+stage+'). A conductor cannot drive twice in the same five-week stage.');
  }
  if(source==='donations'||source==='ds'||source==='vs'){
   const winner=previous.find(a=>a.source===source);
   if(winner){
    const label={ds:'DS MVP',donations:'Top donor',vs:'Top VS'}[source];
    warnings.push(name+' already received a '+label+' conductor assignment on '+winner.train_date+' in Stage '+stage+'.');
   }
  }
 }
 if(valid(vip_member_id)){
  const name=displayName(vip_member_id);
  const previous=sameStage.filter(a=>a.vip_member_id===vip_member_id);
  const thisWeek=previous.filter(a=>a.train_date>=weeklyStart&&a.train_date<=weeklyEnd);
  for(const prior of thisWeek){
   warnings.push(name+' was already a VIP on '+prior.train_date+
    '. A VIP cannot be selected again in the same Monday-to-Sunday week.');
  }
  if(source==='donations'||source==='ds'){
   const winner=previous.find(a=>a.source===source);
   if(winner){
    const label={ds:'DS MVP',donations:'Top donor',vs:'Top VS'}[source];
    warnings.push(name+' already received a '+label+' VIP assignment on '+winner.train_date+' in Stage '+stage+'.');
   }
  }
 }
 if(valid(member_id)&&valid(vip_member_id)&&member_id===vip_member_id)
  warnings.push(displayName(member_id)+' cannot be both conductor and VIP on the same train.');
 return [...new Set(warnings)];
}

```

## 5. Calendar labels and schedules (complete file)

Original: `assets/r4-train-schedule.mjs`

```javascript
// Day-specific train selection labels from the UTW.xlsx Stage 7–16 calendars.
// Original conductor and VIP names stay in the private Supabase archive.
import {stageRange} from './r4-train-rules.mjs';
export const stageTrainLabels={
 "7": [
  "VS TOP 1",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Mo",
  "R5 Acu",
  "R4 Ganoosh",
  "Alliance vote",
  "VS TOP 1",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Suby",
  "R5 Acu choice (given)",
  "R4 Benny",
  "Never had train roulette",
  "VS TOP 1-save week Roulette",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Deviant",
  "R3 Roulette",
  "R4 CallmeBaba",
  "Never had train roulette",
  "VS TOP 1",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Kitkatt",
  "R3 Roulette",
  "R4 Rylis haha",
  "Never had train roulette",
  "VS TOP 1",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Crum",
  "Free for all Roulette",
  "R4 Tiny",
  "Never had train roulette"
 ],
 "8": [
  "VS TOP 1",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Mo",
  "R5 Acu",
  "R4 Ganoosh",
  "Alliance vote",
  "VS TOP 1",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Suby",
  "Train masters choice",
  "R4 CallmeBaba",
  "Never had train roulette",
  "VS TOP 1",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Rylis haha",
  "R3 Roulette",
  "R4 Crum",
  "Never had train roulette",
  "VS TOP 1",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Deviant",
  "R3 Roulette",
  "R4 Tiny",
  "Never had train roulette",
  "VS TOP 1",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Plant",
  "Free for all Roulette",
  "R4 Savvy",
  "Never had train roulette"
 ],
 "9": [
  "VS TOP 1",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R5 Mo",
  "R4 Goodbye Acu",
  "R4 CallmeBaba",
  "Alliance vote",
  "VS TOP 1",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Devi",
  "Train masters choice",
  "R4 Ganoosh",
  "Never had train roulette",
  "VS TOP 1",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Subby",
  "R3 Roulette",
  "R4 Crum",
  "Never had train roulette",
  "VS TOP 1",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Rylis haha!",
  "R3 Roulette",
  "R4 Tiny",
  "Never had train roulette",
  "VS TOP 1",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Plant",
  "Free for all Roulette",
  "R4 Savvy",
  "Never had train roulette"
 ],
 "10": [
  "Top donation last week",
  "DS Mvp's",
  "Canyon Mvp's",
  "R4 Noosh",
  "R5 Mo",
  "R4 Baba",
  "VS Mvp's",
  "Top donation last week",
  "DS Mvp's",
  "Canyon Mvp's",
  "R4 Devi",
  "Baba's Choice",
  "R4 Crum",
  "VS Mvp's",
  "Top donation last week",
  "DS Mvp's",
  "Canyon Mvp's",
  "R4 Tiny",
  "Vs competition",
  "R4 SubZero",
  "VS Mvp's",
  "Top donation last week",
  "DS Mvp's",
  "Canyon Mvp's",
  "R4 Rylis haha!",
  "Roulette",
  "R4 Savvy",
  "VS Mvp's",
  "Top donation last week",
  "DS Mvp's",
  "Canyon Mvp's",
  "R4 Plant",
  "Roulette",
  "R4 Sea",
  "VS Mvp's"
 ],
 "11": [
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Noosh",
  "R5 Mo",
  "R4 Baba",
  "VS Mvp's",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Devi",
  "Rylis's Choice",
  "R4 Crum",
  "VS Mvp's",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Tiny",
  "Roulette",
  "R4 SubZero",
  "VS Mvp's",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Rylis haha!",
  "Roulette",
  "R4 Savvy",
  "VS Mvp's",
  "Top donation last week",
  "Event Top 2 scores (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Plant",
  "Roulette",
  "R4 Sea",
  "No VS train Mvp's"
 ],
 "12": [
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Noosh",
  "R5 Mo",
  "R4 Baba",
  "VS Mvp's",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Crum",
  "Rylis's Choice",
  "R4 Tiny",
  "VS Mvp's",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Tiny",
  "Roulette",
  "R4 Rylis",
  "VS Mvp's",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Savvy",
  "Roulette",
  "R4 Sea",
  "VS Mvp's",
  "Top donation last week",
  "Event Top 2 scores (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Plant",
  "Roulette",
  "R4 Iz",
  "No VS train Mvp's"
 ],
 "13": [
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Mo",
  "R5 Noosh",
  "R4 Tiny",
  "VS save week closest to 7.2M",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Baba",
  "Rylis's Choice",
  "R4 Rylis",
  "VS MVP's",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Plant",
  "Roulette",
  "R4 Crum",
  "VS Mvp's",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Sea",
  "Roulette",
  "R4 Savvy",
  "Alliance Star 68 vote",
  "Top donation last week",
  "Event Top 2 scores (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Iz",
  "Roulette",
  "R4 CatalystX",
  "VS train Mvp's"
 ],
 "14": [
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Mo",
  "R5 Noosh",
  "R4 Tiny",
  "VS Mvp's",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Baba",
  "Rylis's Choice",
  "R4 Rylis",
  "Chicken Egg contest",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Plant",
  "Roulette",
  "R4 Crum",
  "Mystery Supply Box contest",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Sea",
  "Roulette",
  "R4 Savvy",
  "VS Mvp's",
  "Top donation last week",
  "Event Top 2 scores (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Iz",
  "Roulette",
  "R4 CatalystX",
  "VS Mvp's"
 ],
 "15": [
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Mo",
  "R5 Noosh",
  "R4 Tiny",
  "VS Mvp's",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Baba",
  "Rylis's Choice",
  "R4 Rylis",
  "VS MVP's",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Crum",
  "Roulette",
  "R4 Devi",
  "VS top score",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Sea",
  "Roulette",
  "R4 Savvy",
  "VS top score",
  "Top donation last week",
  "Event Top 2 scores (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Iz",
  "Roulette",
  "R4 CatalystX",
  "VS top score"
 ],
 "16": [
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Mo",
  "R5 Noosh",
  "R4 Tiny",
  "VS Mvp's",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Baba",
  "Rylis's Choice",
  "R4 Rylis",
  "Chicken Egg contest",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Crum (proposed)",
  "Roulette",
  "R4 Devi (proposed)",
  "Mystery Supply Box contest",
  "Top donation last week",
  "Event MVP (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Sea",
  "Roulette",
  "R4 Savvy",
  "VS Mvp's",
  "Top donation last week",
  "Event Top 2 scores (DS mvp or other)",
  "R4 Vote (no train for a while)",
  "R4 Iz",
  "Roulette",
  "R4 CatalystX",
  "No VS train Mvp's"
 ]
};
export function trainLabelForDate(stage,date){
 const start=stageRange(Number(stage)).start;
 const offset=Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000);
 return stageTrainLabels[String(stage)]?.[offset]||null;
}

```

## 6. Recommendation engine (complete file)

Original: `lib/train-advice.mjs`

```javascript
// R4-only, evidence-based train recommendations. Does not make assignments.
// Stages 1-6 and uncertain historical nicknames are not verifiable in the archive.
import {stageRange,stageForDate,weekStart,isR4Train} from '../assets/r4-train-rules.mjs';
import {trainLabelForDate} from '../assets/r4-train-schedule.mjs';

export const tidy=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
const knownNames={
 tiny:'tinymayhem',mo:'movichmo',baba:'callmebaba',
 crum:'crum',devi:'Ɖevi',savvy:'savvyvandromee',
 sea:'seabeastfromwren',seabeast:'seabeastfromwren',
 iz:'iz4rd',izard:'iz4rd',rylis:'rylispro',catalyst:'catalystx',
 noosh:'gan00sh',ganoosh:'gan00sh',subzero:'subz3ro',
 neoo:'mynameisneoo',xgamer:'xgamer20',leo:'leonob',
 smotpoker:'commandersmotpoker',hippie:'tragicallyhippie',
 silentkiller:'silentkiller90z',minimum:'mininimum',
 kingtodd0:'kingtoddo',gb:'mfkngb'
};

export function resolveNames(members,aliases){
 const lookup=new Map(),conflicts=new Set();
 const add=(raw,id)=>{
  const k=tidy(raw);if(!k||!id)return;
  if(lookup.has(k)&&lookup.get(k)!==id)conflicts.add(k);
  else lookup.set(k,id);
 };
 for(const member of members)add(member.display_name,member.id);
 for(const a of aliases){add(a.alias,a.member_id);add(a.alias_key,a.member_id)}
 for(const [short,long] of Object.entries(knownNames)){
  const target=lookup.get(tidy(long));if(target)add(short,target);
 }
 for(const k of conflicts)lookup.delete(k);
 return value=>lookup.get(tidy(value))||null;
}

export function buildTrainAdvice({date,mode,slot='',vipMode='weekly',members=[],aliases=[],legacy=[],awards=[],exceptions=[],scoreboard=[],scoreDate=null,dsEvent=null,rosterIds=[],rosterDate=null,vsRecordCounts={}}){
 const stage=stageForDate(date),range=stageRange(stage),monday=weekStart(date);
 const saturdayVs=mode==='vs'&&new Date(date+'T00:00:00Z').getUTCDay()===6;
 const scoreRanked=mode==='vs'||mode==='donations';
 const resolve=resolveNames(members,aliases),byId=new Map(members.map(m=>[m.id,m.display_name]));
 const vsCount=id=>Math.max(0,Number(vsRecordCounts[id]||0));
 // A former alliance member is ineligible after their departure date, but their
 // earlier train assignments still participate in the historical record.
 const departed=new Set(exceptions.filter(x=>x.active&&x.scope==='all'&&
   /^No longer in UTW\b/i.test(x.reason||'')&&x.starts_on<=date&&x.ends_on>=date)
   .map(x=>x.member_id));
 const savedDates=new Set(awards.map(a=>a.train_date));
 const history=[
  ...legacy.filter(x=>!savedDates.has(x.train_date)).map(x=>({
   date:x.train_date,source:x.source,slot:x.selection_label,
   driver:resolve(x.driver_name),vip:resolve(x.vip_name),
   driverName:x.driver_name,vipName:x.vip_name
  })),
  ...awards.map(x=>({
   date:x.train_date,source:x.source,slot:x.slot,
   driver:x.member_id,vip:x.vip_member_id||null,
   driverName:byId.get(x.member_id)||'Former member',vipName:byId.get(x.vip_member_id)||'Not recorded'
  }))
 ].filter(x=>x.date<=date).sort((a,b)=>b.date.localeCompare(a.date));
 const before=history.filter(x=>x.date<date),sameDate=history.filter(x=>x.date===date);
 const label=slot||(saturdayVs?'Saturday VS top scores':trainLabelForDate(stage,date))||'';
 const nameMatch=mode==='r4'?label.match(/^R4\s+(.+?)(?:\s*\(proposed\))?$/i):null;
 const host=nameMatch&&!/vote|choice|participation/i.test(nameMatch[1])?nameMatch[1].replace(/\s*\(proposed\)$/i,'').trim():null;
 const hostId=host?resolve(host):null;
 const isProposal=/\(proposed\)/i.test(label);
 let rows=[],context='',dataDate=null;
 if(mode==='r4'){
  if(hostId)rows=[{id:hostId,place:1,points:null}];
  context=host?('Rotation holder: '+host+(isProposal?' (proposed from Stage 15)':'')+(hostId?'':' (not linked to a current stats member, choose the actual player manually)')): 'This slot has no named R4 rotation holder. R4 must choose the conductor.';
 }else if(mode==='vs'||mode==='donations'){
  const best=new Map();
  for(const row of scoreboard){if(!row.member_id||!byId.has(row.member_id))continue;
   if(!best.has(row.member_id)||Number(row.points)>best.get(row.member_id).points)best.set(row.member_id,{id:row.member_id,points:Number(row.points)});
  }
  rows=[...best.values()].sort((a,b)=>b.points-a.points||byId.get(a.id).localeCompare(byId.get(b.id))).map((r,i)=>({...r,place:i+1}));
  dataDate=scoreDate;
  context=scoreDate?'Rankings from '+(mode==='vs'?(saturdayVs?"this week's VS weekly total for week starting ":'completed VS weekly total for week starting '):'donation week starting ')+scoreDate:
   (saturdayVs?"No VS weekly total has been uploaded for this Saturday's current week. ":"No "+(mode==='vs'?'completed VS weekly total for the previous week':'previous-week donation total')+' has been uploaded. ')+
   'Daily VS points are not used for train selection.';
 }else if(mode==='ds'){
  rows=dsEvent?[dsEvent.first_member,dsEvent.second_member,dsEvent.third_member].filter(id=>id&&byId.has(id)).map((id,i)=>({id,place:i+1,points:null})):[];
  dataDate=dsEvent?.event_date||null;
  context=dsEvent?'Desert Storm podium from '+dsEvent.event_date:'No recent Desert Storm result was uploaded.';
 }else if(mode==='never'){
  const latest=new Map();
  for(const h of before)for(const id of [h.driver,h.vip])if(id&&!latest.has(id))latest.set(id,h.date);
  const roster=new Set(rosterIds.filter(id=>byId.has(id)));
  const pool=roster.size?members.filter(m=>roster.has(m.id)):members;
  rows=pool.filter(m=>m.id&&!departed.has(m.id)).map(m=>({id:m.id,place:0,points:null,last:latest.get(m.id)||null,vsRecords:vsCount(m.id)}))
   .sort((a,b)=>Number(!!a.last)-Number(!!b.last)||(a.last||'').localeCompare(b.last||'')||b.vsRecords-a.vsRecords||byId.get(a.id).localeCompare(byId.get(b.id)))
   .map((r,i)=>({...r,place:i+1}));
  const neverCount=rows.filter(r=>!r.last).length;
  context=(roster.size?'Using '+roster.size+' names from the latest available VS roster ('+rosterDate+'). ':
   'No VS roster upload found for this date. Using the member directory as a fallback. ')+
   (neverCount?neverCount+' members have no matched train record since Stage 7. They appear first.':
    'Everyone in this roster has a matched train record. Recommending the longest wait since their MOST RECENT conductor or VIP turn, starting with Stage 7, then Stage 8 onward.')+
   ' Older than Stage 7 or unlinked historical names still need R4 review. VS history breaks ties between equally eligible members.';
 }else{
  context='Choose a source to see evidence-based conductor recommendations.';
 }
 if(mode==='r4'&&hostId&&departed.has(hostId))context+=' This player is marked as departed and cannot be recommended.';
 const r4Lane=isR4Train({date,source:mode,slot:label});
 // Preserve original score places when a departed player topped a weekly report.
 const candidateRows=rows.filter(item=>!departed.has(item.id));
 const results=candidateRows.map(item=>{
  const reasons=[],notes=[];
  const mine=before.filter(h=>h.driver===item.id||h.vip===item.id);
  const latest=mine[0];
  const ex=exceptions.filter(x=>x.active&&x.member_id===item.id&&x.starts_on<=date&&x.ends_on>=date&&(x.scope==='all'||x.scope===mode));
  if(ex.length)reasons.push('Active exception: '+ex.map(x=>x.reason).join('; '));
  if(mode==='never'){
   if(latest)notes.push('Longest-wait fallback: last recorded '+(latest.driver===item.id?'conductor':'VIP')+' on '+latest.date+' (Stage '+stageForDate(latest.date)+')');
   else notes.push('No matched conductor or VIP entry in Stages 7 onward');
   notes.push('Appears in '+vsCount(item.id)+' archived VS reports (tenure estimate)');
  }
  // Recommendations are for the conductor slot. A prior VIP selection can NEVER
  // disqualify someone from driving; R4 trains still have their own separate lane.
  const priorDriver=before.find(h=>h.driver===item.id&&h.date>=range.start&&h.date<=range.end&&isR4Train(h)===r4Lane);
  if(priorDriver)reasons.push('Already conductor on '+priorDriver.date+' in Stage '+stage+' (conductor limit: once per stage)');
  if(mode!=='never'&&latest)notes.push('Last recorded train '+latest.date+' ('+(latest.driver===item.id?'conductor':'VIP')+')');
  return {id:item.id,name:byId.get(item.id),place:item.place,points:item.points,
   eligible:reasons.length===0,reasons,notes};
 });
 const recommended=results.find(x=>x.eligible)||null;
 const skipped=results.filter(x=>!x.eligible&&(!recommended||x.place<recommended.place)).slice(0,8);
 let substitution=null;
 if(recommended&&skipped.length&&(mode==='vs'||mode==='donations'||mode==='ds')){
  const first=skipped[0];
  substitution=first.name+' (#'+first.place+') skipped: '+first.reasons[0]+'. Suggest '+recommended.name+' (#'+recommended.place+') instead.';
 }
 // For weekly VS / donation trains, BOTH roles follow the saved score ranking.
 // Conductor checks stay independent from VIP turns; VIP eligibility is weekly.
 // Other train types retain the existing longest-wait VIP suggestions.
 const scoreRankById=new Map(scoreRanked?rows.map(x=>[x.id,x.place]):[]);
 const scorePointsById=new Map(scoreRanked?rows.map(x=>[x.id,x.points]):[]);
 const vipCandidates=members.filter(m=>m.id&&!departed.has(m.id)&&(!scoreRanked||scoreRankById.has(m.id))).map(m=>{
  const turns=before.filter(h=>h.vip===m.id);
  const last=turns[0]||null;
  const stageTurn=turns.find(h=>h.date>=range.start&&h.date<=range.end);
  const weekTurn=turns.find(h=>h.date>=monday);
  const ex=exceptions.filter(x=>x.active&&x.member_id===m.id&&x.starts_on<=date&&x.ends_on>=date&&
    (x.scope==='all'||x.scope===mode));
  const reasons=[];
  if(weekTurn)reasons.push('Already VIP on '+weekTurn.date+' this week');
  // Stage VIP preference is optional for donations and other trains; VS follows
  // the weekly VIP cap even when that preference is selected elsewhere.
  if(vipMode==='stage'&&mode!=='vs'&&stageTurn)reasons.push('Already VIP on '+stageTurn.date+' in Stage '+stage);
  if(ex.length)reasons.push('Active exception: '+ex.map(x=>x.reason).join('; '));
  const notes=[last?'Last VIP on '+last.date+' (Stage '+stageForDate(last.date)+')':
    'No matched VIP turn since Stage 7'];
  if(!scoreRanked)notes.push('Appears in '+vsCount(m.id)+' archived VS reports (tenure estimate)');
  return {id:m.id,name:m.display_name,eligible:reasons.length===0,reasons,notes,
    scoreRank:scoreRanked?scoreRankById.get(m.id):null,
    // Preserve the Saturday VS field for existing consumers.
    vsRank:mode==='vs'?scoreRankById.get(m.id):null,
    points:scoreRanked?scorePointsById.get(m.id):null,
    lastVip:last?.date||null,stageVip:!!stageTurn,vsRecords:vsCount(m.id)};
 }).sort((a,b)=>scoreRanked?a.scoreRank-b.scoreRank:
   Number(b.eligible)-Number(a.eligible)||
   Number(!!a.lastVip)-Number(!!b.lastVip)||
   (a.lastVip||'').localeCompare(b.lastVip||'')||b.vsRecords-a.vsRecords||a.name.localeCompare(b.name))
   .map((r,i)=>({...r,place:scoreRanked?r.scoreRank:i+1}));
 // Take the next LOWER ranked score after the selected conductor, skipping
 // anyone who already had VIP this week. Never loop back to a higher score.
 const recommendedVip=scoreRanked&&recommended?
  vipCandidates.find(v=>v.eligible&&v.id!==recommended.id&&v.scoreRank>recommended.place)||null:null;
 const limitations='Recommendations use recorded Stages 7 onward, saved R4 edits and matching member aliases. VS appearances estimate tenure, not a verified join date. Former UTW members are excluded from new recommendations after their departure date; old train records are preserved. Confirm current rank, hive location, availability and historical nicknames before assigning.';
 return {stage,date,mode,vipMode,context,dataDate,slot:label,host,hostProposed:isProposal,
  recommended,recommendedVip,saturdayVs,scoreRanked,rejected:skipped,substitution,sameDate:sameDate.map(x=>({driver:x.driverName,vip:x.vipName,slot:x.slot})),
  candidates:results.slice(0,mode==='never'?25:20),eligibleCount:results.filter(x=>x.eligible).length,excludedDepartedCount:departed.size,
   vipCandidates,vipEligibleCount:vipCandidates.filter(x=>x.eligible).length,limitations};
}

```

## 7. Backend Train Desk endpoints

The production API also requires the shared server helpers for authentication and Supabase. These are the relevant original code sections rather than the entire R4 statistics server.

### Data retrieval used by Train Desk (`api/r4-stats.mjs`)

```javascript
async function getData(week,season,trainStage){
 const end=dateAdd(week,6),trainRange=stageRange(trainStage);
 const [members,aliases,allImports,ds,exceptions,awards,trainLegacy]=await Promise.all([
  list('utw_stat_members',{select:'id,display_name,created_at',order:'display_name.asc',limit:'1000'}),
  list('utw_stat_aliases',{select:'alias_key,alias,member_id',limit:'3000'}),
  list('utw_stat_imports',{select:'id,metric,period,filename,row_count,created_at,season_id',season_id:'eq.'+season,period:'gte.'+week,order:'created_at.desc',limit:'500'}),
  list('utw_stat_ds',{select:'*',season_id:'eq.'+season,event_date:'gte.'+week,order:'event_date.desc',limit:'200'}),
  list('utw_stat_exceptions',{select:'*',order:'created_at.desc',limit:'1000'}),
  list('utw_stat_awards',{select:'*',train_date:'gte.'+trainRange.start,order:'train_date.asc',limit:'500'}),
  list('utw_stat_train_legacy',{select:'train_date,stage_no,driver_name,vip_name,source,selection_label,notes,original_driver_name,replacement_reason,updated_at,updated_by',train_date:'gte.'+trainRange.start,order:'train_date.asc',limit:'40'})
 ]);
 if([members,aliases,allImports,ds,exceptions,awards,trainLegacy].some(x=>!Array.isArray(x)))throw Error('Invalid database response');
 // Only the most recently uploaded CSV is active for a metric and date.
 const current=new Map();
 for(const imp of allImports){if(imp.period<=end){const k=imp.metric+':'+imp.period;if(!current.has(k))current.set(k,imp)}}
 const imports=[...current.values()],values=(await Promise.all(imports.map(i=>list('utw_stat_values',{select:'import_id,alias_key,original_name,points',import_id:'eq.'+i.id,limit:'501'})))).flat();
 if(imports.some(i=>values.filter(v=>v.import_id===i.id).length!==i.row_count))throw Error('CSV data appears incomplete');
 return {members,aliases,imports,values,ds:ds.filter(d=>d.event_date<=end),exceptions,awards:awards.filter(a=>a.train_date<=trainRange.end),trainLegacy:trainLegacy.filter(a=>a.train_date<=trainRange.end),trainRange};
```

### Recommendation HTTP handler (`api/r4-stats.mjs`)

```javascript
  if(q.get('train_advice')==='1'){
   const date=q.get('date'),mode=q.get('mode'),slot=clean(q.get('slot'),100),vipMode=q.get('vip_mode')||'weekly',selectedSeason=q.get('season');
   if(!isoDate(date)||date<'2025-12-29'||stageForDate(date)>40||
      (!['never','vs','donations','ds','r4','manual'].includes(mode)||!['weekly','stage'].includes(vipMode))||
      (selectedSeason&&!/^[a-z0-9-]{2,30}$/.test(selectedSeason)))return json({error:'Choose a valid train date and category'},400);
   const [members,aliases,legacy,awards,exceptions]=await Promise.all([
    list('utw_stat_members',{select:'id,display_name',order:'display_name.asc',limit:'1000'}),
    list('utw_stat_aliases',{select:'alias_key,alias,member_id',limit:'3000'}),
    list('utw_stat_train_legacy',{select:'train_date,driver_name,vip_name,source,selection_label',order:'train_date.desc',limit:'1500'}),
    list('utw_stat_awards',{select:'train_date,member_id,vip_member_id,source,slot',order:'train_date.desc',limit:'1500'}),
    list('utw_stat_exceptions',{select:'member_id,scope,starts_on,ends_on,reason,active',active:'eq.true',limit:'1000'})
   ]);
   if(![members,aliases,legacy,awards,exceptions].every(Array.isArray))throw Error('Incomplete train records');
   let scoreboard=[],scoreDate=null,dsEvent=null;
   const monday=weekStart(date);
   if(mode==='vs'||mode==='donations'){
    // Saturday VS uses THIS week's saved weekly total (Monday through Saturday).
    // Other VS dates and donation selection retain the prior completed week.
    // Daily VS uploads are never used as a substitute for the weekly report.
    const metric=mode==='vs'?'vs_weekly':'donations_weekly';
    const saturdayVs=mode==='vs'&&new Date(date+'T00:00:00Z').getUTCDay()===6;
    const reportWeek=saturdayVs?monday:dateAdd(monday,-7);
    const filters={select:'id,period,created_at,row_count',metric:'eq.'+metric,
     period:'eq.'+reportWeek,order:'created_at.desc',limit:'50'};
    if(selectedSeason)filters.season_id='eq.'+selectedSeason;
    const imports=await list('utw_stat_imports',filters);
    const latest=imports[0];
    if(latest){
     const values=await list('utw_stat_values',{select:'alias_key,points',import_id:'eq.'+latest.id,limit:'501'});
     if(values.length===latest.row_count){
      const byAlias=new Map(aliases.map(x=>[x.alias_key,x.member_id]));
      scoreboard=values.map(x=>({member_id:byAlias.get(x.alias_key),points:Number(x.points)}));
      scoreDate=latest.period;
     }
    }
   }
   if(mode==='ds'){
    const podium=await list('utw_stat_ds',{select:'event_date,first_member,second_member,third_member',event_date:'gte.'+dateAdd(date,-14),order:'event_date.desc,created_at.desc',limit:'30'});
    dsEvent=podium.find(x=>x.event_date<=date)||null;
   }
   let rosterIds=[],rosterDate=null,vsRecordCounts={};
   if(mode!=='vs'&&mode!=='donations'){
    // Use active snapshots across all seasons. The existing reports RPC picks
    // only the latest upload for each season/metric/date, so reuploads do not
    // falsely inflate how long a member appears in the archived VS history.
    const report=await db('rpc/utw_stat_member_report_data',{
     method:'POST',body:JSON.stringify({p_to:date})
    });
    if(!report||!Array.isArray(report.snapshots)||!Array.isArray(report.observations))
     throw Error('VS history for train recommendations is unavailable');
    const vsIds=new Set(report.snapshots.filter(x=>x.metric==='vs_daily'||x.metric==='vs_weekly').map(x=>x.id));
    for(const observation of report.observations){
     if(!vsIds.has(observation.snapshotId)||!observation.memberId)continue;
     vsRecordCounts[observation.memberId]=(vsRecordCounts[observation.memberId]||0)+1;
    }
    if(mode==='never'){
     // The latest VS report identifies who is currently eligible for selection.
     rosterIds=Array.isArray(report.roster)?report.roster:[];
     rosterDate=report.rosterDate||null;
    }
   }
   return json(buildTrainAdvice({date,mode,slot,vipMode,members,aliases,legacy,awards,exceptions,scoreboard,scoreDate,dsEvent,rosterIds,rosterDate,vsRecordCounts}));
```

### Save / edit / delete assignment handlers (`api/r4-stats.mjs`)

```javascript
    await recordAudit(request,'clear_exception',{id:body.id,member_id:old[0].member_id,reason:old[0].reason},true);
    return json({ok:true});
   }
   case 'award':{
    const season=body.season_id||'post-s5';if(!/^[a-z0-9-]{2,30}$/.test(season)||(await list('utw_stat_seasons',{select:'id',id:'eq.'+season,limit:'1'})).length!==1)return json({error:'Invalid season'},400);
    if(!isoDate(body.train_date)||!uuid(body.member_id)||!uuid(body.vip_member_id)||body.member_id===body.vip_member_id||!['ds','donations','vs','manual','r4'].includes(body.source)||!name(body.slot)||name(body.slot).length>50)return json({error:'Choose different conductor and VIP members, a valid date, source and train slot'},400);
    const created=await insert('utw_stat_awards',{season_id:season,train_date:body.train_date,member_id:body.member_id,vip_member_id:body.vip_member_id,source:body.source,slot:name(body.slot),reason:clean(body.reason,500)});
    await recordAudit(request,'award',{id:created[0].id,season,date:body.train_date,slot:body.slot,member_id:body.member_id},true);
    return json({ok:true},201);
   }
   case 'update_award':{
    if(!uuid(body.id)||!uuid(body.member_id)||!uuid(body.vip_member_id)||body.member_id===body.vip_member_id)return json({error:'Choose different valid conductor and VIP members'},400);
    const old=await list('utw_stat_awards',{select:'*',id:'eq.'+body.id,limit:'1'});
    if(old.length!==1)return json({error:'Train assignment not found'},404);
    const editReason=clean(body.reason,200);
    if(old[0].member_id!==body.member_id&&!editReason)return json({error:'Explain why the conductor changed (for example, no-show)'},400);
    if(typeof body.reason==='string'&&body.reason.trim().length>200)return json({error:'Replacement reason must be under 200 characters'},400);
    const previousNote=old[0].reason||'';
    const combinedReason=editReason?[previousNote,editReason].filter(Boolean).join(' | ').slice(-500):previousNote;
    const updated=await db('utw_stat_awards?'+urlParams({id:'eq.'+body.id,member_id:'eq.'+old[0].member_id,vip_member_id:old[0].vip_member_id?'eq.'+old[0].vip_member_id:'is.null'}),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({member_id:body.member_id,vip_member_id:body.vip_member_id,reason:combinedReason})});
    if(updated.length!==1)return json({error:'This train assignment changed. Refresh before editing.'},409);
    await recordAudit(request,'update_award',{id:body.id,previous_conductor:old[0].member_id,previous_vip:old[0].vip_member_id,new_conductor:body.member_id,new_vip:body.vip_member_id,date:old[0].train_date,slot:old[0].slot,reason:editReason},false);
    return json({ok:true});
   }
   case 'update_legacy_train':{
    const date=body.train_date,driver=name(body.driver_name),vip=name(body.vip_name),reason=clean(body.reason,300);
    if(!isoDate(date)||!driver||!vip||key(driver)===key(vip)||reason.length<1||typeof body.reason!=='string'||body.reason.trim().length>300)
     return json({error:'Choose two different names and give a short reason for changing the historic train.'},400);
    const oldRows=await list('utw_stat_train_legacy',{select:'*',train_date:'eq.'+date,limit:'1'});
    if(oldRows.length!==1)return json({error:'Historical train entry not found'},404);
    const old=oldRows[0];
    if(old.driver_name!==body.expected_driver_name||old.vip_name!==body.expected_vip_name)
     return json({error:'This train assignment has changed. Refresh to see the latest record.'},409);
    if(driver===old.driver_name&&vip===old.vip_name)return json({error:'No changes to save'},400);
    const actor=await sessionUser(request).catch(()=>null);
    const payload={
      driver_name:driver,vip_name:vip,replacement_reason:reason,
      original_driver_name:old.original_driver_name||(driver!==old.driver_name?old.driver_name:null),
      updated_at:new Date().toISOString(),updated_by:actor?.username||'Shared R4'
    };
    const updated=await db('utw_stat_train_legacy?'+urlParams({
      train_date:'eq.'+date,
      updated_at:old.updated_at?'eq.'+old.updated_at:'is.null'
    }),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
    if(!Array.isArray(updated)||updated.length!==1)return json({error:'This entry changed before your edit could be saved. Refresh and try again.'},409);
    await recordAudit(request,'update_legacy_train',{date,previous_driver:old.driver_name,new_driver:driver,previous_vip:old.vip_name,new_vip:vip,reason},false);
    return json({ok:true,train:updated[0]});
   }
   case 'delete_award':{
    if(!uuid(body.id))return json({error:'Invalid train assignment'},400);
    const old=await list('utw_stat_awards',{select:'*',id:'eq.'+body.id,limit:'1'});
    if(old.length!==1)return json({error:'Train assignment not found'},404);
    await del('utw_stat_awards',{id:'eq.'+body.id});
    await recordAudit(request,'delete_award',{row:old[0],date:old[0].train_date,slot:old[0].slot},true);
    return json({ok:true});
   }

```

## 8. Database schema for conductor and VIP

Original: `supabase/r4-train-conductor-vip.sql`

```sql
-- UTW Train Desk: one conductor and one VIP per dated train assignment.
-- VIP stays nullable to preserve any conductor-only historical records.
alter table public.utw_stat_awards
 add column if not exists vip_member_id uuid references public.utw_stat_members(id);

create index if not exists utw_stat_awards_vip_member_idx
 on public.utw_stat_awards(vip_member_id,train_date desc);

do $$
begin
 if not exists (
  select 1 from pg_constraint
   where conname='utw_stat_awards_distinct_people'
    and conrelid='public.utw_stat_awards'::regclass
 ) then
  alter table public.utw_stat_awards
   add constraint utw_stat_awards_distinct_people
   check (vip_member_id is null or vip_member_id<>member_id);
 end if;
end $$;

-- Preserve historical train associations when merging changed in-game names.
create or replace function public.utw_stat_merge_members(p_source uuid,p_target uuid)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare source_name text;
begin
 if p_source=p_target then raise exception 'Choose two different members'; end if;
 select display_name into source_name from public.utw_stat_members where id=p_source for update;
 if not found then raise exception 'Source member not found'; end if;
 perform 1 from public.utw_stat_members where id=p_target for update;
 if not found then raise exception 'Target member not found'; end if;
 update public.utw_stat_aliases set member_id=p_target where member_id=p_source;
 update public.utw_stat_ds set first_member=p_target where first_member=p_source;
 update public.utw_stat_ds set second_member=p_target where second_member=p_source;
 update public.utw_stat_ds set third_member=p_target where third_member=p_source;
 update public.utw_stat_awards
  set vip_member_id=case when vip_member_id=p_target then null else vip_member_id end
  where member_id=p_source;
 update public.utw_stat_awards set member_id=p_target where member_id=p_source;
 update public.utw_stat_awards
  set vip_member_id=case when member_id=p_target then null else p_target end
  where vip_member_id=p_source;
 update public.utw_stat_exceptions set member_id=p_target where member_id=p_source;
 insert into public.utw_stat_audit(action,details)
  values('merge_members',jsonb_build_object('source_id',p_source,'source_name',source_name,'target_id',p_target));
 delete from public.utw_stat_members where id=p_source;
end $$;
revoke all on function public.utw_stat_merge_members(uuid,uuid) from public,anon,authenticated;
grant execute on function public.utw_stat_merge_members(uuid,uuid) to service_role;

alter table public.utw_stat_awards enable row level security;
revoke all on public.utw_stat_awards from public,anon,authenticated;
grant select,insert,update,delete on public.utw_stat_awards to service_role;

```

Original: `supabase/r4-train-separate-and-replacements.sql`

```sql
-- Distinguish R4-arranged trains from standard DS/VS/donations/roulette
-- and retain original driver information when an assigned driver is replaced.
alter table public.utw_stat_train_legacy
 add column if not exists original_driver_name text,
 add column if not exists replacement_reason text not null default '',
 add column if not exists updated_at timestamptz,
 add column if not exists updated_by text;
alter table public.utw_stat_train_legacy
 drop constraint if exists utw_stat_train_legacy_source_check;
alter table public.utw_stat_train_legacy
 add constraint utw_stat_train_legacy_source_check
 check(source in ('donations','ds','vs','manual','r4'));
update public.utw_stat_train_legacy set source='r4'
 where selection_label ~* '^R4([[:space:]]|$)' and source='manual';
alter table public.utw_stat_awards
 drop constraint if exists utw_stat_awards_source_check;
alter table public.utw_stat_awards
 add constraint utw_stat_awards_source_check
 check(source in ('ds','donations','vs','manual','r4'));
-- Both private tables remain RLS-protected and service-role only.

```

## Integration note for the other planner

The existing Train Desk reads its saved records through `/api/r4-stats` and bases its recommendations on the saved Stage history plus the stored weekly VS and donation scores. Linking the separate Alliance Duel planner requires either an authenticated API it exposes or a shared database view, plus matching player IDs/aliases and week dates. The linked page alone does not grant access to its underlying data. Keep write access behind R4 authentication and do not expose a Supabase service-role key in a browser.
