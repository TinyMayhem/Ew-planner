import {matchRoster,normalizeIgn,levenshtein} from './r4-ocr-parser.mjs';
const simplify=s=>String(s||'').trim().normalize('NFKC').replace(/\s+/g,' ');
const ignored=/^(?:Voting Members|Alliance Announcement|Voting Notice|The following members|chose option|Power|LV\.?\s*\d|R[1-5]|Comment|Like|Dislike|Warzone Duel)$/i;
export function cleanPollName(line){
 let s=simplify(line)
  .replace(/(?:Power|P0wer|Pewer)\s*[:：]?\s*[\d,]+.*$/i,'')
  .replace(/\bLV\.?\s*\d+.*$/i,'')
  .replace(/^[\s#\d]+/,'')
  .replace(/^(?:R[1-5]\s+)+/i,'')
  .replace(/^[♂♀🚹🚺\s]+/u,'')
  .replace(/[\s♂♀🚹🚺]+$/u,'');
 return simplify(s);
}
// Voting cards show rank badges and gender icons directly before names.
// OCR often mistakes them for short text prefixes, such as "sa", "m3" or "ç/".
// Only remove possible prefixes when a roster name/alias supports the match.
export function pollNameCandidates(raw){
 const name=cleanPollName(raw),out=[],seen=new Set();
 const push=(value,removed=0)=>{
  value=simplify(value);
  if(value&&!seen.has(value)){out.push({name:value,removed});seen.add(value)}
 };
 if(!name)return out;
 push(name);
 const tokens=name.split(/\s+/);
 for(let i=1;i<=Math.min(3,tokens.length-1);i++){
  const prefix=tokens.slice(0,i).join(' ');
  if(prefix.length>11)break;
  push(tokens.slice(i).join(' '),prefix.length+1);
 }
 // A badge can get glued to the first letter: m3Sorree Baba.
 const joined=name.match(/^([a-z]\d|[^\p{L}\p{N}]{1,3})(?=\p{Lu})/u);
 if(joined)push(name.slice(joined[0].length),joined[0].length);
 return out;
}
const pollKey=value=>normalizeIgn(value).replace(/[^\p{L}\p{N}]/gu,'');
const nameSimilarity=(a,b)=>{
 const x=pollKey(a),y=pollKey(b);
 return x&&y?Math.max(0,1-levenshtein(x,y)/Math.max(x.length,y.length)):0;
};
export function rankPollMemberMatches(raw,members=[],aliases=[]){
 const candidates=pollNameCandidates(raw);
 const namesById=new Map(members.map(m=>[String(m.id),[m.display_name]]));
 for(const a of aliases){
  const labels=namesById.get(String(a.member_id));
  if(!labels)continue;
  if(a.alias)labels.push(a.alias);
  if(a.alias_key)labels.push(a.alias_key);
 }
 return members.map(m=>{
  let score=0;
  for(const c of candidates){
   for(const label of namesById.get(String(m.id))||[m.display_name]){
    score=Math.max(score,nameSimilarity(c.name,label));
   }
  }
  return {id:m.id,name:m.display_name,score};
 }).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,undefined,{sensitivity:'base'}));
}
export function resolvePollOcrName(raw,members=[],aliases=[]){
 const candidates=pollNameCandidates(raw);
 if(!candidates.length)return {name:'',member_id:null,suggestion:null,confidence:'unmatched'};
 const matches=candidates.map(c=>({candidate:c,match:matchRoster(c.name,members,aliases)}));
 // A complete exact name wins over a partial exact nickname.
 const exact=matches.filter(x=>x.match.type==='exact')
  .sort((a,b)=>a.candidate.removed-b.candidate.removed)[0];
 if(exact)return {name:exact.candidate.name,member_id:exact.match.id,
  suggestion:exact.match.id,confidence:'matched'};
 // A fuzzy match can clean noise, but never automatically confirms a member.
 const fuzzy=matches.filter(x=>x.match.type==='suggested'&&x.match.similarity>=0.76)
  .sort((a,b)=>b.match.similarity-a.match.similarity||a.candidate.removed-b.candidate.removed)[0];
 if(fuzzy)return {name:fuzzy.candidate.name,member_id:null,
  suggestion:fuzzy.match.id,confidence:'suggested'};
 const original=candidates[0].name,ranked=rankPollMemberMatches(original,members,aliases);
 return {name:original,member_id:null,
  suggestion:ranked[0]?.score>=0.65?ranked[0].id:null,confidence:'unmatched'};
}
export function parsePollOcrText(raw,members=[],aliases=[]){
 const lines=String(raw||'').split(/\r?\n/).map(simplify).filter(Boolean),names=[];
 const seen=new Set();
 function add(candidate){
  const found=resolvePollOcrName(candidate,members,aliases),name=found.name;
  if(!name||name.length>70||!/\p{L}/u.test(name)||ignored.test(name)||/^Power|^LV\b/i.test(name))return;
  const key=found.member_id?'member:'+found.member_id:'name:'+pollKey(name);
  if(seen.has(key))return;
  seen.add(key);names.push(found);
 }
 // The poll uses the member name just above the Power: and LV.35 line.
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(/\b(?:Power|P0wer|Pewer)\s*[:：]?\s*[\d,]{5,}/i.test(line)){
   const before=cleanPollName(line);
   if(before&&before!==line)add(before);
   else if(i>0)add(lines[i-1]);
  }
 }
 // If a name's Power line was cut off, an exact roster-name match is still reviewable.
 for(const line of lines){
  if(/Power|LV\.?\s*\d|following members|option \d|voting|announc/i.test(line))continue;
  const result=resolvePollOcrName(line,members,aliases);
  if(result.member_id)add(line);
 }
 return names;
}
export function parsePollCsv(text,fallbackResponse='yes'){
 const lines=[];let field='',fields=[],quoted=false;
 const raw=String(text||'').replace(/^\uFEFF/,'');
 for(let i=0;i<raw.length;i++){
  const c=raw[i];
  if(c==='"'){
   if(quoted&&raw[i+1]==='"'){field+='"';i++}
   else quoted=!quoted;
  }else if(c===','&&!quoted){fields.push(field);field=''}
  else if((c==='\n'||c==='\r')&&!quoted){fields.push(field);if(fields.some(x=>x.trim()))lines.push(fields);fields=[];field='';if(c==='\r'&&raw[i+1]==='\n')i++}
  else field+=c;
 }
 if(quoted)throw Error('Unclosed CSV quote');
 fields.push(field);if(fields.some(x=>x.trim()))lines.push(fields);
 if(!lines.length)throw Error('Empty CSV');
 const header=lines[0].map(x=>simplify(x).toLowerCase().replace(/[^a-z]/g,''));
 const indexName=header.findIndex(x=>['membername','name','nickname','member','player'].includes(x));
 const indexResponse=header.findIndex(x=>['response','vote','answer','choice'].includes(x));
 const hasHeader=indexName>=0;
 const nameColumn=hasHeader?indexName:0,respondColumn=hasHeader?indexResponse:(lines[0].length>1?1:-1);
 const items=[];
 for(const row of lines.slice(hasHeader?1:0)){
  const name=simplify(row[nameColumn]);
  if(!name)continue;
  const response=simplify(respondColumn>=0?row[respondColumn]:fallbackResponse).toLowerCase();
  if(!['yes','no','maybe'].includes(response))throw Error('Invalid Yes/No/Maybe answer for '+name);
  items.push({name,response});
  if(items.length>250)throw Error('CSV cannot contain more than 250 voters per upload');
 }
 if(!items.length)throw Error('CSV contains no member names');
 return items;
}
