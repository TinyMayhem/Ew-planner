// Evidence-based UTW R4 performance reports. Missing uploads are not zero scores.
// All dates in this report are source snapshot dates, in server calendar time.
export const METRICS=['vs_daily','vs_weekly','donations_weekly'];
export const DEFAULTS=Object.freeze({dailyMinimum:7200000,weeklyMinimum:42000000,donationMinimum:1,minSamples:2,missPercent:50});

const ratio=(a,b)=>b?Math.round(a/b*100):null;
const dec=x=>Number(x)||0;
const numeric=(value,name)=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid '+name);return n};

export function buildMemberPerformance(raw,settings={}){
 const cfg={
  dailyMinimum:numeric(settings.dailyMinimum??DEFAULTS.dailyMinimum,'daily minimum'),
  weeklyMinimum:numeric(settings.weeklyMinimum??DEFAULTS.weeklyMinimum,'weekly minimum'),
  donationMinimum:numeric(settings.donationMinimum??DEFAULTS.donationMinimum,'donation minimum'),
  minSamples:numeric(settings.minSamples??DEFAULTS.minSamples,'minimum samples'),
  missPercent:numeric(settings.missPercent??DEFAULTS.missPercent,'miss percentage')
 };
 if(cfg.minSamples<1||cfg.minSamples>100||cfg.missPercent>100)throw Error('Invalid report criteria');
 const members=Array.isArray(raw.members)?raw.members:[],snapshots=Array.isArray(raw.snapshots)?raw.snapshots:[],
  observations=Array.isArray(raw.observations)?raw.observations:[];
 const snapshotById=new Map(snapshots.map(x=>[String(x.id),x]));
 const metrics=Object.fromEntries(METRICS.map(metric=>[metric,snapshots.filter(x=>x.metric===metric)]));
 const seen=new Map();
 for(const x of observations){
  const snapshot=snapshotById.get(String(x.snapshotId));
  if(!snapshot||!METRICS.includes(snapshot.metric))continue;
  const points=Number(x.points);if(!Number.isSafeInteger(points)||points<0)continue;
  const id=String(x.memberId);
  const key=id+'|'+snapshot.id;
  const prev=seen.get(key);
  // Two aliases in the same screenshot are not two independent observations.
  if(!prev||points>prev.points)seen.set(key,{memberId:id,points,date:snapshot.date,season:snapshot.season,metric:snapshot.metric,snapshotId:snapshot.id});
 }
 const grouped=new Map();
 for(const x of seen.values()){const key=x.memberId+'|'+x.metric;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(x)}
 const roster=new Set(Array.isArray(raw.roster)?raw.roster.map(String):[]);
 const usingRoster=settings.rosterOnly!==false&&roster.size>0;
 const included=members.filter(m=>!usingRoster||roster.has(String(m.id)));
 const out=[];
 for(const m of included){
  const metricsOf={};
  for(const metric of METRICS){
   const entries=(grouped.get(String(m.id)+'|'+metric)||[]).sort((a,b)=>a.date.localeCompare(b.date)||a.season.localeCompare(b.season));
   const min=metric==='vs_daily'?cfg.dailyMinimum:metric==='vs_weekly'?cfg.weeklyMinimum:cfg.donationMinimum;
   const misses=entries.filter(x=>x.points<min);
   const zero=entries.filter(x=>x.points===0);
   let currentStreak=0;for(const x of entries.slice().reverse()){if(x.points>=min)break;currentStreak++}
   metricsOf[metric]={
    recorded:entries.length,uploads:metrics[metric].length,
    missing:Math.max(0,metrics[metric].length-entries.length),
    below:misses.length,rate:ratio(misses.length,entries.length),
    zero:zero.length,min,streak:currentStreak,
    consistent:entries.length>=cfg.minSamples&&misses.length>0&&ratio(misses.length,entries.length)>=cfg.missPercent,
    alwaysBelow:entries.length>=cfg.minSamples&&misses.length===entries.length,
    entries:entries.map(x=>({date:x.date,season:x.season,points:x.points,below:x.points<min,zero:x.points===0})).reverse(),
    missedDates:misses.map(x=>x.date).reverse()
   };
  }
  const d=metricsOf.vs_daily,w=metricsOf.vs_weekly,don=metricsOf.donations_weekly;
  const flags=[d.consistent&&'Repeated daily VS misses',w.consistent&&'Repeated weekly VS misses',
   don.consistent&&'Below donation target',don.zero>0&&'Recorded zero donations'].filter(Boolean);
  out.push({id:String(m.id),name:m.name,metrics:metricsOf,flags,flagCount:flags.length,
   concerning:d.consistent||w.consistent||don.consistent,
   neverMetVs:d.alwaysBelow||w.alwaysBelow,
   missingData:METRICS.every(metric=>metricsOf[metric].recorded===0),
   lastRecorded:[...METRICS.flatMap(metric=>metricsOf[metric].entries.map(x=>x.date))].sort().at(-1)||null
  });
 }
 out.sort((a,b)=>b.flagCount-a.flagCount||b.metrics.vs_daily.below-a.metrics.vs_daily.below||a.name.localeCompare(b.name));
 const summary={
  rosterCount:out.length,rosterSource:usingRoster?'Latest available VS roster':'All member directory records',
  rosterDate:raw.rosterDate||null,
  uploads:Object.fromEntries(METRICS.map(metric=>[metric,metrics[metric].length])),
  dateCoverage:Object.fromEntries(METRICS.map(metric=>[metric,metrics[metric].map(x=>x.date)])),
  withDailyData:out.filter(x=>x.metrics.vs_daily.recorded).length,
  withWeeklyData:out.filter(x=>x.metrics.vs_weekly.recorded).length,
  withDonationData:out.filter(x=>x.metrics.donations_weekly.recorded).length,
  repeatedDaily:out.filter(x=>x.metrics.vs_daily.consistent).length,
  repeatedWeekly:out.filter(x=>x.metrics.vs_weekly.consistent).length,
  repeatedDonation:out.filter(x=>x.metrics.donations_weekly.consistent).length,
  recordedZeroDonations:out.filter(x=>x.metrics.donations_weekly.zero>0).length,
  noRecordedScores:out.filter(x=>x.missingData).length
 };
 return {settings:cfg,summary,members:out};
}

export function selectMemberReports(report,{filter='all',search=''}={}){
 const q=String(search).trim().toLocaleLowerCase();
 return report.members.filter(m=>{
  if(q&&!m.name.toLocaleLowerCase().includes(q))return false;
  const d=m.metrics.vs_daily,w=m.metrics.vs_weekly,g=m.metrics.donations_weekly;
  switch(filter){
   case 'repeated_vs':return d.consistent||w.consistent;
   case 'daily':return d.consistent;
   case 'weekly':return w.consistent;
   case 'always_vs':return d.alwaysBelow||w.alwaysBelow;
   case 'below_donations':return g.consistent;
   case 'zero_donations':return g.zero>0;
   case 'no_vs_data':return d.recorded===0&&w.recorded===0;
   case 'no_donation_data':return g.recorded===0;
   case 'any_issue':return m.flagCount>0;
   case 'all':return true;
   default:throw Error('Unknown report filter');
  }
 });
}
