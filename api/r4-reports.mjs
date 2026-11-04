import {authorizedAccess} from './r4-planner.mjs';
import {GET as reportPage} from '../lib/r4-reports-page.mjs';
import {buildMemberPerformance} from '../lib/member-performance.mjs';

const headers={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
const json=(body,status=200)=>Response.json(body,{status,headers});
const isDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const integer=(text,defaultValue,min,max)=>{
 if(text===null)return defaultValue;
 if(!/^\d+$/.test(text))return null;
 const value=Number(text);return Number.isSafeInteger(value)&&value>=min&&value<=max?value:null;
};
async function fetchReport(from,to,season){
 const endpoint=process.env.SUPABASE_URL?.replace(/\/$/,'');
 const key=process.env.SUPABASE_SECRET_KEY;
 if(!endpoint||!key)throw Error('Private database not configured');
 const res=await fetch(endpoint+'/rest/v1/rpc/utw_stat_member_report_data',{
  method:'POST',
  headers:{apikey:key,'Content-Type':'application/json','Cache-Control':'no-store'},
  body:JSON.stringify({p_from:from||null,p_to:to||null,p_season:season||null}),
  signal:AbortSignal.timeout(18000)
 });
 if(!res.ok)throw Error('Private report query failed ('+res.status+')');
 return res.json();
}
export async function GET(request){
 const page=new URL(request.url);
 if(page.searchParams.get('view')==='1')return reportPage(request);
 if(!await authorizedAccess(request))return json({error:'UTW R4 sign-in required'},401);
 const q=page.searchParams;
 const from=q.get('from'),to=q.get('to'),season=q.get('season');
 if((from&&!isDate(from))||(to&&!isDate(to))||(from&&to&&from>to)||
    (season&&!/^[a-z0-9-]{2,30}$/.test(season)))return json({error:'Choose a valid report date range and season'},400);
 const dailyMinimum=integer(q.get('daily'),7200000,0,1000000000000),
  weeklyMinimum=integer(q.get('weekly'),42000000,0,1000000000000),
  donationMinimum=integer(q.get('donations'),1,0,1000000000000),
  minSamples=integer(q.get('samples'),2,1,100),
  missPercent=integer(q.get('percent'),50,1,100);
 if([dailyMinimum,weeklyMinimum,donationMinimum,minSamples,missPercent].some(x=>x===null))
  return json({error:'Check the minimums and consistency settings'},400);
 try{
  const raw=await fetchReport(from,to,season);
  if(!raw||!Array.isArray(raw.members)||!Array.isArray(raw.snapshots)||!Array.isArray(raw.observations))
   throw Error('Unexpected private report data');
  const report=buildMemberPerformance(raw,{
   dailyMinimum,weeklyMinimum,donationMinimum,minSamples,missPercent,rosterOnly:q.get('roster')!=='all'
  });
  return json({from:from||null,to:to||null,season:season||'all',...report});
 }catch(e){console.error('UTW member reports read:',e.message);return json({error:'Reports are temporarily unavailable. Check back after data is uploaded.'},503)}
}
