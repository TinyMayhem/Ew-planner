// Shared pure map geometry for the browser and the R4 API.
// All coordinates describe object centers. Even-size anchoring is provisional until calibrated.
export const OBJECTS={
 base:{label:'Commander Base',w:3,h:3},
 mine:{label:'Resource Mine',w:1,h:1},
 secret:{label:'Secret Task',w:3,h:3},
 exercise:{label:'Alliance Exercise',w:3,h:3},
 city:{label:'City',w:7,h:7,contam:15},
 stronghold:{label:'Stronghold',w:5,h:5,contam:13},
 bank:{label:'Bank Stronghold',w:7,h:7,contam:15},
 trade:{label:'Trade Post',w:5,h:5,contam:17},
 capitol:{label:'Capitol',w:21,h:21,contam:100},
 outpost:{label:'Outpost',w:7,h:7,contam:50},
 siege:{label:'Siege Banner',w:1,h:1,influence:21},
 charge:{label:'Charge Banner',w:1,h:1,influence:21},
 abandoned:{label:'Abandoned Mine',w:6,h:5},
 tower:{label:'Broken Tower',w:5,h:5},
 truck55:{label:'Old Truck 5×5',w:5,h:5},
 truck56:{label:'Old Truck 5×6',w:5,h:6},
 car:{label:'Old Car',w:4,h:4},
 sign32:{label:'Sign Post 3×2',w:3,h:2},
 sign33:{label:'Sign Post (L)',w:3,h:3},
 mountain1310:{label:'Mountain 13×10',w:13,h:10},
 mountain1212:{label:'Mountain 12×12',w:12,h:12},
 mountain1311:{label:'Mountain 13×11',w:13,h:11},
 mountain108:{label:'Mountain (S) 10×8',w:10,h:8},
 railh:{label:'Train Tracks Horizontal',w:9,h:3},
 railv:{label:'Train Tracks Vertical',w:3,h:9}
};
export function cityLabel(city){
 const level=Number.isInteger(city.level)&&city.level>=1&&city.level<=10?'L'+city.level:'L?';
 const name=typeof city.name==='string'&&city.name.trim()?city.name.trim():'City';
 return level+' · '+name;
}
// Last War displays increasing Y north/upward. X increases east/right.
// These functions affect display and hit-testing, NEVER the saved game coordinates.
export function mapToPixel(x,y,{x:cx,y:cy,width,height,scale}){
 return {x:(x-cx)*scale+width/2,y:(cy-y)*scale+height/2};
}
export function pixelToMap(px,py,{x:cx,y:cy,width,height,scale}){
 return {x:cx+(px-width/2)/scale,y:cy-(py-height/2)/scale};
}
// Two-finger gesture math. Keep the map coordinate below the starting pinch
// midpoint underneath the moving midpoint while changing zoom and position.
export function pinchCamera(startView,startingMidpoint,currentMidpoint,zoomRatio,width,height){
 const safeRatio=Number.isFinite(zoomRatio)&&zoomRatio>0?zoomRatio:1;
 const scale=Math.min(70,Math.max(1,startView.scale*safeRatio));
 const anchor=pixelToMap(startingMidpoint.x,startingMidpoint.y,{...startView,width,height});
 return {
  x:anchor.x-(currentMidpoint.x-width/2)/scale,
  y:anchor.y+(currentMidpoint.y-height/2)/scale,
  scale
 };
}
export function screenFootprint(r,view){
 const nw=mapToPixel(r.left-0.5,r.bottom+0.5,view);
 return [nw.x,nw.y,(r.right-r.left+1)*view.scale,(r.bottom-r.top+1)*view.scale];
}
export const int=n=>Number.isSafeInteger(Number(n))?Number(n):null;
export function rect(x,y,w,h,calibration={}){
 const biasX=w%2===0&&calibration.evenX==='positive'?1:0;
 const biasY=h%2===0&&calibration.evenY==='positive'?1:0;
 const left=x-Math.floor(w/2)+biasX,top=y-Math.floor(h/2)+biasY;
 return {left,top,right:left+w-1,bottom:top+h-1};
}
export function footprint(o,state){
 const t=OBJECTS[o.type||'base']||OBJECTS.base;
 return rect(Number(o.x),Number(o.y),t.w,t.h,state.calibration);
}
export function zoneRects(state){
 const out=[];
 const add=o=>{const t=OBJECTS[o.type];if(t?.contam)out.push({...rect(o.x,o.y,t.contam,t.contam,state.calibration),source:o.type});};
 if(state.capitolPlaced)add({...state.center,type:'capitol'});
 for(const o of state.obstacles||[])add(o);
 return out;
}
export function influenceRects(state){
 return (state.obstacles||[]).filter(o=>OBJECTS[o.type]?.influence).map(o=>({...rect(o.x,o.y,OBJECTS[o.type].influence,OBJECTS[o.type].influence,state.calibration),source:o.type}));
}
export function intersects(a,b){return a.left<=b.right&&a.right>=b.left&&a.top<=b.bottom&&a.bottom>=b.top;}
export function overlap(a,b){return Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left)+1)*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)+1);}
export function contains(r,x,y){return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;}
export function inMud(base,state){
 const r=footprint(base,state),zones=zoneRects(state);let count=0;
 for(let x=r.left;x<=r.right;x++)for(let y=r.top;y<=r.bottom;y++)if(zones.some(z=>contains(z,x,y)))count++;
 return count;
}
export function sectionFor(base,state){
 const own=(state.territories||[]).filter(t=>t.allianceId===base.allianceId);
 if(base.sectionOverride){const pinned=own.find(t=>t.id===base.sectionOverride);if(pinned)return pinned;}
 return own.filter(t=>base.x>=t.x1&&base.x<=t.x2&&base.y>=t.y1&&base.y<=t.y2).sort((a,b)=>(a.priority||0)-(b.priority||0)||a.id.localeCompare(b.id))[0]||null;
}
export function inspectPlacement(base,state,{spacing=null,extra=[],ignoreId=null}={}){
 const r=footprint(base,state),hard=[],warnings=[];
 const baseRects=[...(state.bases||[]),...extra].filter(o=>o.id!==ignoreId).map(o=>({o,r:footprint(o,state)}));
 if(state.capitolPlaced&&intersects(r,rect(state.center.x,state.center.y,21,21,state.calibration)))hard.push('Capitol footprint');
 for(const o of state.obstacles||[])if(o.id!==ignoreId&&intersects(r,footprint(o,state)))hard.push(OBJECTS[o.type]?.label||'Obstacle');
 for(const pair of baseRects)if(intersects(r,pair.r))hard.push('Another base');
 const mud=inMud(base,state);
 if(mud>3)warnings.push(mud+' of 9 cells overlap contaminated land: shielding may be unavailable');
 else if(mud>0)warnings.push(mud+' of 9 cells overlap contaminated land: provisional allowance');
 const gap=spacing===null?(state.settings?.spacing||0):spacing;
 if(gap>0&&baseRects.some(p=>Math.abs(p.o.x-base.x)<3+gap&&Math.abs(p.o.y-base.y)<3+gap))warnings.push('Closer than the selected '+gap+'-cell base gap');
 const sections=(state.territories||[]).filter(t=>t.allianceId===base.allianceId);
 const assigned=base.sectionOverride?sections.find(t=>t.id===base.sectionOverride):null;
 const relevant=assigned?[assigned]:sections;
 if(relevant.length&&!relevant.some(t=>{const zone={left:t.x1,right:t.x2,top:t.y1,bottom:t.y2};return r.left>=zone.left&&r.right<=zone.right&&r.top>=zone.top&&r.bottom<=zone.bottom;}))warnings.push('Base footprint is outside or crosses its assigned territory section');
 return {hard:[...new Set(hard)],warnings,mud,section:sectionFor(base,state)};
}
// Validate a proposed drag without mutating a saved base or the shared map.
export function inspectBaseMove(state,baseId,x,y){
 const base=(state.bases||[]).find(b=>b.id===baseId);
 if(!base)return {hard:['Base no longer exists'],warnings:[],mud:0,candidate:null};
 if(base.locked)return {hard:['This base is locked'],warnings:[],mud:0,candidate:null};
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>1999||y<0||y>1999)
  return {hard:['Outside the map coordinates'],warnings:[],mud:0,candidate:null};
 const candidate={...base,x,y};
 return {...inspectPlacement(candidate,state,{ignoreId:baseId}),candidate};
}
export function boundsOfState(state,{zones=true,territories=true}={}){
 const rs=[];
 if(state.capitolPlaced){rs.push(rect(state.center.x,state.center.y,21,21,state.calibration));if(zones)rs.push(...zoneRects(state));}
 for(const o of state.obstacles||[])rs.push(footprint(o,state));
 for(const b of state.bases||[])rs.push(footprint(b,state));
 if(zones)rs.push(...zoneRects(state));
 if(territories)for(const t of state.territories||[])rs.push({left:t.x1,right:t.x2,top:t.y1,bottom:t.y2});
 if(!rs.length)return {left:state.center.x-30,right:state.center.x+30,top:state.center.y-30,bottom:state.center.y+30};
 return {left:Math.min(...rs.map(x=>x.left)),right:Math.max(...rs.map(x=>x.right)),top:Math.min(...rs.map(x=>x.top)),bottom:Math.max(...rs.map(x=>x.bottom))};
}
export function occupiedBounds(state,allianceId){
 const rs=(state.bases||[]).filter(b=>b.allianceId===allianceId).map(b=>footprint(b,state));
 if(!rs.length)return null;
 return {left:Math.min(...rs.map(r=>r.left)),right:Math.max(...rs.map(r=>r.right)),top:Math.min(...rs.map(r=>r.top)),bottom:Math.max(...rs.map(r=>r.bottom))};
}
function edgeDistance(x,y,z){
 const dx=x<z.left?z.left-x:x>z.right?x-z.right:Math.min(x-z.left,z.right-x);
 const dy=y<z.top?z.top-y:y>z.bottom?y-z.bottom:Math.min(y-z.top,z.bottom-y);
 return Math.min(dx,dy);
}
export function proposeBases(state,{allianceId,region,count=20,gap=1,strategy='boundary',packing='rows'}){
 const temp=[],seen=new Set(),zone=zoneRects(state);
 const minX=Math.max(0,Math.floor(region.x1)),maxX=Math.min(1999,Math.floor(region.x2));
 const minY=Math.max(0,Math.floor(region.y1)),maxY=Math.min(1999,Math.floor(region.y2));
 if(maxX-minX>320||maxY-minY>320)throw Error('Choose an area at most 320×320 cells for suggestions.');
 const stride=3+gap;
 const candidates=[];
 const add=(x,y)=>{
  const key=x+','+y;if(seen.has(key))return;seen.add(key);
  const b={id:'suggest-'+key,type:'base',x,y,allianceId};
  const box=footprint(b,state);if(box.left<minX||box.right>maxX||box.top<minY||box.bottom>maxY)return;
  const check=inspectPlacement(b,state,{spacing:gap});if(check.hard.length||check.mud>3)return;
  if(check.warnings.some(w=>w.startsWith('Closer')))return;
  const near=zone.length?Math.min(...zone.map(z=>edgeDistance(x,y,z))):0;
  candidates.push({b,near});
 };
 if(packing==='rows'){
  for(let y=minY+1;y<=maxY-1;y+=stride)for(let x=minX+1;x<=maxX-1;x+=stride)add(x,y);
 }else{
  for(let y=minY+1;y<=maxY-1;y++)for(let x=minX+1;x<=maxX-1;x++)add(x,y);
 }
 if(strategy==='boundary'){
  candidates.sort((a,b)=>a.near-b.near||a.b.y-b.b.y||a.b.x-b.b.x);
  for(const {b} of candidates){
   if(temp.length>=Math.min(250,count))break;
   if(temp.some(p=>Math.abs(p.x-b.x)<3+gap&&Math.abs(p.y-b.y)<3+gap))continue;
   temp.push(b);
  }
 }else{
  // Coverage: farthest-first selection spreads the selected number of bases
  // across the whole rectangle instead of filling only the top rows.
  // Candidate placement and obstacle safety have already been validated above.
  const available=candidates.map(x=>x.b);
  const target=Math.min(250,count);
  while(temp.length<target&&available.length){
   let best=-1,bestScore=-Infinity;
   for(let i=0;i<available.length;i++){
    const p=available[i];
    if(temp.some(b=>Math.abs(p.x-b.x)<3+gap&&Math.abs(p.y-b.y)<3+gap))continue;
    const score=temp.length
     ?Math.min(...temp.map(b=>(p.x-b.x)**2+(p.y-b.y)**2))
     :((p.x-minX)**2+(p.y-minY)**2)*-1;
    if(score>bestScore){best=i;bestScore=score;}
   }
   if(best<0)break;
   temp.push(available.splice(best,1)[0]);
  }
 }
 return temp;
}
