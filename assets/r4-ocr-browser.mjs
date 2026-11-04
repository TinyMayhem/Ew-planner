// Local-only, column-specific OCR for Last War ranking screenshots.
// A single OCR pass over the whole screenshot is not reliable: it pairs ranks,
// avatars, [UTW] tags and scores from different visual rows.
import {columnRects,textLines,scoreAnchors,alignRankColumns,cleanRankName} from './r4-ocr-columns.mjs?version=scan-v4-20261104';
import {matchRoster} from './r4-ocr-parser.mjs?version=scan-v4-20261104';
import {hasEastAsianScript} from './r4-ocr-languages.mjs?version=scan-v4-20261104';

function cropScaled(bitmap,rect,targetWidth=650,enhanced=false){
 const scale=Math.min(3,Math.max(1,targetWidth/rect.w));
 const canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(rect.w*scale));
 canvas.height=Math.max(1,Math.round(rect.h*scale));
 const ctx=canvas.getContext('2d',{willReadFrequently:false});
 if(enhanced)ctx.filter='grayscale(100%) contrast(165%) brightness(112%)';
 ctx.drawImage(bitmap,rect.x,rect.y,rect.w,rect.h,0,0,canvas.width,canvas.height);
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
async function recognizeBlock(worker,canvas,scoreOnly=false){
 await worker.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:scoreOnly?'0123456789,.' : ''});
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
  const pointsData=await recognizeBlock(worker,pointsImage.canvas,true);
  const pointLines=orderedLines(pointsData,pointsImage.scale);
  const heading=pointLines.find(x=>/\bpoints\b/i.test(x.text));
  let scores=scoreAnchors({lines:pointLines});
  if(heading?.y!==null)scores=scores.filter(x=>x.y>heading.y+Math.max(heading.h||0,bitmap.height*.01));
  onProgress('reading names column');
  const namesImage=cropScaled(bitmap,rects.name,740);
  const namesData=await recognizeBlock(worker,namesImage.canvas,false);
  const nameLines=orderedLines(namesData,namesImage.scale);
  let rows=alignRankColumns({names:nameLines,scores,height:bitmap.height,roster,aliases});
  let secondaryText='';
  // Game UI uses colored backgrounds and small decorative fonts. A second,
  // higher-contrast pass is worthwhile only when the original pass was poor.
  if(scores.length&&rows.filter(r=>r.name).length<Math.ceil(rows.length*.7)){
   onProgress('improving unreadable names');
   const contrasted=cropScaled(bitmap,rects.name,800,true);
   const alternative=await recognizeBlock(worker,contrasted.canvas,false);
   secondaryText=alternative.text||'';
   const alternativeLines=orderedLines(alternative,contrasted.scale);
   const alternatives=alignRankColumns({names:alternativeLines,scores,height:bitmap.height,roster,aliases});
   for(let i=0;i<rows.length;i++){
    const better=alternatives[i];
    if(!better)continue;
    const rank=value=>value.matchType==='exact'?3:value.matchType==='suggested'?2:value.ocrGuess?1:0;
    if(rank(better)>rank(rows[i]))rows[i]=better;
    else if(rank(better)===rank(rows[i])&&better.name&&rows[i].name&&better.name!==rows[i].name){
     rows[i].name='';rows[i].confirmed=false;rows[i].ocrGuess=rows[i].ocrGuess+' / '+better.ocrGuess;
     rows[i].matchType='conflict';
    }
   }
  }
  const uncertain=rows.filter(r=>!r.name).length;
  // Focused single-row reading only for unlinked names. This eliminates [UTW]
  // labels and avatar edges without slowing down clear rows.
  if(uncertain){
   await worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:''});
   for(const row of rows.filter(r=>!r.name).slice(0,12)){
    const gap=Math.max(bitmap.height*.047,row.imageCrop.height);
    const rect={
     x:Math.round(bitmap.width*.33),
     y:Math.max(0,Math.round(row.y-gap*.32)),
     w:Math.round(bitmap.width*.36),
     h:Math.max(14,Math.min(bitmap.height-Math.max(0,Math.round(row.y-gap*.32)),Math.round(gap*.42)))
    };
    if(rect.h<10)continue;
    const focused=cropScaled(bitmap,rect,720);
    const result=await worker.recognize(focused.canvas);
    const guess=cleanRankName(String(result.data.text||'').trim().split('\n')[0]);
    const match=matchRoster(guess,roster,aliases);
    if(match.type==='exact'||match.type==='suggested'){
     row.ocrGuess=guess;row.name=match.name;row.matchType=match.type;
     row.confirmed=match.type==='exact'&&!row.needsScoreCheck&&!hasEastAsianScript(guess);
    }
   }
  }
  for(const row of rows){
   row.preview=rankStrip(bitmap,row.imageCrop);
   if(row.needsScoreCheck)row.confirmed=false;
  }
  const recognized=rows.filter(r=>r.name).length;
  const quality=scores.length?recognized/scores.length:0;
  const qualityMessage=quality<.5?
   'LOW CONFIDENCE: Less than half the game rows matched the UTW roster. Do not save until each name and score has been checked against the original image.':
   quality<.8?'PARTIAL MATCH: Some names need correction. Review every highlighted row.':
   'Most detected names matched the roster. Verify the original screenshot before saving.';
  const details=[
   'Scanner v4.2 · '+scores.length+' score rows',
   recognized+' roster names',
   rows.filter(r=>!r.confirmed).length+' require checking'
  ].join(' · ');
  return {rows,ocrText:'NAMES COLUMN:\n'+(namesData.text||'')+
   '\n\nSECOND PASS:\n'+secondaryText+'\n\nPOINTS COLUMN:\n'+(pointsData.text||''),
   unread:rows.filter(r=>!r.name).map(r=>r.ocrGuess||'Unmatched name'),diagnostics:details,
   quality,qualityMessage,layout:'last-war-ranked-columns'};
 }finally{bitmap.close?.()}
}
