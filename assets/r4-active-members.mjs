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

// Archived aliases must not be used to resolve a current selection.
export function activeAliases(members,aliases){
 const ids=new Set(activeMembers(members).map(m=>String(m.id)));
 return (aliases||[]).filter(a=>ids.has(String(a.member_id)));
}
// External Alliance Duel IDs differ from the member directory IDs. Resolve the
// known archived names and aliases to external IDs, without dropping unlinked
// external members who may be new recruits. A historical alias can also identify
// a source ID whose latest name has changed.
const externalKey=value=>String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function filterExternalRoster(rows,members,aliases,sourceAliases=[]){
 const archived=new Set((members||[]).filter(m=>m?.archived_at).map(m=>String(m.id)));
 const blockedNames=new Set();
 const add=value=>{const key=externalKey(value);if(key)blockedNames.add(key)};
 for(const m of members||[])if(archived.has(String(m.id)))add(m.display_name);
 for(const a of aliases||[])if(archived.has(String(a.member_id))){add(a.alias);add(a.alias_key)}
 const sourceId=r=>String(r?.source_member_id??r?.id??'');
 const blocked=new Set();
 for(const a of sourceAliases||[])if(blockedNames.has(externalKey(a.alias))&&sourceId(a))blocked.add(sourceId(a));
 for(const r of rows||[])if(blockedNames.has(externalKey(r.name??r.member_name))&&sourceId(r))blocked.add(sourceId(r));
 return (rows||[]).filter(r=>r&&!r.archived_at&&!blocked.has(sourceId(r))&&!blockedNames.has(externalKey(r.name??r.member_name)));
}
