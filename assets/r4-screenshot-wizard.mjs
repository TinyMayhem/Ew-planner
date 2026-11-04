import {parseRankLines,matchRoster,normalizeIgn,validateConfirmedRows} from './r4-ocr-parser.mjs?version=scan-v5-20261104';
import {scanRankingScreenshot} from './r4-ocr-browser.mjs?version=podium-v51-20261104';
import {languagesForOcr,describeLanguagePacks,OCR_LANGUAGE_MODES} from './r4-ocr-languages.mjs?version=scan-v4-20261104';
import {weekStart,validTarget} from './r4-csv-utils.mjs';

// The scanner works in the browser. Screenshots leave the device only for DS evidence.
const $=id=>document.getElementById(id);
const node=(tag,content,cls)=>{const e=document.createElement(tag);if(content!==undefined&&content!==null)e.textContent=String(content);if(cls)e.className=cls;return e};
const hint=(where,message,error=false)=>{where.textContent=message;where.classList.toggle('error',error)};
const tesseractUrl='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let runtime=null,loading=null;
async function loadOcr(){
 if(runtime)return runtime;
 if(!loading)loading=new Promise((resolve,reject)=>{
  const js=document.createElement('script');js.src=tesseractUrl;js.async=true;
  js.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(Error('OCR library did not initialize'));
  js.onerror=()=>reject(Error('OCR could not load. Check the internet connection and try again.'));
  document.head.append(js);
 }).catch(error=>{loading=null;throw error});
 runtime=await loading;return runtime;
}
async function compressEvidence(file){
 if(file.size<=4*1024*1024&&['image/png','image/jpeg','image/webp'].includes(file.type))return file;
 const image=await createImageBitmap(file);
 const canvas=document.createElement('canvas'),scale=Math.min(1,1600/image.width,2200/image.height);
 canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
 canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close?.();
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.78));
 if(!blob||blob.size>4*1024*1024)throw Error('Screenshot is too large for evidence. Choose a smaller screenshot.');
 return new File([blob],'ds-evidence.jpg',{type:'image/jpeg'});
}
function selectMembers(members,selected=''){
 const select=document.createElement('select');select.append(new Option('Not selected',''));
 for(const m of members)select.append(new Option(m.display_name,m.id));
 select.value=selected;return select;
}
function makeRowCard({image,row,index,roster,aliases,redraw}){
 const card=node('article',null,'ocr-member-card'+(!row.confirmed?' ocr-uncertain':''));
 const header=node('div',null,'ocr-member-head');
 header.append(node('strong','Row '+(index+1)+(row.pinned?' · Green pinned rank':'')+(row.confirmed?' · Matched':' · Check this entry')));
 if(row.preview){
  const link=document.createElement('a');link.href=row.preview;link.target='_blank';link.rel='noopener noreferrer';
  link.title='Open enlarged copy of this game row';link.className='ocr-row-sample';
  const picture=document.createElement('img');picture.src=row.preview;picture.alt='Original game row showing the name and score';picture.loading='lazy';
  link.append(picture);card.append(header,link);
 }else card.append(header);
 const match=matchRoster(row.name,roster,aliases);
 const ocrMatch=matchRoster(row.ocrGuess||'',roster,aliases);
 const fields=node('div',null,'ocr-member-fields'),nameLabel=node('label',null,'ocr-member-field');
 nameLabel.append(node('span','Member name'));
 const inputName=document.createElement('input');inputName.value=row.name||'';inputName.maxLength=60;
 inputName.placeholder='Find member from roster';inputName.setAttribute('list','ocr-names');
 inputName.setAttribute('aria-label','Member name for screenshot row '+(index+1));
 const hintName=row.matchType==='suggested'?
  'Check OCR guess "'+(row.ocrGuess||'')+'" against '+(row.name||'the roster'):
  row.ocrGuess&&ocrMatch.type==='unknown'?
  'Unmatched OCR text: '+row.ocrGuess+' · select correct roster name':
  match.type==='exact'&&/[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(row.name)?
  'East Asian name found in roster. Verify every character.':
  match.type==='exact'?'Matched UTW roster':
  match.type==='suggested'?'Possible roster name: '+match.name:
  row.ocrGuess?'OCR could not match: '+row.ocrGuess:'Name could not be read. Choose from roster.';
 nameLabel.append(inputName,node('small',hintName,'ocr-match'));
 if(!row.name&&row.ocrGuess)nameLabel.append(node('small','Use the screenshot above to select the correct name.','report-low'));
 fields.append(nameLabel);
 const scoreLabel=node('label',null,'ocr-member-field');scoreLabel.append(node('span','Points / donations'));
 const inputScore=document.createElement('input');inputScore.type='text';inputScore.inputMode='numeric';
 inputScore.value=row.points===null?'':String(row.points);inputScore.setAttribute('aria-label','Score for screenshot row '+(index+1));
 scoreLabel.append(inputScore);
 if(row.needsScoreCheck)scoreLabel.append(node('small','Score needs a careful check','ocr-match'));
 fields.append(scoreLabel);card.append(fields);
 const controls=node('div',null,'ocr-member-controls');
 const label=node('label',null,'ocr-check'),checkbox=document.createElement('input');
 checkbox.type='checkbox';checkbox.checked=!!row.confirmed;
 label.append(checkbox,node('span','Name and score checked'));
 controls.append(label);
 if(match.type==='suggested'){
  const fix=node('button','Use '+match.name,'stat-button');fix.type='button';
  fix.onclick=()=>{row.name=match.name;row.confirmed=false;image.reviewed=false;redraw()};
  controls.append(fix);
 }
 const remove=node('button','Remove wrong row','stat-button');remove.type='button';
 remove.onclick=()=>{row.deleted=true;image.reviewed=false;redraw()};
 controls.append(remove);
 if(!row.confirmed){
  const pick=node('button','Pick from UTW roster','stat-button');pick.type='button';
  pick.addEventListener('click',()=>{
   if(card.querySelector('.ocr-roster-picker'))return;
   const box=node('div',null,'ocr-roster-picker'),selection=document.createElement('select');
   selection.setAttribute('aria-label','Choose player for row '+(index+1));
   selection.append(new Option('Select correct player…',''));
   for(const member of roster)selection.append(new Option(member.display_name,member.id));
   const apply=node('button','Use selected player','stat-button');apply.type='button';
   apply.addEventListener('click',()=>{
    const selected=roster.find(m=>m.id===selection.value);
    if(!selected)return;
    row.name=selected.display_name;row.confirmed=false;image.reviewed=false;redraw();
   });
   box.append(selection,apply);card.append(box);
  });
  controls.append(pick);
 }
 card.append(controls);
 inputName.addEventListener('change',()=>{
  row.name=inputName.value.trim();const m=matchRoster(row.name,roster,aliases);
  if(m.type==='exact'){row.name=m.name;inputName.value=m.name}
  row.confirmed=false;image.reviewed=false;redraw();
 });
 inputScore.addEventListener('change',()=>{
  row.points=inputScore.value.trim().replace(/[ ,]/g,'');
  row.needsScoreCheck=false;row.confirmed=false;image.reviewed=false;redraw();
 });
 checkbox.addEventListener('change',()=>{
  row.confirmed=checkbox.checked;
  if(row.confirmed&&(!row.name||row.points===null||row.points===undefined||String(row.points).trim()==='')){
   row.confirmed=false;checkbox.checked=false;
  }
  image.reviewed=false;redraw();
 });
 return card;
}
export function initScreenshotWizard({getMembers,getAliases,getSeason,reload,submit,today}){
 const root=$('ocr-wizard');if(!root)return;
 let images=[],busy=false,lastSaved=null,historyBusy=false;
 root.innerHTML='<p class="ocr-current-build"><strong>SCANNER v5.1 · CARD READER</strong> · Game-row previews + quality checking. If you still see the old Member name / Score table, refresh this page.</p><div class="ocr-start"><div class="stat-fields"><label>1. What are you uploading?<select id="ocr-type"><option value="vs_daily">VS daily scores</option><option value="vs_weekly">VS weekly totals</option><option value="donations_weekly">Weekly donations</option><option value="ds">Desert Storm results</option></select></label><label>2. Date shown on the results<input id="ocr-date" type="date" required></label><label class="ocr-file-label">3. Add screenshots (up to 15)<input id="ocr-files" type="file" accept="image/png,image/jpeg,image/webp" multiple></label><label>Player name languages<select id="ocr-languages"><option value="auto">Auto: languages in UTW roster</option><option value="all">English + Korean + Chinese + Japanese</option><option value="eng">English only (faster)</option><option value="ko">English + Korean</option><option value="zh">English + Chinese (both scripts)</option><option value="ja">English + Japanese</option></select></label></div><p class="stat-muted">For a full VS or donation roster, select all 11 screenshots together. Keep the same report date for the batch. The site scans locally and never saves scores before you confirm. Korean, Chinese and Japanese player names are supported. Auto selects languages found in the roster. Choose All languages for new names not yet in the roster.</p><button type="button" id="ocr-begin" class="stat-button primary">Read my screenshots</button><p id="ocr-progress" role="status" aria-live="polite"></p></div><div id="ocr-review" hidden><h3>4. Check the names and scores</h3><p class="stat-muted">Look at each screenshot and correct anything the scanner missed. Add missing people. Tick “I checked this picture” for every screenshot before saving.</p><div id="ocr-images"></div><div id="ocr-ds-fields" hidden><div class="stat-fields"><label>DS MVP / 1st<select id="ocr-ds-first"></select></label><label>2nd<select id="ocr-ds-second"></select></label><label>3rd<select id="ocr-ds-third"></select></label><label>Opponent (optional)<input id="ocr-ds-opponent" maxlength="80" placeholder="Opponent alliance"></label></div><p class="stat-muted">Review the original screenshot and choose the correct podium order. Only the first image is saved as private match evidence.</p></div><p id="ocr-ready" role="status"></p><div class="ocr-actions"><button type="button" id="ocr-save" class="stat-button primary">Confirm and save results</button><button type="button" id="ocr-reset" class="stat-button">Start over</button></div></div><div id="ocr-success" class="ocr-success" hidden><strong id="ocr-success-message"></strong><button type="button" id="ocr-undo" class="stat-button">Undo this upload</button></div><details class="ocr-history" open><summary>Recent screenshot uploads and Undo</summary><p class="stat-muted">You can undo a mistaken upload even after refreshing this page. The owner audit log keeps a recoverable record.</p><div id="ocr-history-list"></div></details><datalist id="ocr-names"></datalist>';
 const type=$('ocr-type'),date=$('ocr-date'),files=$('ocr-files'),languages=$('ocr-languages'),go=$('ocr-begin'),progress=$('ocr-progress'),
  review=$('ocr-review'),imageRoot=$('ocr-images'),dsFields=$('ocr-ds-fields'),ready=$('ocr-ready'),
  save=$('ocr-save'),reset=$('ocr-reset'),success=$('ocr-success'),successMessage=$('ocr-success-message'),undo=$('ocr-undo');
 date.value=today();
 const updateRoster=()=>{
  const list=$('ocr-names');list.replaceChildren();
  for(const m of getMembers())list.append(new Option(m.display_name));
 };
 const clear=()=>{
  images.forEach(x=>URL.revokeObjectURL(x.url));
  images=[];files.value='';busy=false;go.disabled=false;save.disabled=false;
  review.hidden=true;success.hidden=true;imageRoot.replaceChildren();progress.textContent='';
 };
 reset.onclick=clear;
 type.addEventListener('change',()=>{if(!review.hidden)clear(); files.multiple=type.value!=='ds';});
 files.addEventListener('change',()=>{if(files.files.length)hint(progress,files.files.length+' screenshot'+(files.files.length===1?'':'s')+' selected. Click “Read my screenshots”.')});
 async function history(){
  if(historyBusy)return;historyBusy=true;
  const holder=$('ocr-history-list');holder.replaceChildren(node('p','Loading saved uploads…','stat-muted'));
  try{
   const response=await fetch('/api/r4-stats?scan_recent=1',{credentials:'same-origin',cache:'no-store'});
   const payload=await response.json();if(!response.ok)throw Error(payload.error||'Could not load uploads');
   holder.replaceChildren();
   const all=[
    ...(payload.imports||[]).map(x=>({kind:'import',id:x.id,date:x.period,text:x.metric.replaceAll('_',' ')+' · '+x.row_count+' names',file:x.filename,at:x.created_at})),
    ...(payload.ds||[]).map(x=>({kind:'ds',id:x.id,date:x.event_date,text:'Desert Storm podium',file:'Screenshot evidence',at:x.created_at}))
   ].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,30);
   if(!all.length)holder.append(node('p','No screenshot uploads saved yet.','stat-muted'));
   for(const entry of all){
    const row=node('div',null,'ocr-history-row'),info=node('div');
    info.append(node('strong',entry.date+' · '+entry.text),node('small',entry.file,'stat-muted'));
    const button=node('button','Undo','stat-button');button.type='button';
    button.onclick=()=>removeSaved(entry,button);row.append(info,button);holder.append(row);
   }
  }catch(e){holder.replaceChildren(node('p',e.message,'stat-flag blocked'))}
  finally{historyBusy=false}
 }
 async function removeSaved(entry,button){
  if(!confirm('Undo '+entry.text+' from '+entry.date+'? Saved scores / DS results will be removed. The owner audit log retains recovery information.'))return;
  button.disabled=true;
  try{
   await submit({action:entry.kind==='import'?'delete_import':'delete_ds',id:entry.id});
   if(lastSaved?.id===entry.id){lastSaved=null;success.hidden=true}
   await reload();await history();hint(progress,'Upload undone. You may correct and upload again.');
  }catch(e){hint(progress,'Could not undo: '+e.message,true);button.disabled=false}
 }
 undo.onclick=()=>{
  if(lastSaved)removeSaved(lastSaved,undo);
 };
 function dsSelectors(){
  const roster=getMembers();
  for(const id of ['ocr-ds-first','ocr-ds-second','ocr-ds-third']){
   const old=$(id).value;$(id).replaceChildren(...selectMembers(roster).options);
   $(id).value=old;
  }
  // OCR suggests first three names only when a complete roster name appears in a screenshot.
  const raw=images.map(x=>x.ocrText).join(' ').toLowerCase();
  const matches=roster.filter(m=>raw.includes(m.display_name.toLowerCase()))
   .sort((a,b)=>raw.indexOf(a.display_name.toLowerCase())-raw.indexOf(b.display_name.toLowerCase()));
  ['ocr-ds-first','ocr-ds-second','ocr-ds-third'].forEach((id,i)=>{if(matches[i])$(id).value=matches[i].id});
 }
 function render(){
  const roster=getMembers(),aliases=getAliases();
  imageRoot.replaceChildren();updateRoster();
  const isDs=type.value==='ds';dsFields.hidden=!isDs;
  for(const image of images){
   const card=node('article',null,'ocr-image-card');
   const head=node('div',null,'ocr-image-head'),left=node('div');
   left.append(node('strong',image.file.name),node('small',image.rows.filter(r=>!r.deleted).length+' captured rows · '+image.unread.length+' uncertain text lines','stat-muted'));
   const view=node('a','View screenshot');view.href=image.url;view.target='_blank';view.rel='noopener noreferrer';view.className='stat-button';
   head.append(left,view);card.append(head);
   const layout=node('div',null,'ocr-image-layout'),preview=document.createElement('img');
   preview.src=image.url;preview.alt='Uploaded results screenshot '+image.file.name;preview.className='ocr-thumb';preview.loading='lazy';layout.append(preview);
   const content=node('div',null,'ocr-image-contents');
   if(!isDs){
    const list=node('div',null,'ocr-member-list');
    image.rows.forEach((row,i)=>{if(!row.deleted)list.append(makeRowCard({image,row,index:i,roster,aliases,redraw:render}))});
    content.append(list);
    if(image.diagnostics)content.prepend(node('p',image.diagnostics,'ocr-diagnostic'));
    if(image.qualityMessage)content.prepend(node('p',image.qualityMessage,image.quality<.5?'ocr-quality-warning':'ocr-quality-note'));
    const add=node('button','+ Add missing member','stat-button');add.type='button';
    add.onclick=()=>{image.rows.push({name:'',points:'',confirmed:false,deleted:false,ocrGuess:''});image.reviewed=false;render()};
    content.append(add);
   }else{
    content.append(node('p','The OCR text is shown below. Confirm the podium names and order in Step 4.','stat-muted'));
   }
   const note=node('details',null,'ocr-raw'),summary=node('summary','Review OCR text / fix missed lines'),raw=document.createElement('textarea');
   raw.rows=5;raw.value=image.ocrText;raw.setAttribute('aria-label','Editable OCR text for '+image.file.name);
   const parse=node('button','Try parsing corrected text','stat-button');parse.type='button';
   parse.onclick=()=>{
    if(image.layout==='last-war-ranked-columns'&&!confirm('Replace the column-matched rows with manually parsed OCR text? Only use this if you have entered each name and score together.'))return;
    image.ocrText=raw.value;const parsed=parseRankLines(raw.value);
    if(!isDs){image.rows=parsed.rows.map(row=>prepareRow(row,roster,aliases));image.unread=parsed.unread}
    image.reviewed=false;render();
   };
   note.append(summary,raw,parse);content.append(note);
   const checked=node('label',null,'ocr-review-check'),check=document.createElement('input');check.type='checkbox';check.checked=image.reviewed;
   check.onchange=()=>{image.reviewed=check.checked;renderStatus()};
   checked.append(check,node('strong','I checked this picture against the results'));content.append(checked);
   layout.append(content);card.append(layout);imageRoot.append(card);
  }
  if(isDs)dsSelectors();
  renderStatus();
 }
 function renderStatus(){
  const checked=images.filter(x=>x.reviewed).length,rows=images.flatMap(x=>x.rows.filter(r=>!r.deleted));
  const unique=new Set(rows.filter(r=>r.name).map(r=>normalizeIgn(r.name))).size;
  ready.textContent=checked+'/'+images.length+' pictures checked · '+rows.length+' parsed rows'+
   (type.value==='ds'?' (only podium is saved)':' · '+unique+' unique names'+(rows.length>unique?' · repeated green/overlap rows counted once':''));
  save.disabled=busy||checked!==images.length||!images.length||(!rows.length&&type.value!=='ds');
 }
 function prepareRow(row,roster,aliases){
  const m=matchRoster(row.name,roster,aliases);
  return {name:m.type==='exact'?m.name:row.name,points:row.points,confirmed:m.type==='exact',deleted:false};
 }
 go.onclick=async()=>{
  if(busy)return;const selected=[...files.files];
  if(!selected.length){hint(progress,'Choose screenshot images first.',true);return}
  if(!date.value||!validTarget(type.value==='ds'?'vs_daily':type.value,type.value==='ds'?date.value:type.value==='vs_daily'?date.value:weekStart(date.value))){
   hint(progress,'Select a valid reporting date.',true);return;
  }
  if(selected.length>15){hint(progress,'Choose at most 15 images at once. Eleven works well.',true);return}
  if(type.value==='ds'&&selected.length!==1){hint(progress,'For Desert Storm, choose the single results screenshot showing the podium.',true);return}
  if(selected.some(f=>!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>16*1024*1024)){
   hint(progress,'Choose JPG, PNG or WebP images smaller than 16 MB each.',true);return;
  }
  busy=true;go.disabled=true;success.hidden=true;review.hidden=true;
  images.forEach(x=>URL.revokeObjectURL(x.url));images=[];
  let worker=null;
  try{
   const langs=languagesForOcr(languages.value,getMembers(),getAliases());
   hint(progress,'Loading language packs: '+describeLanguagePacks(langs)+'. First use may take longer on mobile…');
   const engine=await loadOcr();
   worker=await engine.createWorker(langs,1);
   for(let i=0;i<selected.length;i++){
    const file=selected[i];hint(progress,'Reading screenshot '+(i+1)+' of '+selected.length+': '+file.name);
    const roster=getMembers(),aliases=getAliases();
    let parsed;
    if(type.value==='ds'){
     const result=await worker.recognize(file);
     const source=result.data.text||'';
     const detected=parseRankLines(source);
     parsed={rows:detected.rows.map(r=>prepareRow(r,roster,aliases)),ocrText:source,unread:detected.unread,diagnostics:'DS screenshot: confirm the podium manually.'};
    }else{
     parsed=await scanRankingScreenshot(worker,file,roster,aliases,phase=>
      hint(progress,'Screenshot '+(i+1)+' of '+selected.length+': '+phase+'…'));
     if(!parsed.rows.length){
      // This layout is not recognized. Do not invent rows or silently save garbage.
      parsed.diagnostics='No ranking rows were recognized. Add rows manually or use a clearer screenshot.';
      parsed.rows=[{name:'',points:'',ocrGuess:'',confirmed:false,deleted:false}];
     }
    }
    images.push({file,url:URL.createObjectURL(file),...parsed,reviewed:false});
   }
   review.hidden=false;hint(progress,'Multilingual OCR finished. Check the results in Step 4. Nothing has been saved yet.');
   render();
  }catch(e){
   hint(progress,'Could not read screenshots: '+e.message+'. Try a narrower language setting to reduce memory use, or use CSV upload.',true);
   if(images.length){review.hidden=false;render()}
  }finally{try{await worker?.terminate()}catch{}busy=false;go.disabled=false;renderStatus()}
 };
 save.onclick=async()=>{
  if(busy||images.some(x=>!x.reviewed)||!images.length)return;
  const metric=type.value,period=metric==='ds'||metric==='vs_daily'?date.value:weekStart(date.value);
  let payload;
  try{
   if(metric==='ds'){
    const ids=['ocr-ds-first','ocr-ds-second','ocr-ds-third'].map(id=>$(id).value||null);
    if(!ids[0]||new Set(ids.filter(Boolean)).size!==ids.filter(Boolean).length)throw Error('Choose a valid, different MVP, second and third place.');
    payload={ids};
   }else payload={rows:validateConfirmedRows(images)};
  }catch(e){hint(ready,e.message,true);return}
  if(metric!=='ds'){
   const rosterCount=getMembers().length;
   if(images.length>=6&&payload.rows.length<Math.min(65,Math.ceil(rosterCount*.65))){
    if(!confirm('Only '+payload.rows.length+' unique members were found across '+images.length+' screenshots. A full UTW roster normally has many more. Are you sure none were missed?'))return;
   }
  }
  if(!confirm('Save '+(metric==='ds'?'the verified DS podium':payload.rows.length+' reviewed member scores')+' for '+date.value+'? This will update the selected season.'))return;
  busy=true;save.disabled=true;reset.disabled=true;
  try{
   let res;
   if(metric==='ds'){
    const form=new FormData();form.set('action','ds');form.set('season_id',getSeason());form.set('date',date.value);
    form.set('first',payload.ids[0]);form.set('second',payload.ids[1]||'');form.set('third',payload.ids[2]||'');
    form.set('opponent',$('ocr-ds-opponent').value.trim());form.set('notes','Screenshot scanner: manually reviewed podium');
    form.set('screenshot',await compressEvidence(images[0].file));
    res=await submit(form,true);
   }else{
    res=await submit({action:'import',season_id:getSeason(),metric,period,
     filename:'Screenshot_'+metric+'_'+period+'_'+Date.now()+'.csv',rows:payload.rows});
   }
   if(!res.id)throw Error('Saved, but server did not return an undo ID. Check the saved history before submitting again.');
   lastSaved={id:res.id,kind:metric==='ds'?'ds':'import',date:period,text:metric==='ds'?'DS podium':metric+' · '+payload.rows.length+' members'};
   successMessage.textContent='Saved! '+(metric==='ds'?'Desert Storm podium':payload.rows.length+' verified scores')+' · '+period;
   success.hidden=false;review.hidden=true;hint(progress,'Saved and available in R4 stats. Use Undo if it was incorrect.');
   await reload();await history();
  }catch(e){hint(ready,'Save failed: '+e.message,true);save.disabled=false}
  finally{busy=false;reset.disabled=false;renderStatus()}
 };
 history();
}
