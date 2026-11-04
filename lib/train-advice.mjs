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

export function buildTrainAdvice({date,mode,slot='',members=[],aliases=[],legacy=[],awards=[],exceptions=[],scoreboard=[],scoreDate=null,dsEvent=null}){
 const stage=stageForDate(date),range=stageRange(stage),monday=weekStart(date);
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
 const label=slot||trainLabelForDate(stage,date)||'';
 const nameMatch=label.match(/^R4\s+(.+?)(?:\s*\(proposed\))?$/i);
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
  context=scoreDate?'Rankings from '+(mode==='vs'?'VS day ':'donation week ')+scoreDate:
   'No matching '+(mode==='vs'?'VS daily CSV for this train week':'previous-week donation CSV')+' has been uploaded.';
 }else if(mode==='ds'){
  rows=dsEvent?[dsEvent.first_member,dsEvent.second_member,dsEvent.third_member].filter(id=>id&&byId.has(id)).map((id,i)=>({id,place:i+1,points:null})):[];
  dataDate=dsEvent?.event_date||null;
  context=dsEvent?'Desert Storm podium from '+dsEvent.event_date:'No recent Desert Storm result was uploaded.';
 }else if(mode==='never'){
  const latest=new Map();
  for(const h of before)for(const id of [h.driver,h.vip])if(id&&!latest.has(id))latest.set(id,h.date);
  rows=members.filter(m=>m.id).map(m=>({id:m.id,place:0,points:null,last:latest.get(m.id)||null}))
   .sort((a,b)=>Number(!!a.last)-Number(!!b.last)||(a.last||'').localeCompare(b.last||'')||byId.get(a.id).localeCompare(byId.get(b.id)))
   .map((r,i)=>({...r,place:i+1}));
  context='Prioritize members with no saved driver or VIP entry from Stage 7 onward. Earlier stages and unlinked nicknames need manual verification.';
 }else{
  context='Choose a source to see evidence-based conductor recommendations.';
 }
 const eligibleCategory=mode==='vs'||mode==='donations'||mode==='ds';
 const results=rows.map(item=>{
  const reasons=[],notes=[];
  const mine=before.filter(h=>h.driver===item.id||h.vip===item.id);
  const latest=mine[0];
  const ex=exceptions.filter(x=>x.active&&x.member_id===item.id&&x.starts_on<=date&&x.ends_on>=date&&(x.scope==='all'||x.scope===mode));
  if(ex.length)reasons.push('Active exception: '+ex.map(x=>x.reason).join('; '));
  if(mode==='never'&&latest){
   reasons.push('Previously '+(latest.driver===item.id?'drove':'was VIP on')+' '+latest.date);
  }
  if(eligibleCategory){
   const received=mine.find(h=>h.date>=range.start&&h.date<=range.end&&!isR4Train(h)&&h.source===mode);
   if(received)reasons.push('Already received a '+(mode==='vs'?'VS':mode==='ds'?'DS MVP':'donation')+' train on '+received.date+' (Stage '+stage+')');
  }
  const regular=mode!=='r4';
  const alreadyDriven=regular&&mine.find(h=>h.date>=monday&&h.date<date&&h.driver===item.id&&!isR4Train(h));
  if(alreadyDriven)reasons.push('Already drove a regular train on '+alreadyDriven.date+' this week');
  if(mode==='r4'){
   const prior=mine.find(h=>h.date>=range.start&&h.date<=range.end&&isR4Train(h));
   if(prior)reasons.push('Already had an R4 train on '+prior.date+' (Stage '+stage+')');
  }
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
 const limitations='Recommendations use recorded Stages 7 onward, saved R4 edits and matching member aliases. Confirm current rank, hive location, availability and historical nicknames before assigning.';
 return {stage,date,mode,context,dataDate,slot:label,host,hostProposed:isProposal,
  recommended,rejected:skipped,substitution,sameDate:sameDate.map(x=>({driver:x.driverName,vip:x.vipName,slot:x.slot})),
  candidates:results.slice(0,mode==='never'?25:20),eligibleCount:results.filter(x=>x.eligible).length,limitations};
}
