import {detectRankingPanels,parsePanelPoints,splitMontageByPanel,panelCropRects,detectVisibleZeroGlyph} from './r4-ranking-panels.mjs?version=podium-v51-20261104';
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
async function scanColumnFallback(worker,file,roster,aliases,onProgress=()=>{}){
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


function montageForRankedCards(bitmap,panels,kind){
 const tileHeight=128,tileWidth=kind==='name'?690:410;
 const canvas=document.createElement('canvas');
 canvas.width=tileWidth;canvas.height=tileHeight*panels.length;
 const ctx=canvas.getContext('2d');
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
 for(const [i,panel] of panels.entries()){
  const rect=panelCropRects(bitmap.width,panel)[kind],scale=Math.min(2.5,(tileWidth-18)/rect.w);
  const h=Math.min(tileHeight-12,Math.round(rect.h*scale)),w=Math.min(tileWidth-16,Math.round(rect.w*scale));
  ctx.save();
  ctx.filter='grayscale(100%) contrast(150%) brightness(108%)';
  ctx.drawImage(bitmap,rect.x,rect.y,rect.w,rect.h,8,i*tileHeight+6,w,h);
  ctx.restore();
 }
 return {canvas,tileHeight};
}

function panelPreview(bitmap,panel){
 const rect=panelCropRects(bitmap.width,panel).original;
 const cv=document.createElement('canvas');
 cv.width=940;cv.height=Math.max(70,Math.round(rect.h*940/rect.w));
 cv.getContext('2d').drawImage(bitmap,rect.x,rect.y,rect.w,rect.h,0,0,cv.width,cv.height);
 return cv.toDataURL('image/jpeg',.83);
}

async function readMontage(worker,montage,numbersOnly=false){
 await worker.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:numbersOnly?'0123456789,.':''});
 return (await worker.recognize(montage.canvas,{}, {blocks:true})).data;
}

async function retrySingleCard(worker,bitmap,panel,kind){
 const r=panelCropRects(bitmap.width,panel)[kind];
 const width=kind==='name'?680:390;
 const cv=document.createElement('canvas'),scale=Math.min(3,width/r.w);
 cv.width=width;cv.height=Math.max(42,Math.ceil(r.h*scale)+12);
 const ctx=cv.getContext('2d');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,cv.width,cv.height);
 ctx.filter='grayscale(100%) contrast(145%) brightness(108%)';
 ctx.drawImage(bitmap,r.x,r.y,r.w,r.h,4,5,Math.round(r.w*scale),Math.round(r.h*scale));
 await worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:kind==='score'?'0123456789,.':''});
 const result=await worker.recognize(cv);
 return String(result.data.text||'').trim().replace(/\s+/g,' ');
}

function rosterGuess(value,roster,aliases){
 const guess=cleanRankName(value.trim());
 const match=matchRoster(guess,roster,aliases);
 return {name:match.name||guess,ocrGuess:guess,matchType:match.type,
  confirmed:match.type==='exact'&&!hasEastAsianScript(guess)};
}

