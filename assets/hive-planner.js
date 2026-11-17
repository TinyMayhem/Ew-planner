import {OBJECTS,rect,footprint,zoneRects,influenceRects,intersects,inspectPlacement,sectionFor,boundsOfState,occupiedBounds,proposeBases,contains,cityLabel,mapToPixel,pixelToMap,screenFootprint,inspectBaseMove,pinchCamera,territoryBoundsFromCorners,moveTerritoryBounds,resizeTerritoryBounds,allianceBaseClusters,allianceUsage,packingGrid,basesInSelection,inspectGroupMove} from './hive-geometry.js';

const API='/r4-hive',app=document.getElementById('hive-app');
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=id=>Number($(id)?.value);
const uid=()=>globalThis.crypto?.randomUUID?.()||('id-'+Date.now()+'-'+Math.random().toString(36).slice(2));
const clone=x=>JSON.parse(JSON.stringify(x));
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
let state=null,revision=0,history=[],members=[],aliases=[],user=null,busy=false;
let activeAlliance='utw',tool='select',selected=null,preview=[],showNames='auto',displayMud=true,displayBuff=true,displayGrid=true;
let view={x:499,y:499,scale:10},pointer=null,dragMove=null,groupBox=null,groupDrag=null,hoverCell=null,drawArea=null,areaGesture=null,editingTerritoryId=null,canvas,ctx,width=900,height=600,polling=false;
const groupSelection=new Set();
const touchPoints=new Map();let pinchGesture=null,ignoreTouchUntilRelease=false;
const LONG_PRESS_MS=450, LONG_PRESS_SLOP_PX=9;
const typeChoices=Object.entries(OBJECTS).filter(([k])=>!['base','capitol','city'].includes(k));
const html=[
 '<header class="topbar"><div class="brand">✦ UTW Hive & Territory Planner<small>R4 Command Center · Server 1395 · shared map</small></div>',
 '<div class="top-actions"><span class="pill" id="sync-state">Connecting…</span><a href="/r4-planner" class="btn">← Command Center</a></div></header>',
 '<div class="layout"><aside class="sidebar">',
 '<section class="panel"><h2>📍 Coordinates & Capitol</h2><div class="fields">',
 '<div class="field"><label for="coord-x">Center X</label><input id="coord-x" type="number" min="0" max="1999" value="499"></div>',
 '<div class="field"><label for="coord-y">Center Y</label><input id="coord-y" type="number" min="0" max="1999" value="499"></div></div>',
 '<div class="actions"><button class="btn primary" id="jump">Jump to X/Y</button><button class="btn" id="set-capitol">Set Capitol center</button><button class="btn" id="test-coordinate">Test 3×3 base here</button></div>',
 '<p class="hint">Capitol: 21×21 cells; contaminated zone: 100×100. Even-size alignment is provisional until tested in-game.</p>',
 '<div class="fields"><div class="field"><label>Even-width X side</label><select id="even-x"><option value="negative">Extra west cell</option><option value="positive">Extra east cell</option></select></div>',
 '<div class="field"><label>Even-height Y side</label><select id="even-y"><option value="negative">Extra south cell</option><option value="positive">Extra north cell</option></select></div></div>',
 '<div class="actions"><button id="save-calibration" class="btn">Save calibration</button><button id="verify-calibration" class="btn">Mark tested</button></div><p class="hint" id="calibration-message">Not verified against an in-game mud edge.</p><p id="calibration-result" class="notice">Enter a known game coordinate, then use Test 3×3 base here to compare the predicted footprint with your screenshot.</p></section>',
 '<section class="panel"><h2>🏳 Alliances & Bases</h2><div class="fields"><div class="field wide"><label>Current alliance</label><select id="alliance"></select></div>',
 '<div class="field"><label>New alliance initials</label><input id="new-alliance" maxlength="28" placeholder="VON"></div><div class="field"><label>Colour</label><input id="alliance-color" type="color" value="#be654e"></div></div>',
 '<div class="actions"><button id="add-alliance" class="btn">Add alliance</button></div>',
 '<h3>Manage selected alliance</h3><div class="field"><label for="alliance-rename">Alliance display name</label><input id="alliance-rename" maxlength="28" placeholder="Alliance name"></div>',
 '<div class="actions"><button id="rename-alliance" class="btn">Save alliance name</button><button id="delete-alliance" class="btn danger">Delete alliance</button></div>',
 '<p class="hint" id="alliance-usage"></p>',
 '<h3>Place commander base (3×3)</h3><div class="fields"><div class="field wide"><label>Member name (optional, UTW)</label><input id="member-name" list="member-options" placeholder="Search by current or old nickname"><datalist id="member-options"></datalist></div>',
 '<div class="field"><label>Gap between bases</label><select id="base-gap"><option value="0">No gap</option><option value="1">1-cell gap</option><option value="2">2-cell gap</option></select></div>',
 '<div class="field"><label>View member names</label><select id="show-names"><option value="auto">Auto by zoom</option><option value="on">Show</option><option value="off">Hide</option></select></div></div>',
 '<div class="actions"><button id="place-base" class="btn primary">Place at X/Y</button></div><p class="hint">To tap positions instead, choose the Base tool above the map. Names are optional, with no missing-member tracking.</p></section>',
 '<section class="panel"><h2>🏙 Place City</h2><p class="hint">Cities occupy 7×7 cells, with a separate 15×15 contaminated zone. The city label always shows its level and name on the map.</p>',
 '<div class="fields"><div class="field wide"><label>City name</label><input id="city-name" maxlength="70" placeholder="Lawless Road"></div>',
 '<div class="field"><label>City level</label><select id="city-level">'+Array.from({length:10},(_,i)=>'<option value="'+(i+1)+'">Level '+(i+1)+'</option>').join('')+'</select></div>',
 '<div class="field"><label>Owning alliance (optional)</label><select id="city-owner"></select></div></div>',
 '<div class="actions"><button id="place-city" class="btn primary">Place city at X/Y</button></div>',
 '<p class="hint">Or select Tap: City above the map and touch the center cell. Select a city later to edit its name, level, ownership or coordinates.</p></section>',
 '<section class="panel"><h2>⛏ Obstacles</h2><div class="field"><label>Object type</label><select id="obstacle-type"></select></div>',
 '<div class="actions"><button id="place-obstacle" class="btn">Place at X/Y</button></div><h3>Paste multiple mines / objects</h3>',
 '<textarea id="bulk" placeholder="550,540&#10;555,540&#10;truck55,560,540"></textarea>',
 '<div class="actions"><button id="bulk-preview" class="btn">Review & add bulk items</button></div><p class="hint">One line per object. Use X,Y for a mine or type,X,Y for other items. Objects cannot intersect commander bases.</p></section>',
 '<section class="panel"><h2>▱ Territory sections</h2><div class="fields"><div class="field wide"><label>Section name</label><input id="territory-name" maxlength="65" placeholder="North Frontline"></div>',
 '<div class="field"><label>Min X</label><input id="x1" type="number" value="450"></div><div class="field"><label>Max X</label><input id="x2" type="number" value="550"></div>',
 '<div class="field"><label>Min Y</label><input id="y1" type="number" value="450"></div><div class="field"><label>Max Y</label><input id="y2" type="number" value="550"></div>',
 '<div class="field wide"><label>Section spacing</label><select id="territory-gap"><option value="0">No gap</option><option value="1">1-cell gap</option><option value="2">2-cell gap</option></select></div></div>',
 '<div class="actions"><button id="add-territory" class="btn primary">Save territory</button><button id="clear-territory-draft" class="btn">Clear draft</button></div>',
 '<p class="hint">Draw a rectangle on the map. Your draft stays visible until you save or clear it. Adjust its corners on the map, or edit the X/Y fields above. Saved sections can be edited below.</p>',
 '<h3>Saved territories</h3><div id="territory-list" class="territory-list"></div>',
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
 '<button class="btn active" data-tool="select">Select / Pan</button><button class="btn" data-tool="group">Select Group</button><button class="btn" data-tool="base">Tap: Base</button><button class="btn" data-tool="city">Tap: City</button><button class="btn" data-tool="obstacle">Tap: Obstacle</button><button class="btn" data-tool="territory">Draw territory</button>',
 '</div><div class="zoomset"><button class="btn" id="zoom-out">−</button><button class="btn" id="zoom-in">+</button><button class="btn" id="fit">Fit active area</button></div></div>',
 '<div class="map-wrap"><canvas id="map-canvas" aria-label="Interactive UTW map coordinate grid"></canvas><div class="map-overlay" id="map-coordinate">X: 499 · Y: 499</div></div>',
 '<div id="group-controls" class="group-controls" hidden>',
 '<div class="group-header"><strong id="group-count">0 bases selected</strong><span id="group-status">Draw around bases or tap them to select.</span></div>',
 '<div class="group-actions"><button class="btn" id="group-select-all">Select all current alliance</button><button class="btn" id="group-clear">Clear selection</button></div>',
 '<div class="group-move-fields"><label>Move X cells <input id="group-dx" type="number" value="0" step="1"></label><label>Move Y cells <input id="group-dy" type="number" value="0" step="1"></label><button id="group-move" class="btn primary">Move selected</button></div>',
 '<p class="hint">Drag a rectangle around bases to select them. Tap individual bases to add or remove. Long-press a selected base, then drag the entire group. Pinch with two fingers to pan or zoom. Locked bases cannot move.</p></div>',
 '<div id="territory-draft-bar" class="draft-bar" hidden><span id="territory-draft-summary"></span><div class="actions"><button id="draft-save" class="btn primary">Save territory</button><button id="draft-edit" class="btn">Edit coordinates</button><button id="draft-clear" class="btn">Clear</button></div></div>',
 '<div class="map-legend"><span><i class="swatch" style="background:#b16b4b"></i>Contaminated</span><span><i class="swatch" style="background:#b69a58"></i>Physical obstacle</span><span><i class="swatch" style="background:#b1eb8a"></i>3×3 green preview = placeable</span><span><i class="swatch" style="background:#e5b37e"></i>City label = level and name</span>',
 '<span>Solid = assigned territory</span><span>Dashed = occupied territory</span><span>↑ Y increases north · → X increases east</span><span id="overview-mode-note" hidden>Overview: alliance colours and names. Zoom in for individual bases.</span>',
 '<label style="display:inline"><input id="mud-toggle" type="checkbox" checked style="width:auto"> Mud</label>',
 '<label style="display:inline"><input id="buff-toggle" type="checkbox" checked style="width:auto"> Influence</label>',
 '<label style="display:inline"><input id="grid-toggle" type="checkbox" checked style="width:auto"> Grid</label></div>',
 '<div class="mobile-caption">Faint 1×1 cells and gentle 3-cell guides match base-sized placement. Guides do not force snapping. One finger: tap to select, long-hold a base to move, or drag to pan. Select Group: draw over bases, then long-hold one to move them together. Two fingers: slide together to pan, or pinch apart/together to zoom. Buttons still work.</div></section>',
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
 $('alliance-rename').value=alliance().name;
 const usage=allianceUsage(state,activeAlliance);
 $('alliance-usage').textContent=activeAlliance==='utw'
  ?'UTW is the primary alliance. Its name can be changed, but it cannot be deleted.'
  :usage.bases+ ' bases, '+usage.territories+' territories, '+usage.cities+' owned cities. To delete this alliance, first reassign or remove its associated records.';
 $('delete-alliance').disabled=activeAlliance==='utw'||state.alliances.length<=1;
 $('obstacle-type').innerHTML=typeChoices.map(([key,t])=>'<option value="'+key+'">'+esc(t.label)+' ('+t.w+'×'+t.h+')</option>').join('');
 const old=$('obstacle-type').dataset.chosen;if(old)$('obstacle-type').value=old;
 const currentCityOwner=$('city-owner').value;
 $('city-owner').innerHTML='<option value="">Unassigned</option>'+state.alliances.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join('');
 if(currentCityOwner&&state.alliances.some(a=>a.id===currentCityOwner))$('city-owner').value=currentCityOwner;
 if(!$('city-level').dataset.initialized){$('city-level').value='3';$('city-level').dataset.initialized='yes';}
 $('member-options').innerHTML=members.map(m=>'<option value="'+esc(m.display_name)+'"></option>').join('')+
 aliases.slice(0,500).map(a=>'<option value="'+esc(a.alias)+'"></option>').join('');
 $('history-select').innerHTML=history.map(h=>'<option value="'+h.revision+'">v'+h.revision+' · '+esc(h.summary)+' · '+esc(h.actor)+'</option>').join('');
 $('history-list').innerHTML=history.slice(0,16).map(h=>'<div class="history-row">v'+h.revision+' · '+esc(h.actor)+' · '+esc(h.summary)+'<br>'+new Date(h.created_at).toLocaleString()+'</div>').join('');
 $('suggest-section').innerHTML='<option value="">Use coordinate rectangle below</option>'+state.territories.filter(t=>t.allianceId===activeAlliance).sort((a,b)=>a.priority-b.priority).map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+'</option>').join('');
 const ownTerritories=state.territories.filter(t=>t.allianceId===activeAlliance).sort((a,b)=>a.priority-b.priority);
 $('territory-list').innerHTML=ownTerritories.length?ownTerritories.map(t=>
  '<div class="territory-entry"><div><strong>'+esc(t.name)+'</strong><span>X '+t.x1+'–'+t.x2+' · Y '+t.y1+'–'+t.y2+'</span></div>'+
  '<button class="btn" data-territory-edit="'+esc(t.id)+'">Edit</button>'+
  '<button class="btn" data-territory-locate="'+esc(t.id)+'">Locate</button></div>'
 ).join(''):'<p class="hint">No saved territories for '+esc(nameFor(activeAlliance))+'. Draw one to get started.</p>';
 document.querySelectorAll('[data-territory-edit]').forEach(b=>b.onclick=()=>openTerritory(b.dataset.territoryEdit));
 document.querySelectorAll('[data-territory-locate]').forEach(b=>b.onclick=()=>focusTerritory(state.territories.find(t=>t.id===b.dataset.territoryLocate)));
 $('even-x').value=state.calibration.evenX;$('even-y').value=state.calibration.evenY;
 $('calibration-message').textContent=state.calibration.verified?'✓ Calibration marked as tested':'⚠ Even-size edge alignment has NOT been verified against the game.';
 $('base-gap').value=String(state.settings.spacing);
 $('territory-priority').innerHTML='<h3>Section priority (top wins)</h3>'+state.territories.filter(t=>t.allianceId===activeAlliance).sort((a,b)=>a.priority-b.priority).map((t,i)=>'<div class="rank-row"><span>'+ (i+1)+'. '+esc(t.name)+'</span><button class="btn" data-priority="'+esc(t.id)+'" data-direction="-1" aria-label="Move section up">↑</button><button class="btn" data-priority="'+esc(t.id)+'" data-direction="1" aria-label="Move section down">↓</button></div>').join('');
 document.querySelectorAll('[data-priority]').forEach(b=>b.onclick=()=>movePriority(b.dataset.priority,Number(b.dataset.direction)));
 if(!$('coord-x').dataset.initialized){$('coord-x').value=state.center.x;$('coord-y').value=state.center.y;$('coord-x').dataset.initialized='yes';}
 renderSelection();renderReports();
}
function renameAlliance(){
 const current=alliance();
 if(!current)return inform('Choose an alliance first.',true);
 const name=$('alliance-rename').value.trim();
 if(!name||name.length>28)return inform('Alliance name must contain 1 to 28 characters.',true);
 if(state.alliances.some(a=>a.id!==current.id&&a.name.toLowerCase()===name.toLowerCase()))
  return inform('That alliance name already exists.',true);
 if(current.name===name)return inform('Alliance name is unchanged.');
 const next=clone(state);
 next.alliances.find(a=>a.id===current.id).name=name;
 commit(next,'Renamed alliance '+current.name+' to '+name);
}
function deleteAlliance(){
 const current=alliance();
 if(!current)return inform('Choose an alliance first.',true);
 if(current.id==='utw')return inform('The primary UTW alliance cannot be deleted.',true);
 if(state.alliances.length<=1)return inform('At least one alliance must remain.',true);
 const usage=allianceUsage(state,current.id);
 if(usage.bases||usage.territories||usage.cities)
  return inform('Cannot delete '+current.name+': it still has '+usage.bases+' bases, '+
   usage.territories+' territories, and '+usage.cities+' owned cities. Reassign or remove them first to avoid losing map data.',true);
 if(!confirm('Delete the unused alliance "'+current.name+'"? This cannot be undone except through map history.'))return;
 const next=clone(state);
 next.alliances=next.alliances.filter(a=>a.id!==current.id);
 commit(next,'Deleted unused alliance '+current.name).then(ok=>{
  if(ok){activeAlliance=next.alliances.some(a=>a.id==='utw')?'utw':next.alliances[0].id;updateDynamic();draw();}
 });
}
function renderReports(){
 if(!state)return;
 $('reports').innerHTML=state.alliances.map(a=>{
  const bs=state.bases.filter(b=>b.allianceId===a.id),out=occupiedBounds(state,a.id);
  const ts=state.territories.filter(t=>t.allianceId===a.id);
  const counts=new Map(ts.map(t=>[t.id,0]));
  for(const b of bs){const section=sectionFor(b,state);if(section)counts.set(section.id,(counts.get(section.id)||0)+1);}
  const off=bs.filter(b=>{const relevant=b.sectionOverride?ts.filter(t=>t.id===b.sectionOverride):ts;if(!relevant.length)return ts.length>0;return !relevant.some(t=>{const r=footprint(b,state);return r.left>=t.x1&&r.right<=t.x2&&r.top>=t.y1&&r.bottom<=t.y2;});}).length;
  return '<div class="report-alliance" style="--team:'+esc(a.color)+'"><strong>'+esc(a.name)+'</strong> · '+bs.length+' bases'+
  '<br>Occupied: '+(out?'X '+out.left+'–'+out.right+', Y '+out.top+'–'+out.bottom:'No bases')+
  '<br>Sections: '+ts.length+(off?' · ⚠ '+off+' outside/crossing':'')+
  ts.map(t=>'<br>↳ '+esc(t.name)+': X '+t.x1+'–'+t.x2+', Y '+t.y1+'–'+t.y2+' · '+(counts.get(t.id)||0)+' bases · gap '+t.gap).join('')+'</div>';
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
function createCity(x,y){
 if(!valid(x)||!valid(y))return inform('Enter a valid city center coordinate',true);
 const name=$('city-name').value.trim().slice(0,70)||'City';
 const level=number('city-level');
 const ownerAllianceId=$('city-owner').value||null;
 if(!Number.isInteger(level)||level<1||level>10)return inform('Choose a city level from 1 to 10',true);
 const city={id:uid(),type:'city',name,level,ownerAllianceId,x,y};
 const block=obstacleCollision(city);
 if(block)return inform('City location blocked by '+block,true);
 const next=clone(state);next.obstacles.push(city);
 commit(next,'Placed '+cityLabel(city)+' at '+x+','+y);
}
function territoryFieldBounds(){
 const [x1,x2,y1,y2]=['x1','x2','y1','y2'].map(number);
 if(![x1,x2,y1,y2].every(valid)||x1>x2||y1>y2)return null;
 return {x1,x2,y1,y2};
}
function showTerritoryDraft(){
 const bar=$('territory-draft-bar');
 if(!bar)return;
 bar.hidden=!drawArea;
 if(drawArea){
  const t=drawArea;
  $('territory-draft-summary').textContent=(editingTerritoryId?'Editing saved territory':'Unsaved territory')+' · '+nameFor(activeAlliance)+
   ' · X '+t.x1+'–'+t.x2+' · Y '+t.y1+'–'+t.y2+
   ' · Drag corners to resize or the inside to move';
  $('draft-save').textContent=editingTerritoryId?'Save changes':'Save territory';
  $('draft-clear').textContent=editingTerritoryId?'Cancel edit':'Clear';
 }
}
function syncTerritoryFields(t){
 for(const k of ['x1','x2','y1','y2'])$(k).value=String(t[k]);
 showTerritoryDraft();
 draw();
}
function clearTerritoryDraft(){
 drawArea=null;areaGesture=null;editingTerritoryId=null;showTerritoryDraft();draw();
}
function startEditingTerritoryOnMap(id){
 const territory=state.territories.find(t=>t.id===id);
 if(!territory)return inform('Territory no longer exists',true);
 activeAlliance=territory.allianceId;
 selected=null;updateDynamic();
 $('alliance').value=activeAlliance;
 $('territory-name').value=territory.name;
 $('territory-gap').value=String(territory.gap);
 editingTerritoryId=id;
 drawArea={x1:territory.x1,x2:territory.x2,y1:territory.y1,y2:territory.y2};
 syncTerritoryFields(drawArea);
 tool='territory';hoverCell=null;
 document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
 focusTerritory(territory);
 inform('Editing '+territory.name+'. Move or resize the highlighted rectangle, then Save changes. Cancel leaves the saved territory untouched.');
}
function focusTerritory(t,scrollToMap=true){
 if(!t)return;
 view.x=(t.x1+t.x2)/2;view.y=(t.y1+t.y2)/2;
 const w=canvas?.clientWidth||800,h=canvas?.clientHeight||450;
 view.scale=clamp(Math.min(w/(t.x2-t.x1+24),h/(t.y2-t.y1+24)),1.2,70);
 draw();
 if(scrollToMap)$('map-canvas').scrollIntoView({behavior:'smooth',block:'center'});
}
function openTerritory(id,scroll=true){
 const t=state.territories.find(x=>x.id===id);if(!t)return;
 selected={kind:'territory',id:t.id};
 renderSelection();focusTerritory(t,false);
 if(scroll)$('selection').scrollIntoView({behavior:'smooth',block:'start'});
}
function addTerritory(){
 const a=alliance(),bounds=territoryFieldBounds(),gap=number('territory-gap');
 const current=editingTerritoryId?state.territories.find(t=>t.id===editingTerritoryId):null;
 if(editingTerritoryId&&!current)return inform('This saved territory is no longer available. Cancel editing before creating a new one.',true);
 const name=$('territory-name').value.trim()||
  (current?.name||a.name+' section '+(state.territories.filter(t=>t.allianceId===a.id).length+1));
 if(!bounds||![0,1,2].includes(gap))return inform('Please use valid X/Y bounds and base spacing.',true);
 const next=clone(state),saved=current?next.territories.find(t=>t.id===current.id):{
  id:uid(),allianceId:a.id,priority:next.territories.filter(t=>t.allianceId===a.id).length
 };
 Object.assign(saved,{name:name.slice(0,65),...bounds,gap});
 if(!current)next.territories.push(saved);
 commit(next,(current?'Updated':'Added')+' '+nameFor(saved.allianceId)+' territory '+name).then(ok=>{
  if(ok){
   drawArea=null;areaGesture=null;editingTerritoryId=null;showTerritoryDraft();
   selected={kind:'territory',id:saved.id};
   renderSelection();focusTerritory(saved,false);
  }
 });
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
  const gap=number('suggest-gap');
  preview=proposeBases(state,{allianceId:activeAlliance,region,count:number('suggest-count'),gap,strategy:$('suggest-strategy').value,packing:$('suggest-packing').value});
  $('approve').disabled=!preview.length;
  const grid=packingGrid(state,{allianceId:activeAlliance,region,gap});
  $('preview-info').textContent=preview.length+' suggested shield-safe positions (preview only). '+
   (grid.alignedToExisting?'Rows aligned with nearby existing bases. ':'No nearby bases to align with. ')+
   gap+' empty cell'+(gap===1?'':'s')+' is the target between adjacent bases; obstacles or skipped spaces may produce larger gaps.';
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
  const t=OBJECTS[o.type],isCity=o.type==='city';
  box.innerHTML='<h2>'+esc(isCity?cityLabel(o):t.label)+' · '+t.w+'×'+t.h+'</h2><div class="fields">'+
  '<div class="field"><label>Center X</label><input id="edit-x" type="number" value="'+o.x+'"></div><div class="field"><label>Center Y</label><input id="edit-y" type="number" value="'+o.y+'"></div>'+
  (isCity?'<div class="field wide"><label>City name</label><input id="edit-city-name" maxlength="70" value="'+esc(o.name||'City')+'"></div>'+
   '<div class="field"><label>City level</label><select id="edit-city-level">'+Array.from({length:10},(_,i)=>'<option value="'+(i+1)+'" '+((i+1)===(o.level||1)?'selected':'')+'>L'+(i+1)+'</option>').join('')+'</select></div>'+
   '<div class="field"><label>Owning alliance</label><select id="edit-city-owner"><option value="">Unassigned</option>'+state.alliances.map(a=>'<option value="'+esc(a.id)+'" '+(a.id===o.ownerAllianceId?'selected':'')+'>'+esc(a.name)+'</option>').join('')+'</select></div>':'')+
  '</div>'+
  '<div class="actions"><button id="save-selected" class="btn primary">Move object</button><button id="delete-selected" class="btn danger">Remove object</button></div>';
 }else{
  box.innerHTML='<h2>'+esc(nameFor(o.allianceId))+' · '+esc(o.name)+'</h2><div class="fields"><div class="field wide"><label>Section name</label><input id="edit-name" value="'+esc(o.name)+'"></div>'+
  ['x1','x2','y1','y2'].map(k=>'<div class="field"><label>'+k.toUpperCase()+'</label><input id="edit-'+k+'" type="number" value="'+o[k]+'"></div>').join('')+
  '<div class="field wide"><label>Gap between bases</label><select id="edit-territory-gap">'+[0,1,2].map(n=>'<option value="'+n+'" '+(n===o.gap?'selected':'')+'>'+n+' cell'+(n===1?'':'s')+'</option>').join('')+'</select></div></div>'+
  '<p class="muted">Priority '+(o.priority+1)+' · Existing bases will not move when you edit this territory.</p>'+
  '<div class="actions"><button id="save-selected" class="btn primary">Save territory changes</button><button id="edit-territory-map" class="btn">Resize on map</button><button id="focus-selected-territory" class="btn">Locate on map</button><button id="delete-selected" class="btn danger">Delete section</button></div>';
 }
 $('save-selected').onclick=saveSelected;$('delete-selected').onclick=deleteSelected;
 if(selected.kind==='territory'){
  $('focus-selected-territory').onclick=()=>focusTerritory(o);
  $('edit-territory-map').onclick=()=>startEditingTerritoryOnMap(o.id);
 }
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
  if(item.type==='city'){
   item.name=$('edit-city-name').value.trim().slice(0,70)||'City';
   item.level=number('edit-city-level');
   item.ownerAllianceId=$('edit-city-owner').value||null;
   if(!Number.isInteger(item.level)||item.level<1||item.level>10)return inform('Invalid city level',true);
  }
  const block=obstacleCollision(item,next,item.id);if(block)return inform('Blocked: overlaps '+block,true);
 }else{
  item.name=$('edit-name').value.trim().slice(0,65);for(const k of ['x1','x2','y1','y2'])item[k]=number('edit-'+k);
  item.gap=number('edit-territory-gap');
  if(!item.name||!['x1','x2','y1','y2'].every(k=>valid(item[k]))||item.x1>item.x2||item.y1>item.y2||![0,1,2].includes(item.gap))return inform('Invalid territory bounds',true);
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
 const projection={x:cx,y:cy,width:w,height:h,scale};
 const sx=x=>mapToPixel(x,cy,projection).x,sy=y=>mapToPixel(cx,y,projection).y;
 const rxy=r=>screenFootprint(r,projection);
 // Game-style olive field. At low zoom, hide tiny cell boundaries to avoid noise.
 ctx.fillStyle='#4c5a3c';ctx.fillRect(0,0,w,h);
 const xl=Math.floor(cx-w/(2*scale)),xr=Math.ceil(cx+w/(2*scale)),yt=Math.floor(cy-h/(2*scale)),yb=Math.ceil(cy+h/(2*scale));
 if(showGrid&&scale>=4.5){
  const minor=scale>=9;
  ctx.lineWidth=.65;
  for(let x=Math.max(0,xl);x<=Math.min(2000,xr);x++){
   const major=((x%3)+3)%3===0;
   if(!major&&!minor)continue;
   ctx.strokeStyle=major?'rgba(249,232,177,.22)':'rgba(249,232,177,.085)';
   const px=sx(x-.5);ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px,h);ctx.stroke();
  }
  for(let y=Math.max(0,yt);y<=Math.min(2000,yb);y++){
   const major=((y%3)+3)%3===0;
   if(!major&&!minor)continue;
   ctx.strokeStyle=major?'rgba(249,232,177,.22)':'rgba(249,232,177,.085)';
   const py=sy(y+.5);ctx.beginPath();ctx.moveTo(0,py);ctx.lineTo(w,py);ctx.stroke();
  }
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
  if(o.type==='city'){
   const owner=o.ownerAllianceId?nameFor(o.ownerAllianceId):'';
   ctx.globalAlpha=.78;ctx.fillStyle=o.ownerAllianceId?colorFor(o.ownerAllianceId):'#bb9255';ctx.fillRect(...p);ctx.globalAlpha=1;
   ctx.strokeStyle='#ffe2a6';ctx.lineWidth=2;ctx.strokeRect(...p);
   // Keep names and levels readable even when the actual 7x7 square is small.
   const title=cityLabel(o),detail=owner?title+' ['+owner+']':title;
   ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
   const ty=p[1]+Math.max(10,Math.min(p[3]/2,20));
   const bw=Math.min(w-8,220,Math.max(60,ctx.measureText(detail).width+16));
   const tx=clamp(p[0]+p[2]/2,bw/2+4,w-bw/2-4);
   ctx.fillStyle='rgba(18,36,25,.9)';ctx.fillRect(tx-bw/2,ty-11,bw,23);
   ctx.strokeStyle='rgba(255,229,164,.75)';ctx.lineWidth=1;ctx.strokeRect(tx-bw/2,ty-11,bw,23);
   ctx.fillStyle='#fff0c9';ctx.fillText(detail,tx,ty,bw-10);
   ctx.textAlign='left';ctx.textBaseline='alphabetic';
  }else{
   ctx.fillStyle=['siege','charge'].includes(o.type)?'#bba353':'#8d7753';ctx.fillRect(...p);
   ctx.strokeStyle='#e6c08c';ctx.lineWidth=1.3;ctx.strokeRect(...p);
   if(scale>=6){ctx.fillStyle='#1e261b';ctx.font='bold '+clamp(Math.min(p[2],p[3])*.22,8,15)+'px system-ui';ctx.textAlign='center';ctx.fillText(t.label.split(' ')[0],p[0]+p[2]/2,p[1]+p[3]/2);ctx.textAlign='left';}
  }
 }
 const compactAllianceView=exportKind==='screen'&&scale<4.5&&!dragMove;
 if(compactAllianceView){
  // At an overview zoom, replace the tiny bases with one coloured occupied
  // region per connected alliance group. These are not new saved territories.
  const labels=[];
  const renderCluster=(cluster,draft=false)=>{
   const p=rxy(cluster.bounds),color=colorFor(cluster.allianceId);
   ctx.globalAlpha=draft?.32:.86;ctx.fillStyle=color;ctx.fillRect(...p);ctx.globalAlpha=1;
   ctx.lineWidth=draft?2.3:2;ctx.strokeStyle=draft?'#fff1c2':color;
   if(draft)ctx.setLineDash([5,4]);
   ctx.strokeRect(...p);ctx.setLineDash([]);
   const label=nameFor(cluster.allianceId)+(draft?' · PREVIEW':'');
   ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
   const bw=Math.min(Math.max(48,ctx.measureText(label).width+18),w-8);
   const cx=clamp(p[0]+p[2]/2,bw/2+4,w-bw/2-4);
   const desired=clamp(p[1]+p[3]/2,14,h-14);
   let cy=desired;
   const candidates=[0,-27,27,-54,54,-81,81];
   for(const delta of candidates){
    const y=clamp(desired+delta,14,h-14);
    const box={l:cx-bw/2,r:cx+bw/2,t:y-12,b:y+12};
    if(!labels.some(v=>box.l<v.r+4&&box.r>v.l-4&&box.t<v.b+4&&box.b>v.t-4)){cy=y;break;}
   }
   labels.push({l:cx-bw/2,r:cx+bw/2,t:cy-12,b:cy+12});
   ctx.globalAlpha=.94;ctx.fillStyle=color;ctx.fillRect(cx-bw/2,cy-12,bw,24);ctx.globalAlpha=1;
   ctx.strokeStyle='#f8ebd1';ctx.lineWidth=1.1;ctx.strokeRect(cx-bw/2,cy-12,bw,24);
   ctx.fillStyle='#fff';ctx.shadowColor='rgba(0,0,0,.85)';ctx.shadowBlur=3;
   ctx.fillText(label,cx,cy,bw-9);ctx.shadowBlur=0;
   ctx.textAlign='left';ctx.textBaseline='alphabetic';
  };
  for(const cluster of allianceBaseClusters(state))renderCluster(cluster);
  for(const cluster of allianceBaseClusters(state,preview))renderCluster(cluster,true);
 }else{
 const useNumbers=exportKind==='detailed';
 for(const b of state.bases){
  if(exportKind==='screen'&&dragMove?.id===b.id)continue;
  const p=rxy(footprint(b,state)),c=colorFor(b.allianceId);
  ctx.fillStyle=c;ctx.fillRect(...p);ctx.strokeStyle='#e3ead8';ctx.lineWidth=1;ctx.strokeRect(...p);
  // Three subdivided cells in both directions, aligned to the real 3x3 footprint.
  if(scale>=9){
   ctx.strokeStyle='rgba(255,255,255,.23)';ctx.lineWidth=.65;
   for(let k=1;k<3;k++){
    ctx.beginPath();ctx.moveTo(p[0]+k*scale,p[1]);ctx.lineTo(p[0]+k*scale,p[1]+p[3]);ctx.stroke();
    ctx.beginPath();ctx.moveTo(p[0],p[1]+k*scale);ctx.lineTo(p[0]+p[2],p[1]+k*scale);ctx.stroke();
   }
  }
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
 }
 // Show original footprint and a cell-snapped draft while long-press dragging.
 // Exported images do not include the transient draft.
 if(exportKind==='screen'&&dragMove){
  const original=state.bases.find(b=>b.id===dragMove.id);
  if(original){
   const oldRect=rxy(footprint(original,state));
   ctx.fillStyle='rgba(236,238,220,.12)';ctx.fillRect(...oldRect);
   ctx.setLineDash([5,5]);ctx.lineWidth=1.5;ctx.strokeStyle='rgba(246,249,220,.8)';ctx.strokeRect(...oldRect);ctx.setLineDash([]);
  }
  if(dragMove.check.candidate){
   const rect3=rxy(footprint(dragMove.check.candidate,state));
   const blocked=dragMove.check.hard.length>0,warning=dragMove.check.warnings.length>0;
   ctx.fillStyle=blocked?'rgba(246,70,67,.6)':warning?'rgba(241,174,57,.55)':'rgba(116,236,118,.58)';
   ctx.fillRect(...rect3);
   ctx.lineWidth=2.5;ctx.strokeStyle=blocked?'#ff8b87':warning?'#ffd47b':'#c7ffbe';ctx.strokeRect(...rect3);
   if(scale>=7){
    const cell=rect3[2]/3;
    ctx.lineWidth=.75;ctx.strokeStyle='rgba(255,255,255,.4)';
    for(let j=1;j<3;j++){
     ctx.beginPath();ctx.moveTo(rect3[0]+j*cell,rect3[1]);ctx.lineTo(rect3[0]+j*cell,rect3[1]+rect3[3]);ctx.stroke();
     ctx.beginPath();ctx.moveTo(rect3[0],rect3[1]+j*cell);ctx.lineTo(rect3[0]+rect3[2],rect3[1]+j*cell);ctx.stroke();
    }
   }
  }
 }
 if(exportKind==='screen'&&hoverCell&&['base','city','obstacle'].includes(tool)){
  const type=tool==='base'?'base':tool==='city'?'city':$('obstacle-type').value;
  const temp={type,x:hoverCell.x,y:hoverCell.y,allianceId:activeAlliance,id:'hover'};
  const r=footprint(temp,state),p=rxy(r);
  const blocked=tool==='base'?inspectPlacement(temp,state).hard.length>0:!!obstacleCollision(temp,state);
  const mud=tool==='base'&&!blocked?inspectPlacement(temp,state).mud:0;
  const fill=blocked?'rgba(249,83,80,.65)':mud>3?'rgba(242,170,59,.62)':'rgba(117,226,89,.58)';
  const line=blocked?'#ff8680':mud>3?'#ffd16c':'#baff9b';
  ctx.fillStyle=fill;
  const cw=p[2]/OBJECTS[type].w,ch=p[3]/OBJECTS[type].h;
  for(let i=0;i<OBJECTS[type].w;i++)for(let j=0;j<OBJECTS[type].h;j++){
   const bx=p[0]+i*cw,by=p[1]+j*ch;
   ctx.fillRect(bx+Math.min(1,cw*.08),by+Math.min(1,ch*.08),Math.max(0,cw-2),Math.max(0,ch-2));
  }
  ctx.strokeStyle=line;ctx.lineWidth=2.5;ctx.strokeRect(...p);
 }
 if(exportKind==='screen'&&drawArea){
  const r={left:drawArea.x1,right:drawArea.x2,top:drawArea.y1,bottom:drawArea.y2};
  const p=rxy(r);
  ctx.fillStyle='rgba(255,217,107,.23)';ctx.fillRect(...p);
  ctx.strokeStyle='#ffed93';ctx.lineWidth=3;ctx.setLineDash([10,4]);ctx.strokeRect(...p);ctx.setLineDash([]);
  const corners=[['nw',r.left,r.bottom],['ne',r.right,r.bottom],['sw',r.left,r.top],['se',r.right,r.top]];
  for(const [,x,y] of corners){
   const q=mapToPixel(x,y,projection);
   ctx.beginPath();ctx.arc(q.x,q.y,8,0,Math.PI*2);
   ctx.fillStyle='#fff3ba';ctx.fill();ctx.strokeStyle='#78520a';ctx.lineWidth=2;ctx.stroke();
  }
  const label='UNSAVED TERRITORY · '+nameFor(activeAlliance);
  ctx.font='bold 12px system-ui';const textW=Math.min(w-14,Math.max(96,ctx.measureText(label).width+16));
  const labelX=clamp(p[0],6,Math.max(6,w-textW-6)),labelY=clamp(p[1]-25,4,Math.max(4,h-24));
  ctx.fillStyle='rgba(79,54,16,.96)';ctx.fillRect(labelX,labelY,textW,24);
  ctx.fillStyle='#fff3bd';ctx.fillText(label,labelX+7,labelY+16,textW-10);
 }
 if(selected&&!dragMove){
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
 $('overview-mode-note').hidden=!(view.scale<4.5&&!dragMove);
 $('map-coordinate').textContent=dragMove
  ?'Moving base to X '+dragMove.x+' · Y '+dragMove.y+
   (dragMove.check.hard.length?' · BLOCKED':dragMove.check.warnings.length?' · WARNING':' · Valid')
  :hoverCell&&['base','city','obstacle'].includes(tool)
   ?'Preview '+(tool==='city'?'City':tool==='base'?'3×3 Base':OBJECTS[$('obstacle-type').value]?.label||'Object')+' · X '+hoverCell.x+' · Y '+hoverCell.y
   :'Center X '+Math.round(view.x)+' · Y '+Math.round(view.y)+' · '+view.scale.toFixed(1)+' px/cell';
}
function fitMap(all=false){
 if(!state)return;
 const b=boundsOfState(state,{zones:!all,territories:true});
 view.x=(b.left+b.right)/2;view.y=(b.top+b.bottom)/2;
 const w=canvas?.clientWidth||800,h=canvas?.clientHeight||450;
 view.scale=clamp(Math.min(w/(b.right-b.left+24),h/(b.bottom-b.top+24)),1.2,45);
 draw();
}
function localPoint(clientX,clientY){
 const r=canvas.getBoundingClientRect();
 return {
  x:(clientX-r.left)*(width/(r.width||width)),
  y:(clientY-r.top)*(height/(r.height||height))
 };
}
function eventCell(e){
 const p=localPoint(e.clientX,e.clientY);
 const point=pixelToMap(p.x,p.y,{...view,width,height});
 return {x:Math.round(point.x),y:Math.round(point.y)};
}
function gesturePair(){
 if(!pinchGesture)return null;
 const a=touchPoints.get(pinchGesture.ids[0]),b=touchPoints.get(pinchGesture.ids[1]);
 if(!a||!b)return null;
 const one=localPoint(a.x,a.y),two=localPoint(b.x,b.y);
 return {mid:{x:(one.x+two.x)/2,y:(one.y+two.y)/2},dist:Math.hypot(one.x-two.x,one.y-two.y)};
}
function beginPinchGesture(){
 clearPressTimer();
 if(areaGesture){
  drawArea=areaGesture.previous;
  editingTerritoryId=areaGesture.previousEditingId;
  areaGesture=null;
  showTerritoryDraft();
 }
 pointer=null;dragMove=null;hoverCell=null;
 ignoreTouchUntilRelease=true;
 const ids=Array.from(touchPoints.keys()).slice(0,2);
 pinchGesture={ids,initial:null,startView:{...view}};
 const pair=gesturePair();
 if(!pair){pinchGesture=null;return;}
 pinchGesture.initial=pair;
 inform('Two fingers: slide to move the map, pinch to zoom.');
 draw();
}
function updatePinchGesture(){
 if(!pinchGesture)return false;
 const pair=gesturePair();
 if(!pair)return false;
 const start=pinchGesture.initial;
 view=pinchCamera(pinchGesture.startView,start.mid,pair.mid,
  start.dist>1?pair.dist/start.dist:1,width,height);
 draw();
 return true;
}
function pick(x,y){
 const b=[...state.bases].reverse().find(o=>contains(footprint(o,state),x,y));
 if(b)return {kind:'base',id:b.id};
 const o=[...state.obstacles].reverse().find(o=>contains(footprint(o,state),x,y));
 if(o)return {kind:'obstacle',id:o.id};
 const t=[...state.territories].reverse().find(o=>x>=o.x1&&x<=o.x2&&y>=o.y1&&y<=o.y2);
 return t?{kind:'territory',id:t.id}:null;
}
function chooseTerritoryAction(point,isTouch=false){
 if(!drawArea)return {mode:'new'};
 const projection={...view,width,height},t=drawArea;
 const corners=[
  {mode:'nw',x:t.x1,y:t.y2},{mode:'ne',x:t.x2,y:t.y2},
  {mode:'sw',x:t.x1,y:t.y1},{mode:'se',x:t.x2,y:t.y1}
 ];
 const local=mapToPixel(point.x,point.y,projection);
 const tolerancePx=isTouch?23:13;
 let best=null,min=Infinity;
 for(const c of corners){
  const dist=Math.hypot(local.x-mapToPixel(c.x,c.y,projection).x,local.y-mapToPixel(c.x,c.y,projection).y);
  if(dist<min){min=dist;best=c;}
 }
 if(min<=tolerancePx)return {mode:best.mode};
 if(point.x>=t.x1&&point.x<=t.x2&&point.y>=t.y1&&point.y<=t.y2)return {mode:'move'};
 return {mode:'new'};
}
function updateAreaGesture(point){
 if(!areaGesture)return;
 const {mode,initial,original}=areaGesture;
 if(mode==='new')drawArea=territoryBoundsFromCorners(initial,point);
 else if(mode==='move')drawArea=moveTerritoryBounds(original,point.x-initial.x,point.y-initial.y);
 else drawArea=resizeTerritoryBounds(original,mode,point.x,point.y);
 showTerritoryDraft();draw();
}
function cancelAreaGesture(){
 if(areaGesture){
  drawArea=areaGesture.previous;
  editingTerritoryId=areaGesture.previousEditingId;
  areaGesture=null;
  showTerritoryDraft();
 }
}
function handleMapTap(x,y){
 if(!valid(x)||!valid(y))return;
 $('coord-x').value=x;$('coord-y').value=y;
 if(tool==='base')createBase(x,y);
 else if(tool==='obstacle')createObstacle(x,y,$('obstacle-type').value);
 else if(tool==='city')createCity(x,y);
 else {selected=pick(x,y);renderSelection();draw();}
}
function releaseHeldBase(move){
 const base=state.bases.find(b=>b.id===move.id);
 if(!base)return inform('This base no longer exists. No changes were made.',true);
 if(base.x===move.x&&base.y===move.y){inform('Base selected. Its position is unchanged.');return;}
 const check=inspectBaseMove(state,move.id,move.x,move.y);
 if(check.hard.length)return inform('Cannot move base: '+check.hard.join(', '),true);
 if(check.warnings.length&&!confirm('Move base to ('+move.x+', '+move.y+')?\n\n'+check.warnings.join('\n')+'\n\nMove anyway?')){
  inform('Move cancelled. The original position was kept.');
  return;
 }
 const next=clone(state),record=next.bases.find(b=>b.id===move.id);
 if(!record)return inform('Base record no longer exists',true);
 const oldX=record.x,oldY=record.y;
 record.x=move.x;record.y=move.y;
 // Preserve id, number, member name, alliance and manual section assignment.
 // Server-side revision checks prevent overwriting another R4's edits.
 commit(next,'Moved '+nameFor(record.allianceId)+' base #'+(record.number||'?')+
  ' from ('+oldX+','+oldY+') to ('+record.x+','+record.y+')');
}
function clearPressTimer(){
 if(pointer?.holdTimer!==null&&pointer?.holdTimer!==undefined){
  clearTimeout(pointer.holdTimer);pointer.holdTimer=null;
 }
}
function attachCanvas(){
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.addEventListener('pointerdown',e=>{
  if(!state||busy)return;
  if(e.pointerType==='touch'){
   touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});
   try{canvas.setPointerCapture(e.pointerId);}catch{}
   if(touchPoints.size>=2){
    if(!pinchGesture)beginPinchGesture();
    return;
   }
   if(ignoreTouchUntilRelease)return;
  }
  if(pointer||e.isPrimary===false||e.button!==0)return;
  if(e.pointerType!=='touch')canvas.setPointerCapture(e.pointerId);
  const initial=eventCell(e);
  pointer={id:e.pointerId,x:e.clientX,y:e.clientY,originX:view.x,originY:view.y,cell:initial,moved:false,holdTimer:null};
  hoverCell=['base','city','obstacle'].includes(tool)?initial:null;
  if(tool==='select'){
   const hit=pick(initial.x,initial.y);
   if(hit?.kind==='base'){
    pointer.holdBaseId=hit.id;
    const pressId=e.pointerId;
    pointer.holdTimer=setTimeout(()=>{
     if(!pointer||pointer.id!==pressId||pointer.moved||busy||touchPoints.size>1)return;
     pointer.holdTimer=null;
     const original=state.bases.find(b=>b.id===hit.id);
     if(!original)return;
     selected={kind:'base',id:original.id};
     renderSelection();
     if(original.locked){
      inform('This base is locked. Unlock it in the Selected item panel before dragging.',true);
      return;
     }
     dragMove={id:original.id,initialX:original.x,initialY:original.y,x:original.x,y:original.y,check:inspectBaseMove(state,original.id,original.x,original.y)};
     hoverCell=null;
     inform('Base picked up. Drag to a new grid location, then release to move. Red is blocked, orange requires approval.');
     draw();
    },LONG_PRESS_MS);
   }
  }
  if(tool==='territory'){
   const action=chooseTerritoryAction(initial,e.pointerType==='touch');
   areaGesture={mode:action.mode,initial,original:drawArea?{...drawArea}:null,previous:drawArea?{...drawArea}:null,previousEditingId:editingTerritoryId};
   if(action.mode==='new'){
    drawArea=territoryBoundsFromCorners(initial,initial);
    editingTerritoryId=null;
   }
   showTerritoryDraft();
  }
  draw();
 });
 canvas.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'&&touchPoints.has(e.pointerId)){
   touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(pinchGesture){updatePinchGesture();return;}
   if(ignoreTouchUntilRelease)return;
  }
  if(!pointer||e.pointerId!==pointer.id){
   if(!pointer&&e.pointerType!=='touch'&&['base','city','obstacle'].includes(tool)){
    const cell=eventCell(e);
    if(!hoverCell||cell.x!==hoverCell.x||cell.y!==hoverCell.y){hoverCell=cell;draw();}
   }
   return;
  }
  const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
  if(Math.hypot(dx,dy)>LONG_PRESS_SLOP_PX){
   pointer.moved=true;
   if(!dragMove)clearPressTimer();
  }
  if(dragMove){
   // Finger maintains the same offset inside the base while it moves.
   const cell=eventCell(e);
   const x=dragMove.initialX+cell.x-pointer.cell.x;
   const y=dragMove.initialY+cell.y-pointer.cell.y;
   if(Number.isInteger(x)&&Number.isInteger(y)&&(dragMove.x!==x||dragMove.y!==y)){
    dragMove.x=x;dragMove.y=y;
    dragMove.check=inspectBaseMove(state,dragMove.id,x,y);
    draw();
   }
  }else if(tool==='territory'&&areaGesture){
   updateAreaGesture(eventCell(e));
  }else if(pointer.moved){
   hoverCell=null;
   view.x=pointer.originX-dx/view.scale;view.y=pointer.originY+dy/view.scale;draw();
  }else if(hoverCell){hoverCell=eventCell(e);draw();}
 });
 canvas.addEventListener('pointerup',e=>{
  if(e.pointerType==='touch'){
   touchPoints.delete(e.pointerId);
   if(pinchGesture||ignoreTouchUntilRelease){
    pinchGesture=null;
    if(touchPoints.size===0)ignoreTouchUntilRelease=false;
    hoverCell=null;draw();
    return;
   }
  }
  if(!pointer||e.pointerId!==pointer.id)return;
  clearPressTimer();
  const wasMoving=dragMove,hadMoved=pointer.moved;
  if(wasMoving){
   const c=eventCell(e);
   wasMoving.x=wasMoving.initialX+c.x-pointer.cell.x;
   wasMoving.y=wasMoving.initialY+c.y-pointer.cell.y;
   pointer=null;dragMove=null;hoverCell=null;
   draw();releaseHeldBase(wasMoving);return;
  }
  if(tool==='territory'&&areaGesture){
   updateAreaGesture(eventCell(e));
   areaGesture=null;
   if(drawArea){
    syncTerritoryFields(drawArea);
    inform('Territory draft is still visible. Drag its corners or edit coordinates, then tap Save territory.');
   }
  }else if(!hadMoved){
   const cell=eventCell(e);handleMapTap(cell.x,cell.y);
  }
  pointer=null;hoverCell=null;draw();
 });
 canvas.addEventListener('pointercancel',e=>{
  if(e.pointerType==='touch'){
   touchPoints.delete(e.pointerId);
   if(pinchGesture||ignoreTouchUntilRelease){
    pinchGesture=null;
    if(touchPoints.size===0)ignoreTouchUntilRelease=false;
    draw();return;
   }
  }
  clearPressTimer();cancelAreaGesture();pointer=null;dragMove=null;hoverCell=null;draw();
 });
 canvas.addEventListener('lostpointercapture',e=>{
  // Browser/OS interruption: abandon any pending single-finger placement.
  if(e.pointerType==='touch'&&touchPoints.has(e.pointerId)){
   touchPoints.delete(e.pointerId);
   pinchGesture=null;
   ignoreTouchUntilRelease=touchPoints.size>0;
  }
  if(pointer?.id===e.pointerId){
   clearPressTimer();cancelAreaGesture();pointer=null;dragMove=null;hoverCell=null;draw();
  }
 });
 canvas.addEventListener('pointerleave',()=>{if(!pointer&&!pinchGesture){hoverCell=null;draw();}});
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
 context.font='14px system-ui';context.fillStyle='#c9d9c2';context.fillText('Warzone 1395 · X → east · Y ↑ north · Snapshot v'+revision,28,59);
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
  const py=top+((b.top+b.bottom)/2-y)*scale+innerH/2;
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
 $('test-coordinate').onclick=()=>{
  try{
   if(!state.capitolPlaced)throw Error('Set the Capitol center before calibrating its mud boundary.');
   const p=coord(),test={id:'calibration-preview',type:'base',x:p.x,y:p.y,allianceId:activeAlliance,locked:false};
   const r=footprint(test,state),result=inspectPlacement(test,state);
   $('calibration-result').textContent='Test base center ('+p.x+', '+p.y+'): X '+r.left+'–'+r.right+', Y '+r.top+'–'+r.bottom+'. Predicted mud overlap: '+result.mud+'/9 cells. '+(result.mud>3?'Over the provisional shielding allowance.':'Within the provisional 3-cell allowance.')+(result.hard.length?' Placement blocked by '+result.hard.join(', ')+'.':'')+' Compare this result with the actual game before marking calibration tested.';
   view.x=p.x;view.y=p.y;view.scale=clamp(Math.max(view.scale,15),1,70);draw();
  }catch(e){inform(e.message,true);}
 };
 $('set-capitol').onclick=()=>{try{const c=coord();const next=clone(state);next.center=c;next.capitolPlaced=true;next.calibration.verified=false;commit(next,'Set Capitol center '+c.x+','+c.y);}catch(e){inform(e.message,true)}};
 $('save-calibration').onclick=()=>{const next=clone(state);next.calibration={evenX:$('even-x').value,evenY:$('even-y').value,verified:false};commit(next,'Adjusted even-sized object anchor convention');};
 $('verify-calibration').onclick=()=>{if(!confirm('Have you compared the planner against real in-game edge coordinates?'))return;const next=clone(state);next.calibration.verified=true;commit(next,'Marked coordinate calibration tested in game');};
 $('alliance').onchange=e=>{activeAlliance=e.target.value;preview=[];updateDynamic();draw();};
 $('add-alliance').onclick=()=>{
  const name=$('new-alliance').value.trim().slice(0,28),id=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  if(!id||state.alliances.some(a=>a.id===id||a.name.toLowerCase()===name.toLowerCase()))return inform('Enter a unique alliance name',true);
  const next=clone(state);next.alliances.push({id,name,color:$('alliance-color').value});
  commit(next,'Added alliance '+name).then(ok=>{if(ok){activeAlliance=id;updateDynamic();}});
 };
 $('rename-alliance').onclick=renameAlliance;
 $('delete-alliance').onclick=deleteAlliance;
 $('base-gap').onchange=e=>{const next=clone(state);next.settings.spacing=Number(e.target.value);commit(next,'Set preferred base gap to '+e.target.value+' cells');};
 $('show-names').onchange=e=>{showNames=e.target.value;draw();};
 $('place-base').onclick=()=>{try{const c=coord();createBase(c.x,c.y);}catch(e){inform(e.message,true)}};
 $('place-obstacle').onclick=()=>{try{const c=coord();createObstacle(c.x,c.y,$('obstacle-type').value);}catch(e){inform(e.message,true)}};
 $('place-city').onclick=()=>{try{const c=coord();createCity(c.x,c.y);}catch(e){inform(e.message,true)}};
 $('obstacle-type').onchange=e=>{$('obstacle-type').dataset.chosen=e.target.value;};
 $('bulk-preview').onclick=bulkAdd;
 $('add-territory').onclick=addTerritory;
 $('draft-save').onclick=addTerritory;
 $('draft-edit').onclick=()=>{$('territory-name').scrollIntoView({behavior:'smooth',block:'center'});$('territory-name').focus();};
 $('draft-clear').onclick=clearTerritoryDraft;
 $('clear-territory-draft').onclick=clearTerritoryDraft;
 for(const field of ['x1','x2','y1','y2']){
  $(field).addEventListener('input',()=>{
   if(!drawArea||areaGesture)return;
   const bounds=territoryFieldBounds();
   if(bounds){drawArea=bounds;showTerritoryDraft();draw();}
  });
 }
 $('suggest').onclick=generateSuggestions;$('approve').onclick=approveSuggestions;
 $('discard').onclick=()=>{preview=[];$('approve').disabled=true;$('preview-info').textContent='Preview cleared.';draw();};
 for(const b of document.querySelectorAll('[data-tool]'))b.onclick=()=>{
  tool=b.dataset.tool;hoverCell=null;
  document.querySelectorAll('[data-tool]').forEach(x=>x.classList.toggle('active',x.dataset.tool===tool));
  inform(tool==='territory'
  ?'Draw or edit a highlighted territory. Drag corners to resize, drag inside to move, or draw outside for a new section.'
  :'Tool: '+b.textContent+'. Drag to pan unless drawing a territory.');
  draw();
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
 setInterval(async()=>{if(busy||polling||pointer?.holdBaseId||dragMove||pinchGesture||touchPoints.size>0||document.visibilityState==='hidden')return;polling=true;try{const was=revision;const changed=await fetchData(false,false);if(changed&&was!==revision)inform('Shared map updated by another R4. Revision '+revision);}catch(e){sync('Offline · retrying');}finally{polling=false;}},5000);
}
start();
