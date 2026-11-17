import {authorizedAccess} from './r4-planner.mjs';
import {sessionUser} from '../lib/r4-auth.mjs';
import {GET as page} from '../lib/r4-polls-page.mjs';

const privateHeaders={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
const json=(data,status=200)=>Response.json(data,{status,headers:privateHeaders});
const allowedTypes=new Set(['svs','trade_post','wednesday_war','saturday_war']);
const isDate=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const clean=(s,max)=>String(s||'').trim().slice(0,max);
const sb=()=>{const url=process.env.SUPABASE_URL?.replace(/\/$/,'');const key=process.env.SUPABASE_SECRET_KEY;if(!url||!key)throw Error('R4 poll database is not configured');return {url,key}};
async function db(path,opts={}){
 const {url,key}=sb();const r=await fetch(url+'/rest/v1/'+path,{...opts,headers:{apikey:key,'Content-Type':'application/json',...opts.headers},signal:AbortSignal.timeout(20000)});
 if(!r.ok){const msg=(await r.text()).slice(0,400);throw Error('Database: '+msg)}
 if(r.status===204)return null;
 return r.json();
}
const params=o=>new URLSearchParams(o).toString();
const list=(table,o)=>db(table+'?'+params(o));
async function all(table,filter,limit=15000){
 const rows=[];for(let offset=0;offset<limit;offset+=1000){
  const page=await list(table,{...filter,offset:String(offset),limit:'1000'});
  if(!Array.isArray(page))throw Error('Incomplete database response');
  rows.push(...page);if(page.length<1000)return rows;
 }throw Error('Poll report limit reached. Narrow the date range.');
}
async function active(request){
 if(!await authorizedAccess(request))return null;
 const u=await sessionUser(request).catch(()=>null);
 return u&&['r4','admin'].includes(u.role)?u:null;
}
function err(e){
 const message=String(e?.message||'Unexpected error').replace(/https?:\/\/\S+/g,'').slice(0,300);
 return json({error:message},/changed since|duplicate key|unique constraint|conflict/i.test(message)?409:400);
}
async function rosterFor(date){
 const [report,members]=await Promise.all([
  db('rpc/utw_stat_member_report_data',{method:'POST',body:JSON.stringify({p_to:date})}),
  list('utw_stat_members',{select:'id,display_name,archived_at',limit:'1000'})
 ]);
 if(!report||!Array.isArray(report.roster)||!Array.isArray(members))throw Error('Latest VS roster not available');
 const names=new Map(members.map(m=>[m.id,m]));
 const roster=[...new Set(report.roster)].map(id=>names.get(id)).filter(m=>m&&(!m.archived_at||m.archived_at.slice(0,10)>date)).map(m=>({id:m.id,name:m.display_name}));
 return {roster,rosterDate:report.rosterDate||null,source:'Most recent saved VS roster'};
}
async function loadEvents(){
 return all('utw_poll_events',{select:'id,event_type,event_date,title,status,reviewed_yes,reviewed_no,reviewed_maybe,revision,roster,roster_date,roster_source,created_by,updated_by,created_at,updated_at',order:'event_date.desc,created_at.desc'},1000);
}
async function loadPoll(id){
 const rows=await list('utw_poll_events',{select:'*',id:'eq.'+id,limit:'1'});
 if(rows.length!==1)return null;
 const [votes,changes]=await Promise.all([
  all('utw_poll_votes',{select:'member_id,response,source,note,updated_at,updated_by',poll_id:'eq.'+id,order:'updated_at.desc'},1000),
  all('utw_poll_changes',{select:'id,member_id,action,old_response,new_response,details,actor,created_at',poll_id:'eq.'+id,order:'id.desc'},5000)
 ]);
 return {poll:rows[0],votes,changes};
}
const counts=(poll,votes)=>{
 const eligible=new Set(poll.roster.map(x=>x.id)),seen=new Set(),result={yes:0,no:0,maybe:0,missing:0,roster:eligible.size};
 for(const row of votes){if(eligible.has(row.member_id)){result[row.response]++;seen.add(row.member_id)}}
 result.missing=Math.max(0,eligible.size-seen.size);return result;
};
async function reportData(q){
 const from=q.get('from'),to=q.get('to'),type=q.get('type');
 if((from&&!isDate(from))||(to&&!isDate(to))||(from&&to&&from>to)||(type&&type!=='all'&&!allowedTypes.has(type)))throw Error('Invalid report filters');
 let events=(await loadEvents()).filter(x=>x.status==='finalized'&&(!from||x.event_date>=from)&&(!to||x.event_date<=to)&&(!type||type==='all'||x.event_type===type));
 const members=await all('utw_stat_members',{select:'id,display_name,archived_at',order:'display_name.asc'},1000);
 const history=new Map(members.map(m=>[m.id,{id:m.id,name:m.display_name,archived:!!m.archived_at,eligible:0,yes:0,no:0,maybe:0,missing:0,late:0,events:[],byType:{}}]));
 const byPoll={};const summary={polls:events.length,eligibleResponses:0,yes:0,no:0,maybe:0,missing:0,byType:{},byMonth:{}};
 // Chunk by poll count to keep requests within PostgREST's 1000-row limit.
 for(let i=0;i<events.length;i+=7){
  const group=events.slice(i,i+7);
  const votes=await all('utw_poll_votes',{select:'poll_id,member_id,response,source',poll_id:'in.('+group.map(p=>p.id).join(',')+')'},3000);
  const by=new Map();for(const v of votes){if(!by.has(v.poll_id))by.set(v.poll_id,[]);by.get(v.poll_id).push(v)}
  for(const p of group){
   const existing=new Map((by.get(p.id)||[]).map(v=>[v.member_id,v]));
   const allEligible=new Set();
   const c=counts(p,by.get(p.id)||[]);byPoll[p.id]=c;
   const bucket=summary.byType[p.event_type]??={polls:0,yes:0,no:0,maybe:0,missing:0};
   bucket.polls++;const month=summary.byMonth[p.event_date.slice(0,7)]??={polls:0,yes:0,no:0,maybe:0,missing:0};month.polls++;for(const label of ['yes','no','maybe','missing']){summary[label]+=c[label];bucket[label]+=c[label];month[label]+=c[label]}
   for(const person of p.roster){
    if(allEligible.has(person.id))continue;allEligible.add(person.id);
    const h=history.get(person.id);if(!h)continue;
    const v=existing.get(person.id),response=v?.response||'missing';
    h.eligible++;h[response]++;h.late+=Number(v?.source==='manual');h.events.push({poll_id:p.id,event_date:p.event_date,event_type:p.event_type,title:p.title,response,source:v?.source||null});
    const t=h.byType[p.event_type]??={eligible:0,yes:0,no:0,maybe:0,missing:0};
    t.eligible++;t[response]++;
   }
  }
 }
 const profiles=[...history.values()].filter(x=>x.eligible>0).map(x=>({...x,responded:x.yes+x.no+x.maybe,noRate:(x.yes+x.no+x.maybe)?x.no/(x.yes+x.no+x.maybe):0,responseRate:x.eligible?(x.eligible-x.missing)/x.eligible:0})).sort((a,b)=>b.eligible-a.eligible||a.name.localeCompare(b.name));
 return {summary,profiles,polls:events.map(p=>({id:p.id,event_type:p.event_type,event_date:p.event_date,title:p.title,...byPoll[p.id]}))};
}
const csvValue=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
function csvDownload(rows,filename){
 const content='\uFEFF'+rows.map(row=>row.map(csvValue).join(',')).join('\r\n')+'\r\n';
 return new Response(content,{headers:{...privateHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="'+filename+'"'}});
}
export async function GET(request){
 const q=new URL(request.url).searchParams;
 if(q.get('view')==='page')return page(request);
 const u=await active(request);if(!u)return json({error:'Sign in with an individual UTW R4 login'},403);
 try{
  if(q.get('roster')==='1'){const date=q.get('date');if(!isDate(date))return json({error:'Valid poll date required'},400);return json(await rosterFor(date))}
  if(q.has('poll')){if(!uuid(q.get('poll')))return json({error:'Invalid poll ID'},400);const poll=await loadPoll(q.get('poll'));return poll?json(poll):json({error:'Poll not found'},404)}
  if(q.get('report')==='1')return json(await reportData(q));
  if(q.get('export')){
   const kind=q.get('export');
   if(kind==='poll'||kind==='history'){
    const id=q.get('id');if(!uuid(id))return json({error:'Choose a valid poll'},400);
    const record=await loadPoll(id);if(!record)return json({error:'Poll not found'},404);
    const {poll,votes,changes}=record;
    const members=await list('utw_stat_members',{select:'id,display_name',limit:'1000'});const names=new Map(members.map(m=>[m.id,m.display_name]));
    if(kind==='history')return csvDownload([['poll','at','action','member','before','after','R4','details'],...changes.map(c=>[poll.title,c.created_at,c.action,names.get(c.member_id)||'',c.old_response||'',c.new_response||'',c.actor,JSON.stringify(c.details)])],'utw-poll-history-'+poll.event_date+'.csv');
    const by=new Map(votes.map(v=>[v.member_id,v]));
    return csvDownload([['event_date','event_type','poll','member_name','response','source','note','roster_date'],...poll.roster.map(p=>{const v=by.get(p.id);return [poll.event_date,poll.event_type,poll.title,names.get(p.id)||p.name,v?.response||(poll.status==='finalized'?'No Response':'Not reviewed'),v?.source||'',v?.note||'',poll.roster_date||'']})],'utw-poll-'+poll.event_date+'.csv');
   }
   if(kind==='backup'){
    const events=await loadEvents(),votes=await all('utw_poll_votes',{select:'*'},15000),changes=await all('utw_poll_changes',{select:'*'},15000);
    return new Response(JSON.stringify({exportedAt:new Date().toISOString(),events,votes,changes},null,2),{headers:{...privateHeaders,'Content-Type':'application/json','Content-Disposition':'attachment; filename="utw-poll-backup.json"'}});
   }
   return json({error:'Unknown export type'},400);
  }
  const [events,members,aliases]=await Promise.all([
   loadEvents(),
   list('utw_stat_members',{select:'id,display_name,archived_at',order:'display_name.asc',limit:'1000'}),
   list('utw_stat_aliases',{select:'alias_key,alias,member_id',limit:'5000'})
  ]);
  return json({events:events.map(p=>({...p,roster_count:p.roster.length,roster:undefined})),members,aliases});
 }catch(e){return err(e)}
}
export async function POST(request){
 const u=await active(request);if(!u)return json({error:'Individual UTW R4 login required'},403);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin'},403);
 if(Number(request.headers.get('content-length')||0)>180000)return json({error:'Request too large'},413);
 try{
  const raw=await request.text();if(raw.length>180000)throw Error('Request too large');
  const body=JSON.parse(raw),actor=clean(u.username||u.display_name,80);
  if(body.action==='create'){
   const type=body.event_type,date=body.event_date,title=clean(body.title,120);
   if(!allowedTypes.has(type)||!isDate(date)||title.length<2||String(body.title||'').length>120)return json({error:'Choose valid type, date and title'},400);
   const snapshot=await rosterFor(date);
   const created=await db('utw_poll_events',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({
    event_type:type,event_date:date,title,roster:snapshot.roster,
    roster_date:snapshot.rosterDate,roster_source:snapshot.source,
    created_by:actor,updated_by:actor
   })});
   return json({ok:true,poll:created[0]},201);
  }
  if(body.action==='change'){
   if(!uuid(body.poll_id)||!Number.isInteger(body.revision)||body.revision<0||typeof body.operation!=='string'||!body.payload||typeof body.payload!=='object')return json({error:'Invalid poll change'},400);
   if(body.operation==='votes'){
    const p=body.payload;
    if(!['yes','no','maybe'].includes(p.response)||!['append','replace','manual'].includes(p.mode)||!Array.isArray(p.items)||p.items.length>250)return json({error:'Review up to 250 votes in a valid category'},400);
    if(p.items.some(i=>!uuid(i.member_id)||!['csv','screenshot','manual'].includes(i.source)||String(i.note||'').length>500))return json({error:'Invalid reviewed vote'},400);
   }else if(body.operation==='eligibility'){
    if(!uuid(body.payload.member_id)||!['add','remove'].includes(body.payload.mode))return json({error:'Invalid eligibility update'},400);
   }else if(body.operation==='remove_vote'){
    if(!uuid(body.payload.member_id)||String(body.payload.reason||'').length>500)return json({error:'Choose a valid vote to remove'},400);
   }else if(body.operation==='review'){
    if(!['yes','no','maybe'].includes(body.payload.category)||typeof body.payload.reviewed!=='boolean')return json({error:'Invalid review status'},400);
   }else if(body.operation!=='finalize')return json({error:'Unsupported action'},400);
   const result=await db('rpc/utw_poll_change',{method:'POST',body:JSON.stringify({
    p_poll_id:body.poll_id,p_revision:body.revision,p_operation:body.operation,p_payload:body.payload,p_actor:actor
   })});
   return json(result);
  }
  return json({error:'Unknown action'},400);
 }catch(e){return err(e)}
}
