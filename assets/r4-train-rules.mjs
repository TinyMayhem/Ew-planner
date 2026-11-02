// Pure train calendar and eligibility checks shared by the R4 Train Desk.
export const TRAIN_ANCHOR='2026-08-03';
export const TRAIN_BASE_STAGE=13;
const DAY=86400000;
const toTime=date=>Date.parse(date+'T00:00:00Z');
export const addDays=(date,days)=>new Date(toTime(date)+days*DAY).toISOString().slice(0,10);
export function stageRange(stage){
 if(!Number.isInteger(stage)||stage<13||stage>40)throw Error('Unsupported train calendar');
 const start=addDays(TRAIN_ANCHOR,(stage-TRAIN_BASE_STAGE)*35);
 return {stage,start,end:addDays(start,34)};
}
export function stageForDate(date){
 const timestamp=toTime(date);
 if(!Number.isFinite(timestamp))return TRAIN_BASE_STAGE;
 return Math.max(TRAIN_BASE_STAGE,Math.min(40,TRAIN_BASE_STAGE+Math.floor((timestamp-toTime(TRAIN_ANCHOR))/(35*DAY))));
}
export const weekStart=date=>addDays(date,-((new Date(toTime(date)).getUTCDay()+6)%7));
export const trainRole=(award,id)=>award.member_id===id?'Driver':award.vip_member_id===id?'VIP':null;
export function trainWarnings(awards,proposed,displayName=id=>id){
 const {train_date,member_id,vip_member_id,source,slot,id:editingId}=proposed;
 if(!train_date||!member_id||!vip_member_id)return [];
 const stage=stageForDate(train_date),range=stageRange(stage),weeklyStart=weekStart(train_date);
 const warnings=[];
 const people=[{id:member_id,role:'Driver'},{id:vip_member_id,role:'VIP'}];
 for(const person of people){
  const matches=awards.filter(a=>a.id!==editingId&&a.train_date>=range.start&&a.train_date<=range.end&&trainRole(a,person.id));
  const who=displayName(person.id);
  for(const prior of matches){
   warnings.push(who+' already appeared as '+trainRole(prior,person.id)+' on '+prior.train_date+' (Stage '+stage+'). This '+person.role+' assignment repeats a person in the same calendar.');
  }
  if(person.role==='Driver'&&matches.some(a=>a.member_id===person.id&&a.train_date>=weeklyStart&&a.train_date<=addDays(weeklyStart,6))){
   warnings.push(who+' has already driven a train this Monday-to-Sunday week.');
  }
  if(person.role==='Driver'&&/roulette/i.test(slot||'')&&matches.some(a=>a.member_id===person.id)){
   warnings.push(who+' is not eligible for roulette because they already drove in Stage '+stage+'.');
  }
  if(['ds','donations','vs'].includes(source)&&matches.some(a=>a.source===source)){
   const label={ds:'DS MVP',donations:'Top donor',vs:'Top VS'}[source];
   warnings.push(who+' has already received a '+label+' train assignment in Stage '+stage+'.');
  }
 }
 return [...new Set(warnings)];
}
