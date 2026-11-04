// Last War ranking names and scores must be read separately.
// Joining by row position prevents ranks, avatars and alliance tags becoming scores.
import {scoreValue,matchRoster} from './r4-ocr-parser.mjs';

const median=values=>{const s=values.filter(x=>Number.isFinite(x)&&x>0).sort((a,b)=>a-b);return s.length?s[Math.floor(s.length/2)]:null};
export const columnRects=(width,height)=>({
 name:{x:Math.round(width*.33),y:0,w:Math.round(width*.36),h:height},
 score:{x:Math.round(width*.71),y:0,w:Math.round(width*.265),h:height}
});

export function textLines(data){
 const direct=Array.isArray(data?.lines)?data.lines:[];
 const nested=Array.isArray(data?.blocks)?data.blocks.flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[])):[];
 const arr=direct.length?direct:nested;
 return arr.map(x=>({
  text:String(x.text||'').trim(),
  confidence:Number(x.confidence)||0,
  y:Number.isFinite(x.bbox?.y0)&&Number.isFinite(x.bbox?.y1)?(x.bbox.y0+x.bbox.y1)/2:null,
  h:Number.isFinite(x.bbox?.y0)&&Number.isFinite(x.bbox?.y1)?Math.max(1,x.bbox.y1-x.bbox.y0):null
 })).filter(x=>x.text);
}
const skipLine=text=>/\b(?:UTW|Commander|Ranking|Points|Weekly Rank|Daily Rank|Your Alliance)\b/i.test(text)
 || /^\s*(?:Mon|Tues|Wed|Thur|Fri|Sat|Sun)\.?\s*$/i.test(text)
 || /^[\d\s|.#()\[\]]+$/.test(text);
export function cleanRankName(value){
 return String(value||'').replace(/^[\s|;:'"\\()[\]{}.,]+/g,'').replace(/^\s*#?\d{1,3}[.)\-:]\s*/,'')
  .replace(/[\s|;:]+$/g,'').trim().replace(/\s+/g,' ');
}
export function scoreAnchors(data){
 const lines=textLines(data),scores=[];
 for(const line of lines){
  const t=line.text.trim().replace(/^[|\s:]+|[|\s:]+$/g,'');
  const points=scoreValue(t.replace(/^[#\s]+/,''));
  if(points===null||line.y===null||points<100)continue;
  scores.push({points,y:line.y,confidence:line.confidence,text:t});
 }
 scores.sort((a,b)=>a.y-b.y);
 const dedup=[];
 for(const item of scores){
  const found=dedup.find(x=>Math.abs(x.y-item.y)<Math.max(4,item.text.length*.25));
  if(!found)dedup.push(item);
  else if(item.confidence>found.confidence)Object.assign(found,item);
 }
 return dedup;
}
export function alignRankColumns({names,scores,height,roster=[],aliases=[]}){
 const points=scores.slice().sort((a,b)=>a.y-b.y);
 const validNames=names.map(x=>({...x,text:cleanRankName(x.text)}))
  .filter(x=>x.y!==null&&x.text&&/[\p{L}]/u.test(x.text)&&!skipLine(x.text));
 const diffs=points.slice(1).map((x,i)=>x.y-points[i].y).filter(d=>d>height*.018&&d<height*.18);
 const gap=median(diffs)||height*.083;
 const used=new Set();
 return points.map((score,index)=>{
  const nearby=validNames.map((line,i)=>({line,i})).filter(({line,i})=>
   !used.has(i)&&line.y>=score.y-gap*.53&&line.y<=score.y+gap*.10)
   .sort((a,b)=>{
    const ma=matchRoster(a.line.text,roster,aliases),mb=matchRoster(b.line.text,roster,aliases);
    const rank=m=>m.type==='exact'?0:m.type==='suggested'?1:2;
    return rank(ma)-rank(mb)||Math.abs(a.line.y-(score.y-gap*.16))-Math.abs(b.line.y-(score.y-gap*.16));
   });
  const selected=nearby[0];
  if(selected)used.add(selected.i);
  const guess=selected?.line.text||'';
  const match=matchRoster(guess,roster,aliases);
  const resolved=match.type==='exact'||match.type==='suggested'?match.name:'';
  const gapBefore=index?score.y-points[index-1].y:gap;
  return {
   name:resolved,ocrGuess:guess,points:score.points,raw:guess+' | '+score.text,
   confirmed:match.type==='exact',deleted:false,
   needsScoreCheck:score.confidence<65||(index>0&&gapBefore<gap*.38)||
    (index>0&&score.points>points[index-1].points)||
    (index<points.length-1&&score.points<points[index+1].points),
   confidence:score.confidence,matchType:match.type,
   y:score.y,imageCrop:{y:Math.max(0,Math.round(score.y-gap*.46)),height:Math.round(gap*.90)}
  };
 });
}
