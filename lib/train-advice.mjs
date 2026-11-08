// R4-only, evidence-based train recommendations. Does not make assignments.
// Stages 1-6 and uncertain historical nicknames are not verifiable in the archive.
import {stageRange,stageForDate,weekStart,isR4Train} from '../assets/r4-train-rules.mjs';
import {trainLabelForDate} from '../assets/r4-train-schedule.mjs';

export const tidy=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
const knownNames={
 tiny:'tinymayhem',mo:'movichmo',baba:'calllmebaba',
 crum:'crum',devi:'Ɖevi',savvy:'savvyvandromee',
 sea:'seabeastfromwren',seabeast:'seabeastfromwren',
 iz:'iz4rd',izard:'iz4rd',rylis:'rylispro',catalyst:'catalystx',
 noosh:'gan00sh',ganoosh:'gan00sh',subzero:'subz3ro',
 neoo:'mynameisneoo',xgamer:'xgamer20',leo:'leonob',
 smotpoker:'commandersmotpoker',hippie:'tragicallyhippie',
 silentkiller:'silentkiller90z',minimum:'mininimum',
 kingtodd0:'kingtoddo',gb:'mfkngb'
};

export function resolveNames(members,aliases){
 const lookup=new Map(),conflicts=new Set();
 const add=(raw,id)=>{
  const k=tidy(raw);if(!k||!id)return;
  if(lookup.has(k)&&lookup.get(k)!==id)conflicts.add(k);
  else lookup.set(k,id);
 };
 for(const member of members)add(member.display_name,member.id);
 for(const a of aliases){add(a.alias,a.member_id);add(a.alias_key,a.member_id)}
 for(const [short,long] of Object.entries(knownNames)){
  const target=lookup.get(tidy(long));if(target)add(short,target);
 }
 for(const k of conflicts)lookup.delete(k);
 return value=>lookup.get(tidy(value))||null;
}

