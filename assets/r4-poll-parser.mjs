import {matchRoster} from './r4-ocr-parser.mjs';
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
export function parsePollOcrText(raw,members=[],aliases=[]){
 const lines=String(raw||'').split(/\r?\n/).map(simplify).filter(Boolean),names=[];
 const seen=new Set();
 function add(candidate){
  const name=cleanPollName(candidate);
  if(!name||name.length>70||!/\p{L}/u.test(name)||ignored.test(name)||/^Power|^LV\b/i.test(name))return;
  const key=name.toLocaleLowerCase();
  if(seen.has(key))return;seen.add(key);
  const m=matchRoster(name,members,aliases);
  names.push({name,member_id:m.type==='exact'?m.id:null,suggestion:m.id||null,
   confidence:m.type==='exact'?'matched':m.type==='suggested'?'suggested':'unmatched'});
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
  const cleaned=cleanPollName(line);
  const m=matchRoster(cleaned,members,aliases);
  if(m.type==='exact')add(cleaned);
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
