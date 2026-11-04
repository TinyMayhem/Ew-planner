// Local-only, column-specific OCR for Last War ranking screenshots.
// A single OCR pass over the whole screenshot is not reliable: it pairs ranks,
// avatars, [UTW] tags and scores from different visual rows.
import {columnRects,textLines,scoreAnchors,alignRankColumns,cleanRankName} from './r4-ocr-columns.mjs';
import {matchRoster} from './r4-ocr-parser.mjs';

function cropScaled(bitmap,rect,targetWidth=650){
 const scale=Math.min(3,Math.max(1,targetWidth/rect.w));
 const canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(rect.w*scale));
 canvas.height=Math.max(1,Math.round(rect.h*scale));
 canvas.getContext('2d',{willReadFrequently:false}).drawImage(
  bitmap,rect.x,rect.y,rect.w,rect.h,0,0,canvas.width,canvas.height);
 return {canvas,scale};
}
function rankStrip(bitmap,rect){
 const y=Math.max(0,rect.y),height=Math.min(bitmap.height-y,rect.height);
 const x=bitmap.width*.21,width=bitmap.width*.77;
 const canvas=document.createElement('canvas');
 canvas.width=1000;canvas.height=Math.max(60,Math.round(1000*height/width));
 canvas.getContext('2d').drawImage(bitmap,x,y,width,height,0,0,canvas.width,canvas.height);
 return canvas.toDataURL('image/jpeg',.84);
}
async function recognizeBlock(worker,canvas){
 await worker.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:''});
 return (await worker.recognize(canvas,{}, {blocks:true})).data;
}
function orderedLines(data,scale){
 return textLines(data).map(l=>({...l,y:l.y===null?null:l.y/scale,h:l.h===null?null:l.h/scale}));
}
export async function scanRankingScreenshot(worker,file,roster,aliases,onProgress=()=>{}){
 const bitmap=await createImageBitmap(file);
 try{
  const rects=columnRects(bitmap.width,bitmap.height);
  onProgress('reading points column');
  const pointsImage=cropScaled(bitmap,rects.score,570);
  const pointsData=await recognizeBlock(worker,pointsImage.canvas);
  const pointLines=orderedLines(pointsData,pointsImage.scale);
  const heading=pointLines.find(x=>/\bpoints\b/i.test(x.text));
  let scores=scoreAnchors({lines:pointLines});
  if(heading?.y!==null)scores=scores.filter(x=>x.y>heading.y+Math.max(heading.h||0,bitmap.height*.01));
  onProgress('reading names column');
  const namesImage=cropScaled(bitmap,rects.name,740);
  const namesData=await recognizeBlock(worker,namesImage.canvas);
  const nameLines=orderedLines(namesData,namesImage.scale);
  let rows=alignRankColumns({names:nameLines,scores,height:bitmap.height,roster,aliases});
  const uncertain=rows.filter(r=>!r.name).length;
  // Focused single-row reading only for unlinked names. This eliminates [UTW]
  // labels and avatar edges without slowing down clear rows.
  if(uncertain){
   await worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:''});
   for(const row of rows.filter(r=>!r.name).slice(0,12)){
    const gap=Math.max(bitmap.height*.047,row.imageCrop.height);
    const rect={
     x:Math.round(bitmap.width*.325),
     y:Math.max(0,Math.round(row.y-gap*.40)),
     w:Math.round(bitmap.width*.365),
     h:Math.max(14,Math.min(bitmap.height-Math.max(0,Math.round(row.y-gap*.40)),Math.round(gap*.58)))
    };
    if(rect.h<10)continue;
    const focused=cropScaled(bitmap,rect,720);
    const result=await worker.recognize(focused.canvas);
    const guess=cleanRankName(String(result.data.text||'').trim().split('\n')[0]);
    const match=matchRoster(guess,roster,aliases);
    if(match.type==='exact'||match.type==='suggested'){
     row.ocrGuess=guess;row.name=match.name;row.matchType=match.type;
     row.confirmed=match.type==='exact'&&!row.needsScoreCheck;
    }
   }
  }
  for(const row of rows){
   row.preview=rankStrip(bitmap,row.imageCrop);
   if(row.needsScoreCheck)row.confirmed=false;
  }
  const recognized=rows.filter(r=>r.name).length;
  const details=[
   'Column scan: '+scores.length+' scores detected',
   recognized+' roster names matched',
   rows.filter(r=>!r.confirmed).length+' rows need verification'
  ].join(' · ');
  return {rows,ocrText:'NAMES COLUMN:\n'+(namesData.text||'')+'\n\nPOINTS COLUMN:\n'+(pointsData.text||''),
   unread:rows.filter(r=>!r.name).map(r=>r.ocrGuess||'Unmatched name'),diagnostics:details,
   layout:'last-war-ranked-columns'};
 }finally{bitmap.close?.()}
}