export function buildTrainAdvice({date,mode,slot='',vipMode='weekly',members=[],aliases=[],legacy=[],awards=[],exceptions=[],scoreboard=[],scoreDate=null,dsEvent=null,rosterIds=[],rosterDate=null}){
 const stage=stageForDate(date),range=stageRange(stage),monday=weekStart(date);
 const saturdayVs=mode==='vs'&&new Date(date+'T00:00:00Z').getUTCDay()===6;
 const resolve=resolveNames(members,aliases),byId=new Map(members.map(m=>[m.id,m.display_name]));
 const savedDates=new Set(awards.map(a=>a.train_date));
 const history=[
  ...legacy.filter(x=>!savedDates.has(x.train_date)).map(x=>({
   date:x.train_date,source:x.source,slot:x.selection_label,
   driver:resolve(x.driver_name),vip:resolve(x.vip_name),
   driverName:x.driver_name,vipName:x.vip_name
  })),
  ...awards.map(x=>({
   date:x.train_date,source:x.source,slot:x.slot,
   driver:x.member_id,vip:x.vip_member_id||null,
   driverName:byId.get(x.member_id)||'Former member',vipName:byId.get(x.vip_member_id)||'Not recorded'
  }))
 ].filter(x=>x.date<=date).sort((a,b)=>b.date.localeCompare(a.date));
 const before=history.filter(x=>x.date<date),sameDate=history.filter(x=>x.date===date);
 const label=slot||(saturdayVs?'Saturday VS top scores':trainLabelForDate(stage,date))||'';
 const nameMatch=mode==='r4'?label.match(/^R4\s+(.+?)(?:\s*\(proposed\))?$/i):null;
 const host=nameMatch&&!/vote|choice|participation/i.test(nameMatch[1])?nameMatch[1].replace(/\s*\(proposed\)$/i,'').trim():null;
 const hostId=host?resolve(host):null;
 const isProposal=/\(proposed\)/i.test(label);
 let rows=[],context='',dataDate=null;
 if(mode==='r4'){
  if(hostId)rows=[{id:hostId,place:1,points:null}];
  context=host?('Rotation holder: '+host+(isProposal?' (proposed from Stage 15)':'')+(hostId?'':' (not linked to a current stats member, choose the actual player manually)')): 'This slot has no named R4 rotation holder. R4 must choose the conductor.';
 }else if(mode==='vs'||mode==='donations'){
  const best=new Map();
  for(const row of scoreboard){if(!row.member_id||!byId.has(row.member_id))continue;
   if(!best.has(row.member_id)||Number(row.points)>best.get(row.member_id).points)best.set(row.member_id,{id:row.member_id,points:Number(row.points)});
  }
  rows=[...best.values()].sort((a,b)=>b.points-a.points||byId.get(a.id).localeCompare(byId.get(b.id))).map((r,i)=>({...r,place:i+1}));
  dataDate=scoreDate;
  context=scoreDate?'Rankings from '+(mode==='vs'?(saturdayVs?"this week's VS weekly total for week starting ":'completed VS weekly total for week starting '):'donation week starting ')+scoreDate:
   (saturdayVs?"No VS weekly total has been uploaded for this Saturday's current week. ":"No "+(mode==='vs'?'completed VS weekly total for the previous week':'previous-week donation total')+' has been uploaded. ')+
   'Daily VS points are not used for train selection.';
 }else if(mode==='ds'){
  rows=dsEvent?[dsEvent.first_member,dsEvent.second_member,dsEvent.third_member].filter(id=>id&&byId.has(id)).map((id,i)=>({id,place:i+1,points:null})):[];
  dataDate=dsEvent?.event_date||null;
  context=dsEvent?'Desert Storm podium from '+dsEvent.event_date:'No recent Desert Storm result was uploaded.';
 }else if(mode==='never'){
  const latest=new Map();
  for(const h of before)for(const id of [h.driver,h.vip])if(id&&!latest.has(id))latest.set(id,h.date);
  const roster=new Set(rosterIds.filter(id=>byId.has(id)));
  const pool=roster.size?members.filter(m=>roster.has(m.id)):members;
  rows=pool.filter(m=>m.id).map(m=>({id:m.id,place:0,points:null,last:latest.get(m.id)||null}))
   .sort((a,b)=>Number(!!a.last)-Number(!!b.last)||(a.last||'').localeCompare(b.last||'')||byId.get(a.id).localeCompare(byId.get(b.id)))
   .map((r,i)=>({...r,place:i+1}));
  const neverCount=rows.filter(r=>!r.last).length;
  context=(roster.size?'Using '+roster.size+' names from the latest available VS roster ('+rosterDate+'). ':
   'No VS roster upload found for this date. Using the member directory as a fallback. ')+
   (neverCount?neverCount+' members have no matched train record since Stage 7. They appear first.':
    'Everyone in this roster has a matched train record. Recommending the longest wait since their MOST RECENT conductor or VIP turn, starting with Stage 7, then Stage 8 onward.')+
   ' Older than Stage 7 or unlinked historical names still need R4 review.';
 }else{
  context='Choose a source to see evidence-based conductor recommendations.';
 }
 const r4Lane=isR4Train({date,source:mode,slot:label});
 const results=rows.map(item=>{
  const reasons=[],notes=[];
  const mine=before.filter(h=>h.driver===item.id||h.vip===item.id);
  const latest=mine[0];
  const ex=exceptions.filter(x=>x.active&&x.member_id===item.id&&x.starts_on<=date&&x.ends_on>=date&&(x.scope==='all'||x.scope===mode));
  if(ex.length)reasons.push('Active exception: '+ex.map(x=>x.reason).join('; '));
  if(mode==='never'){
   if(latest)notes.push('Longest-wait fallback: last recorded '+(latest.driver===item.id?'conductor':'VIP')+' on '+latest.date+' (Stage '+stageForDate(latest.date)+')');
   else notes.push('No matched conductor or VIP entry in Stages 7 onward');
  }
  // Recommendations are for the conductor slot. A prior VIP selection can NEVER
  // disqualify someone from driving; R4 trains still have their own separate lane.
  const priorDriver=before.find(h=>h.driver===item.id&&h.date>=range.start&&h.date<=range.end&&isR4Train(h)===r4Lane);
  if(priorDriver)reasons.push('Already conductor on '+priorDriver.date+' in Stage '+stage+' (conductor limit: once per stage)');
  if(mode!=='never'&&latest)notes.push('Last recorded train '+latest.date+' ('+(latest.driver===item.id?'conductor':'VIP')+')');
  return {id:item.id,name:byId.get(item.id),place:item.place,points:item.points,
   eligible:reasons.length===0,reasons,notes};
 });
 const recommended=results.find(x=>x.eligible)||null;
 const skipped=results.filter(x=>!x.eligible&&(!recommended||x.place<recommended.place)).slice(0,8);
 let substitution=null;
 if(recommended&&skipped.length&&(mode==='vs'||mode==='donations'||mode==='ds')){
  const first=skipped[0];
  substitution=first.name+' (#'+first.place+') skipped: '+first.reasons[0]+'. Suggest '+recommended.name+' (#'+recommended.place+') instead.';
 }
 // VIPs have no R4 exception. The weekly cap applies across every train.
 // Optional Stage filter prioritizes people without a VIP turn this Stage.
 const vsRankById=new Map(saturdayVs?rows.map(x=>[x.id,x.place]):[]);
 const vsPointsById=new Map(saturdayVs?rows.map(x=>[x.id,x.points]):[]);
 const vipCandidates=members.filter(m=>m.id&&(!saturdayVs||vsRankById.has(m.id))).map(m=>{
  const turns=before.filter(h=>h.vip===m.id);
  const last=turns[0]||null;
  const stageTurn=turns.find(h=>h.date>=range.start&&h.date<=range.end);
  const weekTurn=turns.find(h=>h.date>=monday);
  const ex=exceptions.filter(x=>x.active&&x.member_id===m.id&&x.starts_on<=date&&x.ends_on>=date&&
    (x.scope==='all'||x.scope===mode));
  const reasons=[];
  if(weekTurn)reasons.push('Already VIP on '+weekTurn.date+' this week');
  if(vipMode==='stage'&&!saturdayVs&&stageTurn)reasons.push('Already VIP on '+stageTurn.date+' in Stage '+stage);
  if(ex.length)reasons.push('Active exception: '+ex.map(x=>x.reason).join('; '));
  const notes=[last?'Last VIP on '+last.date+' (Stage '+stageForDate(last.date)+')':
    'No matched VIP turn since Stage 7'];
  return {id:m.id,name:m.display_name,eligible:reasons.length===0,reasons,notes,
    vsRank:saturdayVs?vsRankById.get(m.id):null,points:saturdayVs?vsPointsById.get(m.id):null,
    lastVip:last?.date||null,stageVip:!!stageTurn};
 }).sort((a,b)=>saturdayVs?a.vsRank-b.vsRank:
   Number(b.eligible)-Number(a.eligible)||
   Number(!!a.lastVip)-Number(!!b.lastVip)||
   (a.lastVip||'').localeCompare(b.lastVip||'')||a.name.localeCompare(b.name))
   .map((r,i)=>({...r,place:saturdayVs?r.vsRank:i+1}));
 const recommendedVip=saturdayVs&&recommended?
  vipCandidates.find(v=>v.eligible&&v.id!==recommended.id&&v.vsRank>recommended.place)||null:null;
 const limitations='Recommendations use recorded Stages 7 onward, saved R4 edits and matching member aliases. Confirm current rank, hive location, availability and historical nicknames before assigning.';
 return {stage,date,mode,vipMode,context,dataDate,slot:label,host,hostProposed:isProposal,
  recommended,recommendedVip,saturdayVs,rejected:skipped,substitution,sameDate:sameDate.map(x=>({driver:x.driverName,vip:x.vipName,slot:x.slot})),
  candidates:results.slice(0,mode==='never'?25:20),eligibleCount:results.filter(x=>x.eligible).length,
   vipCandidates,vipEligibleCount:vipCandidates.filter(x=>x.eligible).length,limitations};
}
