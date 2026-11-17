import {sessionUser,r4Db} from './r4-auth.mjs';
import {OBJECTS,inspectPlacement,footprint,rect,intersects} from '../assets/hive-geometry.js';

const HEAD={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
const json=(obj,status=200)=>Response.json(obj,{status,headers:HEAD});
const okayOrigin=r=>r.headers.get('origin')===new URL(r.url).origin;
async function actor(r){const a=await sessionUser(r);return a&&['admin','r4'].includes(a.role)?a:null;}
const validInt=x=>Number.isInteger(x)&&x>=0&&x<=1999;
const safeText=(s,n=80)=>typeof s==='string'?s.trim().slice(0,n):'';
const uuidLike=s=>typeof s==='string'&&s.length>0&&s.length<=90&&/^[a-zA-Z0-9_-]+$/.test(s);
const color=s=>typeof s==='string'&&/^#[0-9a-fA-F]{6}$/.test(s);
export function validateState(s){
 if(!s||typeof s!=='object'||Array.isArray(s))return 'Invalid map data';
 if(!s.center||!validInt(s.center.x)||!validInt(s.center.y)||typeof s.capitolPlaced!=='boolean')return 'Invalid Capitol center';
 if(!s.calibration||!['positive','negative'].includes(s.calibration.evenX)||!['positive','negative'].includes(s.calibration.evenY)||typeof s.calibration.verified!=='boolean')return 'Invalid calibration settings';
 const arrays=['alliances','territories','obstacles','bases'];
 if(arrays.some(k=>!Array.isArray(s[k])))return 'Invalid map collections';
 if(s.alliances.length>35||s.territories.length>150||s.obstacles.length>750||s.bases.length>350)return 'Map item limit exceeded';
 if(!s.settings||![0,1,2].includes(s.settings.spacing)||!['auto','on','off'].includes(s.settings.showNames))return 'Invalid display settings';
 const seen=(a)=>new Set(a.map(o=>o.id)).size===a.length;
 if(arrays.some(k=>!seen(s[k])))return 'Duplicate map item IDs';
 if(s.alliances.some(a=>!uuidLike(a.id)||!safeText(a.name,28)||!color(a.color)))return 'Invalid alliance';
 const allianceSet=new Set(s.alliances.map(a=>a.id));
 if(s.territories.some(t=>!uuidLike(t.id)||!allianceSet.has(t.allianceId)||!safeText(t.name,65)||![0,1,2].includes(t.gap)||!Number.isInteger(t.priority)||Math.abs(t.priority)>1000||[t.x1,t.x2,t.y1,t.y2].some(x=>!validInt(x))||t.x1>t.x2||t.y1>t.y2))return 'Invalid territory';
 if(s.obstacles.some(o=>!uuidLike(o.id)||!OBJECTS[o.type]||o.type==='capitol'||o.type==='base'||!validInt(o.x)||!validInt(o.y)))return 'Invalid obstacle';
 if(s.obstacles.some(o=>o.type==='city'&&(
   (o.name!==undefined&&(typeof o.name!=='string'||o.name.trim().length>70))||
   (o.level!==undefined&&(!Number.isInteger(o.level)||o.level<1||o.level>10))||
   (o.ownerAllianceId!==undefined&&o.ownerAllianceId!==null&&o.ownerAllianceId!==''&&!allianceSet.has(o.ownerAllianceId))
 )))return 'Invalid city name, level or ownership';
 if(s.bases.some(b=>!uuidLike(b.id)||!allianceSet.has(b.allianceId)||!validInt(b.x)||!validInt(b.y)||typeof b.locked!=='boolean'||(b.memberName!==undefined&&typeof b.memberName!=='string')||(b.memberName||'').length>80||(b.sectionOverride!==null&&b.sectionOverride!==undefined&&!uuidLike(b.sectionOverride))))return 'Invalid commander base';
 for(const [index,o] of s.obstacles.entries()){
  const r=footprint(o,s);
  if(s.capitolPlaced&&intersects(r,rect(s.center.x,s.center.y,21,21,s.calibration)))return 'A physical obstacle intersects the Capitol';
  if(s.obstacles.slice(0,index).some(p=>intersects(r,footprint(p,s))))return 'Two physical obstacles intersect';
 }
 for(const b of s.bases){const rest=s.bases.filter(x=>x.id!==b.id);const check=inspectPlacement(b,{...s,bases:rest});if(check.hard.length)return 'A commander base intersects another base or blocking object';}
 return '';
}
function html(){
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#0b2b22"><title>UTW Hive & Territory Planner</title><link rel="stylesheet" href="/assets/hive-planner.css?v=territoryedit-20261117"></head><body><div id="hive-app"><div class="hive-loading">Loading the UTW Hive & Territory Planner…</div></div><script type="module" src="/assets/hive-planner.js?v=overviewalliance-20261117"></script></body></html>';
}
async function mainRow(){const rows=await r4Db('utw_hive_map?select=*&id=eq.main&limit=1');if(!rows?.length)throw Error('Hive map data has not been initialized');return rows[0];}
export async function GET(request){
 const user=await actor(request);
 if(!user)return new Response(null,{status:303,headers:{Location:'/r4-planner','Cache-Control':'no-store'}});
 const q=new URL(request.url).searchParams;
 if(!q.has('data')&&!q.has('snapshot'))return new Response(html(),{headers:{...HEAD,'Content-Type':'text/html; charset=utf-8'}});
 try{
  if(q.has('snapshot')){
   const rev=Number(q.get('snapshot'));if(!Number.isSafeInteger(rev)||rev<0)return json({error:'Invalid revision'},400);
   const rows=await r4Db('utw_hive_history?'+new URLSearchParams({select:'revision,state,actor,summary,created_at',revision:'eq.'+rev,limit:'1'}));
   return rows?.length?json({snapshot:rows[0]}):json({error:'Snapshot not found'},404);
  }
  const row=await mainRow();
  if(q.get('since')!==null&&Number(q.get('since'))===Number(row.revision))return json({unchanged:true,revision:row.revision});
  const history=await r4Db('utw_hive_history?select=revision,actor,summary,created_at&order=revision.desc&limit=50');
  const data={revision:row.revision,state:row.state,updatedBy:row.updated_by,updatedAt:row.updated_at,history,user:{username:user.username,displayName:user.display_name}};
  if(q.get('members')==='1'){
   const [members,aliases]=await Promise.all([
    r4Db('utw_stat_members?select=id,display_name&order=display_name.asc&limit=500'),
    r4Db('utw_stat_aliases?select=member_id,alias&limit=1000')
   ]);
   data.members=members;data.aliases=aliases;
  }
  return json(data);
 }catch(e){return json({error:'Unable to load hive map: '+e.message},503);}
}
export async function POST(request){
 const user=await actor(request);
 if(!user)return json({error:'Please sign in to your R4 account'},401);
 if(!okayOrigin(request))return json({error:'Invalid request origin'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required'},415);
 const raw=await request.text();if(raw.length>500000)return json({error:'Map too large'},413);
 let body;try{body=JSON.parse(raw)}catch{return json({error:'Invalid JSON'},400)}
 if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)return json({error:'Invalid revision'},400);
 const bad=validateState(body.state);if(bad)return json({error:bad},400);
 const summary=safeText(body.summary,160)||'Updated hive map';
 try{
  const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw Error('Database configuration is unavailable');
  const response=await fetch(url+'/rest/v1/rpc/utw_hive_commit',{
   method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
   body:JSON.stringify({
    p_expected_revision:body.expectedRevision,
    p_next_state:body.state,
    p_actor:user.display_name||user.username,
    p_summary:summary
   }),signal:AbortSignal.timeout(15000)
  });
  const result=await response.json();
  if(!response.ok){
   if(result?.code==='40001'||String(result?.message).includes('revision_conflict'))return json({error:'Another R4 updated the map first. Reload the latest map before trying again.'},409);
   throw Error('Save rejected by database');
  }
  const saved=result?.[0];
  if(!saved)return json({error:'Could not save map'},503);
  return json({revision:Number(saved.new_revision),updatedAt:saved.saved_at,actor:user.display_name||user.username});
 }catch(e){
  if(String(e.message).includes('40001')||String(e.message).includes('409')||String(e.message).includes('revision_conflict'))return json({error:'Another R4 updated the map first. Refresh before applying your changes.'},409);
  return json({error:'Unable to save hive map'},503);
 }
}
