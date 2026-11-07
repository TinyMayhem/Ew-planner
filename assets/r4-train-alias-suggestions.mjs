// Suggests historical train spellings for human confirmation in Nickname Manager.
// Never merges players or writes aliases without an explicit confirmation.
import {normalizeIgn,levenshtein} from './r4-ocr-parser.mjs?version=auto90-v1-20261106';
const key=value=>normalizeIgn(value).replace(/[\s._-]/g,'');
const annotation=/\b(?:no show|gifted to|not set|did not|swap|redacted|100%|roulette|recorded|choice)\b|[/()]/i;
const excluded=/^(?:not recorded|none|unknown|train|vip|123)$/i;
export function trainAliasSuggestions(trainLegacy=[],members=[],aliases=[]){
 const names=new Map();
 for(const record of trainLegacy)for(const raw of [record.driver_name,record.vip_name]){
  const n=String(raw||'').trim().replace(/\s+/g,' ');
  if(!n||n.length>60||excluded.test(n)||annotation.test(n))continue;
  names.set(n,(names.get(n)||0)+1);
 }
 const index=new Map();
 for(const m of members)for(const raw of [m.display_name,...aliases.filter(x=>x.member_id===m.id).map(x=>x.alias)]){
  const k=key(raw);if(!k)continue;
  if(!index.has(k))index.set(k,new Set());index.get(k).add(m.id);
 }
 const byId=new Map(members.map(m=>[m.id,m.display_name]));
 const result=[];
 for(const [oldName,count] of names){
  const nameKey=key(oldName);
  if(nameKey.length<4||index.has(nameKey))continue;
  const scores=new Map();
  for(const [known,ids] of index){
   if(ids.size!==1)continue;
   const id=[...ids][0];
   const similarity=1-levenshtein(nameKey,known)/Math.max(nameKey.length,known.length);
   const contains=nameKey.length>=4&&known.length>=nameKey.length+2&&known.includes(nameKey);
   const score=Math.max(similarity,contains?0.76:0);
   if(!scores.has(id)||score>scores.get(id))scores.set(id,score);
  }
  const ordered=[...scores.entries()].sort((a,b)=>b[1]-a[1]);
  const best=ordered[0],second=ordered[1];
  if(!best||best[1]<0.72||second&&best[1]-second[1]<0.08)continue;
  result.push({alias:oldName,member_id:best[0],member_name:byId.get(best[0]),
   confidence:Math.round(best[1]*100),occurrences:count});
 }
 return result.sort((a,b)=>b.confidence-a.confidence||b.occurrences-a.occurrences||
  a.alias.localeCompare(b.alias)).slice(0,75);
}
