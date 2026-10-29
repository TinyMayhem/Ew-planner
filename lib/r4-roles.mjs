import {authorizedAlliance,departments} from '../api/r4-planner.mjs';
import {r4Db,sessionUser} from './r4-auth.mjs';

// Separate alliance rosters. Never shared as faction planning data.
const H={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
const json=(data,status=200)=>Response.json(data,{status,headers:H});
const validAlliance=a=>a==='utw'||a==='von';
const keys=new Set(departments.map(d=>d.key));
async function denied(request){
 const signedIn=await sessionUser(request).catch(()=>null);
 return json({error:'You do not have access to this alliance roster.'},signedIn?403:401);
}
const name=v=>typeof v==='string'&&v.trim().length<=50&&!/[\u0000-\u001f\u007f]/.test(v)?v.trim():null;
export function cleanAssignment(data){
 if(!data||!keys.has(data.department_key))return null;
 const leader=name(data.leader),backup=name(data.backup);
 if(leader===null||backup===null||!Array.isArray(data.additional_backups)||data.additional_backups.length>15)return null;
 const extras=[];
 for(const raw of data.additional_backups){
  const n=name(raw);
  if(!n)return null;
  if(!extras.some(x=>x.toLocaleLowerCase()===n.toLocaleLowerCase()))extras.push(n);
 }
 const filled=[leader,backup,...extras].filter(Boolean);
 if(new Set(filled.map(n=>n.toLocaleLowerCase())).size!==filled.length)return null;
 return {department_key:data.department_key,leader,backup,additional_backups:extras};
}
export async function GET(request){
 const alliance=new URL(request.url).searchParams.get('alliance');
 if(!validAlliance(alliance))return json({error:'Invalid alliance.'},400);
 if(!await authorizedAlliance(request,alliance))return denied(request);
 try{
  const params=new URLSearchParams({select:'department_key,leader,backup,additional_backups,updated_at,updated_by',alliance:'eq.'+alliance,order:'department_key.asc'});
  const rows=await r4Db('utw_r4_roles?'+params);
  if(!Array.isArray(rows))throw Error('Invalid response');
  return json({roles:rows.filter(r=>keys.has(r.department_key))});
 }catch{return json({error:'Roles database not ready. Apply the R4 roles SQL setup.'},503)}
}
export async function POST(request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid origin.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
 let payload;
 try{const raw=await request.text();if(raw.length>5000)return json({error:'Request too long.'},413);payload=JSON.parse(raw)}
 catch{return json({error:'Invalid request.'},400)}
 const alliance=payload?.alliance;
 if(!validAlliance(alliance))return json({error:'Invalid alliance.'},400);
 if(!await authorizedAlliance(request,alliance))return denied(request);
 const actor=await sessionUser(request).catch(()=>null);
 if(!actor)return denied(request);
 const fields=cleanAssignment(payload);
 if(!fields)return json({error:'Names must be at most 50 characters, with no duplicate assignments. Maximum 15 additional backups.'},400);
 try{
  const rows=await r4Db('utw_r4_roles?on_conflict=alliance,department_key',{
   method:'POST',
   headers:{Prefer:'resolution=merge-duplicates,return=representation'},
   body:JSON.stringify({alliance,...fields,updated_by:actor.display_name||actor.username,updated_at:new Date().toISOString()})
  });
  if(!Array.isArray(rows)||rows.length!==1)throw Error('Invalid response');
  return json({role:rows[0]});
 }catch{return json({error:'Could not save roles. Check the R4 roles database setup.'},503)}
}
