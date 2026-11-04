// Browser screenshot parser for UTW game ranking lists.
// Pure helpers, deliberately conservative. Every result requires human confirmation.
export const normalizeIgn=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[ƉĐđɖ]/g,'d').replace(/[Łł]/g,'l').trim().replace(/\s+/g,' ').toLowerCase();
export function scoreValue(text){
 const raw=String(text||'').trim().replace(/[Oo](?=\d)/g,'0').replace(/[Il](?=\d)/g,'1');
 const match=/^(\d[\d,. ]*)([KMB])?$/i.exec(raw.replace(/\s*(points?|pts|power|score)$/i,'').trim());
 if(!match)return null;
 const unit=(match[2]||'').toUpperCase();
 if(!unit&&!/[., ]/.test(match[1])&&match[1].length<3)return null;
 const digits=match[1].trim();
 const dec=unit?Number(digits.replace(/,/g,'')):Number(digits.replace(/[,. ]/g,''));
 if(!Number.isFinite(dec)||dec<0)return null;
 const mul={K:1e3,M:1e6,B:1e9}[unit]||1;
 const score=Math.round(dec*mul);
 return Number.isSafeInteger(score)?score:null;
}
const ignore=/^(?:rank(?:ing)?|commander|member|score|points|donations?|contribution|power|total|vs|alliance|daily|weekly|page\s*\d+|\d+\s*\/\s*\d+|results?|leaderboard|top\s*\d+)\b/i;
export function parseRankLines(input){
 const raw=String(input||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 const rows=[],unread=[];
 for(let i=0;i<raw.length;i++){
  const line=raw[i];if(ignore.test(line))continue;
  let content=line.replace(/^[#\s]*(?:\d{1,3}[.)]|\d{1,3}\s*[-:|])\s*/,'').trim();
  let match=content.match(/^(.*?)[\s|:]+(\d[\d,. ]*[KMB]?)\s*(?:points?|pts)?$/i);
  if(!match){
   // Sometimes OCR reads the score below the player instead of beside it.
   const next=raw[i+1];
   const candidate=next?scoreValue(next.replace(/\s*(?:pts|points)$/i,'')):null;
   if(candidate!==null&&/[\p{L}]/u.test(content)&&!ignore.test(content)){
    match=[content+' '+next,content,next];i++;
   }
  }
  if(!match){
   if(/[\p{L}]/u.test(content)&&content.length>=2&&content.length<=70)unread.push(line);
   continue;
  }
  const name=match[1].trim().replace(/^[\d#.)\s]+/,'').replace(/[|]+$/,'').replace(/\s+/g,' ');
  const points=scoreValue(match[2]);
  if(!name||name.length>60||!/[\p{L}]/u.test(name)||points===null){unread.push(line);continue}
  if(ignore.test(name))continue;
  rows.push({name,points,raw:line});
 }
 return {rows,unread:unread.slice(0,70)};
}
export function levenshtein(a,b){
 const x=[...normalizeIgn(a)],y=[...normalizeIgn(b)];
 let prior=Array.from({length:y.length+1},(_,i)=>i);
 for(let i=1;i<=x.length;i++){
  const next=[i];
  for(let j=1;j<=y.length;j++)next[j]=Math.min(next[j-1]+1,prior[j]+1,prior[j-1]+(x[i-1]===y[j-1]?0:1));
  prior=next;
 }
 return prior[y.length];
}
export function matchRoster(name,members,aliases=[]){
 const key=normalizeIgn(name).replace(/[\s._-]/g,'');
 const index=new Map(),conflicts=new Set();
 const add=(value,id)=>{
  const k=normalizeIgn(value).replace(/[\s._-]/g,'');if(!k)return;
  if(index.has(k)&&index.get(k)!==id)conflicts.add(k);else index.set(k,id);
 };
 for(const m of members)add(m.display_name,m.id);
 for(const a of aliases){add(a.alias,a.member_id);add(a.alias_key,a.member_id)}
 for(const k of conflicts)index.delete(k);
 const byId=new Map(members.map(x=>[x.id,x.display_name]));
 if(index.has(key))return {id:index.get(key),name:byId.get(index.get(key)),type:'exact'};
 // Suggest, never silently apply a fuzzy guess. Missed digits and non-Latin text are risky.
 if(key.length<4)return {id:null,name:null,type:'unknown'};
 const suggestions=[...index.entries()].map(([k,id])=>({id,d:levenshtein(key,k)})).filter(x=>x.d<=(key.length>=7?2:1))
 .sort((a,b)=>a.d-b.d).filter((x,i,list)=>list.findIndex(y=>y.id===x.id)===i);
 const best=suggestions[0];
 if(!best||suggestions[1]?.d===best.d)return {id:null,name:null,type:'unknown'};
 return {id:best.id,name:byId.get(best.id),type:'suggested'};
}
export function validateConfirmedRows(images){
 const rows=images.flatMap(image=>image.rows.filter(r=>!r.deleted));
 if(!rows.length)throw Error('No member scores to save. Add missing rows or rescan the screenshots.');
 if(rows.length>500)throw Error('One upload can contain at most 500 rows.');
 const seen=new Set(),out=[];
 for(const [i,row] of rows.entries()){
  const name=String(row.name||'').trim().replace(/\s+/g,' '),points=Number(String(row.points).replace(/[ ,]/g,''));
  if(!name||name.length>60||!/\p{L}/u.test(name))throw Error('Check the name on row '+(i+1)+'.');
  if(!Number.isSafeInteger(points)||points<0)throw Error('Check the score for '+name+'.');
  if(!row.confirmed)throw Error('Confirm the name for '+name+' before saving.');
  const k=normalizeIgn(name);
  if(seen.has(k))throw Error('Duplicate name: '+name+'. Remove the repeated row before saving.');
  seen.add(k);out.push({name,points});
 }
 return out;
}
