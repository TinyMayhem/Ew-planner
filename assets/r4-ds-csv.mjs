import {parseCsv} from './r4-csv-utils.mjs';
const norm=v=>String(v??'').trim().replace(/\s+/g,' ').normalize('NFKC').toLowerCase();
export function parseDsCsvOutcome(raw){
 const {head,matrix}=parseCsv(raw);
 const col=head.findIndex(h=>['outcome','result','winloss','winlose','matchresult'].includes(norm(h).replace(/[^a-z]/g,'')));
 if(col<0)return null;
 const results=new Set();
 for(const row of matrix){
  const value=norm(row[col]);if(!value)continue;
  if(['win','won','w','victory'].includes(value))results.add('win');
  else if(['loss','lose','lost','l','defeat'].includes(value))results.add('loss');
  else throw Error('Invalid match result: '+row[col]+'. Use Win or Loss.');
 }
 if(results.size>1)throw Error('A team CSV must have one consistent match result. Split different matches into separate files.');
 return [...results][0]||null;
}
export function parseDsCsv(raw){
 const {head,matrix}=parseCsv(raw);
 const names=head.map(h=>norm(h).replace(/[ _-]+/g,''));
 const n=names.findIndex(h=>['membername','member','playername','player','ign','commander','commandername','name','nickname'].includes(h));
 const p=names.findIndex(h=>['points','score','scores','dsscore','dspoints','totalpoints','total','point'].includes(h));
 if(n<0||p<0||n===p)throw Error('CSV needs member_name and points columns (or player and score).');
 if(matrix.length>200)throw Error('Upload at most 200 DS players per file.');
 const seen=new Set();
 return matrix.map((row,i)=>{
  const name=String(row[n]??'').trim().replace(/\s+/g,' ');
  const raw=String(row[p]??'').trim().replace(/[\s,]/g,'');
  const match=/^(\d+(?:\.\d+)?)([kmb])?$/i.exec(raw);
  const points=match?Number(match[1])*({k:1e3,m:1e6,b:1e9}[String(match[2]||'').toLowerCase()]||1):NaN;
  if(!name||name.length>60||!Number.isSafeInteger(points)||points<0)throw Error('Invalid player name or score on CSV row '+(i+2)+'.');
  const key=norm(name);if(seen.has(key))throw Error('Duplicate name: '+name);seen.add(key);
  return {name,points};
 });
}
export function matchDsCsvRows(rows,members,aliases){
 const active=new Set(members.map(m=>m.id)),lookup=new Map();
 const add=(label,id)=>{if(!active.has(id))return;const k=norm(label);if(!lookup.has(k))lookup.set(k,new Set());lookup.get(k).add(id)};
 for(const m of members)add(m.display_name,m.id);
 for(const a of aliases){add(a.alias,a.member_id);add(a.alias_key,a.member_id)}
 return rows.map(row=>{const matches=lookup.get(norm(row.name));return {...row,memberId:matches?.size===1?[...matches][0]:null}});
}
