// Pure train calendar and eligibility checks shared by the R4 Train Desk.
export const TRAIN_ANCHOR='2026-08-03';
export const TRAIN_BASE_STAGE=13;
const DAY=86400000;
const toTime=date=>Date.parse(date+'T00:00:00Z');
export const addDays=(date,days)=>new Date(toTime(date)+days*DAY).toISOString().slice(0,10);
export function stageRange(stage){
 if(!Number.isInteger(stage)||stage<7||stage>40)throw Error('Unsupported train calendar');
 // Stages 7 and 8 preceded a one-week break before Stage 9.
 const start=stage===7?'2025-12-29':stage===8?'2026-02-02':addDays(TRAIN_ANCHOR,(stage-TRAIN_BASE_STAGE)*35);
 return {stage,start,end:addDays(start,34)};
}
export function stageForDate(date){
 const timestamp=toTime(date);
 if(!Number.isFinite(timestamp))return TRAIN_BASE_STAGE;
 if(timestamp<toTime('2026-02-02'))return 7;
 if(timestamp<toTime('2026-03-16'))return 8;
 return Math.max(9,Math.min(40,TRAIN_BASE_STAGE+Math.floor((timestamp-toTime(TRAIN_ANCHOR))/(35*DAY))));
}
export const weekStart=date=>addDays(date,-((new Date(toTime(date)).getUTCDay()+6)%7));
export const trainRole=(award,id)=>award.member_id===id?'Driver':award.vip_member_id===id?'VIP':null;
// Only Thursday/Saturday R4 conductor trains use a separate eligibility lane.
// A Wednesday R4 vote is not a train assignment, and VIPs never use this lane.
export function isR4Train(award){
 const date=award?.train_date||award?.date;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return false;
 const day=new Date(date+'T00:00:00Z').getUTCDay();
 const label=String(award?.slot||award?.selection_label||'').trim();
 return (day===4||day===6)&&
   (award?.source==='r4'||/^R4(?:\s|$)/i.test(label))&&
   !/\bvote\b/i.test(label);
}
// Conductor and VIP are independent entitlements. Standard conductors are
// limited to one five-week Stage; VIPs are limited to one Monday-Sunday week,
// across ALL train types, even Thursday/Saturday R4 trains.
export function trainWarnings(awards,proposed,displayName=id=>id){
 const {train_date,member_id,vip_member_id,source,slot,id:editingId}=proposed;
 if(!train_date||(!member_id&&!vip_member_id))return [];
 const stage=stageForDate(train_date),range=stageRange(stage),weeklyStart=weekStart(train_date);
 const weeklyEnd=addDays(weeklyStart,6),r4Lane=isR4Train(proposed),warnings=[];
 const sameStage=awards.filter(a=>a.id!==editingId&&
   a.train_date>=range.start&&a.train_date<=range.end);
  const sameLane=sameStage.filter(a=>isR4Train(a)===r4Lane);
 const valid=id=>id&&String(id).trim().toLowerCase()!=='not recorded';
 if(valid(member_id)){
  const name=displayName(member_id);
  const previous=sameLane.filter(a=>a.member_id===member_id);
  for(const prior of previous){
   warnings.push(name+' already drove on '+prior.train_date+
    ' (Stage '+stage+'). A conductor cannot drive twice in the same five-week stage.');
  }
  if(source==='donations'||source==='ds'||source==='vs'){
   const winner=previous.find(a=>a.source===source);
   if(winner){
    const label={ds:'DS MVP',donations:'Top donor',vs:'Top VS'}[source];
    warnings.push(name+' already received a '+label+' conductor assignment on '+winner.train_date+' in Stage '+stage+'.');
   }
  }
 }
 if(valid(vip_member_id)){
  const name=displayName(vip_member_id);
  const previous=sameStage.filter(a=>a.vip_member_id===vip_member_id);
  const thisWeek=previous.filter(a=>a.train_date>=weeklyStart&&a.train_date<=weeklyEnd);
  for(const prior of thisWeek){
   warnings.push(name+' was already a VIP on '+prior.train_date+
    '. A VIP cannot be selected again in the same Monday-to-Sunday week.');
  }
  if(source==='donations'||source==='ds'){
   const winner=previous.find(a=>a.source===source);
   if(winner){
    const label={ds:'DS MVP',donations:'Top donor',vs:'Top VS'}[source];
    warnings.push(name+' already received a '+label+' VIP assignment on '+winner.train_date+' in Stage '+stage+'.');
   }
  }
 }
 if(valid(member_id)&&valid(vip_member_id)&&member_id===vip_member_id)
  warnings.push(displayName(member_id)+' cannot be both conductor and VIP on the same train.');
 return [...new Set(warnings)];
}
