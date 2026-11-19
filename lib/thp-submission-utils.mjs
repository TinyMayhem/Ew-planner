import {powerFromInput} from '../assets/thp-power.mjs';
export {powerFromInput};
export function nameKey(value){
 return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
}
export function nameSuggestions(query,members,aliases,limit=8){
 const q=nameKey(query);if(q.length<2)return [];
 const names=new Map(members.map(m=>[String(m.source_member_id),String(m.name)]));
 const aliasesById=new Map();
 for(const a of aliases||[]){
  const id=String(a.source_member_id||a.member_id||'');
  if(!names.has(id)||!a.alias)continue;
  if(!aliasesById.has(id))aliasesById.set(id,[]);
  aliasesById.get(id).push(a.alias);
 }
 return members.map(m=>{
  const id=String(m.source_member_id),name=String(m.name),canonical=nameKey(name);
  const old=aliasesById.get(id)||[];
  const match=old.find(a=>nameKey(a).includes(q));
  const rank=canonical===q?0:old.some(a=>nameKey(a)===q)?1:canonical.startsWith(q)?2:old.some(a=>nameKey(a).startsWith(q))?3:canonical.includes(q)?4:match?5:99;
  return {id,name,rank};
 }).filter(v=>v.rank<99).sort((a,b)=>a.rank-b.rank||a.name.localeCompare(b.name,undefined,{sensitivity:'base'}))
 .slice(0,limit).map(({id,name})=>({id,name}));
}
export function cleanThpSubmission(body){
 const rawName=String(body?.name??'').trim().replace(/\s+/g,' ');
 const squadType=String(body?.squadType||'').toLowerCase();
 const squadPower=powerFromInput(body?.squadPower);
 const heroPower=powerFromInput(body?.heroPower);
 const note=String(body?.note??'').trim();
 if(!rawName||rawName.length>100||/[\x00-\x1f\x7f]/.test(rawName))throw Error('Enter your in-game name (100 characters max).');
 if(!['tank','air','missile'].includes(squadType))throw Error('Choose Tank, Air or Missile for your main squad.');
 if(squadPower===null)throw Error('Enter your main squad power, for example 52.78 or 52.78M.');
 if(heroPower===null)throw Error('Enter Hero Power from Power Details, not overall commander power.');
 if(note.length>500||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(note))throw Error('Keep your note under 500 characters.');
 return {submitted_name:rawName,squad_type:squadType,squad_power:squadPower,hero_power:heroPower,member_note:note};
}
