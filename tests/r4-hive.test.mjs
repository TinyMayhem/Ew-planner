import test from 'node:test';
import assert from 'node:assert/strict';
import {OBJECTS,rect,footprint,zoneRects,inMud,inspectPlacement,proposeBases,sectionFor,occupiedBounds,cityLabel,mapToPixel,pixelToMap,screenFootprint} from '../assets/hive-geometry.js';
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
