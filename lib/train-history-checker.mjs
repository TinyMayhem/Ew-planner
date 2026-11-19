// Train History Checker. This is read-only; dates and identity matches come only
// from the recorded R4 train awards and the earlier spreadsheet archive.
import {resolveNames} from './train-advice.mjs';
import {stageForDate} from '../assets/r4-train-rules.mjs';

const safeDate=date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date);
const daysBetween=(older,later)=>Math.round((Date.parse(later+'T12:00:00Z')-Date.parse(older+'T12:00:00Z'))/86400000);
const display=(id,lookup,fallback)=>id?lookup.get(id)||fallback||'Unknown member':fallback||'Not recorded';

// Live R4 assignments replace legacy spreadsheet entries on the same date,
// exactly as the existing Train Calendar does. Unlinked spreadsheet names are
// not assigned to a guessed member.
export function trainHistoryRows({awards=[],legacy=[],members=[],aliases=[]}){
 const resolve=resolveNames(members,aliases);
 const names=new Map(members.map(m=>[m.id,m.display_name]));
 const savedDays=new Set(awards.map(a=>a.train_date));
 const rows=[],unmatched=[];
 for(const a of awards){
  if(!safeDate(a.train_date))continue;
  rows.push({
   date:a.train_date,source:a.source||'manual',slot:a.slot||'Train',
   conductorId:a.member_id||null,vipId:a.vip_member_id||null,
   conductorName:display(a.member_id,names,'Former member'),
   vipName:display(a.vip_member_id,names,'Not recorded'),
   origin:'R4 saved',stage:stageForDate(a.train_date)
  });
 }
 for(const a of legacy){
  if(!safeDate(a.train_date)||savedDays.has(a.train_date))continue;
  const conductorId=resolve(a.driver_name),vipId=resolve(a.vip_name);
  if(a.driver_name&&!conductorId)unmatched.push({date:a.train_date,role:'Conductor'});
  if(a.vip_name&&!vipId)unmatched.push({date:a.train_date,role:'VIP'});
  rows.push({
   date:a.train_date,source:a.source||'legacy',slot:a.selection_label||'Historic train',
   conductorId,vipId,conductorName:display(conductorId,names,a.driver_name||'Not recorded'),
   vipName:display(vipId,names,a.vip_name||'Not recorded'),
   origin:'Spreadsheet',stage:stageForDate(a.train_date)
  });
 }
 rows.sort((a,b)=>b.date.localeCompare(a.date)||a.slot.localeCompare(b.slot));
 return {rows,unlinkedLegacyCount:unmatched.length,earliestRecordedDate:rows.reduce((m,r)=>!m||r.date<m?r.date:m,null)};
}
export function memberTrainHistory({memberId,rows,today}){
 const history=[],future=[];
 for(const row of rows){
  const roles=[];
  if(row.conductorId===memberId)roles.push('conductor');
  if(row.vipId===memberId)roles.push('vip');
  for(const role of roles){
   const entry={
    date:row.date,role,stage:row.stage,slot:row.slot,source:row.source,origin:row.origin,
    withName:role==='conductor'?row.vipName:row.conductorName
   };
   if(row.date>today)future.push(entry);
   else history.push(entry);
  }
 }
 history.sort((a,b)=>b.date.localeCompare(a.date)||a.role.localeCompare(b.role));
 future.sort((a,b)=>a.date.localeCompare(b.date)||a.role.localeCompare(b.role));
 const conductors=history.filter(x=>x.role==='conductor'),vips=history.filter(x=>x.role==='vip');
 const lastConductor=conductors[0]?.date||null,lastVip=vips[0]?.date||null,lastAny=history[0]?.date||null;
 return {memberId,history,future,total:history.length,conductorCount:conductors.length,vipCount:vips.length,
  lastConductor,lastVip,lastAny,
  daysSinceLast:lastAny?daysBetween(lastAny,today):null,
  daysSinceConductor:lastConductor?daysBetween(lastConductor,today):null,
  daysSinceVip:lastVip?daysBetween(lastVip,today):null
 };
}
// Comparison is intentionally not an eligibility verdict. R4 train conductor
// exceptions, stage/week limits, ranks, and hive attendance are separate checks.
export function compareTrainWait(first,second,role='any'){
 if(!second)return null;
 const field=role==='conductor'?'lastConductor':role==='vip'?'lastVip':'lastAny';
 const a=first[field],b=second[field];
 const name=role==='conductor'?'conductor':role==='vip'?'VIP':'conductor or VIP';
 if(!a&&!b)return {winnerId:null,tie:true,unverified:true,message:'Neither player has a linked '+name+' record in the saved history. Confirm any unmatched historical names before choosing.'};
 if(!a||!b){
  const person=!a?first:second;
  return {winnerId:person.memberId,tie:false,unverified:true,
   message:'One player has no linked '+name+' record in the saved history. They appear to have waited longer, but confirm older or unlinked records first.'};
 }
 if(a===b)return {winnerId:null,tie:true,unverified:false,
  message:'Both players last had this train role on '+a+'. Their recorded wait is tied.'};
 const winner=a<b?first:second;
 return {winnerId:winner.memberId,tie:false,unverified:false,
  message:'Longest recorded wait based on the most recent '+name+' assignment.',
  gapDays:daysBetween(a<b?a:b,a>b?a:b)};
}
