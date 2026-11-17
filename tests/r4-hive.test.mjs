import test from 'node:test';
import assert from 'node:assert/strict';
import {OBJECTS,rect,footprint,zoneRects,inMud,inspectPlacement,proposeBases,sectionFor,occupiedBounds,cityLabel,mapToPixel,pixelToMap,screenFootprint,inspectBaseMove,pinchCamera,territoryBoundsFromCorners,moveTerritoryBounds,resizeTerritoryBounds,allianceBaseClusters,allianceUsage} from '../assets/hive-geometry.js';
import {GET as hiveGet,POST as hivePost,validateState} from '../lib/r4-hive-handler.mjs';
const make=()=>({center:{x:499,y:499},capitolPlaced:true,calibration:{evenX:'negative',evenY:'negative',verified:false},alliances:[{id:'utw',name:'UTW',color:'#3478c0'}],territories:[],obstacles:[],bases:[],settings:{spacing:1,showNames:'auto'}});
const base=(id,x,y)=>({id,type:'base',x,y,allianceId:'utw',memberName:'',locked:false,sectionOverride:null});
test('Odd footprints center on the provided coordinate',()=>{
 const state=make();
 assert.deepEqual(footprint(base('a',499,499),state),{left:498,right:500,top:498,bottom:500});
 assert.deepEqual(rect(499,499,21,21,state.calibration),{left:489,right:509,top:489,bottom:509});
});
test('Even-size zones shift by one cell when choosing the opposite calibrated side',()=>{
 const state=make();
 const zone=zoneRects(state)[0];
 assert.equal(zone.left,449);assert.equal(zone.right,548);
 state.calibration.evenX='positive';state.calibration.evenY='positive';
 assert.equal(zoneRects(state)[0].left,450);
 assert.equal(zoneRects(state)[0].bottom,549);
});
test('One third mud overlap is a warning, more than one third remains warned',()=>{
 const state=make();
 assert.equal(inMud(base('edge',499,549),state),3);
 assert.equal(inMud(base('unsafe',499,548),state),6);
 assert.equal(inspectPlacement(base('edge',499,549),state).hard.length,0);
 assert.match(inspectPlacement(base('unsafe',499,548),state).warnings[0],/6 of 9/);
});
test('Physical obstacle collisions are hard blocks',()=>{
 const state=make();state.capitolPlaced=false;
 state.obstacles=[{id:'mine1',type:'mine',x:500,y:500}];
 assert.deepEqual(inspectPlacement(base('a',499,499),state).hard,['Resource Mine']);
});
test('Gap presets measure empty cells between three-by-three bases',()=>{
 const state=make();state.capitolPlaced=false;state.bases=[base('a',499,499)];
 assert.equal(inspectPlacement(base('b',502,499),state,{spacing:0}).hard.length,0);
 assert.equal(inspectPlacement(base('b',502,499),state,{spacing:1}).warnings.some(s=>s.includes('gap')),true);
 assert.equal(inspectPlacement(base('b',504,499),state,{spacing:1}).warnings.some(s=>s.includes('gap')),false);
});
test('Overlapping territory priorities and manual overrides are respected',()=>{
 const state=make();state.capitolPlaced=false;
 state.territories=[
 {id:'west',allianceId:'utw',name:'West',x1:0,x2:900,y1:0,y2:900,priority:2,gap:1},
 {id:'front',allianceId:'utw',name:'Front',x1:400,x2:600,y1:400,y2:600,priority:0,gap:0}
 ];
 const b=base('a',499,540);
 assert.equal(sectionFor(b,state).id,'front');
 b.sectionOverride='west';assert.equal(sectionFor(b,state).id,'west');
});
test('Smart suggestions remain within region and avoid mines',()=>{
 const state=make();state.capitolPlaced=false;
 state.obstacles=[{id:'mine',type:'mine',x:453,y:453}];
 const region={x1:450,x2:505,y1:450,y2:500};
 const draft=proposeBases(state,{allianceId:'utw',region,count:10,gap:2,strategy:'coverage',packing:'flex'});
 assert.equal(draft.length,10);
 for(const b of draft){assert.equal(inspectPlacement(b,state).hard.length,0);assert.ok(b.x>region.x1&&b.x<region.x2);assert.ok(b.y>region.y1&&b.y<region.y2);}
});
test('Occupied bounds use the complete 3x3 footprints',()=>{
 const state=make();state.capitolPlaced=false;state.bases=[base('a',550,540),base('b',560,550)];
 assert.deepEqual(occupiedBounds(state,'utw'),{left:549,right:561,top:539,bottom:551});
});
test('Hive API cannot be viewed or edited without R4 sign-in',async()=>{
 const baseUrl='https://example.test/api/r4-hive';
 const get=await hiveGet(new Request(baseUrl));
 assert.equal(get.status,303);
 const post=await hivePost(new Request(baseUrl,{method:'POST',headers:{origin:'https://example.test','Content-Type':'application/json'},body:'{}'}));
 assert.equal(post.status,401);
});


