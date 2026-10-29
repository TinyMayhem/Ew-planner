import {authorizedAlliance,weeks} from './r4-planner.mjs';
import {sessionUser} from '../lib/r4-auth.mjs';
import {scopeForTask,taskParts} from '../lib/r4-workspace.mjs';
const HEADERS={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
const json=(body,status=200)=>Response.json(body,{status,headers:HEADERS});
const workspace=x=>['utw','von'].includes(x)?x:null;
async function database(path,opts={}){
 const url=process.env.SUPABASE_URL?.replace(/\/$/,''),key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw Error('Checklist storage unavailable');
 const response=await fetch(url+'/rest/v1/'+path,{...opts,headers:{apikey:key,'Content-Type':'application/json',...opts.headers},signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('Checklist storage unavailable ('+response.status+')');
 return response.status===204?null:response.json();
}
const allowed=async(request,alliance)=>{
 if(!await authorizedAlliance(request,alliance)){
  const user=await sessionUser(request).catch(()=>null);
  return json({error:user?'No access to this alliance checklist':'R4 sign-in required'},user?403:401);
 }
 return null;
};
const allTasks=week=>weeks[week].groups.flatMap((g,gi)=>g.items.map((_,i)=>week+'-'+gi+'-'+i));
const filterForAlliance=(row,alliance)=>{
 const scope=scopeForTask(alliance,row.task_key,weeks);
 return scope!==null&&row.scope===scope;
};
export async function GET(request){
 const url=new URL(request.url),alliance=workspace(url.searchParams.get('alliance'));
 if(!alliance)return json({error:'Invalid alliance'},400);
 const denied=await allowed(request,alliance);if(denied)return denied;
 const week=Number(url.searchParams.get('week'));
 if(!Number.isInteger(week)||week<0||week>=weeks.length||!(/^\d$/.test(url.searchParams.get('week')||'')))return json({error:'Invalid week'},400);
 try{
  const params=new URLSearchParams({select:'scope,task_key,completed,updated_at,updated_by',scope:'in.('+alliance+',faction)',task_key:'like.'+week+'-*',limit:'100'});
  const rows=await database('utw_r4_task_state?'+params);
  if(!Array.isArray(rows))throw Error('Unexpected checklist storage response');
  return json({alliance,week,items:rows.filter(r=>filterForAlliance(r,alliance))});
 }catch{return json({error:'Unable to load shared checklist. No changes were made.'},503)}
}
export async function POST(request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required'},415);
 let body;try{const raw=await request.text();if(raw.length>6000)return json({error:'Request too large'},413);body=JSON.parse(raw)}catch{return json({error:'Invalid request'},400)}
 const alliance=workspace(body?.alliance);
 if(!alliance)return json({error:'Invalid alliance'},400);
 const denied=await allowed(request,alliance);if(denied)return denied;
 const actor=await sessionUser(request).catch(()=>null);
 const by=actor?.username||'UTW legacy R4';
 let keys,completed;
 if(body.action==='reset_week'){
  if(!Number.isInteger(body.week)||body.week<0||body.week>=weeks.length)return json({error:'Invalid week'},400);
  keys=allTasks(body.week);completed=false;
 }else if(body.action==='import_checked'){
  if(!Array.isArray(body.keys)||body.keys.length>100||!body.keys.length||new Set(body.keys).size!==body.keys.length)return json({error:'Invalid import list'},400);
  keys=body.keys;completed=true;
 }else if(body.action==='toggle'){
  if(typeof body.completed!=='boolean')return json({error:'Invalid completion status'},400);
  keys=[body.taskKey];completed=body.completed;
 }else return json({error:'Unknown checklist action'},400);
 if(keys.some(k=>!taskParts(k,weeks)))return json({error:'Invalid checklist task'},400);
 const rows=keys.map(k=>({scope:scopeForTask(alliance,k,weeks),task_key:k,completed,updated_by:by,updated_at:new Date().toISOString()}));
 if(rows.some(r=>!r.scope))return json({error:'Invalid task scope'},400);
 try{
  const saved=await database('utw_r4_task_state?on_conflict=scope,task_key',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(rows)});
  if(!Array.isArray(saved)||saved.length!==rows.length)throw Error('Shared checklist update incomplete');
  return json({ok:true,items:saved});
 }catch{return json({error:'Checklist was not saved. Try again before leaving.'},503)}
}
