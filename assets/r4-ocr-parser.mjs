// Browser screenshot parser for UTW game ranking lists.
// Pure helpers, deliberately conservative. Every result requires human confirmation.
export const normalizeIgn=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[ƉĐđɖ]/g,'d').replace(/[Łł]/g,'l').replace(/[Øø]/g,'o').trim().replace(/\s+/g,' ').toLowerCase();
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
 const unknown={id:null,name:null,type:'unknown',similarity:0};
 if(conflicts.has(key))return unknown;
 if(index.has(key))return {id:index.get(key),name:byId.get(index.get(key)),type:'exact',similarity:1};
 if(key.length<4)return unknown;
 // Compute best score per member, including their saved alternate names.
 // Similarity is 1 minus Levenshtein distance divided by the longer length.
 const scored=new Map();
 for(const [k,id] of index){
  const distance=levenshtein(key,k);
  const similarity=1-distance/Math.max(key.length,k.length);
  if(!scored.has(id)||similarity>scored.get(id).similarity)
   scored.set(id,{id,d:distance,similarity});
 }
 const ranked=[...scored.values()].sort((a,b)=>b.similarity-a.similarity||a.d-b.d);
 const best=ranked[0],second=ranked[1];
 if(!best||best.d>(key.length>=7?2:1))return unknown;
 // Never precheck a collision or similarly plausible alternative member.
 if(second&&best.similarity-second.similarity<0.05)return unknown;
 return {id:best.id,name:byId.get(best.id),type:'suggested',similarity:best.similarity};
}

export function autoVerifyRosterRow(row,members,aliases=[]){
 const source=String(row.ocrGuess||row.name||'').trim();
 const match=matchRoster(source,members,aliases);
 const points=Number(row.points);
 const scoreValid=row.points!==null&&row.points!==undefined&&
  String(row.points).trim()!==''&&Number.isSafeInteger(points)&&points>=0;
 const verified=(match.type==='exact'||match.type==='suggested'&&match.similarity>=0.9)&&
  scoreValid&&!row.needsScoreCheck&&!row.deleted&&!row.pinned&&row.matchType!=='conflict';
 return {...row,name:verified?match.name:row.name,confirmed:verified,
  autoMatched:verified,matchSimilarity:match.similarity||0};
}

/**
 * Build one review card per unique player and score across screenshots.
 * Only exact roster identities or identical normalized names are grouped.
 * Different scores for the same player remain separate and must be resolved.
 * Unknown/empty scores and names are never automatically collapsed.
 */
export function groupScreenshotRows(images,members=[],aliases=[]){
 const groups=[],byImage=images.map(()=>[]),overlapsByImage=images.map(()=>[]);
 const byPair=new Map(),byPlayer=new Map();
 images.forEach((image,imageIndex)=>{
  (image.rows||[]).forEach((row,index)=>{
   if(row.deleted||row.pinned)return;
   const name=String(row.name||'').trim(),match=matchRoster(name,members,aliases);
   const playerKey=match.type==='exact'&&match.id?'member:'+match.id:
    name?'name:'+normalizeIgn(name):null;
   const rawScore=String(row.points??'').trim(),points=rawScore===''?NaN:Number(rawScore.replace(/[ ,]/g,''));
   const validScore=Number.isSafeInteger(points)&&points>=0;
   const key=playerKey&&validScore?JSON.stringify([playerKey,points]):null;
   const occurrence={image,imageIndex,row,index};
   const found=key?byPair.get(key):null;
   if(found){
    found.occurrences.push(occurrence);
    overlapsByImage[imageIndex].push(found);
    return;
   }
   const group={...occurrence,occurrences:[occurrence],playerKey,score:validScore?points:null,conflict:false};
   groups.push(group);byImage[imageIndex].push(group);
   if(key)byPair.set(key,group);
   if(playerKey){
    if(!byPlayer.has(playerKey))byPlayer.set(playerKey,[]);
    byPlayer.get(playerKey).push(group);
   }
  });
 });
 const conflicts=[];
 for(const matches of byPlayer.values()){
  if(matches.length<2)continue;
  const conflict={name:matches[0].row.name,scores:matches.map(g=>g.score),groups:matches};
  for(const group of matches){group.conflict=true;group.conflictScores=conflict.scores}
  conflicts.push(conflict);
 }
 return {groups,byImage,overlapsByImage,conflicts,duplicateCount:groups.reduce((n,g)=>n+g.occurrences.length-1,0)};
}

export function validateConfirmedRows(images){
 const rows=images.flatMap(image=>image.rows.filter(r=>!r.deleted&&!r.pinned)); // defense-in-depth for older previews
 if(!rows.length)throw Error('No member scores to save. Add missing rows or rescan the screenshots.');
 if(rows.length>500)throw Error('One upload can contain at most 500 rows.');
 const seen=new Map(),out=[];
 for(const [i,row] of rows.entries()){
  const name=String(row.name||'').trim().replace(/\s+/g,' '),rawScore=String(row.points??'').trim(),points=rawScore===''?NaN:Number(rawScore.replace(/[ ,]/g,''));
  if(!name||name.length>60||!/\p{L}/u.test(name))throw Error('Check the name on row '+(i+1)+'.');
  if(!Number.isSafeInteger(points)||points<0)throw Error('Check the score for '+name+'.');
  if(!row.confirmed)throw Error('Confirm the name for '+name+' before saving.');
  const k=normalizeIgn(name);
  if(seen.has(k)){
   const previous=seen.get(k);
   if(previous.points!==points)throw Error('Conflicting scores for '+name+': '+previous.points+' and '+points+'. Check the screenshots and keep only the correct result.');
   continue; // The same rank or the pinned green self-row can repeat across 11 screenshots.
  }
  seen.set(k,{name,points});out.push({name,points});
 }
 return out;
}
