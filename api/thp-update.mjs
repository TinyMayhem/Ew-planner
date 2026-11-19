import {randomUUID,createHash} from 'node:crypto';
import {validSession} from '../lib/buddies.mjs';
import {authorizedAccess} from './r4-planner.mjs';
import {sessionUser} from '../lib/r4-auth.mjs';
import {cleanThpSubmission,nameSuggestions,powerFromInput} from '../lib/thp-submission-utils.mjs';

const HEADERS={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex,nofollow'};
const json=(value,status=200)=>Response.json(value,{status,headers:HEADERS});
const pageAllowed=request=>validSession(request.headers.get('cookie'),'page')||validSession(request.headers.get('cookie'));
const siteOrigin=request=>new URL(request.url).origin;
const secureRequest=request=>request.headers.get('origin')===siteOrigin(request);
const bucket='utw-thp-evidence';
const dbConfig=()=>{
 const url=process.env.SUPABASE_URL?.replace(/\/$/,''),key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw Error('THP submission storage is not configured.');
 return {url,key};
};
async function db(path,options={}){
 const {url,key}=dbConfig();
 const res=await fetch(url+'/rest/v1/'+path,{
  ...options,
  headers:{apikey:key,'Content-Type':'application/json',...options.headers},
  signal:AbortSignal.timeout(15000)
 });
 if(!res.ok){
  const body=await res.text().catch(()=> '');
  const detail=JSON.parse(body||'{}');
  throw Error(detail.message||'THP database operation failed');
 }
 return res.status===204?null:res.json();
}
const list=(table,params)=>db(table+'?'+new URLSearchParams(params));
const todayServer=()=>new Intl.DateTimeFormat('en-CA',{
 timeZone:'America/Noronha',year:'numeric',month:'2-digit',day:'2-digit'
}).format(new Date());
async function limited(request,action,limit){
 const ip=(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'unknown').split(',')[0];
 const key='thp-'+action+':'+createHash('sha256').update(ip).digest('hex');
 const count=await db('rpc/utw_buddy_rate_limit',{method:'POST',body:JSON.stringify({p_key:key})});
 if(!Number.isInteger(count)||count>limit)throw Error('Too many attempts. Try again in 15 minutes.');
}
async function getRoster(){
 const [members,aliases]=await Promise.all([
  list('utw_duel_backup_members',{select:'source_member_id,name',order:'name.asc',limit:'1000'}),
  list('utw_duel_backup_aliases',{select:'source_member_id,alias',limit:'5000'})
 ]);
 if(!Array.isArray(members)||!Array.isArray(aliases))throw Error('Alliance Duel member names unavailable');
 return {members,aliases};
}
async function reviewAllowed(request){
 if(!await authorizedAccess(request))return false;
 const actor=await sessionUser(request);
 return actor&&['admin','r4'].includes(actor.role)?actor:false;
}
function imageType(file,bytes){
 const type=String(file.type||'').toLowerCase();
 const u=new Uint8Array(bytes);
 const jpeg=u.length>=3&&u[0]===0xff&&u[1]===0xd8&&u[2]===0xff;
 const png=u.length>=8&&[137,80,78,71,13,10,26,10].every((x,i)=>u[i]===x);
 const webp=u.length>=12&&String.fromCharCode(...u.slice(0,4))==='RIFF'&&String.fromCharCode(...u.slice(8,12))==='WEBP';
 if(type==='image/jpeg'&&jpeg)return {type,ext:'jpg'};
 if(type==='image/png'&&png)return {type,ext:'png'};
 if(type==='image/webp'&&webp)return {type,ext:'webp'};
 throw Error('Please upload a genuine JPG, PNG, or WebP screenshot.');
}
async function uploadEvidence(id,file){
 if(!file||!file.size)return null;
 if(file.size>3145728)throw Error('Screenshot is too large. Upload an image smaller than 3 MB.');
 const bytes=await file.arrayBuffer(),mime=imageType(file,bytes);
 const {url,key}=dbConfig(),path='proof/'+id+'.'+mime.ext;
 const res=await fetch(url+'/storage/v1/object/'+bucket+'/'+path,{
  method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':mime.type,'x-upsert':'false'},
  body:bytes,signal:AbortSignal.timeout(20000)
 });
 if(!res.ok)throw Error('Screenshot could not be stored privately. Try again.');
 return path;
}
async function deleteEvidence(path){
 if(!path)return;
 const {url,key}=dbConfig();
 await fetch(url+'/storage/v1/object/'+bucket+'/'+path,{
  method:'DELETE',headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(10000)
 }).catch(()=>{});
}
async function evidenceFor(request,id){
 const actor=await reviewAllowed(request);
 if(!actor)return json({error:'R4 sign-in required'},401);
 const rows=await list('utw_thp_submissions',{select:'evidence_path',id:'eq.'+id,limit:'1'});
 const path=rows?.[0]?.evidence_path;
 if(!path||!/^proof\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path))return json({error:'Evidence not found'},404);
 const {url,key}=dbConfig();
 const remote=await fetch(url+'/storage/v1/object/'+bucket+'/'+path,{
  headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(12000)
 });
 if(!remote.ok)return json({error:'Evidence unavailable'},404);
 const ext=path.split('.').pop(),contentType=ext==='jpg'?'image/jpeg':ext==='png'?'image/png':'image/webp';
 return new Response(remote.body,{status:200,headers:{...HEADERS,'Content-Type':contentType,'Content-Disposition':'inline; filename="thp-evidence.'+ext+'"'}});
}
const validId=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id);
export async function GET(request){
 const query=new URL(request.url).searchParams;
 try{
  if(query.has('review')){
   const actor=await reviewAllowed(request);
   if(!actor)return json({error:'R4 sign-in required'},401);
   const [rows,roster,latest,squads]=await Promise.all([
    list('utw_thp_submissions',{
     select:'id,submitted_name,squad_type,squad_power,hero_power,measurement_date,evidence_path,member_note,status,submitted_at,reviewed_at,reviewed_by,review_note,approved_source_member_id,approved_member_name',
     order:'submitted_at.desc',limit:'300'
    }),
    getRoster(),
    db('rpc/utw_r4_thp_latest',{method:'POST',body:JSON.stringify({p_date:todayServer()})}),
    list('utw_r4_member_squad_profiles',{select:'source_member_id,squad_type,squad_power,updated_at',limit:'1000'})
   ]);
   if(!Array.isArray(rows)||!Array.isArray(latest)||!Array.isArray(squads))throw Error('THP reviewer data is unavailable');
   return json({rows,roster:roster.members,aliases:roster.aliases,latest,squads,
    pending:rows.filter(r=>r.status==='pending').length});
  }
  if(query.has('evidence')){
   const id=query.get('evidence');
   if(!validId(id))return json({error:'Invalid evidence ID'},400);
   return evidenceFor(request,id);
  }
  if(!pageAllowed(request))return json({locked:true});
  if(query.has('suggest')){
   const term=String(query.get('suggest')||'').slice(0,80);
   if(term.length<2)return json({matches:[]});
   await limited(request,'lookup',70);
   const roster=await getRoster();
   return json({matches:nameSuggestions(term,roster.members,roster.aliases)});
  }
  return json({locked:false,ready:true});
 }catch(e){
  console.error('THP request unavailable:',e.message);
  return json({error:e.message.startsWith('Too many')?e.message:'THP service is temporarily unavailable'},e.message.startsWith('Too many')?429:503);
 }
}
export async function POST(request){
 if(!secureRequest(request))return json({error:'Open this form from the UTW website.'},403);
 try{
  const type=request.headers.get('content-type')||'';
  if(type.startsWith('application/json')){
   const actor=await reviewAllowed(request);
   if(!actor)return json({error:'R4 sign-in required'},401);
   if(Number(request.headers.get('content-length')||0)>6000)return json({error:'Review request too large'},413);
   const body=await request.json();
   if(body?.action!=='review'||!validId(body.id)||!['approved','rejected'].includes(body.decision))
    return json({error:'Select a pending THP submission and review decision'},400);
   await limited(request,'review',60);
   const pThp=powerFromInput(body.heroPower),pSquad=powerFromInput(body.squadPower);
   if(body.decision==='approved'&&(!/^[A-Za-z0-9_-]{1,100}$/.test(body.sourceMemberId||'')||
    pThp===null||pSquad===null||!['tank','air','missile'].includes(body.squadType)))
    return json({error:'Select the correct existing member and verify both THP and squad information'},400);
   const note=String(body.reviewNote||'').trim();
   if(note.length>500)return json({error:'Review note must be under 500 characters'},400);
   const result=await db('rpc/utw_review_member_thp',{
    method:'POST',body:JSON.stringify({
     p_id:body.id,p_decision:body.decision,p_member_id:body.decision==='approved'?body.sourceMemberId:null,
     p_hero_power:body.decision==='approved'?pThp:null,
     p_squad_type:body.decision==='approved'?body.squadType:null,
     p_squad_power:body.decision==='approved'?pSquad:null,
     p_reviewer:String(actor.username||actor.display_name||'R4').slice(0,80),
     p_note:note
    })
   });
   return json({ok:true,record:result});
  }
  if(!type.startsWith('multipart/form-data'))return json({error:'Submit the THP form from Members Den.'},415);
  if(!pageAllowed(request))return json({error:'Enter the UTW member passcode first.'},401);
  await limited(request,'submit',12);
  const form=await request.formData();
  const payload=cleanThpSubmission({
   name:form.get('name'),squadType:form.get('squadType'),
   squadPower:form.get('squadPower'),heroPower:form.get('heroPower'),note:form.get('note')
  });
  if(String(form.get('website')||'').trim())return json({error:'Invalid submission'},400);
  const file=form.get('screenshot');
  if(file&&typeof file==='object'&&file.size>3145728)
   return json({error:'Screenshot exceeds the 3 MB upload limit.'},413);
  const id=randomUUID();
  const path=file&&typeof file==='object'&&file.size?await uploadEvidence(id,file):null;
  try{
   const rows=await db('utw_thp_submissions',{
    method:'POST',headers:{Prefer:'return=representation'},
    body:JSON.stringify([{id,...payload,measurement_date:todayServer(),evidence_path:path}])
   });
   if(!Array.isArray(rows)||rows.length!==1)throw Error('THP submission was not saved');
   return json({ok:true,id,status:'pending',message:'Your THP update was sent to R4 for review.'},201);
  }catch(e){await deleteEvidence(path);throw e}
 }catch(e){
  const message=e.message||'Unable to submit THP';
  const invalid=/^(Enter |Choose |Keep |Please |Screenshot |Too many |Reviewer |Invalid |This )/.test(message);
  console.error('THP submission failed:',invalid?message:'Storage error');
  return json({error:invalid?message:'Could not complete the THP request. Please try again.'},invalid?400:503);
 }
}
