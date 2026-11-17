// R4 Command Centre login roles identify which UTW members may hold R4 departments.
// Match each active account to the latest Train Desk name without relying on old aliases.
import {resolveNames,tidy} from './train-advice.mjs';

export function activeR4MemberOptions(accounts,members,aliases){
 const resolve=resolveNames(members,aliases);
 const byId=new Map(members.map(m=>[m.id,m]));
 const selected=new Map(),unmatched=new Set();
 for(const account of accounts||[]){
  if(!account.active||!['admin','r4'].includes(account.role))continue;
  const accountName=String(account.display_name||account.username||'').trim();
  const id=resolve(accountName)||resolve(account.username);
  if(!id||!byId.has(id)){
   if(accountName)unmatched.add(accountName);
   continue;
  }
  const person=byId.get(id);
  const oldNames=[accountName,account.username,...(aliases||[]).filter(a=>a.member_id===id).map(a=>a.alias)].filter(Boolean);
  const previous=selected.get(id);
  const formerNames=[...new Set([...(previous?.formerNames||[]),...oldNames])];
  selected.set(id,{memberId:id,name:person.display_name,formerNames});
 }
 return {members:[...selected.values()].sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base'})),unmatched:[...unmatched]};
}

export function validR4RoleNames(assignment,choices){
 const allowed=new Set(choices.map(x=>tidy(x.name)));
 const names=[assignment.leader,assignment.backup,...assignment.additional_backups].filter(Boolean);
 return names.every(name=>allowed.has(tidy(name)));
}
