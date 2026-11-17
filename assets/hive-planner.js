import {OBJECTS,rect,footprint,zoneRects,influenceRects,intersects,inspectPlacement,sectionFor,boundsOfState,occupiedBounds,proposeBases,contains} from './hive-geometry.js';

const API='/r4-hive',app=document.getElementById('hive-app');
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=id=>Number($(id)?.value);
const uid=()=>globalThis.crypto?.randomUUID?.()||('id-'+Date.now()+'-'+Math.random().toString(36).slice(2));
const clone=x=>JSON.parse(JSON.stringify(x));
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
let state=null,revision=0,history=[],members=[],aliases=[],user=null,busy=false;
let activeAlliance='utw',tool='select',selected=null,preview=[],showNames='auto',displayMud=true,displayBuff=true,displayGrid=true;
let view={x:499,y:499,scale:10},pointer=null,drawArea=null,canvas,ctx,width=900,height=600,polling=false;
const typeChoices=Object.entries(OBJECTS).filter(([k])=>k!=='base'&&k!=='capitol');
const html=[
 '<header class="topbar"><div class="brand">✦ UTW Hive & Territory Planner<small>R4 Command Center · Server 1395 · shared map</small></div>',
 '<div class="top-actions"><span class="pill" id="sync-state">Connecting…</span><a href="/r4-planner" class="btn">← Command Center</a></div></header>',
 '<div class="layout"><aside class="sidebar">',
 '<section class="panel"><h2>📍 Coordinates & Capitol</h2><div class="fields">',
 '<div class="field"><label for="coord-x">Center X</label><input id="coord-x" type="number" min="0" max="1999" value="499"></div>',
 '<div class="field"><label for="coord-y">Center Y</label><input id="coord-y" type="number" min="0" max="1999" value="499"></div></div>',
 '<div class="actions"><button class="btn primary" id="jump">Jump to X/Y</button><button class="btn" id="set-capitol">Set Capitol center</button></div>',
 '<p class="hint">Capitol: 21×21 cells; contaminated zone: 100×100. Even-size alignment is provisional until tested in-game.</p>',
 '<div class="fields"><div class="field"><label>Even-width X side</label><select id="even-x"><option value="negative">Extra west cell</option><option value="positive">Extra east cell</option></select></div>',
 '<div class="field"><label>Even-height Y side</label><select id="even-y"><option value="negative">Extra north cell</option><option value="positive">Extra south cell</option></select></div></div>',
 '<div class="actions"><button id="save-calibration" class="btn">Save calibration</button><button id="verify-calibration" class="btn">Mark tested</button></div><p class="hint" id="calibration-message">Not verified against an in-game mud edge.</p></section>',
 '<section class="panel"><h2>🏳 Alliances & Bases</h2><div class="fields"><div class="field wide"><label>Current alliance</label><select id="alliance"></select></div>',
 '<div class="field"><label>New alliance initials</label><input id="new-alliance" maxlength="28" placeholder="VON"></div><div class="field"><label>Colour</label><input id="alliance-color" type="color" value="#be654e"></div></div>',
 '<div class="actions"><button id="add-alliance" class="btn">Add alliance</button></div>',
 '<h3>Place commander base (3×3)</h3><div class="fields"><div class="field wide"><label>Member name (optional, UTW)</label><input id="member-name" list="member-options" placeholder="Search by current or old nickname"><datalist id="member-options"></datalist></div>',
 '<div class="field"><label>Gap between bases</label><select id="base-gap"><option value="0">No gap</option><option value="1">1-cell gap</option><option value="2">2-cell gap</option></select></div>',
 '<div class="field"><label>View member names</label><select id="show-names"><option value="auto">Auto by zoom</option><option value="on">Show</option><option value="off">Hide</option></select></div></div>',
 '<div class="actions"><button id="place-base" class="btn primary">Place at X/Y</button></div><p class="hint">To tap positions instead, choose the Base tool above the map. Names are optional, with no missing-member tracking.</p></section>',
 '<section class="panel"><h2>⛏ Obstacles</h2><div class="field"><label>Object type</label><select id="obstacle-type"></select></div>',
 '<div class="actions"><button id="place-obstacle" class="btn">Place at X/Y</button></div><h3>Paste multiple mines / objects</h3>',
 '<textarea id="bulk" placeholder="550,540&#10;555,540&#10;truck55,560,540"></textarea>',
 '<div class="actions"><button id="bulk-preview" class="btn">Review & add bulk items</button></div><p class="hint">One line per object. Use X,Y for a mine or type,X,Y for other items. Objects cannot intersect commander bases.</p></section>',
 '<section class="panel"><h2>▱ Territory sections</h2><div class="fields"><div class="field wide"><label>Section name</label><input id="territory-name" maxlength="65" placeholder="North Frontline"></div>',
 '<div class="field"><label>Min X</label><input id="x1" type="number" value="450"></div><div class="field"><label>Max X</label><input id="x2" type="number" value="550"></div>',
 '<div class="field"><label>Min Y</label><input id="y1" type="number" value="450"></div><div class="field"><label>Max Y</label><input id="y2" type="number" value="550"></div>',
 '<div class="field wide"><label>Section spacing</label><select id="territory-gap"><option value="0">No gap</option><option value="1">1-cell gap</option><option value="2">2-cell gap</option></select></div></div>',
 '<div class="actions"><button id="add-territory" class="btn primary">Add section</button></div>',
 '<p class="hint">Or choose Draw territory on the map, drag across an area, then save its name here. Solid boundary = assigned; dashed = actual occupied.</p>',
 '<div id="territory-priority"></div></section>',
 '<section class="panel"><h2>✨ Smart suggestions</h2><div class="fields"><div class="field wide"><label>Fill section</label><select id="suggest-section"></select></div>',
 '<div class="field"><label>Number of bases</label><input id="suggest-count" type="number" min="1" max="250" value="20"></div>',
 '<div class="field"><label>Gap</label><select id="suggest-gap"><option value="0">No gap</option><option value="1">1-cell gap</option><option value="2">2-cell gap</option></select></div>',
 '<div class="field"><label>Placement priority</label><select id="suggest-strategy"><option value="boundary">Boundary first</option><option value="coverage">Territory coverage</option></select></div>',
 '<div class="field"><label>Obstacle handling</label><select id="suggest-packing"><option value="rows">Straight rows</option><option value="flex">Flexible packing</option></select></div></div>',
 '<div class="actions"><button id="suggest" class="btn">Preview positions</button><button id="approve" class="btn primary" disabled>Approve preview</button><button id="discard" class="btn">Discard</button></div>',
 '<p id="preview-info" class="hint">Suggestions never edit the shared map until approved.</p></section>',
 '<section class="panel"><h2>📸 Exports</h2><div class="fields"><div class="field wide"><label>File format</label><select id="export-format"><option value="png">PNG (sharp text)</option><option value="jpeg">JPG</option></select></div></div>',
 '<div class="actions"><button class="btn" id="export-overview">Alliance overview</button><button class="btn" id="export-detailed">Detailed UTW map</button><button class="btn" id="export-legend">UTW coordinate legend</button></div>',
 '<p class="hint">Exports crop to active objects and territories. Coordinates are printed on the axes. Detailed maps use stable numbered bases with a matching legend.</p></section>',
 '<section class="panel"><h2>↶ History & restore</h2><div class="field"><label>Saved revisions</label><select id="history-select"></select></div>',
 '<div class="actions"><button id="undo" class="btn">Undo last edit</button><button id="restore" class="btn">Restore selected revision</button><button id="snapshot" class="btn">Mark snapshot</button></div>',
 '<div id="history-list" class="history"></div></section></aside>',
 '<div class="map-column"><section class="map-card"><div class="map-tools"><div class="toolset">',
 '<button class="btn active" data-tool="select">Select / Pan</button><button class="btn" data-tool="base">Tap: Base</button><button class="btn" data-tool="obstacle">Tap: Obstacle</button><button class="btn" data-tool="territory">Draw territory</button>',
 '</div><div class="zoomset"><button class="btn" id="zoom-out">−</button><button class="btn" id="zoom-in">+</button><button class="btn" id="fit">Fit active area</button></div></div>',
 '<div class="map-wrap"><canvas id="map-canvas" aria-label="Interactive UTW map coordinate grid"></canvas><div class="map-overlay" id="map-coordinate">X: 499 · Y: 499</div></div>',
 '<div class="map-legend"><span><i class="swatch" style="background:#b16b4b"></i>Contaminated</span><span><i class="swatch" style="background:#b69a58"></i>Physical obstacle</span>',
 '<span>Solid = assigned territory</span><span>Dashed = occupied territory</span>',
 '<label style="display:inline"><input id="mud-toggle" type="checkbox" checked style="width:auto"> Mud</label>',
 '<label style="display:inline"><input id="buff-toggle" type="checkbox" checked style="width:auto"> Influence</label>',
 '<label style="display:inline"><input id="grid-toggle" type="checkbox" checked style="width:auto"> Grid</label></div>',
 '<div class="mobile-caption">Drag to pan. Pinch controls are available through + / −. Tap to place only when a placement tool is selected.</div></section>',
 '<section id="selection" class="details"><h2>Selected item</h2><p class="muted">Tap a base, obstacle or territory to edit it.</p></section>',
 '<section class="report"><h2>Alliance ranges & base counts</h2><div class="report-grid" id="reports"></div></section>',
 '<div id="message" class="status" aria-live="polite"></div></div></div>'
].join('');

