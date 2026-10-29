import {createHash} from 'node:crypto';
import {authorizedAlliance,weeks} from './r4-planner.mjs';
import {sessionUser} from '../lib/r4-auth.mjs';
import {scopeForTask,isFactionTask} from '../lib/r4-workspace.mjs';

const headers={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
const json=(data,status=200)=>Response.json(data,{status,headers});
const validKey=key=>{
  if(typeof key!=='string'||!/^(?:[0-9])-\d+-\d+$/.test(key))return false;
  const [w,g,i]=key.split('-').map(Number);
  return w>=0&&w<weeks.length&&g>=0&&g<weeks[w].groups.length&&i>=0&&i<weeks[w].groups[g].items.length;
};
const taskKeysForWeek=week=>weeks[week].groups.flatMap((g,group)=>g.items.map((_,item)=>week+'-'+group+'-'+item));
const formatComment=c=>({id:c.id,task_key:c.task_key,author:c.author,body:c.body,created_at:c.created_at,scope:c.alliance});
const requestedAlliance=v=>v===null?'utw':['utw','von'].includes(v)?v:null;
const denied=async request=>json({error:'No access to this alliance discussion'},(await sessionUser(request).catch(()=>null))?403:401);
const cleanText=(value,max)=>typeof value==='string'&&value.trim().length>=1&&value.trim().length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)?value.trim():null;
const configured=()=>Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY);
async function db(path,options={}){
  if(!configured())throw Error('Database not configured');
  const response=await fetch(process.env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/'+path,{
    ...options,
    headers:{apikey:process.env.SUPABASE_SECRET_KEY,'Content-Type':'application/json',...options.headers},
    signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)throw Error('Database unavailable');
  return response.json();
}
async function rateLimited(request){
  const ip=(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'unknown').split(',')[0];
  const digest=createHash('sha256').update(ip).digest('hex');
  const count=await db('rpc/utw_buddy_rate_limit',{
    method:'POST',
    body:JSON.stringify({p_key:'r4-comment:'+digest})
  });
  if(!Number.isInteger(count))throw Error('Rate limit unavailable');
  return count>30;
}
export async function GET(request){
  const url=new URL(request.url);
  const alliance=requestedAlliance(url.searchParams.get('alliance'));
  if(!alliance)return json({error:'Invalid alliance'},400);
  if(!await authorizedAlliance(request,alliance))return denied(request);
  const w=url.searchParams.get('week');
  if(!/^[0-9]$/.test(w)||Number(w)>=weeks.length)return json({error:'Invalid week.'},400);
  const week=Number(w);
  try{
    const params=new URLSearchParams({
      select:'id,task_key,author,body,created_at,alliance',
      task_key:'like.'+week+'-*',
      alliance:'in.('+alliance+',faction)',
      order:'created_at.desc',
      limit:'500'
    });
    const comments=await db('utw_r4_comments?'+params);
    if(!Array.isArray(comments))throw Error('Invalid data');
    const allowed=new Set(taskKeysForWeek(week));
    return json({comments:comments.filter(c=>allowed.has(c.task_key)&&(c.alliance===alliance||(c.alliance==='faction'&&isFactionTask(c.task_key,weeks)))).reverse().map(formatComment)});
  }catch{return json({error:'Shared discussions are not available. Check the R4 database setup.'},503)}
}
export async function POST(request){
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
  let body;
  try{
    const raw=await request.text();
    if(raw.length>3000)return json({error:'Comment is too long.'},413);
    body=JSON.parse(raw);
  }catch{return json({error:'Invalid comment request.'},400)}
  const alliance=requestedAlliance(body.alliance??null);
  if(!alliance)return json({error:'Invalid alliance'},400);
  if(!await authorizedAlliance(request,alliance))return denied(request);
  if(!validKey(body.taskKey))return json({error:'Invalid checklist task.'},400);
  const scope=scopeForTask(alliance,body.taskKey,weeks);
  if(!scope)return json({error:'Invalid checklist scope'},400);
  const author=cleanText(body.author,40),message=cleanText(body.body,1200);
  if(!author||!message)return json({error:'Enter an in-game name and a comment (maximum 1200 characters).'},400);
  try{
    if(await rateLimited(request))return json({error:'Too many comments. Please try again later.'},429);
    const result=await db('utw_r4_comments',{
      method:'POST',
      headers:{Prefer:'return=representation'},
      body:JSON.stringify({task_key:body.taskKey,author,body:message,alliance:scope})
    });
    if(!Array.isArray(result)||result.length!==1)throw Error('Invalid data');
    return json({comment:formatComment(result[0])},201);
  }catch{return json({error:'Could not save this comment. The shared discussion database may need setup.'},503)}
}