async function scanCards(worker,file,roster,aliases,onProgress=()=>{}){
 const bitmap=await createImageBitmap(file);
 try{
  const canvas=document.createElement('canvas');
  canvas.width=bitmap.width;canvas.height=bitmap.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(bitmap,0,0);
  const imagePixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  const detected=detectRankingPanels(imagePixels);
  // The green footer is the uploader's own pinned rank, not part of the
  // scrolling leaderboard. Never send it to OCR or the save preview.
  const panels=detected.filter(panel=>!panel.isPinned);
  const skippedPinned=detected.length-panels.length;
  if(!panels.length)return null;
  onProgress('found '+panels.length+' ranked cards'+(skippedPinned?' · skipped '+skippedPinned+' green self-row':''));
  const nameMontage=montageForRankedCards(bitmap,panels,'name');
  const scoreMontage=montageForRankedCards(bitmap,panels,'score');
  onProgress('reading names from '+panels.length+' isolated rows');
  const nameData=await readMontage(worker,nameMontage,false);
  onProgress('reading all points, including zeros');
  const scoreData=await readMontage(worker,scoreMontage,true);
  const nameLines=splitMontageByPanel(nameData,panels.length,nameMontage.tileHeight);
  const scoreLines=splitMontageByPanel(scoreData,panels.length,scoreMontage.tileHeight);
  const rows=[],debug=[];
  for(let i=0;i<panels.length;i++){
   const n=nameLines[i].map(x=>x.text).filter(Boolean).join(' ').trim();
   const scoreRaw=scoreLines[i].map(x=>x.text).filter(Boolean).join('').replace(/\s+/g,'');
   const guess=rosterGuess(n,roster,aliases);
   const initial=parsePanelPoints(scoreRaw);
   rows.push({
    ...guess,points:initial.points,needsScoreCheck:initial.uncertain,
    confirmed:guess.confirmed&&initial.points!==null&&!initial.uncertain,
    deleted:false,raw:n+' | '+scoreRaw,
    preview:panelPreview(bitmap,panels[i]),pinned:panels[i].isPinned,
    y:(panels[i].top+panels[i].bottom)/2
   });
   debug.push('Row '+(i+1)+(panels[i].isPinned?' (green pinned)':'')+': '+n+' | '+scoreRaw);
  }
  // Only retry genuinely incomplete rows; a zero is a real value, not missing.
  const incomplete=rows.map((r,i)=>({...r,i})).filter(r=>!r.ocrGuess||r.points===null);
  for(const row of incomplete.slice(0,15)){
   const i=row.i;
   if(!rows[i].ocrGuess){
    onProgress('retrying unreadable name in row '+(i+1));
    const guess=rosterGuess(await retrySingleCard(worker,bitmap,panels[i],'name'),roster,aliases);
    Object.assign(rows[i],guess);
    rows[i].confirmed=false;
   }
   if(rows[i].points===null){
    onProgress('retrying points in row '+(i+1));
    const score=parsePanelPoints(await retrySingleCard(worker,bitmap,panels[i],'score'));
    rows[i].points=score.points;rows[i].needsScoreCheck=score.uncertain;
    rows[i].confirmed=false;
   }
  }
  // Tiny one-character zeros can vanish even in a focused OCR pass.
  // Only infer zero if the printed glyph is actually visible and oval-shaped.
  for(let i=0;i<rows.length;i++){
   if(rows[i].points!==null)continue;
   if(detectVisibleZeroGlyph(imagePixels,panels[i])){
    rows[i].points=0;
    rows[i].needsScoreCheck=true;
    rows[i].confirmed=false;
    rows[i].raw+=' | visually detected 0 (verify)';
   }
  }
  // Pinned self-entry is not an extra ranking place in the scrolling list.
  // The existing save path deduplicates by identical member+score values.
  const matched=rows.filter(r=>r.ocrGuess).length,withPoints=rows.filter(r=>r.points!==null).length;
  const quality=Math.min(matched/rows.length,withPoints/rows.length);
  const qualityMessage=quality<.6?
   'LOW CONFIDENCE: Some names or scores were unreadable. Compare the full game-row previews before saving.':
   quality<1?'PARTIAL SCAN: Check highlighted names and scores against their row previews.':
   'All game rows were located. Review the names and points before saving.';
  return {
   rows,ocrText:'ISOLATED RANKING ROWS:\n'+debug.join('\n')+
    '\n\nNAME OCR:\n'+(nameData.text||'')+'\n\nSCORE OCR:\n'+(scoreData.text||''),
   unread:rows.filter(r=>!r.ocrGuess||r.points===null).map(r=>r.ocrGuess||'(unreadable)'),
   diagnostics:'Scanner v5 · '+panels.length+' actual game cards (podium, blue and green) · '+withPoints+
    ' scores, including '+rows.filter(r=>r.points===0).length+' recorded zeros'+
    (skippedPinned?' · '+skippedPinned+' green pinned self-row'+(skippedPinned===1?'':'s')+' automatically excluded':''),
   quality,qualityMessage,layout:'last-war-ranked-panels'
  };
 }finally{bitmap.close?.()}
}

export async function scanRankingScreenshot(worker,file,roster,aliases,onProgress=()=>{}){
 const result=await scanCards(worker,file,roster,aliases,onProgress);
 if(result)return result;
 onProgress('Ranking cards not recognized; trying generic column scan');
 return scanColumnFallback(worker,file,roster,aliases,onProgress);
}