function inform(message,error=false){const el=$('message');if(el){el.textContent=message;el.className='status'+(error?' error':'');}}
function sync(message){if($('sync-state'))$('sync-state').textContent=message;}
function valid(x){return Number.isInteger(x)&&x>=0&&x<=1999;}
function coord(){const x=number('coord-x'),y=number('coord-y');if(!valid(x)||!valid(y))throw Error('Enter integer X and Y values from 0 to 1999');return {x,y};}
function alliance(){return state.alliances.find(a=>a.id===activeAlliance)||state.alliances[0];}
function colorFor(id){return state.alliances.find(a=>a.id===id)?.color||'#8eaaa4';}
function nameFor(id){return state.alliances.find(a=>a.id===id)?.name||id;}
function matchingName(input){
 const t=String(input||'').trim();if(!t)return '';
 const direct=members.find(m=>m.display_name.toLowerCase()===t.toLowerCase());
 const alias=aliases.find(a=>a.alias.toLowerCase()===t.toLowerCase());
 return direct?.display_name||members.find(m=>m.id===alias?.member_id)?.display_name||t.slice(0,80);
}
async function fetchData(includeMembers=false,force=false){
 const q='?data=1'+(includeMembers?'&members=1':'')+(!force&&state?'&since='+revision:'');
 const res=await fetch(API+q,{credentials:'same-origin',cache:'no-store'});
 if(!res.ok)throw Error('Could not load shared map ('+res.status+')');
 const data=await res.json();if(data.unchanged)return false;
 const firstLoad=!state;
 state=data.state;revision=Number(data.revision);history=data.history||[];user=data.user;
 if(includeMembers){members=data.members||[];aliases=data.aliases||[];}
 updateDynamic();if(firstLoad)fitMap(false);else draw();sync('✓ Saved · v'+revision);return true;
}
async function commit(next,summary){
 if(busy){inform('A save is already in progress. Please try again.',true);return false;}
 const prev=state;busy=true;state=next;sync('Saving…');draw();
 try{
  const res=await fetch(API,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:revision,state:next,summary})});
  const info=await res.json().catch(()=>({error:'Unexpected response'}));
  if(!res.ok)throw Error(info.error||'Save failed');
  revision=Number(info.revision);sync('✓ Saved · v'+revision);inform(summary);busy=false;
  await fetchData(false,true);
  return true;
 }catch(e){
  state=prev;busy=false;sync('⚠ Not saved');draw();inform(e.message+' Your attempted change was not saved.',true);
  return false;
 }
}
function updateDynamic(){
 if(!state)return;
 if(!state.alliances.some(a=>a.id===activeAlliance))activeAlliance=state.alliances[0]?.id||'utw';
 $('alliance').innerHTML=state.alliances.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join('');
 $('alliance').value=activeAlliance;
 $('obstacle-type').innerHTML=typeChoices.map(([key,t])=>'<option value="'+key+'">'+esc(t.label)+' ('+t.w+'×'+t.h+')</option>').join('');
 const old=$('obstacle-type').dataset.chosen;if(old)$('obstacle-type').value=old;
 $('member-options').innerHTML=members.map(m=>'<option value="'+esc(m.display_name)+'"></option>').join('')+
 aliases.slice(0,500).map(a=>'<option value="'+esc(a.alias)+'"></option>').join('');
 $('history-select').innerHTML=history.map(h=>'<option value="'+h.revision+'">v'+h.revision+' · '+esc(h.summary)+' · '+esc(h.actor)+'</option>').join('');
 $('history-list').innerHTML=history.slice(0,16).map(h=>'<div class="history-row">v'+h.revision+' · '+esc(h.actor)+' · '+esc(h.summary)+'<br>'+new Date(h.created_at).toLocaleString()+'</div>').join('');
 $('suggest-section').innerHTML='<option value="">Use coordinate rectangle below</option>'+state.territories.filter(t=>t.allianceId===activeAlliance).sort((a,b)=>a.priority-b.priority).map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+'</option>').join('');
 $('even-x').value=state.calibration.evenX;$('even-y').value=state.calibration.evenY;
 $('calibration-message').textContent=state.calibration.verified?'✓ Calibration marked as tested':'⚠ Even-size edge alignment has NOT been verified against the game.';
 $('base-gap').value=String(state.settings.spacing);
 $('territory-priority').innerHTML='<h3>Section priority (top wins)</h3>'+state.territories.filter(t=>t.allianceId===activeAlliance).sort((a,b)=>a.priority-b.priority).map((t,i)=>'<div class="rank-row"><span>'+ (i+1)+'. '+esc(t.name)+'</span><button class="btn" data-priority="'+esc(t.id)+'" data-direction="-1" aria-label="Move section up">↑</button><button class="btn" data-priority="'+esc(t.id)+'" data-direction="1" aria-label="Move section down">↓</button></div>').join('');
 document.querySelectorAll('[data-priority]').forEach(b=>b.onclick=()=>movePriority(b.dataset.priority,Number(b.dataset.direction)));
 if(!$('coord-x').dataset.initialized){$('coord-x').value=state.center.x;$('coord-y').value=state.center.y;$('coord-x').dataset.initialized='yes';}
 renderSelection();renderReports();
}
function renderReports(){
 if(!state)return;
 $('reports').innerHTML=state.alliances.map(a=>{
  const bs=state.bases.filter(b=>b.allianceId===a.id),out=occupiedBounds(state,a.id);
  const ts=state.territories.filter(t=>t.allianceId===a.id);
  const off=bs.filter(b=>{const relevant=b.sectionOverride?ts.filter(t=>t.id===b.sectionOverride):ts;if(!relevant.length)return ts.length>0;return !relevant.some(t=>{const r=footprint(b,state);return r.left>=t.x1&&r.right<=t.x2&&r.top>=t.y1&&r.bottom<=t.y2;});}).length;
  return '<div class="report-alliance" style="--team:'+esc(a.color)+'"><strong>'+esc(a.name)+'</strong> · '+bs.length+' bases'+
  '<br>Occupied: '+(out?'X '+out.left+'–'+out.right+', Y '+out.top+'–'+out.bottom:'No bases')+
  '<br>Sections: '+ts.length+(off?' · ⚠ '+off+' outside/crossing':'')+
  ts.map(t=>'<br>↳ '+esc(t.name)+': X '+t.x1+'–'+t.x2+', Y '+t.y1+'–'+t.y2).join('')+'</div>';
 }).join('');
}
function movePriority(id,dir){
 const own=state.territories.filter(t=>t.allianceId===activeAlliance).sort((a,b)=>a.priority-b.priority);
 const i=own.findIndex(t=>t.id===id),j=i+dir;if(i<0||j<0||j>=own.length)return;
 [own[i],own[j]]=[own[j],own[i]];const next=clone(state);
 own.forEach((t,k)=>{next.territories.find(x=>x.id===t.id).priority=k;});
 commit(next,'Reordered '+nameFor(activeAlliance)+' territory priority');
}
function doPlacement(base){
 const result=inspectPlacement(base,state,{spacing:state.settings.spacing});
 if(result.hard.length){inform('Blocked: '+result.hard.join(', '),true);return;}
 if(result.warnings.length&&!confirm('Placement warnings:\n\n'+result.warnings.join('\n')+'\n\nPlace anyway?'))return;
 const next=clone(state);next.bases.push(base);commit(next,'Placed '+nameFor(base.allianceId)+' base at '+base.x+','+base.y);
}
function createBase(x,y){
 if(!valid(x)||!valid(y)){inform('Invalid coordinates',true);return;}
 const name=activeAlliance==='utw'?matchingName($('member-name').value):'';
 const used=state.bases.filter(b=>b.allianceId===activeAlliance).map(b=>b.number||0);
 doPlacement({id:uid(),type:'base',x,y,allianceId:activeAlliance,memberName:name,number:Math.max(0,...used)+1,locked:false,sectionOverride:null});
}
function obstacleCollision(o,s=state,ignore=null){
 const r=footprint(o,s);
 if(s.capitolPlaced&&intersects(r,rect(s.center.x,s.center.y,21,21,s.calibration)))return 'Capitol';
 for(const b of s.bases)if(intersects(r,footprint(b,s)))return 'Commander base';
 for(const p of s.obstacles)if(p.id!==ignore&&intersects(r,footprint(p,s)))return OBJECTS[p.type]?.label||'Obstacle';
 return '';
}
function createObstacle(x,y,type){
 const obj={id:uid(),type,x,y};
 const block=obstacleCollision(obj);
 if(block){inform('Cannot place object: overlaps '+block,true);return;}
 const next=clone(state);next.obstacles.push(obj);commit(next,'Placed '+OBJECTS[type].label+' at '+x+','+y);
}
function addTerritory(){
 const a=alliance(),x1=number('x1'),x2=number('x2'),y1=number('y1'),y2=number('y2'),gap=number('territory-gap');
 const name=$('territory-name').value.trim()||a.name+' section '+(state.territories.filter(t=>t.allianceId===a.id).length+1);
 if(![x1,x2,y1,y2].every(valid)||x1>x2||y1>y2){inform('Enter valid min/max territory coordinates.',true);return;}
 const next=clone(state),pri=next.territories.filter(t=>t.allianceId===a.id).length;
 next.territories.push({id:uid(),allianceId:a.id,name:name.slice(0,65),x1,x2,y1,y2,gap,priority:pri});
 commit(next,'Added '+a.name+' territory '+name);
}
function bulkAdd(){
 const lines=$('bulk').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 if(!lines.length){inform('Paste one or more coordinates first.',true);return;}
 if(lines.length>250){inform('Import up to 250 obstacles per batch.',true);return;}
 const next=clone(state),issues=[],validItems=[];
 lines.forEach((line,i)=>{
  const p=line.split(/[,\s;]+/).filter(Boolean);
  const type=p.length===2?'mine':p[0]?.toLowerCase();
  const x=Number(p.length===2?p[0]:p[1]),y=Number(p.length===2?p[1]:p[2]);
  if(!OBJECTS[type]||type==='base'||type==='capitol'||!valid(x)||!valid(y)){issues.push('Line '+(i+1)+': invalid type or coordinate');return;}
  const o={id:uid(),type,x,y},block=obstacleCollision(o,next);
  if(block){issues.push('Line '+(i+1)+': overlaps '+block);return;}
  next.obstacles.push(o);validItems.push(o);
 });
 if(!validItems.length){inform(issues.join('; ')||'No valid items',true);return;}
 const text=validItems.length+' obstacles are ready.'+(issues.length?'\n'+issues.length+' lines will be skipped:\n'+issues.slice(0,8).join('\n'):'')+'\nApply this batch to the shared map?';
 if(confirm(text))commit(next,'Imported '+validItems.length+' obstacles');
}
function generateSuggestions(){
 try{
  const id=$('suggest-section').value;
  const region=id?state.territories.find(t=>t.id===id):{x1:number('x1'),x2:number('x2'),y1:number('y1'),y2:number('y2')};
  if(!region||[region.x1,region.x2,region.y1,region.y2].some(v=>!valid(v))||region.x1>region.x2||region.y1>region.y2)throw Error('Select a territory or enter valid region coordinates.');
  preview=proposeBases(state,{allianceId:activeAlliance,region,count:number('suggest-count'),gap:number('suggest-gap'),strategy:$('suggest-strategy').value,packing:$('suggest-packing').value});
  $('approve').disabled=!preview.length;
  $('preview-info').textContent=preview.length+' suggested shield-safe positions (preview only).';
  draw();
 }catch(e){inform(e.message,true);}
}
function approveSuggestions(){
 if(!preview.length)return;
 if(!confirm('Place '+preview.length+' proposed '+nameFor(activeAlliance)+' bases on the shared map?'))return;
 const next=clone(state),used=next.bases.filter(b=>b.allianceId===activeAlliance).map(b=>b.number||0);
 let index=Math.max(0,...used);
 for(const o of preview)next.bases.push({...o,id:uid(),locked:false,memberName:'',sectionOverride:null,number:++index});
 const count=preview.length;
 commit(next,'Approved '+count+' smart placements for '+nameFor(activeAlliance)).then(ok=>{if(ok){preview=[];$('approve').disabled=true;$('preview-info').textContent='Preview applied.';draw();}});
}
function renderSelection(){
 const box=$('selection');if(!state||!selected){box.innerHTML='<h2>Selected item</h2><p class="muted">Tap a base, obstacle or territory to inspect its center coordinates and edit it.</p>';return;}
 const o=(selected.kind==='base'?state.bases:selected.kind==='obstacle'?state.obstacles:state.territories).find(x=>x.id===selected.id);
 if(!o){selected=null;renderSelection();return;}
 if(selected.kind==='base'){
  const sec=sectionFor(o,state),info=inspectPlacement(o,{...state,bases:state.bases.filter(b=>b.id!==o.id)});
  const options=state.territories.filter(t=>t.allianceId===o.allianceId).map(t=>'<option value="'+esc(t.id)+'" '+(o.sectionOverride===t.id?'selected':'')+'>'+esc(t.name)+'</option>').join('');
  box.innerHTML='<h2>Commander base #'+(o.number||'?')+' · '+esc(nameFor(o.allianceId))+'</h2><div class="fields">'+
   '<div class="field"><label>X center</label><input type="number" id="edit-x" value="'+o.x+'"></div><div class="field"><label>Y center</label><input type="number" id="edit-y" value="'+o.y+'"></div>'+
   '<div class="field wide"><label>Member (optional)</label><input id="edit-member" list="member-options" value="'+esc(o.memberName||'')+'"></div>'+
   '<div class="field"><label>Alliance</label><select id="edit-alliance">'+state.alliances.map(a=>'<option value="'+esc(a.id)+'" '+(a.id===o.allianceId?'selected':'')+'>'+esc(a.name)+'</option>').join('')+'</select></div>'+
   '<div class="field"><label>Section override</label><select id="edit-section"><option value="">Automatic</option>'+options+'</select></div></div>'+
   '<p class="muted">Assigned section: '+esc(sec?.name||'None')+' · Mud overlap: '+info.mud+'/9 cells'+(info.warnings.length?' · ⚠ '+esc(info.warnings.join('; ')):'')+'</p>'+
   '<label><input id="edit-locked" type="checkbox" '+(o.locked?'checked':'')+' style="width:auto"> Lock this position</label>'+
   '<div class="actions"><button id="save-selected" class="btn primary">Save base</button><button id="delete-selected" class="btn danger">Remove base</button></div>';
 }else if(selected.kind==='obstacle'){
  const t=OBJECTS[o.type];box.innerHTML='<h2>'+esc(t.label)+' · '+t.w+'×'+t.h+'</h2><div class="fields">'+
  '<div class="field"><label>Center X</label><input id="edit-x" type="number" value="'+o.x+'"></div><div class="field"><label>Center Y</label><input id="edit-y" type="number" value="'+o.y+'"></div></div>'+
  '<div class="actions"><button id="save-selected" class="btn primary">Move object</button><button id="delete-selected" class="btn danger">Remove object</button></div>';
 }else{
  box.innerHTML='<h2>'+esc(nameFor(o.allianceId))+' · '+esc(o.name)+'</h2><div class="fields"><div class="field wide"><label>Section name</label><input id="edit-name" value="'+esc(o.name)+'"></div>'+
  ['x1','x2','y1','y2'].map(k=>'<div class="field"><label>'+k.toUpperCase()+'</label><input id="edit-'+k+'" type="number" value="'+o[k]+'"></div>').join('')+
  '</div><p class="muted">Priority '+(o.priority+1)+' · gap '+o.gap+'</p>'+
  '<div class="actions"><button id="save-selected" class="btn primary">Update section</button><button id="delete-selected" class="btn danger">Delete section</button></div>';
 }
 $('save-selected').onclick=saveSelected;$('delete-selected').onclick=deleteSelected;
}
function saveSelected(){
 if(!selected)return;
 const next=clone(state),items=selected.kind==='base'?next.bases:selected.kind==='obstacle'?next.obstacles:next.territories;
 const item=items.find(x=>x.id===selected.id);if(!item)return;
 if(selected.kind==='base'){
  if(item.locked&&(!confirm('This base is locked. Edit it anyway?')))return;
  item.x=number('edit-x');item.y=number('edit-y');item.allianceId=$('edit-alliance').value;
  item.memberName=item.allianceId==='utw'?matchingName($('edit-member').value):'';
  item.locked=$('edit-locked').checked;item.sectionOverride=$('edit-section').value||null;
  if(!valid(item.x)||!valid(item.y))return inform('Invalid coordinates',true);
  if(item.sectionOverride&&!next.territories.some(t=>t.id===item.sectionOverride&&t.allianceId===item.allianceId))item.sectionOverride=null;
  const check=inspectPlacement(item,next,{ignoreId:item.id});
  if(check.hard.length)return inform('Blocked: '+check.hard.join(', '),true);
  if(check.warnings.length&&!confirm(check.warnings.join('\n')+'\n\nSave anyway?'))return;
 }else if(selected.kind==='obstacle'){
  item.x=number('edit-x');item.y=number('edit-y');
  if(!valid(item.x)||!valid(item.y))return inform('Invalid coordinates',true);
  const block=obstacleCollision(item,next,item.id);if(block)return inform('Blocked: overlaps '+block,true);
 }else{
  item.name=$('edit-name').value.trim().slice(0,65);for(const k of ['x1','x2','y1','y2'])item[k]=number('edit-'+k);
  if(!item.name||!['x1','x2','y1','y2'].every(k=>valid(item[k]))||item.x1>item.x2||item.y1>item.y2)return inform('Invalid territory bounds',true);
 }
 commit(next,'Updated '+selected.kind+' '+selected.id.slice(0,8));
}
function deleteSelected(){
 if(!selected||!confirm('Remove this '+selected.kind+' from the shared map?'))return;
 const next=clone(state),key=selected.kind==='base'?'bases':selected.kind==='obstacle'?'obstacles':'territories';
 next[key]=next[key].filter(o=>o.id!==selected.id);
 if(key==='territories')for(const b of next.bases)if(b.sectionOverride===selected.id)b.sectionOverride=null;
 selected=null;commit(next,'Removed '+key.slice(0,-1));
}
function scene(ctx,w,h,cx,cy,scale,{exportKind='screen',showMud=true,showBuff=true,showGrid=true}={}){
 const sx=x=>(x-cx)*scale+w/2,sy=y=>(y-cy)*scale+h/2;
 const rxy=r=>[sx(r.left-.5),sy(r.top-.5),(r.right-r.left+1)*scale,(r.bottom-r.top+1)*scale];
 ctx.fillStyle='#172c21';ctx.fillRect(0,0,w,h);
 const xl=Math.floor(cx-w/(2*scale)),xr=Math.ceil(cx+w/(2*scale)),yt=Math.floor(cy-h/(2*scale)),yb=Math.ceil(cy+h/(2*scale));
 if(showGrid&&scale>=4){
  ctx.lineWidth=.6;ctx.strokeStyle='rgba(206,218,180,.13)';
  for(let x=Math.max(0,xl);x<=Math.min(2000,xr);x++){let px=sx(x-.5);ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px,h);ctx.stroke();}
  for(let y=Math.max(0,yt);y<=Math.min(2000,yb);y++){let py=sy(y-.5);ctx.beginPath();ctx.moveTo(0,py);ctx.lineTo(w,py);ctx.stroke();}
 }
 if(showMud)for(const r of zoneRects(state)){const p=rxy(r);ctx.fillStyle='rgba(176,98,59,.34)';ctx.fillRect(...p);ctx.setLineDash([8,5]);ctx.strokeStyle='#e39e6d';ctx.lineWidth=2;ctx.strokeRect(...p);ctx.setLineDash([]);}
 if(showBuff)for(const r of influenceRects(state)){const p=rxy(r);ctx.fillStyle='rgba(73,167,233,.17)';ctx.fillRect(...p);ctx.strokeStyle='rgba(111,195,255,.8)';ctx.setLineDash([5,6]);ctx.strokeRect(...p);ctx.setLineDash([]);}
 // Explicit territory outlines stay visible, including overlaps.
 for(const t of state.territories){
  const c=colorFor(t.allianceId),p=rxy({left:t.x1,right:t.x2,top:t.y1,bottom:t.y2});
  ctx.fillStyle=c+'18';ctx.fillRect(...p);ctx.strokeStyle=c;ctx.lineWidth=2.3;ctx.strokeRect(...p);
  ctx.font='bold 12px system-ui';ctx.fillStyle='#fff5cf';ctx.fillText(nameFor(t.allianceId)+' · '+t.name,p[0]+4,p[1]+15);
 }
 for(const a of state.alliances){
  const r=occupiedBounds(state,a.id);if(!r)continue;
  const p=rxy(r);ctx.strokeStyle=a.color;ctx.setLineDash([7,5]);ctx.lineWidth=1.7;ctx.strokeRect(...p);ctx.setLineDash([]);
 }
 if(state.capitolPlaced){const p=rxy(rect(state.center.x,state.center.y,21,21,state.calibration));ctx.fillStyle='#984738';ctx.fillRect(...p);ctx.strokeStyle='#f4c59d';ctx.lineWidth=2;ctx.strokeRect(...p);ctx.fillStyle='#fff2d3';ctx.font='bold '+clamp(scale*1.15,13,24)+'px system-ui';ctx.textAlign='center';ctx.fillText('CAPITOL',p[0]+p[2]/2,p[1]+p[3]/2);ctx.textAlign='left';}
 for(const o of state.obstacles){
  const p=rxy(footprint(o,state)),t=OBJECTS[o.type];
  ctx.fillStyle=['siege','charge'].includes(o.type)?'#bba353':'#8d7753';ctx.fillRect(...p);
  ctx.strokeStyle='#e6c08c';ctx.lineWidth=1.3;ctx.strokeRect(...p);
  if(scale>=6){ctx.fillStyle='#1e261b';ctx.font='bold '+clamp(Math.min(p[2],p[3])*.22,8,15)+'px system-ui';ctx.textAlign='center';ctx.fillText(t.label.split(' ')[0],p[0]+p[2]/2,p[1]+p[3]/2);ctx.textAlign='left';}
 }
 const useNumbers=exportKind==='detailed';
 for(const b of state.bases){
  const p=rxy(footprint(b,state)),c=colorFor(b.allianceId);
  ctx.fillStyle=c;ctx.fillRect(...p);ctx.strokeStyle='#e3ead8';ctx.lineWidth=.7;ctx.strokeRect(...p);
  const unsafe=inspectPlacement(b,{...state,bases:state.bases.filter(x=>x.id!==b.id)}).mud>3;
  if(unsafe){ctx.strokeStyle='#f76666';ctx.lineWidth=2.8;ctx.strokeRect(...p);}
  const autoName=showNames==='auto'&&scale>=20;
  const textName=showNames==='on'||autoName;
  const label=useNumbers&&b.allianceId==='utw'?'#'+(b.number||'?'):nameFor(b.allianceId);
  if(scale>=3){
   ctx.font='bold '+clamp(scale*.68,7,15)+'px system-ui';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.textBaseline='middle';
   ctx.fillText(label,p[0]+p[2]/2,p[1]+p[3]/2-(textName&&b.memberName?scale*.45:0),p[2]-3);
   if(exportKind==='screen'&&textName&&b.memberName){ctx.font=clamp(scale*.42,7,11)+'px system-ui';ctx.fillText(b.memberName,p[0]+p[2]/2,p[1]+p[3]/2+scale*.5,p[2]-2);}
   ctx.textBaseline='alphabetic';ctx.textAlign='left';
  }
 }
 for(const b of preview){const p=rxy(footprint(b,state));ctx.fillStyle='rgba(166,219,238,.32)';ctx.fillRect(...p);ctx.strokeStyle='#a2edff';ctx.lineWidth=2;ctx.strokeRect(...p);}
 if(drawArea){const r={left:Math.min(drawArea.x1,drawArea.x2),right:Math.max(drawArea.x1,drawArea.x2),top:Math.min(drawArea.y1,drawArea.y2),bottom:Math.max(drawArea.y1,drawArea.y2)};const p=rxy(r);ctx.fillStyle='#d8c26824';ctx.fillRect(...p);ctx.strokeStyle='#fff2b5';ctx.lineWidth=2;ctx.strokeRect(...p);}
 if(selected){
  const o=(selected.kind==='base'?state.bases:selected.kind==='obstacle'?state.obstacles:state.territories).find(x=>x.id===selected.id);
  if(o){const r=selected.kind==='territory'?{left:o.x1,right:o.x2,top:o.y1,bottom:o.y2}:footprint(o,state);ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.strokeRect(...rxy(r));}
 }
}
function draw(){
 if(!ctx||!state)return;
 const dpr=window.devicePixelRatio||1,ww=canvas.clientWidth,hh=canvas.clientHeight;
 if(!ww||!hh)return;
 if(width!==ww||height!==hh||canvas.width!==Math.round(ww*dpr)){
  width=ww;height=hh;canvas.width=Math.round(ww*dpr);canvas.height=Math.round(hh*dpr);
 }
 ctx.setTransform(dpr,0,0,dpr,0,0);
 scene(ctx,width,height,view.x,view.y,view.scale,{showMud:displayMud,showBuff:displayBuff,showGrid:displayGrid});
 $('map-coordinate').textContent='Center X '+Math.round(view.x)+' · Y '+Math.round(view.y)+' · '+view.scale.toFixed(1)+' px/cell';
}
function fitMap(all=false){
 if(!state)return;
 const b=boundsOfState(state,{zones:!all,territories:true});
 view.x=(b.left+b.right)/2;view.y=(b.top+b.bottom)/2;
 const w=canvas?.clientWidth||800,h=canvas?.clientHeight||450;
 view.scale=clamp(Math.min(w/(b.right-b.left+24),h/(b.bottom-b.top+24)),1.2,45);
 draw();
}
function eventCell(e){
 const r=canvas.getBoundingClientRect();
 return {x:Math.round(view.x+(e.clientX-r.left-width/2)/view.scale),y:Math.round(view.y+(e.clientY-r.top-height/2)/view.scale)};
}
function pick(x,y){
 const b=[...state.bases].reverse().find(o=>contains(footprint(o,state),x,y));
 if(b)return {kind:'base',id:b.id};
 const o=[...state.obstacles].reverse().find(o=>contains(footprint(o,state),x,y));
 if(o)return {kind:'obstacle',id:o.id};
 const t=[...state.territories].reverse().find(o=>x>=o.x1&&x<=o.x2&&y>=o.y1&&y<=o.y2);
 return t?{kind:'territory',id:t.id}:null;
}
function handleMapTap(x,y){
 if(!valid(x)||!valid(y))return;
 $('coord-x').value=x;$('coord-y').value=y;
 if(tool==='base')createBase(x,y);
 else if(tool==='obstacle')createObstacle(x,y,$('obstacle-type').value);
 else {selected=pick(x,y);renderSelection();draw();}
}
function attachCanvas(){
 canvas.addEventListener('pointerdown',e=>{
  if(!state)return;
  canvas.setPointerCapture(e.pointerId);
  pointer={id:e.pointerId,x:e.clientX,y:e.clientY,originX:view.x,originY:view.y,cell:eventCell(e),moved:false};
  if(tool==='territory'){drawArea={x1:pointer.cell.x,y1:pointer.cell.y,x2:pointer.cell.x,y2:pointer.cell.y};draw();}
 });
 canvas.addEventListener('pointermove',e=>{
  if(!pointer||e.pointerId!==pointer.id)return;
  const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(Math.hypot(dx,dy)>6)pointer.moved=true;
  if(tool==='territory'&&drawArea){const c=eventCell(e);drawArea.x2=c.x;drawArea.y2=c.y;draw();}
  else if(pointer.moved){view.x=pointer.originX-dx/view.scale;view.y=pointer.originY-dy/view.scale;draw();}
 });
 canvas.addEventListener('pointerup',e=>{
  if(!pointer||e.pointerId!==pointer.id)return;
  if(tool==='territory'&&drawArea){
   const b=drawArea;for(const [id,n] of [['x1',Math.min(b.x1,b.x2)],['x2',Math.max(b.x1,b.x2)],['y1',Math.min(b.y1,b.y2)],['y2',Math.max(b.y1,b.y2)]])$(id).value=n;
   drawArea=null;inform('Territory rectangle selected. Enter a section name and tap Add section.');
  }else if(!pointer.moved){const c=eventCell(e);handleMapTap(c.x,c.y);}
  pointer=null;draw();
 });
 canvas.addEventListener('pointercancel',()=>{pointer=null;drawArea=null;draw();});
 canvas.addEventListener('wheel',e=>{e.preventDefault();view.scale=clamp(view.scale*(e.deltaY<0?1.15:1/1.15),1,70);draw();},{passive:false});
}
function downloadCanvas(c,name){
 const type=$('export-format').value==='jpeg'?'image/jpeg':'image/png';
 c.toBlob(blob=>{
  if(!blob){inform('Unable to create image',true);return;}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name+'.'+(type==='image/png'?'png':'jpg');
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
 },type,.94);
}
function sortedUTW(){return state.bases.filter(b=>b.allianceId==='utw').sort((a,b)=>(a.number||0)-(b.number||0));}
function drawLegend(ctx,arr,startY,w,columns=3){
 const colWidth=w/columns,rows=Math.ceil(arr.length/columns);
 ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.font='bold 18px system-ui';ctx.fillStyle='#f6dfaa';
 ctx.fillText('UTW base coordinates · center cells',24,startY+25);
 ctx.font='14px system-ui';
 arr.forEach((b,i)=>{
  const col=Math.floor(i/rows),row=i%rows;
  const name=(b.memberName||'').slice(0,18);
  ctx.fillStyle='#e5f1dd';ctx.fillText('#'+b.number+' '+name,24+col*colWidth,startY+55+row*26,colWidth-95);
  ctx.fillStyle='#c6d4bd';ctx.fillText('('+b.x+', '+b.y+')',col*colWidth+colWidth-95,startY+55+row*26,90);
 });
}
function exportMap(kind){
 const b=boundsOfState(state,{zones:true,territories:true}),padding=6;
 const worldW=b.right-b.left+1+padding*2,worldH=b.bottom-b.top+1+padding*2;
 const scale=clamp(2500/Math.max(worldW,worldH),3,36);
 const innerW=Math.ceil(worldW*scale),innerH=Math.ceil(worldH*scale);
 const legend=kind==='detailed'?sortedUTW():[],cols=3,rows=Math.ceil(legend.length/cols);
 const legendHeight=kind==='detailed'?Math.max(100,70+rows*26):0;
 const c=document.createElement('canvas');c.width=innerW+112;c.height=innerH+175+legendHeight;
 const context=c.getContext('2d');context.fillStyle='#102b20';context.fillRect(0,0,c.width,c.height);
 context.fillStyle='#f4e3b7';context.font='bold 27px Georgia';context.fillText(kind==='detailed'?'UTW Detailed Hive Map':'Alliance Territory Overview',28,37);
 context.font='14px system-ui';context.fillStyle='#c9d9c2';context.fillText('Warzone 1395 · Center coordinates · Snapshot v'+revision,28,59);
 const left=60,top=85;
 context.save();context.translate(left,top);
 scene(context,innerW,innerH,(b.left+b.right)/2,(b.top+b.bottom)/2,scale,{exportKind:kind,showMud:true,showBuff:true,showGrid:true});
 context.restore();
 context.fillStyle='#f6e5bb';context.font='13px system-ui';context.textBaseline='middle';
 const step=worldW<120?10:worldW<400?25:50;
 for(let x=Math.ceil((b.left-padding)/step)*step;x<=b.right+padding;x+=step){
  const px=left+(x-(b.left+b.right)/2)*scale+innerW/2;
  context.fillText(String(x),px-14,top-13);
  context.fillText(String(x),px-14,top+innerH+15);
 }
 for(let y=Math.ceil((b.top-padding)/step)*step;y<=b.bottom+padding;y+=step){
  const py=top+(y-(b.top+b.bottom)/2)*scale+innerH/2;
  context.fillText(String(y),9,py);
  context.fillText(String(y),left+innerW+10,py);
 }
 context.font='13px system-ui';context.fillStyle='#d5dfcc';
 context.fillText('X '+(b.left-padding)+' to '+(b.right+padding)+'   |   Y '+(b.top-padding)+' to '+(b.bottom+padding),24,top+innerH+51);
 if(kind==='detailed')drawLegend(context,legend,top+innerH+74,c.width,cols);
 downloadCanvas(c,'UTW-'+kind+'-map-v'+revision);
}
function exportLegend(){
 const bs=sortedUTW(),cols=bs.length>30?3:2,rows=Math.ceil(bs.length/cols),w=1200;
 const c=document.createElement('canvas');c.width=w;c.height=Math.max(170,115+rows*30);
 const x=c.getContext('2d');x.fillStyle='#102b20';x.fillRect(0,0,c.width,c.height);
 x.fillStyle='#f4dfaa';x.font='bold 30px Georgia';x.fillText('UTW · Base Coordinate Legend',22,41);
 x.fillStyle='#c8d8c0';x.font='15px system-ui';x.fillText('Center X/Y coordinates · Warzone 1395 · Revision '+revision,22,70);
 drawLegend(x,bs,75,w,cols);downloadCanvas(c,'UTW-base-coordinates-v'+revision);
}
async function restoreRevision(rev){
 if(!Number.isSafeInteger(rev)||rev<0)return;
 const response=await fetch(API+'?snapshot='+rev,{credentials:'same-origin',cache:'no-store'});
 if(!response.ok){inform('Could not load historical snapshot',true);return;}
 const data=await response.json();
 if(!confirm('Restore revision '+rev+'? This will create a new revision and preserve current history.'))return;
 await commit(data.snapshot.state,'Restored hive map revision '+rev);
}
function bind(){
 canvas=$('map-canvas');ctx=canvas.getContext('2d');attachCanvas();
 $('jump').onclick=()=>{try{const c=coord();view.x=c.x;view.y=c.y;draw();}catch(e){inform(e.message,true)}};
 $('set-capitol').onclick=()=>{try{const c=coord();const next=clone(state);next.center=c;next.capitolPlaced=true;next.calibration.verified=false;commit(next,'Set Capitol center '+c.x+','+c.y);}catch(e){inform(e.message,true)}};
 $('save-calibration').onclick=()=>{const next=clone(state);next.calibration={evenX:$('even-x').value,evenY:$('even-y').value,verified:false};commit(next,'Adjusted even-sized object anchor convention');};
 $('verify-calibration').onclick=()=>{if(!confirm('Have you compared the planner against real in-game edge coordinates?'))return;const next=clone(state);next.calibration.verified=true;commit(next,'Marked coordinate calibration tested in game');};
 $('alliance').onchange=e=>{activeAlliance=e.target.value;preview=[];updateDynamic();draw();};
 $('add-alliance').onclick=()=>{
  const name=$('new-alliance').value.trim().slice(0,28),id=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  if(!id||state.alliances.some(a=>a.id===id))return inform('Enter a unique alliance name',true);
  const next=clone(state);next.alliances.push({id,name,color:$('alliance-color').value});
  commit(next,'Added alliance '+name).then(ok=>{if(ok){activeAlliance=id;updateDynamic();}});
 };
 $('base-gap').onchange=e=>{const next=clone(state);next.settings.spacing=Number(e.target.value);commit(next,'Set preferred base gap to '+e.target.value+' cells');};
 $('show-names').onchange=e=>{showNames=e.target.value;draw();};
 $('place-base').onclick=()=>{try{const c=coord();createBase(c.x,c.y);}catch(e){inform(e.message,true)}};
 $('place-obstacle').onclick=()=>{try{const c=coord();createObstacle(c.x,c.y,$('obstacle-type').value);}catch(e){inform(e.message,true)}};
 $('obstacle-type').onchange=e=>{$('obstacle-type').dataset.chosen=e.target.value;};
 $('bulk-preview').onclick=bulkAdd;
 $('add-territory').onclick=addTerritory;
 $('suggest').onclick=generateSuggestions;$('approve').onclick=approveSuggestions;
 $('discard').onclick=()=>{preview=[];$('approve').disabled=true;$('preview-info').textContent='Preview cleared.';draw();};
 for(const b of document.querySelectorAll('[data-tool]'))b.onclick=()=>{
  tool=b.dataset.tool;document.querySelectorAll('[data-tool]').forEach(x=>x.classList.toggle('active',x.dataset.tool===tool));
  inform('Tool: '+b.textContent+'. Drag to pan unless drawing a territory.');
 };
 $('zoom-in').onclick=()=>{view.scale=clamp(view.scale*1.3,1,70);draw();};
 $('zoom-out').onclick=()=>{view.scale=clamp(view.scale/1.3,1,70);draw();};
 $('fit').onclick=()=>fitMap(false);
 $('mud-toggle').onchange=e=>{displayMud=e.target.checked;draw();};
 $('buff-toggle').onchange=e=>{displayBuff=e.target.checked;draw();};
 $('grid-toggle').onchange=e=>{displayGrid=e.target.checked;draw();};
 $('export-overview').onclick=()=>exportMap('overview');
 $('export-detailed').onclick=()=>exportMap('detailed');
 $('export-legend').onclick=exportLegend;
 $('restore').onclick=()=>restoreRevision(Number($('history-select').value));
 $('undo').onclick=()=>{if(revision>0)restoreRevision(revision-1);};
 $('snapshot').onclick=()=>{const label=prompt('Name this snapshot (for example, Before Capitol War)');if(label?.trim())commit(clone(state),'Snapshot: '+label.trim().slice(0,130));};
 window.addEventListener('resize',draw);
}
async function start(){
 app.innerHTML=html;bind();sync('Loading…');
 try{await fetchData(true,true);showNames=state.settings.showNames;view.x=state.center.x;view.y=state.center.y;fitMap(false);draw();inform('Ready. Set a Capitol center, then place bases or tap a tool. Coordinate alignment is unverified until game testing.');}
 catch(e){sync('Connection error');inform(e.message,true);}
 setInterval(async()=>{if(busy||polling||document.visibilityState==='hidden')return;polling=true;try{const was=revision;const changed=await fetchData(false,false);if(changed&&was!==revision)inform('Shared map updated by another R4. Revision '+revision);}catch(e){sync('Offline · retrying');}finally{polling=false;}},5000);
}
start();
