// Nightly independent archive of Alliance Duel records.
// Source access is read-only. Never delete backup rows when they vanish upstream.
const HEADERS={'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'};
const JSON_HEADERS={'Content-Type':'application/json'};
const json=(obj,status=200)=>Response.json(obj,{status,headers:HEADERS});
const source=()=>({
 url:process.env.UTW_SUPABASE_URL?.replace(/\/+$/,''),
 key:process.env.UTW_SUPABASE_ANON_KEY
});
const destination=()=>({
 url:process.env.SUPABASE_URL?.replace(/\/+$/,''),
 key:process.env.SUPABASE_SECRET_KEY
});
async function fetchJson(url,options={}){
 const response=await fetch(url,{...options,cache:'no-store',signal:AbortSignal.timeout(22000)});
 const body=await response.json().catch(()=>null);
 if(!response.ok)throw Error('Database request failed ('+response.status+')');
 return body;
}
async function sourceRows(table,select,order){
 const {url,key}=source();
 const headers=key.startsWith('eyJ')?{apikey:key,Authorization:'Bearer '+key}:{apikey:key};
 const size=700;let offset=0,all=[];
 for(;;){
  const query=new URLSearchParams({select,order,limit:String(size),offset:String(offset)});
  const rows=await fetchJson(url+'/rest/v1/'+table+'?'+query,{headers});
  if(!Array.isArray(rows))throw Error('Invalid Alliance Duel '+table+' response');
  all.push(...rows);
  if(rows.length<size)break;
  offset+=size;
  if(offset>50000)throw Error('Unexpectedly large Alliance Duel '+table+' dataset');
 }
 return all;
}
async function dest(path,options={}){
 const {url,key}=destination();
 return fetchJson(url+'/rest/v1/'+path,{
  ...options,headers:{apikey:key,'Content-Type':'application/json',...options.headers}
 });
}
async function saveRows(table,rows,conflict){
 // Upsert in chunks; an existing historical record is never deleted.
 // Re-uploaded corrections update the snapshot in our archive.
 for(let i=0;i<rows.length;i+=250){
  const slice=rows.slice(i,i+250);
  await dest(table+'?on_conflict='+encodeURIComponent(conflict),{
   method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
   body:JSON.stringify(slice)
  });
 }
}
const asId=x=>String(x??'').trim();
const asScore=x=>{
 const score=Number(x);
 if(!Number.isFinite(score)||score<0)throw Error('Invalid score in Alliance Duel data');
 return score;
};
export async function runBackup(){
 if(!source().url||!source().key||!destination().url||!destination().key)throw Error('Backup connection settings missing');
 const [members,aliases,daily,weekly,donations]=await Promise.all([
  sourceRows('members','*','id.asc'),
  sourceRows('member_aliases','alias,member_id','member_id.asc,alias.asc'),
  sourceRows('vs_daily','member_id,week_start,day_number,points','week_start.asc,day_number.asc,member_id.asc'),
  sourceRows('vs_weekly','member_id,week_start,points','week_start.asc,member_id.asc'),
  sourceRows('donations_weekly','member_id,week_start,points','week_start.asc,member_id.asc')
 ]);
 // Verify source payloads before storing. Zero records are allowed, but if ALL
 // tables vanish simultaneously, treat the source as unavailable, not empty.
 if(!members.length&&!(daily.length||weekly.length||donations.length))throw Error('Alliance Duel returned no usable records');
 const now=new Date().toISOString();
 const counts={members:members.length,aliases:aliases.length,vsDaily:daily.length,vsWeekly:weekly.length,donationsWeekly:donations.length};
 const normalized={
  members:members.map(m=>({source_member_id:asId(m.id),name:String(m.name||'Unknown'),source_payload:m,synced_at:now})),
  aliases:aliases.map(a=>({source_member_id:asId(a.member_id),alias:String(a.alias||''),synced_at:now})).filter(a=>a.source_member_id&&a.alias),
  daily:daily.map(d=>({source_member_id:asId(d.member_id),week_start:d.week_start,day_number:Number(d.day_number),points:asScore(d.points),synced_at:now})),
  weekly:weekly.map(d=>({source_member_id:asId(d.member_id),week_start:d.week_start,points:asScore(d.points),synced_at:now})),
  donations:donations.map(d=>({source_member_id:asId(d.member_id),week_start:d.week_start,points:asScore(d.points),synced_at:now}))
 };
 if(normalized.members.some(x=>!x.source_member_id)||normalized.daily.some(x=>!x.source_member_id)
 ||normalized.weekly.some(x=>!x.source_member_id)||normalized.donations.some(x=>!x.source_member_id)
 ||normalized.daily.some(x=>!Number.isInteger(x.day_number)||x.day_number<1||x.day_number>6))
  throw Error('Invalid source member or VS day identifier');
 const created=await dest('utw_duel_backup_runs?select=id',{method:'POST',
  headers:{Prefer:'return=representation'},body:JSON.stringify({status:'running',source_counts:counts})});
 const runId=created[0]?.id;
 if(!runId)throw Error('Could not log the backup run');
 try{
  await saveRows('utw_duel_backup_members',normalized.members,'source_member_id');
  await saveRows('utw_duel_backup_aliases',normalized.aliases,'source_member_id,alias');
  await saveRows('utw_duel_backup_vs_daily',normalized.daily,'source_member_id,week_start,day_number');
  await saveRows('utw_duel_backup_vs_weekly',normalized.weekly,'source_member_id,week_start');
  await saveRows('utw_duel_backup_donations_weekly',normalized.donations,'source_member_id,week_start');
  await dest('utw_duel_backup_runs?id=eq.'+runId,{method:'PATCH',
   headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'success',finished_at:new Date().toISOString()})});
  return {success:true,runId,counts};
 }catch(error){
  await dest('utw_duel_backup_runs?id=eq.'+runId,{method:'PATCH',headers:{Prefer:'return=minimal'},
   body:JSON.stringify({status:'failed',finished_at:new Date().toISOString(),error_message:String(error.message).slice(0,350)})}).catch(()=>{});
  throw error;
 }
}
export async function GET(request){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get('authorization')!==('Bearer '+secret))return json({error:'Unauthorized'},401);
 try{return json(await runBackup())}catch(error){
  // Generic error to avoid leaking database internals from a public endpoint.
  console.error('UTW backup failed:',error.message);
  return json({success:false,error:'Backup failed. Check server logs.'},503);
 }
}