test('Named city displays its level and exact 7x7 footprint, plus 15x15 mud',()=>{
 const state=make();state.capitolPlaced=false;
 const city={id:'city1',type:'city',name:'Lawless Road',level:3,ownerAllianceId:'utw',x:550,y:540};
 state.obstacles.push(city);
 assert.equal(cityLabel(city),'L3 · Lawless Road');
 assert.deepEqual(footprint(city,state),{left:547,top:537,right:553,bottom:543});
 const zone=zoneRects(state)[0];
 assert.equal(zone.left,543);assert.equal(zone.right,557);
 assert.equal(zone.top,533);assert.equal(zone.bottom,547);
 assert.equal(validateState(state),'');
 assert.deepEqual(inspectPlacement(base('b',551,540),state).hard,['City']);
});
test('Legacy cities still display with fallback labels',()=>{
 const state=make();state.capitolPlaced=false;
 const city={id:'oldcity',type:'city',x:550,y:540};
 state.obstacles.push(city);
 assert.equal(cityLabel(city),'L? · City');
 assert.equal(validateState(state),'');
});
test('City editing metadata is validated without changing obstacles schema',()=>{
 const state=make();state.capitolPlaced=false;
 const city={id:'city2',type:'city',name:'Derby Grounds',level:4,ownerAllianceId:'utw',x:550,y:540};
 state.obstacles.push(city);
 assert.equal(validateState(state),'');
 city.level=11;assert.match(validateState(state),/Invalid city/);
 city.level=4;city.ownerAllianceId='unknown';assert.match(validateState(state),/Invalid city/);
 city.ownerAllianceId=null;city.name='a'.repeat(71);assert.match(validateState(state),/Invalid city/);
});

test('Last War Y increases upward, confirmed by 436/476, 436/479, 436/482 screenshots',()=>{
 const camera={x:436,y:479,width:600,height:600,scale:12};
 const p476=mapToPixel(436,476,camera);
 const p479=mapToPixel(436,479,camera);
 const p482=mapToPixel(436,482,camera);
 assert.equal(p476.x,p479.x);
 assert.equal(p479.x,p482.x);
 assert.equal(p476.y-p479.y,36);
 assert.equal(p479.y-p482.y,36);
 assert.equal(p482.y,264);
 assert.equal(p479.y,300);
 assert.equal(p476.y,336);
});
test('Touch-to-coordinate is the inverse of the displayed north-positive map',()=>{
 const camera={x:499,y:499,width:800,height:600,scale:11};
 for(const [x,y] of [[436,476],[436,479],[436,482],[550,540],[499,499]]){
  const pixel=mapToPixel(x,y,camera);
  const roundTrip=pixelToMap(pixel.x,pixel.y,camera);
  assert.equal(Math.round(roundTrip.x),x);
  assert.equal(Math.round(roundTrip.y),y);
 }
});
test('3x3 footprints occupy three square cells and remain north-positive',()=>{
 const camera={x:436,y:479,width:600,height:600,scale:12};
 const south=screenFootprint(footprint(base('south',436,476),make()),camera);
 const north=screenFootprint(footprint(base('north',436,479),make()),camera);
 assert.deepEqual(south,[282,318,36,36]);
 assert.deepEqual(north,[282,282,36,36]);
 assert.equal(north[1]+north[3],south[1]);
});
test('Even-sized mud and city outlines preserve positive screen height',()=>{
 const state=make();
 const camera={x:499,y:499,width:1200,height:800,scale:4};
 const mud=screenFootprint(zoneRects(state)[0],camera);
 assert.equal(mud[2],400);
 assert.equal(mud[3],400);
 assert.ok(mud[1]<mapToPixel(499,499,camera).y);
});

