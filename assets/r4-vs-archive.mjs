// Pure helpers for the private R4 VS archive.
// One saved CSV snapshot per metric/date is active; corrections replace older snapshots.
export const DAILY_TARGET=7_200_000;
export const WEEKLY_TARGET=42_000_000;
const iso=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function dateAdd(s,days){
 if(!iso(s))throw Error('Invalid calendar date');
 return new Date(Date.parse(s+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
}
export function weekOf(date){
 if(!iso(date))throw Error('Invalid reporting date');
 const day=new Date(date+'T00:00:00Z').getUTCDay();
 return dateAdd(date,-((day+6)%7));
}
export function scoreFlag(metric,points){
 const threshold=metric==='vs_daily'?DAILY_TARGET:metric==='vs_weekly'?WEEKLY_TARGET:null;
 return threshold!==null&&Number.isFinite(points)&&points<threshold;
}
export function activeVsImports(imports){
 const out=new Map();
 // The API supplies newest first; guard against other orderings and corrected CSVs.
 for(const imp of imports||[]){
  if(!['vs_daily','vs_weekly'].includes(imp.metric)||!iso(imp.period))continue;
  const k=imp.metric+'|'+imp.period;
  const existing=out.get(k);
  if(!existing||String(imp.created_at||'')>String(existing.created_at||'')||
     (imp.created_at===existing.created_at&&String(imp.id)>String(existing.id)))out.set(k,imp);
 }
 return [...out.values()];
}
export function archivedWeeks(imports){
 const grouped=new Map();
 for(const imp of activeVsImports(imports)){
  const week=weekOf(imp.period);
  if(!grouped.has(week))grouped.set(week,{week,days:new Set(),hasWeekly:false});
  const w=grouped.get(week);
  if(imp.metric==='vs_weekly')w.hasWeekly=true;
  else if(imp.period>=week&&imp.period<=dateAdd(week,5))w.days.add(imp.period);
 }
 return [...grouped.values()].map(w=>({week:w.week,dailyCount:w.days.size,hasWeekly:w.hasWeekly})).sort((a,b)=>b.week.localeCompare(a.week));
}
export function vsWeekSlots(week,imports){
 const active=new Map(activeVsImports(imports).map(i=>[i.metric+'|'+i.period,i]));
 const rows=[];
 for(let d=0;d<6;d++){
  const period=dateAdd(week,d),imp=active.get('vs_daily|'+period);
  rows.push({label:'VS Day '+(d+1),metric:'vs_daily',period,threshold:DAILY_TARGET,import:imp||null});
 }
 const total=active.get('vs_weekly|'+week);
 rows.push({label:'Weekly Total',metric:'vs_weekly',period:week,threshold:WEEKLY_TARGET,import:total||null});
 return rows;
}
export function vsLeaderboard(data,metric,period){
 const imp=(data.imports||[]).find(x=>x.metric===metric&&x.period===period);
 if(!imp)return [];
 const lookup=new Map((data.aliases||[]).map(a=>[a.alias_key,a.member_id]));
 const names=new Map((data.members||[]).map(m=>[m.id,m.display_name]));
 const byMember=new Map();
 for(const value of data.values||[]){
  if(value.import_id!==imp.id)continue;
  const id=lookup.get(value.alias_key),points=Number(value.points);
  if(!id||!Number.isSafeInteger(points)||points<0)continue;
  const prev=byMember.get(id);
  // Nickname merges must not double-count the same member within one snapshot.
  if(!prev||points>prev.points)byMember.set(id,{id,name:names.get(id)||value.original_name,points,duplicate:!!prev});
  else prev.duplicate=true;
 }
 return [...byMember.values()].sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name)).map((r,i)=>({...r,rank:i+1,belowTarget:scoreFlag(metric,r.points)}));
}
