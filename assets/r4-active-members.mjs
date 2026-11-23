// Active members are searchable/selectable; archived records remain available
// to resolve saved VS, donation, Desert Storm and train history.
export const activeMembers=members=>(members||[]).filter(member=>member&&!member.archived_at);
const normalize=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
export function searchActiveMembers(members,aliases,query=''){
 const needle=normalize(query);
 const aliasNames=new Map();
 for(const alias of aliases||[]){
  if(!alias?.member_id)continue;
  if(!aliasNames.has(alias.member_id))aliasNames.set(alias.member_id,[]);
  aliasNames.get(alias.member_id).push(alias.alias||'');
 }
 return activeMembers(members).filter(member=>
  normalize(member.display_name).includes(needle)||
  (aliasNames.get(member.id)||[]).some(name=>normalize(name).includes(needle))
 );
}