test('Long-press draft move preserves identity and reports clear placement',()=>{
 const state=make();state.capitolPlaced=false;
 state.bases=[{...base('tiny-base',436,476),memberName:'Tiny',number:7,allianceId:'utw',sectionOverride:null}];
 const result=inspectBaseMove(state,'tiny-base',436,479);
 assert.equal(result.hard.length,0);
 assert.equal(result.candidate.id,'tiny-base');
 assert.equal(result.candidate.memberName,'Tiny');
 assert.equal(result.candidate.number,7);
 assert.equal(result.candidate.x,436);
 assert.equal(result.candidate.y,479);
 assert.equal(state.bases[0].y,476,'preview must not mutate saved coordinates');
});
test('Long-press base move cannot overlap another base or a mine',()=>{
 const state=make();state.capitolPlaced=false;
 state.bases=[base('a',436,476),base('b',436,482)];
 assert.deepEqual(inspectBaseMove(state,'a',436,482).hard,['Another base']);
 state.obstacles.push({id:'mine',type:'mine',x:436,y:479});
 assert.deepEqual(inspectBaseMove(state,'a',436,479).hard,['Resource Mine']);
});
test('Locked bases, missing bases and out-of-bounds moves are rejected',()=>{
 const state=make();state.capitolPlaced=false;state.bases=[{...base('a',436,476),locked:true}];
 assert.deepEqual(inspectBaseMove(state,'a',436,479).hard,['This base is locked']);
 state.bases[0].locked=false;
 assert.deepEqual(inspectBaseMove(state,'a',2000,479).hard,['Outside the map coordinates']);
 assert.deepEqual(inspectBaseMove(state,'missing',436,479).hard,['Base no longer exists']);
});
test('Long-press move into mud requires the same warning as typed coordinate moves',()=>{
 const state=make();const original=base('a',499,551);state.bases.push(original);
 const result=inspectBaseMove(state,'a',499,548);
 assert.equal(result.hard.length,0);
 assert.equal(result.mud,6);
 assert.ok(result.warnings.some(w=>w.includes('6 of 9')));
 assert.equal(state.bases[0].y,551);
});

test('Two-finger sliding pans in screen direction without changing zoom',()=>{
 const camera={x:499,y:499,scale:10},w=800,h=600;
 const moved=pinchCamera(camera,{x:400,y:300},{x:460,y:330},1,w,h);
 assert.equal(moved.scale,10);
 assert.equal(moved.x,493,'sliding right reveals smaller X at center');
 assert.equal(moved.y,502,'sliding down reveals higher Y at center');
});
test('Pinch out zooms in and pinch in zooms out around finger midpoint',()=>{
 const camera={x:499,y:499,scale:10},w=800,h=600;
 assert.equal(pinchCamera(camera,{x:400,y:300},{x:400,y:300},2,w,h).scale,20);
 assert.equal(pinchCamera(camera,{x:400,y:300},{x:400,y:300},0.5,w,h).scale,5);
});
test('Combined two-finger pan and zoom pins original map location under moving midpoint',()=>{
 const camera={x:499,y:499,scale:9},w=800,h=600;
 const start={x:260,y:420},current={x:460,y:355};
 const anchor=pixelToMap(start.x,start.y,{...camera,width:w,height:h});
 const result=pinchCamera(camera,start,current,1.8,w,h);
 const projected=mapToPixel(anchor.x,anchor.y,{...result,width:w,height:h});
 assert.ok(Math.abs(projected.x-current.x)<1e-9);
 assert.ok(Math.abs(projected.y-current.y)<1e-9);
});
test('Pinch scale respects map zoom limits, keeping finite coordinates',()=>{
 const camera={x:499,y:499,scale:10},mid={x:600,y:200},w=800,h=600;
 for(const ratio of [0,0.00001,0.5,1,2,100000,NaN]){
  const r=pinchCamera(camera,mid,mid,ratio,w,h);
  assert.ok(r.scale>=1&&r.scale<=70);
  assert.ok(Number.isFinite(r.x)&&Number.isFinite(r.y));
 }
});

test('Drawing a territory normalizes corners independent of drag direction and north-positive Y',()=>{
 assert.deepEqual(territoryBoundsFromCorners({x:550,y:480},{x:450,y:540}),{x1:450,x2:550,y1:480,y2:540});
 assert.deepEqual(territoryBoundsFromCorners({x:450,y:540},{x:550,y:480}),{x1:450,x2:550,y1:480,y2:540});
});
test('Draft territory can be moved without changing size',()=>{
 const original={x1:450,x2:550,y1:480,y2:540};
 assert.deepEqual(moveTerritoryBounds(original,12,-7),{x1:462,x2:562,y1:473,y2:533});
 assert.deepEqual(original,{x1:450,x2:550,y1:480,y2:540});
});
test('Draft territory drag clamps to the physical map coordinates',()=>{
 assert.deepEqual(moveTerritoryBounds({x1:4,x2:9,y1:1990,y2:1999},-25,50),{x1:0,x2:5,y1:1990,y2:1999});
});
test('Each draft corner resizes the bounds using the opposite corner as anchor',()=>{
 const t={x1:450,x2:550,y1:480,y2:540};
 assert.deepEqual(resizeTerritoryBounds(t,'nw',440,550),{x1:440,x2:550,y1:480,y2:550});
 assert.deepEqual(resizeTerritoryBounds(t,'ne',560,551),{x1:450,x2:560,y1:480,y2:551});
 assert.deepEqual(resizeTerritoryBounds(t,'sw',435,470),{x1:435,x2:550,y1:470,y2:540});
 assert.deepEqual(resizeTerritoryBounds(t,'se',560,460),{x1:450,x2:560,y1:460,y2:540});
});
test('Dragging a territory corner across the opposite corner remains valid',()=>{
 const t={x1:450,x2:550,y1:480,y2:540};
 assert.deepEqual(resizeTerritoryBounds(t,'nw',600,400),{x1:550,x2:600,y1:400,y2:480});
});

