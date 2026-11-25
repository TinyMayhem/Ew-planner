
import {createHash,randomUUID} from 'node:crypto';
import {authorizedAccess} from './r4-planner.mjs';
import {sessionUser} from '../lib/r4-auth.mjs';
import {GET as auditPage} from '../lib/r4-audit-page.mjs';
import {GET as statsPage} from '../lib/r4-stats-page.mjs';
import {GET as reportsPage} from '../lib/r4-reports-page.mjs';
import {GET as nicknamesPage} from '../lib/r4-nicknames-page.mjs';
import {GET as pollsPage} from '../lib/r4-polls-page.mjs';
import {GET as pollsGet,POST as pollsPost} from '../lib/r4-polls-handler.mjs';
import {buildMemberPerformance} from '../lib/member-performance.mjs';
import {activeMembers} from '../assets/r4-active-members.mjs';
import {stageRange,stageForDate,weekStart} from '../assets/r4-train-rules.mjs';
import {buildTrainAdvice,resolveNames,isTopDonationTrain} from '../lib/train-advice.mjs';
import {currentTrainR4Ids} from '../lib/r4-train-roster.mjs';
import {utwConfigured,utwScoreboard,utwWeeklyOverview} from '../lib/utw-scores.mjs';
import {GET as runDuelBackupCron} from '../lib/r4-duel-backup.mjs';
import {latestThpSnapshotDate} from '../assets/r4-thp-roles.mjs';
import {trainHistoryRows,memberTrainHistory,compareTrainWait} from '../lib/train-history-checker.mjs';

