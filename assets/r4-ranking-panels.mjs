// Find Last War ranking cards by their stable podium, blue and green backgrounds.
// The first three ranks are gold, silver and bronze; other rows are blue,
// with a separate green pinned self-ranking row. OCR stays row-isolated.
const isBlue=(r,g,b)=>r>=145&&r<=243&&g>=150&&g<=247&&b>g+8&&b>r+12;
const isGreen=(r,g,b)=>g>=155&&g>r+24&&g>b+24;
const isGold=(r,g,b)=>r>=225&&g>=170&&g<=245&&b>=40&&b<155&&r>g+12&&g>b+45;
const isBronze=(r,g,b)=>r>=215&&g>=160&&g<=229&&b>=120&&b<215&&r>g+18&&g>b+9;
const isSilver=(r,g,b)=>r>=175&&r<=242&&g>=190&&g<=242&&b>=245&&b>=g+18&&b>=r+25;
const median=v=>{const a=v.slice().sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:0};
export function detectRankingPanels({width,height,data}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<180||height<300||!data||data.length<width*height*4)return [];
 const xs=[.06,.09,.62,.69,.88].map(f=>Math.min(width-1,Math.max(1,Math.round(width*f))));
 function colorAt(y){
  const counts={gold:0,silver:0,bronze:0,blue:0,green:0};
  for(const x of xs){
   const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2];
   if(isGold(r,g,b))counts.gold++;
   else if(isBronze(r,g,b))counts.bronze++;
   else if(isSilver(r,g,b))counts.silver++;
   else if(isBlue(r,g,b))counts.blue++;
   else if(isGreen(r,g,b))counts.green++;
  }
  const best=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  return best[1]>=2?best[0]:null;
 }
 const colors=Array.from({length:height},(_,y)=>colorAt(y)),runs=[];
 let active=null,start=0,miss=0;
 const close=(end)=>{
  if(!active)return;
  const duration=end-start;
  if(duration>=Math.max(19,height*.021)&&duration<height*.23){
   runs.push({top:start,bottom:end,height:duration,kind:active,isPinned:active==='green'});
  }
 };
 for(let y=0;y<height;y++){
  const next=colors[y];
  if(next===active){miss=0;continue}
  if(active&&next===null&&miss<Math.max(2,Math.round(height*.003))){miss++;continue}
  if(active)close(y-miss);
  active=next;start=y;miss=0;
 }
 if(active)close(height-miss);
 const lengths=runs.map(r=>r.height);
 const typical=median(lengths);
 return runs.filter(r=>!typical||r.height>=typical*.65&&r.height<=typical*1.45)
  .sort((a,b)=>a.top-b.top);
}

export function parsePanelPoints(value){
 const raw=String(value??'').trim().replace(/\s+/g,'');
 if(!raw)return {points:null,uncertain:true};
 if(/^[0OoQq°]+$/.test(raw))return {points:0,uncertain:raw!=='0'};
 const onlyDigits=raw.replace(/[,.\s]/g,'').replace(/[oO](?=\d)/g,'0');
 if(!/^\d+$/.test(onlyDigits))return {points:null,uncertain:true};
 const points=Number(onlyDigits);
 if(!Number.isSafeInteger(points))return {points:null,uncertain:true};
 return {points,uncertain:!/^(?:\d{1,3}(?:,\d{3})+|\d+)$/.test(raw)};
}

export function splitMontageByPanel(data,count,tileHeight){
 // Geometry is generated before OCR, so the association does not rely on
 // Tesseract choosing the correct order across original screenshot rows.
 const rows=Array.from({length:count},()=>[]);
 const nested=Array.isArray(data?.blocks)?
  data.blocks.flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[])):[];
 const lines=Array.isArray(data?.lines)&&data.lines.length?data.lines:nested;
 for(const item of lines){
  if(!item?.text||!Number.isFinite(item?.bbox?.y0)||!Number.isFinite(item?.bbox?.y1))continue;
  const center=(item.bbox.y0+item.bbox.y1)/2;
  const index=Math.floor(center/tileHeight);
  if(index>=0&&index<count)rows[index].push({text:item.text.trim(),confidence:item.confidence??0,y:center});
 }
 const matched=rows.filter(r=>r.length).length;
 // Fallback for engines that return only plain text, never guess the alignment
 // unless the output has exactly one nonblank text line per card.
 if(matched===0&&data?.text){
  const plain=String(data.text).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(plain.length===count)plain.forEach((text,i)=>rows[i].push({text,confidence:0,y:(i+.5)*tileHeight}));
 }
 return rows;
}

export function panelCropRects(width,panel){
 const top=panel.top,h=panel.height;
 const rect=(x0,x1,y0,y1)=>({x:Math.max(0,Math.round(width*x0)),y:Math.round(top+h*y0),
  w:Math.max(1,Math.round(width*(x1-x0))),h:Math.max(1,Math.round(h*(y1-y0)))});
 return {
  name:rect(.33,.715,.105,.565),
  score:rect(.735,.968,.23,.79),
  original:rect(.028,.97,0,1)
 };
}


// Last War draws zero as an isolated, outlined black oval at the far
// right edge of a blue card. This is a fallback ONLY when OCR was blank.
// It cannot be mistaken for a blank score since visible ink is required.
export function detectVisibleZeroGlyph(image,panel){
 if(panel.kind!=='blue')return false;
 const {width,height,data}=image;
 const rect=panelCropRects(width,panel).score;
 const minX=Math.max(0,rect.x),maxX=Math.min(width,rect.x+rect.w);
 const minY=Math.max(0,rect.y),maxY=Math.min(height,rect.y+rect.h);
 let left=width,right=0,top=height,bottom=0,ink=0;
 const dark=(x,y)=>{
  const p=(y*width+x)*4;
  return Math.max(data[p],data[p+1],data[p+2])<110;
 };
 for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++){
  if(!dark(x,y))continue;
  ink++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
 }
 const w=right-left+1,h=bottom-top+1;
 if(ink<35||ink>width*.45||w<width*.009||w>width*.036||h<panel.height*.08||h>panel.height*.24||
    right<width*.88)return false;
 // A zero has two solid side walls separated by a light interior at its midline.
 // A thin 1 or another single-stroke glyph must not become a zero.
 const midY=Math.round((top+bottom)/2);
 let leftSide=false,rightSide=false,centerGap=false;
 for(let x=left;x<=right;x++){
  if(dark(x,midY)){
   if(x<left+w*.38)leftSide=true;
   if(x>left+w*.62)rightSide=true;
  }else if(x>left+w*.40&&x<left+w*.60)centerGap=true;
 }
 return leftSide&&rightSide&&centerGap;
}