test('Far zoom alliance blocks group nearby same-colour bases but not other alliances',()=>{
 const state=make();state.capitolPlaced=false;
 state.alliances.push({id:'7vry',name:'7VRY',color:'#c34545'});
 state.bases=[
  base('blue1',450,450),base('blue2',454,450),base('blue3',459,450),
  {...base('red1',470,450),allianceId:'7vry'},
  {...base('red2',474,450),allianceId:'7vry'}
 ];
 const clusters=allianceBaseClusters(state);
 assert.equal(clusters.length,2);
 const blue=clusters.find(c=>c.allianceId==='utw');
 const red=clusters.find(c=>c.allianceId==='7vry');
 assert.equal(blue.count,3);assert.equal(red.count,2);
 assert.deepEqual(blue.bounds,{left:449,top:449,right:460,bottom:451});
 assert.deepEqual(red.bounds,{left:469,top:449,right:475,bottom:451});
});
test('Separate clusters of the same alliance are not joined by a huge bounding box',()=>{
 const state=make();state.capitolPlaced=false;
 state.bases=[base('a',450,450),base('b',454,450),base('c',700,700)];
 const groups=allianceBaseClusters(state);
 assert.equal(groups.length,2);
 assert.deepEqual(groups.map(g=>g.count).sort(),[1,2]);
});
test('Preview clusters can be calculated from unsaved candidate bases',()=>{
 const state=make();state.capitolPlaced=false;
 const pending=[base('draft-a',540,540),base('draft-b',544,540)];
 const groups=allianceBaseClusters(state,pending);
 assert.equal(groups.length,1);assert.equal(groups[0].count,2);
 assert.equal(state.bases.length,0);
});
test('Alliance usage counts existing bases, territories and owned cities',()=>{
 const state=make();state.capitolPlaced=false;
 state.alliances.push({id:'7vry',name:'7VRY',color:'#c34545'});
 state.bases=[{...base('red1',700,700),allianceId:'7vry'}];
 state.territories=[{id:'region',allianceId:'7vry',name:'South',x1:690,x2:710,y1:690,y2:710,priority:0,gap:1}];
 state.obstacles=[{id:'city7',type:'city',x:510,y:510,name:'Road',level:3,ownerAllianceId:'7vry'}];
 assert.deepEqual(allianceUsage(state,'7vry'),{bases:1,territories:1,cities:1});
 assert.deepEqual(allianceUsage(state,'utw'),{bases:0,territories:0,cities:0});
});
test('Renaming an alliance display name preserves map links through stable alliance ID',()=>{
 const state=make();state.capitolPlaced=false;
 state.alliances.push({id:'7vry',name:'7VRY',color:'#c34545'});
 state.bases=[{...base('red1',700,700),allianceId:'7vry'}];
 state.alliances[1].name='EVRY';
 assert.equal(validateState(state),'');
 assert.equal(state.bases[0].allianceId,'7vry');
 assert.equal(state.alliances[1].name,'EVRY');
});
test('The API refuses orphaned member bases when referenced alliance is deleted',()=>{
 const state=make();state.capitolPlaced=false;
 state.alliances.push({id:'7vry',name:'7VRY',color:'#c34545'});
 state.bases=[{...base('red1',700,700),allianceId:'7vry'}];
 state.alliances=state.alliances.filter(a=>a.id!=='7vry');
 assert.equal(validateState(state),'Invalid commander base');
});
test('An unused extra alliance can be removed without affecting primary UTW map',()=>{
 const state=make();state.capitolPlaced=false;
 state.alliances.push({id:'oops',name:'Oops',color:'#aa1122'});
 assert.deepEqual(allianceUsage(state,'oops'),{bases:0,territories:0,cities:0});
 state.alliances=state.alliances.filter(a=>a.id!=='oops');
 assert.equal(validateState(state),'');
 assert.deepEqual(state.alliances.map(a=>a.id),['utw']);
});
