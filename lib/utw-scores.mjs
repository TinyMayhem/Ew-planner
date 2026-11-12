// Read-only Alliance Duel / UTW VS Hub bridge for the R4 Command Center.
// External Supabase uses a publishable key; this module only runs server-side.
import {resolveNames} from './train-advice.mjs';

const TABLE={vs:'vs_weekly',donations:'donations_weekly'};
export const utwConfigured=()=>Boolean(process.env.UTW_SUPABASE_URL&&process.env.UTW_SUPABASE_ANON_KEY);

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
 const [rows,utwMembers,utwAliases]=await Promise.all([
  utw(TABLE[mode]+'?select=member_id,points&week_start=eq.'+reportWeek+'&limit=1000'),
  utw('members?select=id,name&limit=1000'),
  utw('member_aliases?select=alias,member_id&limit=5000')
 ]);
 if(!Array.isArray(rows)||!rows.length)return null;
 const resolve=resolveNames(members,aliases);
 const utwName=new Map(utwMembers.map(m=>[m.id,m.name]));
 const otherNames=new Map();
 for(const a of utwAliases){
  if(!otherNames.has(a.member_id))otherNames.set(a.member_id,[]);
  otherNames.get(a.member_id).push(a.alias);
 }
 const toDesk=utwId=>{
  for(const n of [utwName.get(utwId),...(otherNames.get(utwId)||[])]){
   const id=n&&resolve(n);
   if(id)return id;
  }
  return null;
 };
 const scores=new Map(),unmatched=[];
 for(const row of rows){
  const id=toDesk(row.member_id);
  const points=Number(row.points);
  if(id&&Number.isFinite(points))scores.set(id,Math.max(points,scores.get(id)??-Infinity));
  else unmatched.push(utwName.get(row.member_id)||('UTW #'+row.member_id));
 }
 return {scoreboard:[...scores].map(([member_id,points])=>({member_id,points})),scoreDate:reportWeek,unmatched};
}

// Current weekly leaderboards for the Rankings tab. Does not alter R4 data.
export async function utwWeeklyOverview(reportWeek){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(reportWeek||''))throw Error('Invalid Alliance Duel week');
 const [vs,donations,members]=await Promise.all([
  utw('vs_weekly?select=member_id,points&week_start=eq.'+reportWeek+'&limit=1000'),
  utw('donations_weekly?select=member_id,points&week_start=eq.'+reportWeek+'&limit=1000'),
  utw('members?select=id,name&limit=1000')
 ]);
 const names=new Map(members.map(m=>[m.id,m.name]));
 const ranking=rows=>rows.filter(r=>Number.isFinite(Number(r.points))).map(r=>({
  name:names.get(r.member_id)||'Unknown member',points:Number(r.points)
 })).sort((a,b)=>b.points-a.points);
 return {week:reportWeek,source:'Alliance Duel',vs:ranking(vs),donations:ranking(donations)};
}
