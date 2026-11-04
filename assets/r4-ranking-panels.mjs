// Find Last War ranking row cards by their stable blue/green backgrounds.
// This provides row boundaries independently of OCR, even for zero scores.
const isBlue=(r,g,b)=>r>=145&&r<=243&&g>=150&&g<=247&&b>g+8&&b>r+12;
const isGreen=(r,g,b)=>g>=155&&g>r+24&&g>b+24;
const median=v=>{const a=v.slice().sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:0};
export function detectRankingPanels({width,height,data}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<180||height<300||!data||data.length<width*height*4)return [];
 const xs=[.06,.09,.62,.69,.88].map(f=>Math.min(width-1,Math.max(1,Math.round(width*f))));
 function colorAt(y){
  const counts={blue:0,green:0}; 
  for(const x of xs){
   const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2];
   if(isBlue(r,g,b))counts.blue++;
   else if(isGreen(r,g,b))counts.green++;
  }
  if(counts.blue>=2&&counts.blue>=counts.green)return 'blue';
  if(counts.green>=2&&counts.green>counts.blue)return 'green';
  return null;
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
