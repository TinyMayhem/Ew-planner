// Read-only Alliance Duel / UTW VS Hub bridge for the R4 Command Center.
// External Supabase uses a publishable key; this module only runs server-side.
import {resolveNames} from './train-advice.mjs';

const TABLE={vs:'vs_weekly',donations:'donations_weekly'};
export const utwConfigured=()=>Boolean(
 (process.env.UTW_SUPABASE_URL&&process.env.UTW_SUPABASE_ANON_KEY)||
 (process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY)
);
async function saved(path){
 const base=process.env.SUPABASE_URL?.replace(/\/+$/,'');
 const key=process.env.SUPABASE_SECRET_KEY;
 if(!base||!key)return [];
 const response=await fetch(base+'/rest/v1/'+path,{
  headers:{apikey:key},cache:'no-store',signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw Error('UTW backup request failed ('+response.status+')');
 return response.json();
}
async function savedWeek(table,reportWeek,columns){
 return saved(table+'?select='+columns+'&week_start=eq.'+reportWeek+'&limit=2000');
}
async function savedMembers(){
 const rows=await saved('utw_duel_backup_members?select=source_member_id,name&limit=2000');
 return rows.map(r=>({id:r.source_member_id,name:r.name}));
}
async function savedAliases(){
 const rows=await saved('utw_duel_backup_aliases?select=source_member_id,alias&limit=5000');
 return rows.map(r=>({member_id:r.source_member_id,alias:r.alias}));
}


async function utw(path){
 if(!utwConfigured())throw Error('Alliance Duel connection is not configured');
 const base=process.env.UTW_SUPABASE_URL.trim().replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
 const key=process.env.UTW_SUPABASE_ANON_KEY.trim();
 const headers=key.startsWith('eyJ')?{apikey:key,Authorization:'Bearer '+key}:{apikey:key};
 const response=await fetch(base+'/rest/v1/'+path,{headers,cache:'no-store',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('Alliance Duel request failed ('+response.status+')');
 return response.json();
}

// Scores for Train Desk. Saturday VS selects this Monday; other VS dates
// and donations select the previous completed Monday, as decided by the caller.
export async function utwScoreboard({mode,reportWeek,members,aliases}){
 if(!TABLE[mode]||!/^\d{4}-\d{2}-\d{2}$/.test(reportWeek||''))return null;
 let rows=[],utwMembers=[],utwAliases=[],scoreSource='Alliance Duel';
 let liveFailure=null;
 try{
  [rows,utwMembers,utwAliases]=await Promise.all([
   utw(TABLE[mode]+'?select=member_id,points&week_start=eq.'+reportWeek+'&limit=1000'),
   utw('members?select=id,name&limit=1000'),
   utw('member_aliases?select=alias,member_id&limit=5000')
  ]);
 }catch(e){liveFailure=e;rows=[]}
 if(!Array.isArray(rows)||!rows.length){
  try{
   [rows,utwMembers,utwAliases]=await Promise.all([
    savedWeek('utw_duel_backup_'+TABLE[mode],reportWeek,'source_member_id,points'),
    savedMembers(),savedAliases()
   ]);
   rows=rows.map(r=>({...r,member_id:r.source_member_id}));
   scoreSource='UTW independent backup';
  }catch(e){if(liveFailure)throw liveFailure;throw e}
 }
 if(!Array.isArray(rows)||!rows.length){
  if(liveFailure)throw liveFailure;
  return null;
 }
 const resolve=resolveNames(members,aliases);
 const utwName=new Map(utwMembers.map(m=>[String(m.id),m.name]));
 const otherNames=new Map();
 for(const a of utwAliases){
  const key=String(a.member_id);
  if(!otherNames.has(key))otherNames.set(key,[]);
  otherNames.get(key).push(a.alias);
 }
 const toDesk=utwId=>{
  const key=String(utwId);
  for(const n of [utwName.get(key),...(otherNames.get(key)||[])]){
   const id=n&&resolve(n);
   if(id)return id;
  }
  return null;
 };
 const scores=new Map(),unmatched=[];
 for(const row of rows){
  const id=toDesk(row.member_id),points=Number(row.points);
  if(id&&Number.isFinite(points))scores.set(id,Math.max(points,scores.get(id)??-Infinity));
  else unmatched.push(utwName.get(String(row.member_id))||'Unmatched source player');
 }
 return {scoreboard:[...scores].map(([member_id,points])=>({member_id,points})),
  scoreDate:reportWeek,unmatched,scoreSource};
}

// Daily score flags reflect only the rows uploaded to Alliance Duel.
// Do not treat a day without an uploaded leaderboard as 100 missing members.
// The reference roster is the full weekly total, or the most complete daily
// leaderboard if no weekly total exists. It is not a verified attendance list.
export function buildDuelDailyReport(week,weeklyRows,dailyRows,members,threshold=7200000){
 const names=new Map(members.map(m=>[m.id,m.name]));
 const days=Array.from({length:6},(_,i)=>new Map());
 for(const r of dailyRows){
  const index=Number(r.day_number)-1,points=Number(r.points);
  if(index<0||index>5||!Number.isInteger(index)||!Number.isFinite(points)||!r.member_id)continue;
  // At most one score per member/day; handle accidental duplicates conservatively.
  const existing=days[index].get(r.member_id);
  if(existing===undefined||points>existing)days[index].set(r.member_id,points);
 }
 const weeklyIds=new Set(weeklyRows.map(r=>r.member_id).filter(Boolean));
 let reference=new Set(weeklyIds);
 let referenceLabel='Weekly VS total';
 for(let i=0;i<6;i++){
  if(days[i].size>reference.size){
   reference=new Set(days[i].keys());
   referenceLabel='VS Day '+(i+1)+' (fullest uploaded day)';
  }
 }
 const dateFor=index=>new Date(Date.parse(week+'T00:00:00Z')+index*86400000).toISOString().slice(0,10);
 const missingMembers=new Set(),underMembers=new Set();
 const report=days.map((records,i)=>{
  const uploaded=records.size>0;
  const missing=uploaded?[...reference].filter(id=>!records.has(id)).map(id=>({id,name:names.get(id)||'Unknown member'})).sort((a,b)=>a.name.localeCompare(b.name)):[];
  const under=uploaded?[...records].filter(([,points])=>points<threshold).map(([id,points])=>({id,name:names.get(id)||'Unknown member',points})).sort((a,b)=>a.points-b.points||a.name.localeCompare(b.name)):[];
  for(const m of missing)missingMembers.add(m.id);
  for(const m of under)underMembers.add(m.id);
  return {dayNumber:i+1,date:dateFor(i),uploaded,recorded:records.size,missing,under};
 });
 return {
  threshold,referenceLabel,referenceCount:reference.size,
  daysUploaded:report.filter(d=>d.uploaded).length,
  missingEntries:report.reduce((a,d)=>a+d.missing.length,0),
  underEntries:report.reduce((a,d)=>a+d.under.length,0),
  missingMembers:missingMembers.size,underMembers:underMembers.size,
  days:report
 };
}

// Current weekly leaderboards and daily compliance for the Rankings tab.
export async function utwWeeklyOverview(reportWeek){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(reportWeek||''))throw Error('Invalid Alliance Duel week');
 let vs=[],donations=[],daily=[],members=[],source='Alliance Duel';
 let liveFailure=null;
 try{
  [vs,donations,daily,members]=await Promise.all([
   utw('vs_weekly?select=member_id,points&week_start=eq.'+reportWeek+'&limit=1000'),
   utw('donations_weekly?select=member_id,points&week_start=eq.'+reportWeek+'&limit=1000'),
   utw('vs_daily?select=member_id,day_number,points&week_start=eq.'+reportWeek+'&limit=1000'),
   utw('members?select=id,name&limit=1000')
  ]);
 }catch(e){liveFailure=e;vs=[];donations=[];daily=[]}
 if(!vs.length&&!donations.length&&!daily.length){
  try{
   [vs,donations,daily,members]=await Promise.all([
    savedWeek('utw_duel_backup_vs_weekly',reportWeek,'source_member_id,points'),
    savedWeek('utw_duel_backup_donations_weekly',reportWeek,'source_member_id,points'),
    savedWeek('utw_duel_backup_vs_daily',reportWeek,'source_member_id,day_number,points'),
    savedMembers()
   ]);
   const normalize=rows=>rows.map(r=>({...r,member_id:r.source_member_id}));
   vs=normalize(vs);donations=normalize(donations);daily=normalize(daily);
   source='UTW independent backup';
  }catch(e){if(liveFailure)throw liveFailure;throw e}
 }
 if(liveFailure&&!vs.length&&!donations.length&&!daily.length)throw liveFailure;
 const names=new Map(members.map(m=>[String(m.id),m.name]));
 const ranking=rows=>rows.filter(r=>Number.isFinite(Number(r.points))).map(r=>({
  name:names.get(String(r.member_id))||'Unknown member',points:Number(r.points)
 })).sort((a,b)=>b.points-a.points);
 return {week:reportWeek,source,roster:members.map(m=>({id:String(m.id),name:m.name})),vs:ranking(vs),donations:ranking(donations),
  daily:buildDuelDailyReport(reportWeek,vs,daily,members)};
}
