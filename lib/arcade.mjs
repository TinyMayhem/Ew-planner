import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {validSession} from './buddies.mjs';

// The public arcade is deliberately separate from all UTW roster / R4 tables.
// All database credentials stay on the server. Browser clients never write directly.
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const configured=()=>Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY&&process.env.UTW_SESSION_SECRET?.length>=32);
const memberAllowed=request=>validSession(request.headers.get('cookie'),'page')||validSession(request.headers.get('cookie'));
const cleanName=value=>typeof value==='string'?value.normalize('NFKC').replace(/[\u0000-\u001f\u007f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,32):'';
const cleanTag=value=>typeof value==='string'?value.normalize('NFKC').trim().replace(/[\[\]]/g,'').replace(/[^\p{L}\p{N}_-]/gu,'').toUpperCase().slice(0,12):'';
const sameOrigin=request=>{const origin=request.headers.get('origin');return Boolean(origin&&origin===new URL(request.url).origin)};
const signature=payload=>createHmac('sha256',process.env.UTW_SESSION_SECRET).update(payload).digest('base64url');
const issue=claims=>{const payload=Buffer.from(JSON.stringify(claims)).toString('base64url');return payload+'.'+signature(payload)};
function decode(token){
 if(typeof token!=='string'||token.length>900||token.length<50)return null;
 try{
  const [payload,received,...rest]=token.split('.');
  if(rest.length||!payload||!received)return null;
  const expected=signature(payload);
  if(expected.length!==received.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(received)))return null;
  const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
  if(data.version!==1||!Number.isFinite(data.start)||Date.now()>data.start+4*3600000)return null;
  return data;
 }catch{return null;}
}
async function db(path,opts={}){
 const response=await fetch(process.env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/'+path,{
  ...opts,
  headers:{apikey:process.env.SUPABASE_SECRET_KEY,'Content-Type':'application/json',...opts.headers},
  signal:AbortSignal.timeout(8500)
 });
 if(!response.ok)throw Error('Arcade database unavailable');
 const text=await response.text();
 return text?JSON.parse(text):null;
}
async function rateLimited(request,action){
 const ip=(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim().slice(0,80);
 const digest=createHash('sha256').update(ip).digest('hex');
 const hits=await db('rpc/utw_buddy_rate_limit',{method:'POST',body:JSON.stringify({p_key:'arcade:'+action+':'+digest})});
 if(!Number.isInteger(hits))throw Error('Rate limit unavailable');
 return hits>(action==='start'?50:65);
}
function weekStartUTC(){
 const d=new Date(Date.now()-2*3600000); // Game Server Time is fixed UTC-2
 d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
 d.setUTCHours(0,0,0,0);
 return new Date(d.getTime()+2*3600000).toISOString();
}
export async function GET(request){
 const url=new URL(request.url);
 if(url.searchParams.get('view')==='access')return json({memberAccess:memberAllowed(request)});
 if(!configured())return json({error:'The shared scoreboard is currently unavailable.'},503);
 const mode=url.searchParams.get('mode')==='endless'?'endless':'quick';
 const when=url.searchParams.get('when')==='all'?'all':'weekly';
 const group=['guest','member'].includes(url.searchParams.get('group'))?url.searchParams.get('group'):'all';
 try{
  const query=new URLSearchParams({
   select:'player_name,player_type,alliance_tag,mode,points,elapsed_seconds,created_at',
   mode:'eq.'+mode,
   order:'points.desc,created_at.asc',
   limit:'1000'
  });
  if(group!=='all')query.set('player_type','eq.'+group);
  if(when==='weekly')query.set('created_at','gte.'+weekStartUTC());
  const rows=await db('utw_arcade_scores?'+query.toString());
  if(!Array.isArray(rows))throw Error('Invalid scoreboard data');
  const best=new Map();
  for(const row of rows){
   const key=row.player_type+'|'+row.alliance_tag.toLocaleLowerCase()+'|'+row.player_name.toLocaleLowerCase();
   if(!best.has(key))best.set(key,{
    name:row.player_name,kind:row.player_type,tag:row.alliance_tag,
    score:row.points,when:row.created_at,mode:row.mode
   });
  }
  return json({ready:true,shared:true,mode,when,group,entries:[...best.values()].slice(0,10)});
 }catch(error){
  console.error('Arcade leaderboard read:',error.message);
  return json({error:'The shared scoreboard is temporarily unavailable.'},503);
 }
}
export async function POST(request){
 if(!configured())return json({error:'The shared scoreboard is currently unavailable.'},503);
 if(!sameOrigin(request))return json({error:'Requests must come from the UTW website.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
 let body;
 try{const raw=await request.text();if(raw.length>1800)return json({error:'Request too large.'},413);body=JSON.parse(raw)}catch{return json({error:'Invalid request.'},400)}
 if(!body||!['start','finish'].includes(body.action))return json({error:'Invalid arcade action.'},400);
 try{
  if(await rateLimited(request,body.action))return json({error:'Too many runs. Try again later.'},429);
  if(body.action==='start'){
   const mode=body.mode==='quick'?'quick':body.mode==='endless'?'endless':null;
   const kind=body.kind==='guest'?'guest':body.kind==='member'?'member':null;
   const name=cleanName(body.name);
   const tag=cleanTag(body.tag);
   if(!mode||!kind||name.length<1)return json({error:'Enter a player name and choose a mode.'},400);
   if(kind==='member'&&!memberAllowed(request))return json({error:'Unlock UTW member access before submitting member scores.'},403);
   const now=Date.now();
   const token=issue({version:1,id:randomUUID(),mode,kind,name,tag:kind==='guest'?tag:'UTW',start:now});
   return json({ok:true,token,kind,name,tag:kind==='guest'?tag:'UTW'});
  }
  const data=decode(body.token);
  if(!data)return json({error:'Invalid or expired game session. Score kept on device.'},401);
  const score=body.score,elapsed=body.elapsed,outcome=body.outcome;
  const since=(Date.now()-data.start)/1000;
  if(data.kind==='member'&&!memberAllowed(request))return json({error:'UTW member session expired. Score kept on device.'},403);
  if(!Number.isInteger(score)||score<0||score>Math.min(1000000,Math.floor(elapsed*150+1600)))
   return json({error:'Score outside game limits.'},400);
  if(typeof elapsed!=='number'||!Number.isFinite(elapsed)||elapsed<0||elapsed>14400||elapsed>since+3.5||since>14440)
   return json({error:'Run duration does not match the game session.'},400);
  if(data.mode==='quick'){
   if(elapsed>60.5)return json({error:'Quick Play cannot exceed 60 seconds.'},400);
   if(outcome==='victory'&&(elapsed<59.7||since<55))return json({error:'Quick Play victory was too short.'},400);
  }else if(outcome==='victory')return json({error:'Endless Chaos cannot be completed as a victory.'},400);
  if(!['victory','defeat'].includes(outcome))return json({error:'Unknown run result.'},400);
  const insert={
   attempt_id:data.id,game:'u-dodge',player_type:data.kind,player_name:data.name,
   alliance_tag:data.tag,mode:data.mode,points:score,elapsed_seconds:Math.round(elapsed*100)/100,
   outcome
  };
  await db('utw_arcade_scores',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(insert)});
  return json({ok:true,shared:true,name:data.name,kind:data.kind,tag:data.tag,score});
 }catch(error){
  console.error('Arcade score submission:',error.message);
  return json({error:'Could not save the shared score. Your local score is safe.'},503);
 }
}
