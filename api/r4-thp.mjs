import {authorizedAccess} from './r4-planner.mjs';
import {sessionUser} from '../lib/r4-auth.mjs';

const headers={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
const json=(body,status=200)=>Response.json(body,{status,headers});
const sourceId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
const safeName=value=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=100&&!/[\x00-\x1f\x7f]/.test(value);
export const validThp=value=>Number.isSafeInteger(value)&&value>=0;
const config=()=>{
 const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
 const secret=process.env.SUPABASE_SECRET_KEY;
 if(!url||!secret)throw Error('R4 database is not configured');
 return {url,secret};
};
async function db(path,options={}){
 const {url,secret}=config();
 const response=await fetch(url+'/rest/v1/utw_r4_member_thp'+path,{
  ...options,
  headers:{apikey:secret,'Content-Type':'application/json',...options.headers},
  signal:AbortSignal.timeout(15000)
 });
 if(!response.ok){
  if(response.status===404)throw Error('Member THP storage has not been set up yet');
  throw Error('Unable to access saved THP ('+response.status+')');
 }
 return response.status===204?null:response.json();
}
async function allowed(request){
 if(!await authorizedAccess(request))return false;
 const account=await sessionUser(request);
 return account?.role!=='von';
}
export async function GET(request){
 if(!await allowed(request))return json({error:'UTW R4 sign-in required'},401);
 try{
  const records=await db('?select=source_member_id,member_name,thp,updated_at,updated_by&order=member_name.asc&limit=2000');
  if(!Array.isArray(records))throw Error('Unexpected THP data');
  return json({records});
 }catch(e){return json({error:e.message},503)}
}
export async function POST(request){
 if(!await allowed(request))return json({error:'UTW R4 sign-in required'},401);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required'},415);
 try{
  const raw=await request.text();
  if(raw.length>2000)return json({error:'Request too large'},413);
  const body=JSON.parse(raw);
  if(!sourceId(body.source_member_id)||!safeName(body.member_name))return json({error:'Choose a member from the VS roster'},400);
  const id=body.source_member_id;
  if(body.action==='clear'){
   await db('?source_member_id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:{Prefer:'return=minimal'}});
   return json({ok:true,deleted:true});
  }
  if(body.action!=='save'||!validThp(body.thp))return json({error:'Enter a valid whole-number THP'},400);
  const actor=await sessionUser(request);
  const row={
   source_member_id:id,
   member_name:body.member_name.trim(),
   thp:body.thp,
   updated_at:new Date().toISOString(),
   updated_by:String(actor?.username||actor?.display_name||'R4').slice(0,80)
  };
  const saved=await db('?on_conflict=source_member_id',{
   method:'POST',
   headers:{Prefer:'resolution=merge-duplicates,return=representation'},
   body:JSON.stringify(row)
  });
  if(!Array.isArray(saved)||saved.length!==1)throw Error('THP entry was not saved');
  return json({ok:true,record:saved[0]});
 }catch(e){
  if(e instanceof SyntaxError)return json({error:'Invalid JSON'},400);
  return json({error:e.message},503);
 }
}