const HEADERS={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
export const validThp=value=>Number.isSafeInteger(value)&&value>=0;
export const validSquadType=value=>value===null||['tank','air','missile'].includes(value);
export const validSquadPower=value=>value===null||Number.isSafeInteger(value)&&value>=0;
const json=(body,status=200)=>Response.json(body,{status,headers:HEADERS});
const isoDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const isMonday=v=>isoDate(v)&&new Date(v+'T00:00:00Z').getUTCDay()===1;
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const name=v=>typeof v==='string'?v.trim().replace(/\s+/g,' ').slice(0,100):'';
const key=v=>name(v).normalize('NFKC').toLocaleLowerCase('und');
const clean=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const dateAdd=(v,days)=>new Date(Date.parse(v+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
const sb=()=>{const url=process.env.SUPABASE_URL?.replace(/\/$/,'');const secret=process.env.SUPABASE_SECRET_KEY;if(!url||!secret)throw Error('Server database is not configured');return {url,secret}};
async function db(path,options={}){
 const {url,secret}=sb();
 const res=await fetch(url+'/rest/v1/'+path,{...options,headers:{apikey:secret,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});
 if(!res.ok){const txt=await res.text();throw Error('Database operation failed ('+res.status+'): '+txt.slice(0,200))}
 if(res.status===204)return null;
 return res.json();
}
const urlParams=(obj)=>new URLSearchParams(obj).toString();
async function list(table,params){return db(table+'?'+urlParams(params))}
async function insert(table,data){const rows=await db(table,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(data)});return rows}
// Train eligibility uses explicit verified player identities, not R4 login accounts.
function utwR4Membership(members){
 return currentTrainR4Ids(members);
}
async function donationR4Conflict(source,slot,conductorId,vipId){
 if(!isTopDonationTrain(source,slot))return '';
 const members=await list('utw_stat_members',{select:'id,display_name,archived_at',limit:'1000'});
 const r4=utwR4Membership(members);
 const offenders=members.filter(m=>r4.has(m.id)&&(m.id===conductorId||m.id===vipId));
 return offenders.length?'R4 members cannot be conductor or VIP on Top Donation trains: '+offenders.map(m=>m.display_name).join(', '):'';
}
async function del(table,filters){await db(table+'?'+urlParams(filters),{method:'DELETE',headers:{Prefer:'return=minimal'}})}
function authorizeWrite(request){return request.headers.get('origin')===new URL(request.url).origin}
async function rateLimit(request){
 const ip=(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'unknown').split(',')[0];
 const count=await db('rpc/utw_buddy_rate_limit',{method:'POST',body:JSON.stringify({p_key:'r4-stats:'+createHash('sha256').update(ip).digest('hex')})});
 if(!Number.isInteger(count)||count>50)throw Error('Too many changes. Please try again later.');
}
function sendErr(e){const m=e?.message||'Unexpected error';if(m.startsWith('Too many'))return json({error:m},429);if(m.includes('duplicate key')||m.includes('unique constraint'))return json({error:'This entry already exists. Check existing names, uploads, or train slots.'},409);return json({error:'Unable to complete this request. '+m.replace(/https?:\/\/\S+/g,'').slice(0,160)},503)}
async function recordAudit(request,action,details,reversible=false){
 const user=await sessionUser(request);
 const actor=user?.username||'Shared R4 / unattributed';
 await insert('utw_stat_audit',{action,details,actor,actor_id:user?.id||null,reversible});
}
async function owner(request){const user=await sessionUser(request);return user?.role==='admin'?user:null}
async function storage(path,options={}){const {url,secret}=sb();const res=await fetch(url+'/storage/v1/object/'+path,{...options,headers:{apikey:secret,...options.headers},signal:AbortSignal.timeout(18000)});return res}
async function getData(week,season,trainStage){
 const end=dateAdd(week,6),trainRange=stageRange(trainStage);
 const [members,aliases,allImports,ds,exceptions,awards,trainLegacy]=await Promise.all([
  list('utw_stat_members',{select:'id,display_name,created_at,archived_at',order:'display_name.asc',limit:'1000'}),
  list('utw_stat_aliases',{select:'alias_key,alias,member_id',limit:'3000'}),
  list('utw_stat_imports',{select:'id,metric,period,filename,row_count,created_at,season_id',season_id:'eq.'+season,period:'gte.'+week,order:'created_at.desc',limit:'500'}),
  list('utw_stat_ds',{select:'*',season_id:'eq.'+season,event_date:'gte.'+week,order:'event_date.desc',limit:'200'}),
  list('utw_stat_exceptions',{select:'*',order:'created_at.desc',limit:'1000'}),
  list('utw_stat_awards',{select:'*',train_date:'gte.'+trainRange.start,order:'train_date.asc',limit:'500'}),
  list('utw_stat_train_legacy',{select:'train_date,stage_no,driver_name,vip_name,source,selection_label,notes,original_driver_name,replacement_reason,updated_at,updated_by',train_date:'gte.'+trainRange.start,order:'train_date.asc',limit:'40'})
 ]);
 if([members,aliases,allImports,ds,exceptions,awards,trainLegacy].some(x=>!Array.isArray(x)))throw Error('Invalid database response');
 // Only the most recently uploaded CSV is active for a metric and date.
 const current=new Map();
 for(const imp of allImports){if(imp.period<=end){const k=imp.metric+':'+imp.period;if(!current.has(k))current.set(k,imp)}}
 const imports=[...current.values()],values=(await Promise.all(imports.map(i=>list('utw_stat_values',{select:'import_id,alias_key,original_name,points',import_id:'eq.'+i.id,limit:'501'})))).flat();
 if(imports.some(i=>values.filter(v=>v.import_id===i.id).length!==i.row_count))throw Error('CSV data appears incomplete');
 return {members,aliases,imports,values,ds:ds.filter(d=>d.event_date<=end),exceptions,awards:awards.filter(a=>a.train_date<=trainRange.end),trainLegacy:trainLegacy.filter(a=>a.train_date<=trainRange.end),trainRange};
}
async function evidence(request,id){
 if(!uuid(id))return json({error:'Invalid evidence ID'},400);
 const found=await list('utw_stat_ds',{select:'screenshot_path',id:'eq.'+id,limit:'1'});
 if(found.length!==1)return json({error:'Screenshot not found'},404);
 const path=found[0].screenshot_path.split('/').map(encodeURIComponent).join('/');
 const res=await storage('authenticated/utw-r4-ds-evidence/'+path);
 if(!res.ok)return json({error:'Screenshot unavailable'},503);
 const type=res.headers.get('content-type')||'';
 if(!['image/jpeg','image/png','image/webp'].includes(type))return json({error:'Invalid screenshot content type'},503);
 return new Response(res.body,{status:200,headers:{...HEADERS,'Content-Type':type,'Content-Disposition':'inline; filename="ds-evidence"','X-Content-Type-Options':'nosniff'}});
}
export async function GET(request){
 if(new URL(request.url).searchParams.get('duel_backup')==='1')return runDuelBackupCron(request);
 const view=new URL(request.url).searchParams.get('view');
 if(view==='1')return statsPage(request);
 if(view==='audit')return auditPage(request);
 if(view==='reports')return reportsPage(request);
 if(view==='nicknames')return nicknamesPage(request);
 if(view==='polls')return pollsPage(request);
 if(view==='polls_api')return pollsGet(request);
 if(!await authorizedAccess(request))return json({error:'R4 sign-in required'},401);
 const q=new URL(request.url).searchParams;
 try{
  if(q.get('duel_backup_status')==='1'){
   const runs=await list('utw_duel_backup_runs',{
    select:'id,status,started_at,finished_at,source_counts',
    order:'started_at.desc',limit:'1'
   });
   return json({lastRun:runs[0]||null});
  }
  if(q.get('train_history_checker')==='1'){
   const first=q.get('first'),second=q.get('second')||null,role=q.get('role')||'any';
   if(!uuid(first)||(second&&!uuid(second))||(second&&first===second)||!['any','conductor','vip'].includes(role))
    return json({error:'Choose one or two different members and a valid comparison role'},400);
   const [members,aliases,awards,legacy]=await Promise.all([
    list('utw_stat_members',{select:'id,display_name,archived_at',limit:'1000'}),
    list('utw_stat_aliases',{select:'alias_key,alias,member_id',limit:'5000'}),
    list('utw_stat_awards',{select:'train_date,slot,source,member_id,vip_member_id',order:'train_date.desc',limit:'2000'}),
    list('utw_stat_train_legacy',{select:'train_date,selection_label,source,driver_name,vip_name',order:'train_date.desc',limit:'2000'})
   ]);
   if(![members,aliases,awards,legacy].every(Array.isArray))
    throw Error('Train archive is incomplete');
   const lookup=new Map(members.map(m=>[m.id,m.display_name]));
   const currentIds=new Set(activeMembers(members).map(m=>m.id));
   if(!currentIds.has(first)||(second&&!currentIds.has(second)))return json({error:'Member no longer exists in Train Desk. Refresh the member list.'},404);
   const today=latestThpSnapshotDate();
   const combined=trainHistoryRows({awards,legacy,members,aliases});
   const left={name:lookup.get(first),...memberTrainHistory({memberId:first,rows:combined.rows,today})};
   const right=second?{name:lookup.get(second),...memberTrainHistory({memberId:second,rows:combined.rows,today})}:null;
   return json({today,role,first:left,second:right,comparison:compareTrainWait(left,right,role),
    earliestRecordedDate:combined.earliestRecordedDate,unlinkedLegacyCount:combined.unlinkedLegacyCount,
    savedCount:awards.length,legacyCount:legacy.length,
    explanation:'Historic spreadsheet and final R4 assignments; same-date R4 saves replace spreadsheet entries. Future planned records do not count toward the elapsed wait. An unresolved old nickname may not be linked.'});
  }
  if(q.get('member_thp')==='1'){
   const actor=await sessionUser(request);
   if(actor?.role==='von')return json({error:'UTW R4 access required'},403);
   const at=q.get('date');
   if(!isoDate(at))return json({error:'Choose a valid THP measurement date'},400);
   // The selected date identifies only the measurement to edit, not the display cutoff.
   const latestAsOf=latestThpSnapshotDate();
   const [records,latest,members,aliases,squads]=await Promise.all([
    list('utw_r4_member_thp_history',{
     select:'source_member_id,member_name,thp,recorded_on,entry_source,updated_at,updated_by',
     recorded_on:'eq.'+at,order:'member_name.asc',limit:'1000'
    }),
    db('rpc/utw_r4_thp_latest',{method:'POST',body:JSON.stringify({p_date:latestAsOf})}),
    list('utw_stat_members',{select:'id,display_name',limit:'1000'}),
    list('utw_stat_aliases',{select:'alias_key,alias,member_id',limit:'3000'}),
    list('utw_r4_member_squad_profiles',{select:'source_member_id,member_name,squad_type,squad_power,updated_at,updated_by',order:'member_name.asc',limit:'1000'})
   ]);
   if(![records,latest,members,aliases,squads].every(Array.isArray))throw Error('Incomplete THP snapshot');
   const resolve=resolveNames(members,aliases),mapped=new Map(),conflicts=new Set(),unmatched=[];
   for(const r of latest){
    const deskId=resolve(r.member_name);
    if(!deskId){unmatched.push(r.member_name);continue}
    if(mapped.has(deskId)){conflicts.add(deskId);continue}
    mapped.set(deskId,{member_id:deskId,source_member_id:r.source_member_id,name:r.member_name,thp:r.thp,recorded_on:r.recorded_on});
   }
   for(const id of conflicts)mapped.delete(id);
   return json({date:at,latestAsOf,records,latest,squads,mapped:[...mapped.values()],unmatched,
    ambiguous:conflicts.size,
    explanation:'Display uses latest recorded THP through today in server time. The chosen date is exclusively for editing a dated entry.'});
  }
  if(q.get('image'))return await evidence(request,q.get('image'));
  if(q.get('audit')==='1'){
   if(!await owner(request))return json({error:'Owner account required'},403);
   return json({events:await list('utw_stat_audit',{select:'id,action,actor,created_at,reversible,undone_at,undone_by,details',order:'created_at.desc,id.desc',limit:'400'})});
  }
  if(q.get('member_report')==='1'){
   const from=q.get('from'),to=q.get('to'),season=q.get('season');
   if((from&&!isoDate(from))||(to&&!isoDate(to))||(from&&to&&from>to)||
      (season&&!/^[a-z0-9-]{2,30}$/.test(season)))return json({error:'Choose a valid report date range and season'},400);
   const intValue=(text,defaultValue,min,max)=>{
    if(text===null)return defaultValue;
    if(!/^\d+$/.test(text))return null;
    const value=Number(text);
    return Number.isSafeInteger(value)&&value>=min&&value<=max?value:null;
   };
   const settings={
    dailyMinimum:intValue(q.get('daily'),7200000,0,1000000000000),
    weeklyMinimum:intValue(q.get('weekly'),42000000,0,1000000000000),
    donationMinimum:intValue(q.get('donations'),1,0,1000000000000),
    minSamples:intValue(q.get('samples'),2,1,100),
    missPercent:intValue(q.get('percent'),50,1,100),
    rosterOnly:q.get('roster')!=='all'
   };
   if(Object.values(settings).some(x=>x===null))return json({error:'Check the minimums and consistency settings'},400);
   const [raw,current]=await Promise.all([
    db('rpc/utw_stat_member_report_data',{
     method:'POST',body:JSON.stringify({p_from:from||null,p_to:to||null,p_season:season||null})
    }),
    list('utw_stat_members',{select:'id',archived_at:'is.null',limit:'1000'})
   ]);
   if(!raw||!Array.isArray(raw.members)||!Array.isArray(raw.snapshots)||!Array.isArray(raw.observations)||!Array.isArray(current))
    throw Error('Invalid report data');
   // Keep all saved observations intact; current performance searches exclude ex-members.
   const currentIds=new Set(current.map(member=>String(member.id)));
   const activeReport={...raw,members:raw.members.filter(member=>currentIds.has(String(member.id)))};
   return json({from:from||null,to:to||null,season:season||'all',...buildMemberPerformance(activeReport,settings)});
  }
  if(q.get('nicknames')==='1'){
   const monday=new Date();monday.setUTCHours(0,0,0,0);
   monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
   const weekStart=monday.toISOString();
   const [members,aliases,trainLegacy,weeklyChanges]=await Promise.all([
    list('utw_stat_members',{select:'id,display_name,archived_at',order:'display_name.asc',limit:'1000'}),
    list('utw_stat_aliases',{select:'alias_key,alias,member_id',limit:'5000'}),
    list('utw_stat_train_legacy',{select:'train_date,driver_name,vip_name',order:'train_date.desc',limit:'1500'}),
    list('utw_stat_audit',{select:'action,details,created_at',action:'in.(alias,set_display_name)',created_at:'gte.'+weekStart,order:'created_at.desc',limit:'500'})
   ]);
   if(![members,aliases,trainLegacy,weeklyChanges].every(Array.isArray))throw Error('Member nickname list unavailable');
   return json({members,aliases,trainLegacy,weeklyChanges,weekStart});
  }
  if(q.get('scan_recent')==='1'){
   const [imports,ds]=await Promise.all([
    list('utw_stat_imports',{select:'id,metric,period,filename,row_count,created_at',filename:'like.Screenshot_%',order:'created_at.desc',limit:'30'}),
    list('utw_stat_ds',{select:'id,event_date,notes,created_at',notes:'ilike.Screenshot scanner%',order:'created_at.desc',limit:'20'})
   ]);
   if(!Array.isArray(imports)||!Array.isArray(ds))throw Error('Screenshot upload history unavailable');
   return json({imports,ds});
  }
  if(q.get('duel_scores')==='1'){
   const reportWeek=q.get('week');
   if(!isMonday(reportWeek))return json({error:'Choose a valid Monday to view Alliance Duel rankings'},400);
   if(!utwConfigured())return json({error:'Alliance Duel scores are not connected'},503);
   return json(await utwWeeklyOverview(reportWeek));
  }
  if(q.get('ds_history')==='1'){
   const actor=await sessionUser(request);
   if(!actor||actor.role==='von')return json({error:'UTW R4 access required'},403);
   const season=q.get('season')||'post-s5';
   if(!/^[a-z0-9-]{2,30}$/.test(season))return json({error:'Choose a valid season'},400);
   // Page through all saved records, not just the selected week.
   const historyPages=async(table,select,order)=>{
    const records=[];
    for(let offset=0;offset<100000;offset+=200){
     const page=await list(table,{select,season_id:'eq.'+season,order,limit:'200',offset:String(offset)});
     if(!Array.isArray(page))throw Error('Invalid DS history response');
     records.push(...page);
     if(page.length<200)return records;
    }
    throw Error('DS history exceeds the archive limit');
   };
   const [teams,podium,changes]=await Promise.all([
    historyPages('utw_ds_team_rankings','id,event_date,team,rows,revision,updated_by,updated_at','event_date.desc,team.asc,id.asc'),
    historyPages('utw_stat_ds','id,event_date,first_member,second_member,third_member,opponent,created_at','event_date.desc,id.asc'),
    historyPages('utw_ds_team_changes','id,event_date,team,action,actor,created_at','id.desc')
   ]);
   return json({season,teams,podium,changes});
  }
  if(q.get('ds_teams')==='1'){
   const at=q.get('date'),season=q.get('season')||'post-s5';
   const actor=await sessionUser(request);
   if(!actor||actor.role==='von')return json({error:'UTW R4 access required'},403);
   if(!isoDate(at)||!/^[a-z0-9-]{2,30}$/.test(season))return json({error:'Choose DS date and season'},400);
   const [records,changes]=await Promise.all([
    list('utw_ds_team_rankings',{select:'id,season_id,event_date,team,rows,revision,updated_by,updated_at',
     season_id:'eq.'+season,event_date:'eq.'+at,order:'team.asc',limit:'2'}),
    list('utw_ds_team_changes',{select:'id,event_date,team,action,actor,created_at',
     season_id:'eq.'+season,event_date:'eq.'+at,order:'id.desc',limit:'30'})
   ]);
   if(!Array.isArray(records)||!Array.isArray(changes))throw Error('DS team rankings unavailable');
   return json({date:at,season,teams:records,changes});
  }
  if(q.get('train_advice')==='1'){
   const date=q.get('date'),mode=q.get('mode'),slot=clean(q.get('slot'),100),vipMode=q.get('vip_mode')||'weekly',selectedSeason=q.get('season'),dsTeam=q.get('ds_team')||'a';
   if(!isoDate(date)||date<'2025-12-29'||stageForDate(date)>40||
      (!['never','vs','donations','ds','r4','manual'].includes(mode)||!['weekly','stage'].includes(vipMode)||!['a','b'].includes(dsTeam))||
      (selectedSeason&&!/^[a-z0-9-]{2,30}$/.test(selectedSeason)))return json({error:'Choose a valid train date and category'},400);
   const [members,aliases,legacy,awards,exceptions]=await Promise.all([
    list('utw_stat_members',{select:'id,display_name,archived_at',order:'display_name.asc',limit:'1000'}),
    list('utw_stat_aliases',{select:'alias_key,alias,member_id',limit:'3000'}),
    list('utw_stat_train_legacy',{select:'train_date,driver_name,vip_name,source,selection_label',order:'train_date.desc',limit:'1500'}),
    list('utw_stat_awards',{select:'train_date,member_id,vip_member_id,source,slot',order:'train_date.desc',limit:'1500'}),
    list('utw_stat_exceptions',{select:'member_id,scope,starts_on,ends_on,reason,active',active:'eq.true',limit:'1000'})
   ]);
   if(![members,aliases,legacy,awards,exceptions].every(Array.isArray))throw Error('Incomplete train records');
   let scoreboard=[],scoreDate=null,dsEvent=null,dsTeamReports=[];
   const monday=weekStart(date);
   let scoreSourceNote='';
   if(mode==='vs'||mode==='donations'){
    const metric=mode==='vs'?'vs_weekly':'donations_weekly';
    const saturdayVs=mode==='vs'&&new Date(date+'T00:00:00Z').getUTCDay()===6;
    const reportWeek=saturdayVs?monday:dateAdd(monday,-7);
    // Alliance Duel is now the primary source. R4 uploads are historical fallback only.
    if(utwConfigured()){
     try{
      const duel=await utwScoreboard({mode,reportWeek,members,aliases});
      if(duel?.scoreboard.length){
       scoreboard=duel.scoreboard;scoreDate=duel.scoreDate;
       scoreSourceNote=' Scores read from '+(duel.scoreSource||'Alliance Duel')+'.'+
        (duel.unmatched.length?' Not matched to a Train Desk member (link these names in Nicknames): '+duel.unmatched.join(', ')+'.':'');
      }else if(duel){
       scoreSourceNote=' Alliance Duel scores exist, but no players matched the R4 member directory.';
      }else scoreSourceNote=' Alliance Duel has no weekly report for '+reportWeek+'.';
     }catch(e){
      scoreSourceNote=' Alliance Duel could not be reached ('+e.message+').';
     }
    }else scoreSourceNote=' Alliance Duel integration is not configured.';
    if(!scoreDate){
     // Use previous R4 uploads for a missing/unavailable external week; never overwrite them.
     const filters={select:'id,period,created_at,row_count',metric:'eq.'+metric,
      period:'eq.'+reportWeek,order:'created_at.desc',limit:'50'};
     if(selectedSeason)filters.season_id='eq.'+selectedSeason;
     const imports=await list('utw_stat_imports',filters);
     const latest=imports[0];
     if(latest){
      const values=await list('utw_stat_values',{select:'alias_key,points',import_id:'eq.'+latest.id,limit:'501'});
      if(values.length===latest.row_count){
       const byAlias=new Map(aliases.map(x=>[x.alias_key,x.member_id]));
       scoreboard=values.map(x=>({member_id:byAlias.get(x.alias_key),points:Number(x.points)}));
       scoreDate=latest.period;
       scoreSourceNote+=' Using previously saved R4 report as fallback.';
      }
     }
    }
   }
   if(mode==='ds'){
    const [podium,teams]=await Promise.all([
     list('utw_stat_ds',{select:'event_date,first_member,second_member,third_member',event_date:'gte.'+dateAdd(date,-14),order:'event_date.desc,created_at.desc',limit:'30'}),
     list('utw_ds_team_rankings',{select:'event_date,team,rows,revision,updated_by',
      event_date:'gte.'+dateAdd(date,-14),event_date:'lte.'+date,
      ...(selectedSeason?{season_id:'eq.'+selectedSeason}:{}),
      order:'event_date.desc,updated_at.desc',limit:'60'})
    ]);
    dsEvent=podium.find(x=>x.event_date<=date)||null;
    // Keep Team A/B independent. Never assign a legacy podium to a team by assumption.
    dsTeamReports=['a','b'].map(team=>teams.find(r=>r.team===team)).filter(Boolean);
   }
   let rosterIds=[],rosterDate=null,vsRecordCounts={};
   if(mode!=='vs'&&mode!=='donations'){
    // Use active snapshots across all seasons. The existing reports RPC picks
    // only the latest upload for each season/metric/date, so reuploads do not
    // falsely inflate how long a member appears in the archived VS history.
    const report=await db('rpc/utw_stat_member_report_data',{
     method:'POST',body:JSON.stringify({p_to:date})
    });
    if(!report||!Array.isArray(report.snapshots)||!Array.isArray(report.observations))
     throw Error('VS history for train recommendations is unavailable');
    const vsIds=new Set(report.snapshots.filter(x=>x.metric==='vs_daily'||x.metric==='vs_weekly').map(x=>x.id));
    for(const observation of report.observations){
     if(!vsIds.has(observation.snapshotId)||!observation.memberId)continue;
     vsRecordCounts[observation.memberId]=(vsRecordCounts[observation.memberId]||0)+1;
    }
    if(mode==='never'){
     // The latest VS report identifies who is currently eligible for selection.
     rosterIds=Array.isArray(report.roster)?report.roster:[];
     rosterDate=report.rosterDate||null;
    }
   }
   const r4MemberIds=(mode==='r4'||isTopDonationTrain(mode,slot))?[...utwR4Membership(members)]:[];
   const adviceInput={date,mode,slot,vipMode,members,aliases,legacy,awards,exceptions,scoreboard,scoreDate,dsEvent,rosterIds,rosterDate,vsRecordCounts,r4MemberIds};
   const advice=buildTrainAdvice({...adviceInput,dsTeam:mode==='ds'?dsTeam:null,
    dsTeamRows:mode==='ds'?dsTeamReports.find(r=>r.team===dsTeam)||null:null});
   if(mode==='ds'){
    const byTeam=['a','b'].map(team=>{
     const report=dsTeamReports.find(r=>r.team===team)||null;
     const result=buildTrainAdvice({...adviceInput,dsTeam:team,dsTeamRows:report});
     return {team,sourceDate:result.dataDate,recommended:result.recommended,
      skipped:result.rejected,candidates:result.candidates,
      eligibleCount:result.eligibleCount,context:result.context,uploaded:!!report?.rows?.length};
    });
    advice.teamRecommendations=byTeam;
   }
   advice.context+=scoreSourceNote;
   return json(advice);
  }
  const seasons=await list('utw_stat_seasons',{select:'id,label,sort_order',order:'sort_order.asc',limit:'50'});
  const season=q.get('season')||'post-s5';
  if(!seasons.some(s=>s.id===season))return json({error:'Invalid season'},400);
  if(q.get('report')==='1')return json({season,rows:await db('rpc/utw_stat_season_report',{method:'POST',body:JSON.stringify({p_season:season})})});
  if(q.get('archive')==='1'){
   // Report index only. Full member scores are fetched on demand for the chosen week.
   const history=await list('utw_stat_imports',{select:'id,metric,period,filename,row_count,created_at',season_id:'eq.'+season,metric:'in.(vs_daily,vs_weekly)',order:'created_at.desc,id.desc',limit:'1000'});
   if(!Array.isArray(history))throw Error('VS archive unavailable');
   return json({season,imports:history});
  }
  const week=q.get('week');
  if(!isMonday(week))return json({error:'Select a valid Monday to start the week'},400);
  const trainStage=q.get('train_stage')===null?15:Number(q.get('train_stage'));
  if(!Number.isInteger(trainStage)||trainStage<7||trainStage>40)return json({error:'Invalid train calendar'},400);
  return json({...await getData(week,season,trainStage),seasons,season});
 }catch(e){return sendErr(e)}
}
async function importCsv(body,request){
 const {metric,period,filename,rows}=body;
 const season=body.season_id||'post-s5';
 if(!/^[a-z0-9-]{2,30}$/.test(season)||(await list('utw_stat_seasons',{select:'id',id:'eq.'+season,limit:'1'})).length!==1)return json({error:'Invalid season'},400);
 if(!['vs_daily','vs_weekly','donations_weekly'].includes(metric)||!isoDate(period)||(metric!=='vs_daily'&&!isMonday(period)))return json({error:'Invalid upload type or date'},400);
 if(typeof filename!=='string'||filename.length>180||!filename.toLowerCase().endsWith('.csv'))return json({error:'Upload a named CSV file'},400);
 if(!Array.isArray(rows)||rows.length<1||rows.length>500)return json({error:'CSV must contain 1 to 500 rows'},400);
 const cleanRows=[],seen=new Set();
 for(const row of rows){
  const display=name(row.name),aliasKey=key(display),points=Number(row.points);
  if(!display||display.length>60||!Number.isSafeInteger(points)||points<0||seen.has(aliasKey))return json({error:'Invalid, missing, or duplicated member name / points in CSV. Fix the preview and retry.'},400);
  seen.add(aliasKey);cleanRows.push({name:display,alias_key:aliasKey,points});
 }
 const hash=createHash('sha256').update(JSON.stringify({season,metric,period,cleanRows})).digest('hex');
 const existing=await list('utw_stat_aliases',{select:'alias_key',limit:'3000'});
 const known=new Set(existing.map(a=>a.alias_key));
 const fresh=cleanRows.filter(r=>!known.has(r.alias_key)).map(r=>({memberId:randomUUID(),name:r.name,aliasKey:r.alias_key}));
 if(fresh.length){
  await insert('utw_stat_members',fresh.map(x=>({id:x.memberId,display_name:x.name})));
  await insert('utw_stat_aliases',fresh.map(x=>({alias_key:x.aliasKey,alias:x.name,member_id:x.memberId})));
 }
 const created=await insert('utw_stat_imports',{season_id:season,metric,period,filename:clean(filename,180),file_hash:hash,row_count:cleanRows.length});
 if(created.length!==1)throw Error('Upload did not create a batch');
 const importId=created[0].id;
 try{
  await insert('utw_stat_values',cleanRows.map(x=>({import_id:importId,alias_key:x.alias_key,original_name:x.name,points:x.points})));
 }catch(e){await del('utw_stat_imports',{id:'eq.'+importId}).catch(()=>{});throw e}
 await recordAudit(request,'import',{id:importId,filename,season,metric,period,rows:cleanRows.length,new_members:fresh.length},true);
 return json({ok:true,id:importId,rows:cleanRows.length,new_members:fresh.length},201);
}
async function dsUpload(form,request){
 const season=form.get('season_id')||'post-s5';
 if(!/^[a-z0-9-]{2,30}$/.test(season)||(await list('utw_stat_seasons',{select:'id',id:'eq.'+season,limit:'1'})).length!==1)return json({error:'Invalid season'},400);
 const eventDate=form.get('date'),first=form.get('first'),second=form.get('second')||null,third=form.get('third')||null;
 const opponent=clean(form.get('opponent'),80),notes=clean(form.get('notes'),500),file=form.get('screenshot');
 if(!isoDate(eventDate)||!uuid(first)||((second||third)&&![second,third].filter(Boolean).every(uuid))||new Set([first,second,third].filter(Boolean)).size!==[first,second,third].filter(Boolean).length)return json({error:'Select valid, different MVP / second / third members and a match date'},400);
 if(!file||typeof file.arrayBuffer!=='function'||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size<100||file.size>4*1024*1024)return json({error:'Upload a JPG, PNG, or WebP screenshot under 4 MB'},400);
 const bytes=new Uint8Array(await file.arrayBuffer());
 const isPng=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
 const isJpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const isWebp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!((file.type==='image/png'&&isPng)||(file.type==='image/jpeg'&&isJpg)||(file.type==='image/webp'&&isWebp)))return json({error:'Screenshot contents do not match the file type'},400);
 const ext=file.type==='image/png'?'png':file.type==='image/jpeg'?'jpg':'webp';
 const path=eventDate+'/'+randomUUID()+'.'+ext;
 const upload=await storage('utw-r4-ds-evidence/'+path,{method:'POST',headers:{'Content-Type':file.type,'x-upsert':'false'},body:bytes});
 if(!upload.ok)throw Error('Secure screenshot upload failed');
 let created;
 try{
  created=await insert('utw_stat_ds',{season_id:season,event_date:eventDate,first_member:first,second_member:second,third_member:third,opponent,notes,screenshot_path:path});
 }catch(e){await storage('utw-r4-ds-evidence/'+path,{method:'DELETE'}).catch(()=>{});throw e}
 await recordAudit(request,'ds',{id:created[0].id,season,date:eventDate,opponent,first,second,third,screenshot:path},true);
 return json({ok:true,id:created[0].id},201);
}
export async function POST(request){
 if(new URL(request.url).searchParams.get('view')==='polls_api')return pollsPost(request);
 if(!await authorizedAccess(request))return json({error:'R4 sign-in required'},401);
 if(!authorizeWrite(request))return json({error:'Invalid request origin'},403);
 try{
  await rateLimit(request);
  const type=request.headers.get('content-type')||'';
  if(type.startsWith('multipart/form-data')){
   const declared=Number(request.headers.get('content-length')||0);
   if(declared>4.3*1024*1024)return json({error:'Screenshot too large'},413);
   const form=await request.formData();
   if(form.get('action')!=='ds')return json({error:'Unknown upload'},400);
   return await dsUpload(form,request);
  }
  if(!type.startsWith('application/json'))return json({error:'JSON required'},415);
  const raw=await request.text();
  if(raw.length>150000)return json({error:'Request too large'},413);
  const body=JSON.parse(raw);
  switch(body.action){
   case 'ds_team_clear':{
    const actor=await sessionUser(request);
    if(!actor||actor.role==='von')return json({error:'UTW R4 access required'},403);
    const date=body.event_date,season=body.season_id,team=body.team,revision=body.revision;
    if(!isoDate(date)||typeof season!=='string'||!/^[a-z0-9-]{2,30}$/.test(season)||
     !['a','b'].includes(team)||!Number.isInteger(revision)||revision<0)
     return json({error:'Choose a saved DS team and valid event date'},400);
    const result=await db('rpc/utw_ds_team_apply',{method:'POST',body:JSON.stringify({
     p_season:season,p_date:date,p_team:team,p_mode:'clear',p_rows:[],
     p_revision:revision,p_actor:String(actor.username||actor.display_name||'R4').slice(0,80)
    })});
    await recordAudit(request,'ds_team_clear',{season,date,team,revision:result.revision},false);
    return json(result);
   }
   case 'ds_team':{
    const actor=await sessionUser(request);
    if(!actor||actor.role==='von')return json({error:'UTW R4 access required'},403);
    const eventDate=body.event_date,season=body.season_id,team=body.team,
     mode=body.mode||'replace',rows=body.rows;
    if(!isoDate(eventDate)||typeof season!=='string'||!/^[a-z0-9-]{2,30}$/.test(season)||
     !['a','b'].includes(team)||!['append','replace'].includes(mode)||
     !Array.isArray(rows)||rows.length<1||rows.length>200||
     !(body.revision===null||Number.isInteger(body.revision)&&body.revision>=0))
     return json({error:'Choose a valid date, team, upload mode and reviewed scores'},400);
    const [members,aliases,seasons]=await Promise.all([
     list('utw_stat_members',{select:'id,display_name',limit:'1000'}),
     list('utw_stat_aliases',{select:'alias_key,alias,member_id',limit:'5000'}),
     list('utw_stat_seasons',{select:'id',id:'eq.'+season,limit:'1'})
    ]);
    if(seasons.length!==1)return json({error:'Invalid DS season'},400);
    const resolve=resolveNames(members,aliases),mapped=[],seen=new Set();
    for(const row of rows){
     const label=name(row?.name),id=resolve(label),points=row?.points;
     if(!label||!id||!Number.isSafeInteger(points)||points<0)
      return json({error:'Every DS player must have a verified roster name and valid nonnegative score: '+label},400);
     if(seen.has(id))return json({error:'Duplicate member in reviewed DS ranking: '+label},400);
     seen.add(id);mapped.push({member_id:id,points});
    }
    const result=await db('rpc/utw_ds_team_apply',{method:'POST',body:JSON.stringify({
     p_season:season,p_date:eventDate,p_team:team,p_mode:mode,p_rows:mapped,
     p_revision:body.revision,p_actor:String(actor.username||actor.display_name||'R4').slice(0,80)
    })});
    await recordAudit(request,'ds_team_'+mode,{season,date:eventDate,team,players:mapped.length,revision:result.revision},false);
    return json(result);
   }
   case 'member_squad':{
    const actor=await sessionUser(request);
    if(!actor||actor.role==='von')return json({error:'UTW R4 access required'},403);
    const id=body.source_member_id,n=name(body.member_name);
    if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(id)||
      !n||n.length>100||/[\x00-\x1f\x7f]/.test(n))return json({error:'Choose a valid member'},400);
    const squadType=body.squad_type===null?null:body.squad_type;
    const squadPower=body.squad_power===null?null:body.squad_power;
    if(!validSquadType(squadType)||!validSquadPower(squadPower))
     return json({error:'Choose Tank, Air or Missile, and a valid optional squad power'},400);
    if(squadType===null&&squadPower===null){
     await del('utw_r4_member_squad_profiles',{source_member_id:'eq.'+id});
     await recordAudit(request,'member_squad_clear',{source_member_id:id},false);
     return json({ok:true,deleted:true,record:null});
    }
    const record={source_member_id:id,member_name:n,squad_type:squadType,
     squad_power:squadPower,updated_at:new Date().toISOString(),
     updated_by:String(actor.username||actor.display_name||'R4').slice(0,80)};
    const saved=await db('utw_r4_member_squad_profiles?on_conflict=source_member_id',{
     method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},
     body:JSON.stringify([record])
    });
    if(!Array.isArray(saved)||saved.length!==1)throw Error('Squad details were not saved');
    await recordAudit(request,'member_squad_save',{source_member_id:id,squad_type:squadType,
      squad_power:squadPower},false);
    return json({ok:true,record:saved[0]});
   }
   case 'member_thp':{
    const actor=await sessionUser(request);
    if(actor?.role==='von')return json({error:'UTW R4 access required'},403);
    const date=body.recorded_on,mode=body.mode,source=clean(body.entry_source||'manual',180)||'manual';
    if(!isoDate(date))return json({error:'Choose a valid THP measurement date'},400);
    const normalizeRow=r=>{
     const id=r?.source_member_id,n=name(r?.member_name);
     if(typeof id!=='string'||!(/^[A-Za-z0-9_-]{1,100}$/).test(id)||
       !n||n.length>100||/[\x00-\x1f\x7f]/.test(n)||
       !validThp(r?.thp))return null;
     return {source_member_id:id,member_name:n,thp:r.thp,recorded_on:date,
      entry_source:source,updated_at:new Date().toISOString(),
      updated_by:String(actor?.username||actor?.display_name||'R4').slice(0,80)};
    };
    if(mode==='clear'){
     const id=body.source_member_id;
     if(typeof id!=='string'||!(/^[A-Za-z0-9_-]{1,100}$/).test(id))return json({error:'Choose a valid member'},400);
     await del('utw_r4_member_thp_history',{source_member_id:'eq.'+id,recorded_on:'eq.'+date});
     await recordAudit(request,'member_thp_clear',{source_member_id:id,recorded_on:date},false);
     return json({ok:true,deleted:true});
    }
    const inputs=mode==='save'?[body]:mode==='bulk'&&Array.isArray(body.rows)?body.rows:null;
    if(!inputs||!inputs.length||inputs.length>500)return json({error:'Upload 1 to 500 dated THP entries'},400);
    const rows=inputs.map(normalizeRow);
    if(rows.some(r=>!r))return json({error:'Each THP entry requires a matched roster member and valid whole-number power'},400);
    const ids=new Set(rows.map(r=>r.source_member_id));
    if(ids.size!==rows.length)return json({error:'Duplicate members in this THP upload'},400);
    const saved=await db('utw_r4_member_thp_history?on_conflict=source_member_id,recorded_on',{
     method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},
     body:JSON.stringify(rows)
    });
    if(!Array.isArray(saved)||saved.length!==rows.length)throw Error('Incomplete THP save');
    await recordAudit(request,'member_thp_'+mode,{recorded_on:date,entries:rows.length,entry_source:source},false);
    return json({ok:true,records:saved,record:saved[0]});
   }
   case 'create_members':{
    const actor=await sessionUser(request);
    if(!actor||actor.role==='von')return json({error:'UTW R4 access required'},403);
    if(!Array.isArray(body.members)||body.members.length<1||body.members.length>100)
     return json({error:'Enter 1 to 100 new members at a time.'},400);
    const fresh=[],claimed=new Set();
    for(const item of body.members){
     if(typeof item?.name!=='string'||!Array.isArray(item.aliases)||item.aliases.length>10||
      [item.name,...item.aliases].some(v=>typeof v!=='string'||!v.trim()||v.trim().length>60||key(v).length>100))
      return json({error:'Enter a valid member name and up to 10 nicknames (1 to 60 characters each).'},400);
     const display=name(item.name),memberId=randomUUID(),labels=[display,...item.aliases.map(name)];
     const unique=[];
     for(const label of labels){
      const k=key(label);
      if(unique.some(a=>a.alias_key===k))continue;
      if(claimed.has(k))return json({error:'Duplicate name or nickname in this batch: '+label},409);
      claimed.add(k);unique.push({alias_key:k,alias:label,member_id:memberId});
     }
     fresh.push({id:memberId,display_name:display,aliases:unique});
    }
    const pages=async(table,select,order)=>{
     const all=[];
     for(let offset=0;offset<100000;offset+=500){
      const rows=await list(table,{select,order,limit:'500',offset:String(offset)});
      if(!Array.isArray(rows))throw Error('Member directory unavailable');
      all.push(...rows);if(rows.length<500)return all;
     }
     throw Error('Member directory exceeds the safety limit');
    };
    const [members,aliases]=await Promise.all([
     pages('utw_stat_members','id,display_name,archived_at','id.asc'),
     pages('utw_stat_aliases','alias_key,member_id','alias_key.asc')
    ]);
    const owners=new Map(members.map(m=>[m.id,m]));
    const existing=new Map(members.map(m=>[key(m.display_name),m]));
    for(const a of aliases)existing.set(a.alias_key,owners.get(a.member_id));
    const conflicts=[];
    for(const m of fresh)for(const a of m.aliases){
     const owner=existing.get(a.alias_key);
     if(owner)conflicts.push({name:a.alias,member:owner.display_name,archived:!!owner.archived_at});
    }
    if(conflicts.length)return json({error:conflicts.map(c=>c.name+' already belongs to '+c.member+(c.archived?' (archived: restore the original record)':' (active member)')).join('; '),conflicts},409);
    const memberRows=fresh.map(({id,display_name})=>({id,display_name}));
    const aliasRows=fresh.flatMap(m=>m.aliases);
    await insert('utw_stat_members',memberRows);
    try{await insert('utw_stat_aliases',aliasRows)}
    catch(e){
     // A unique-key rejection rolls back the alias insert as a statement.
     // Only remove our newly generated member IDs if no aliases were linked.
     if(/duplicate key|unique constraint/i.test(e.message)){
      for(const m of fresh){
       const linked=await list('utw_stat_aliases',{select:'member_id',member_id:'eq.'+m.id,limit:'1'});
       if(Array.isArray(linked)&&!linked.length)await del('utw_stat_members',{id:'eq.'+m.id});
      }
     }
     throw e;
    }
    await recordAudit(request,'create_members',{members:memberRows.map(m=>({...m,nicknames:fresh.find(x=>x.id===m.id).aliases.map(a=>a.alias)})),count:fresh.length},false);
    return json({ok:true,count:fresh.length,members:memberRows},201);
   }
   case 'import':return await importCsv(body,request);
   case 'archive_member':
    case 'restore_member':{
     if(!uuid(body.member_id))return json({error:'Choose a valid member'},400);
     const archive=body.action==='archive_member';
     const found=await list('utw_stat_members',{select:'id,display_name,archived_at',id:'eq.'+body.member_id,limit:'1'});
     if(found.length!==1)return json({error:'Member not found'},404);
     if(Boolean(found[0].archived_at)===archive)return json({ok:true,alreadySet:true,archived_at:found[0].archived_at});
     const saved=await db('utw_stat_members?'+urlParams({id:'eq.'+body.member_id,
      archived_at:archive?'is.null':'not.is.null'}),{
      method:'PATCH',headers:{Prefer:'return=representation'},
      body:JSON.stringify({archived_at:archive?new Date().toISOString():null})
     });
     if(!Array.isArray(saved)||saved.length!==1)return json({error:'Member status changed. Refresh and try again.'},409);
     await recordAudit(request,body.action,{member_id:body.member_id,display_name:found[0].display_name,previous_archived_at:found[0].archived_at},false);
     return json({ok:true,archived_at:saved[0].archived_at});
    }
    case 'alias':{
    const alias=name(body.alias),memberId=body.member_id;
    if(alias.length<1||alias.length>60||!uuid(memberId))return json({error:'Enter a valid nickname and member'},400);
    const [member,claimed]=await Promise.all([
     list('utw_stat_members',{select:'id,display_name',id:'eq.'+memberId,limit:'1'}),
     list('utw_stat_aliases',{select:'alias_key,alias,member_id',alias_key:'eq.'+key(alias),limit:'1'})
    ]);
    if(member.length!==1)return json({error:'Choose an existing member'},404);
    if(claimed.length){
     if(claimed[0].member_id===memberId)return json({ok:true,alreadyLinked:true});
     return json({error:'This nickname belongs to another member. Confirm that the people are the same before merging.',existing_member_id:claimed[0].member_id},409);
    }
    await insert('utw_stat_aliases',{alias_key:key(alias),alias,member_id:memberId});
    await recordAudit(request,'alias',{alias_key:key(alias),alias,member_id:memberId},true);
    return json({ok:true},201);
   }
   case 'set_display_name':{
    const memberId=body.member_id,chosen=name(body.alias);
    if(!uuid(memberId)||!chosen||chosen.length>60)return json({error:'Choose a valid member and linked nickname'},400);
    const [record,linked]=await Promise.all([
     list('utw_stat_members',{select:'id,display_name',id:'eq.'+memberId,limit:'1'}),
     list('utw_stat_aliases',{select:'alias,member_id',alias_key:'eq.'+key(chosen),limit:'1'})
    ]);
    if(record.length!==1)return json({error:'Member not found'},404);
    if(linked.length!==1||linked[0].member_id!==memberId)return json({error:'Link this nickname to the member before making it current.'},409);
    const previous=record[0].display_name,current=linked[0].alias;
    if(previous===current)return json({ok:true,alreadyCurrent:true,display_name:current});
    // Keep the former display name searchable so past train/VS records still resolve.
    const oldAlias=await list('utw_stat_aliases',{select:'alias_key,member_id',alias_key:'eq.'+key(previous),limit:'1'});
    if(oldAlias.length&&oldAlias[0].member_id!==memberId)return json({error:'The previous display name belongs to a different member. Review aliases first.'},409);
    if(!oldAlias.length)await insert('utw_stat_aliases',{alias_key:key(previous),alias:previous,member_id:memberId});
    const updated=await db('utw_stat_members?'+urlParams({id:'eq.'+memberId}),{
     method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({display_name:current})
    });
    if(!Array.isArray(updated)||updated.length!==1||updated[0].display_name!==current)return json({error:'Could not verify the updated display name. Refresh before trying again.'},409);
    await recordAudit(request,'set_display_name',{member_id:memberId,previous_name:previous,display_name:current},false);
    return json({ok:true,display_name:current,previous_name:previous});
   }
   case 'delete_alias':{
    const alias=name(body.alias),memberId=body.member_id;
    if(!alias||alias.length>60||!uuid(memberId))return json({error:'Choose a valid nickname and member'},400);
    const [member,found]=await Promise.all([
     list('utw_stat_members',{select:'id,display_name',id:'eq.'+memberId,limit:'1'}),
     list('utw_stat_aliases',{select:'alias_key,alias,member_id',alias_key:'eq.'+key(alias),limit:'1'})
    ]);
    if(member.length!==1||found.length!==1||found[0].member_id!==memberId)return json({error:'Nickname not linked to that member'},404);
    if(key(member[0].display_name)===key(alias))return json({error:'Main member names cannot be removed. Add alternate nicknames instead.'},400);
    const historical=await list('utw_stat_values',{select:'id',alias_key:'eq.'+key(alias),limit:'1'});
    if(historical.length)return json({error:'This nickname has saved VS or donation scores and must stay linked to preserve history. Use the confirmed merge option if it belongs to another member.'},409);
    await del('utw_stat_aliases',{alias_key:'eq.'+key(alias),member_id:'eq.'+memberId});
    await recordAudit(request,'delete_alias',{alias_key:key(alias),alias:found[0].alias,member_id:memberId},false);
    return json({ok:true});
   }
   case 'merge':{
    if(!uuid(body.source)||!uuid(body.target)||body.source===body.target)return json({error:'Choose two distinct members'},400);
    // A merge permanently combines historical scores, so resolve the exact
    // source and target IDs before running the existing atomic database RPC.
    const [source,target,sourceAliases]=await Promise.all([
     list('utw_stat_members',{select:'id,display_name',id:'eq.'+body.source,limit:'1'}),
     list('utw_stat_members',{select:'id,display_name',id:'eq.'+body.target,limit:'1'}),
     list('utw_stat_aliases',{select:'alias_key,alias',member_id:'eq.'+body.source,limit:'1000'})
    ]);
    if(source.length!==1||target.length!==1)return json({error:'A member record is missing. Refresh the page before merging.'},409);
    if(!sourceAliases.length)return json({error:'Source member has no linked nickname. Review the record before merging.'},409);
    await db('rpc/utw_stat_merge_members',{method:'POST',body:JSON.stringify({p_source:body.source,p_target:body.target})});
    const [sourceAfter,linkedAfter]=await Promise.all([
     list('utw_stat_members',{select:'id',id:'eq.'+body.source,limit:'1'}),
     list('utw_stat_aliases',{select:'alias_key,alias,member_id',member_id:'eq.'+body.target,limit:'1000'})
    ]);
    const allKeys=new Set(linkedAfter.map(a=>a.alias_key));
    const verified=sourceAfter.length===0&&sourceAliases.every(a=>allKeys.has(a.alias_key));
    if(!verified)return json({error:'The merge returned but could not be fully verified. Refresh before attempting another merge.'},409);
    await recordAudit(request,'merge',{source:body.source,source_name:source[0].display_name,target:body.target,target_name:target[0].display_name},false);
    return json({ok:true,verified:true,member_id:body.target,aliases:linkedAfter.map(a=>a.alias)});
   }
   case 'exception':{
    if(!uuid(body.member_id)||!['all','ds','donations','vs'].includes(body.scope)||!isoDate(body.starts_on)||!isoDate(body.ends_on)||body.ends_on<body.starts_on||clean(body.reason,301).length<1||clean(body.reason,301).length>300)return json({error:'Enter a valid member, scope, date range and reason'},400);
    const created=await insert('utw_stat_exceptions',{member_id:body.member_id,scope:body.scope,starts_on:body.starts_on,ends_on:body.ends_on,reason:clean(body.reason,300)});
    await recordAudit(request,'exception',{id:created[0].id,member_id:body.member_id,scope:body.scope,starts_on:body.starts_on,ends_on:body.ends_on,reason:clean(body.reason,300)},true);
    return json({ok:true},201);
   }
   case 'clear_exception':{
    if(!uuid(body.id))return json({error:'Invalid exception'},400);
    const old=await list('utw_stat_exceptions',{select:'id,active,member_id,reason',id:'eq.'+body.id,limit:'1'});
    if(old.length!==1||!old[0].active)return json({error:'Exception is already inactive'},409);
    await db('utw_stat_exceptions?'+urlParams({id:'eq.'+body.id}),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({active:false})});
    await recordAudit(request,'clear_exception',{id:body.id,member_id:old[0].member_id,reason:old[0].reason},true);
    return json({ok:true});
   }
   case 'award':{
    const season=body.season_id||'post-s5';if(!/^[a-z0-9-]{2,30}$/.test(season)||(await list('utw_stat_seasons',{select:'id',id:'eq.'+season,limit:'1'})).length!==1)return json({error:'Invalid season'},400);
    if(!isoDate(body.train_date)||!uuid(body.member_id)||!uuid(body.vip_member_id)||body.member_id===body.vip_member_id||!['ds','donations','vs','manual','r4'].includes(body.source)||!name(body.slot)||name(body.slot).length>50)return json({error:'Choose different conductor and VIP members, a valid date, source and train slot'},400);
    const donorConflict=await donationR4Conflict(body.source,body.slot,body.member_id,body.vip_member_id);
    if(donorConflict)return json({error:donorConflict},400);
    const created=await insert('utw_stat_awards',{season_id:season,train_date:body.train_date,member_id:body.member_id,vip_member_id:body.vip_member_id,source:body.source,slot:name(body.slot),reason:clean(body.reason,500)});
    await recordAudit(request,'award',{id:created[0].id,season,date:body.train_date,slot:body.slot,member_id:body.member_id},true);
    return json({ok:true},201);
   }
   case 'update_award':{
    if(!uuid(body.id)||!uuid(body.member_id)||!uuid(body.vip_member_id)||body.member_id===body.vip_member_id)return json({error:'Choose different valid conductor and VIP members'},400);
    const old=await list('utw_stat_awards',{select:'*',id:'eq.'+body.id,limit:'1'});
    if(old.length!==1)return json({error:'Train assignment not found'},404);
    const donorConflict=await donationR4Conflict(old[0].source,old[0].slot,body.member_id,body.vip_member_id);
    if(donorConflict)return json({error:donorConflict},400);
    const editReason=clean(body.reason,200);
    if(old[0].member_id!==body.member_id&&!editReason)return json({error:'Explain why the conductor changed (for example, no-show)'},400);
    if(typeof body.reason==='string'&&body.reason.trim().length>200)return json({error:'Replacement reason must be under 200 characters'},400);
    const previousNote=old[0].reason||'';
    const combinedReason=editReason?[previousNote,editReason].filter(Boolean).join(' | ').slice(-500):previousNote;
    const updated=await db('utw_stat_awards?'+urlParams({id:'eq.'+body.id,member_id:'eq.'+old[0].member_id,vip_member_id:old[0].vip_member_id?'eq.'+old[0].vip_member_id:'is.null'}),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({member_id:body.member_id,vip_member_id:body.vip_member_id,reason:combinedReason})});
    if(updated.length!==1)return json({error:'This train assignment changed. Refresh before editing.'},409);
    await recordAudit(request,'update_award',{id:body.id,previous_conductor:old[0].member_id,previous_vip:old[0].vip_member_id,new_conductor:body.member_id,new_vip:body.vip_member_id,date:old[0].train_date,slot:old[0].slot,reason:editReason},false);
    return json({ok:true});
   }
   case 'update_legacy_train':{
    const date=body.train_date,driver=name(body.driver_name),vip=name(body.vip_name),reason=clean(body.reason,300);
    if(!isoDate(date)||!driver||!vip||key(driver)===key(vip)||reason.length<1||typeof body.reason!=='string'||body.reason.trim().length>300)
     return json({error:'Choose two different names and give a short reason for changing the historic train.'},400);
    const oldRows=await list('utw_stat_train_legacy',{select:'*',train_date:'eq.'+date,limit:'1'});
    if(oldRows.length!==1)return json({error:'Historical train entry not found'},404);
    const old=oldRows[0];
    if(old.driver_name!==body.expected_driver_name||old.vip_name!==body.expected_vip_name)
     return json({error:'This train assignment has changed. Refresh to see the latest record.'},409);
    if(driver===old.driver_name&&vip===old.vip_name)return json({error:'No changes to save'},400);
    const actor=await sessionUser(request).catch(()=>null);
    const payload={
      driver_name:driver,vip_name:vip,replacement_reason:reason,
      original_driver_name:old.original_driver_name||(driver!==old.driver_name?old.driver_name:null),
      updated_at:new Date().toISOString(),updated_by:actor?.username||'Shared R4'
    };
    const updated=await db('utw_stat_train_legacy?'+urlParams({
      train_date:'eq.'+date,
      updated_at:old.updated_at?'eq.'+old.updated_at:'is.null'
    }),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
    if(!Array.isArray(updated)||updated.length!==1)return json({error:'This entry changed before your edit could be saved. Refresh and try again.'},409);
    await recordAudit(request,'update_legacy_train',{date,previous_driver:old.driver_name,new_driver:driver,previous_vip:old.vip_name,new_vip:vip,reason},false);
    return json({ok:true,train:updated[0]});
   }
   case 'delete_award':{
    if(!uuid(body.id))return json({error:'Invalid train assignment'},400);
    const old=await list('utw_stat_awards',{select:'*',id:'eq.'+body.id,limit:'1'});
    if(old.length!==1)return json({error:'Train assignment not found'},404);
    await del('utw_stat_awards',{id:'eq.'+body.id});
    await recordAudit(request,'delete_award',{row:old[0],date:old[0].train_date,slot:old[0].slot},true);
    return json({ok:true});
   }

   case 'delete_import':{
    if(!uuid(body.id))return json({error:'Invalid import ID'},400);
    const old=await list('utw_stat_imports',{select:'*',id:'eq.'+body.id,limit:'1'});
    if(old.length!==1)return json({error:'Import not found'},404);
    const values=await list('utw_stat_values',{select:'alias_key,original_name,points',import_id:'eq.'+body.id,limit:'501'});
    if(values.length!==old[0].row_count)return json({error:'Import backup appears incomplete'},409);
    await del('utw_stat_imports',{id:'eq.'+body.id});
    await recordAudit(request,'delete_import',{row:old[0],values,filename:old[0].filename,season:old[0].season_id,period:old[0].period,metric:old[0].metric},true);
    return json({ok:true});
   }
   case 'delete_ds':{
    if(!uuid(body.id))return json({error:'Invalid DS result ID'},400);
    const old=await list('utw_stat_ds',{select:'*',id:'eq.'+body.id,limit:'1'});
    if(old.length!==1)return json({error:'DS result not found'},404);
    await del('utw_stat_ds',{id:'eq.'+body.id});
    // The private screenshot stays in storage so an owner can undo the deletion.
    await recordAudit(request,'delete_ds',{row:old[0],date:old[0].event_date,opponent:old[0].opponent},true);
    return json({ok:true});
   }
   case 'undo_audit':{
    const account=await owner(request);
    if(!account)return json({error:'Personal owner login required'},403);
    const id=Number(body.id);
    if(!Number.isSafeInteger(id)||id<1)return json({error:'Invalid audit entry'},400);
    const result=await db('rpc/utw_stat_undo_audit_entry',{method:'POST',body:JSON.stringify({p_audit_id:id,p_actor:account.username})});
    return json({ok:true,message:result});
   }
   default:return json({error:'Unknown action'},400);
  }
 }catch(e){return sendErr(e)}
}
