import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {detectRankingPanels,panelCropRects,parsePanelPoints,splitMontageByPanel,detectVisibleZeroGlyph} from '../assets/r4-ranking-panels.mjs';
import {validateConfirmedRows} from '../assets/r4-ocr-parser.mjs';

const width=709,height=1536;
const positions=[
 {top:354,bottom:468,kind:'blue'},
 {top:478,bottom:592,kind:'blue'},
 {top:603,bottom:716,kind:'blue'},
 {top:727,bottom:841,kind:'blue'},
 {top:851,bottom:965,kind:'blue'},
 {top:976,bottom:1090,kind:'blue'},
 {top:1099,bottom:1214,kind:'blue'},
 {top:1230,bottom:1344,kind:'green'}
];
function screenshotPixels(){
 const data=new Uint8ClampedArray(width*height*4);
 // The game background outside each card is pale, not transparent black.
 for(let i=0;i<data.length;i+=4){data[i]=245;data[i+1]=245;data[i+2]=245;data[i+3]=255;}
 for(const {top,bottom,kind} of positions){
  const color=kind==='green'?[173,241,138]:[203,211,230];
  for(let y=top;y<bottom;y++)for(let x=25;x<683;x++){
   const index=(y*width+x)*4;
   data[index]=color[0];data[index+1]=color[1];data[index+2]=color[2];data[index+3]=255;
  }
 }
 // Rank numbers, labels, avatars and scores interrupt some of the sampled scanlines.
 for(let y=385;y<425;y++)for(let x=55;x<140;x++){
  const i=(y*width+x)*4;data[i]=25;data[i+1]=25;data[i+2]=25;
 }
 return {data,width,height};
}
test('actual Last War screenshot geometry identifies seven blue ranked cards and separate green pinned self row',()=>{
 const panels=detectRankingPanels(screenshotPixels());
 assert.equal(panels.length,8);
 assert.deepEqual(panels.map(x=>x.kind),['blue','blue','blue','blue','blue','blue','blue','green']);
 assert.equal(panels[7].isPinned,true);
 for(let i=0;i<positions.length;i++){
  assert(Math.abs(panels[i].top-positions[i].top)<=5,'top panel '+i);
  assert(Math.abs(panels[i].bottom-positions[i].bottom)<=5,'bottom panel '+i);
 }
});
test('name and score crops exclude avatar, ranks, alliance tags and adjacent card',()=>{
 const panels=detectRankingPanels(screenshotPixels());
 const {name,score,original}=panelCropRects(width,panels[0]);
 assert(name.x>=225&&name.x<=240);
 assert(name.x+name.w<score.x);
 assert(score.x>510);
 assert(name.y>=panels[0].top&&name.y+name.h<panels[0].bottom);
 assert(score.y>=panels[0].top&&score.y+score.h<panels[0].bottom);
 assert(original.h<=panels[0].height+1);
});
test('score parser preserves four zero entries and does not invent zero for missing data',()=>{
 for(const score of ['1,684,688','1,297,500','363,750','11,135,742','0','0','0','0']){
  assert.notEqual(parsePanelPoints(score).points,null);
 }
 assert.equal(parsePanelPoints('0').points,0);
 assert.equal(parsePanelPoints('oO').points,0);
 assert.equal(parsePanelPoints('oO').uncertain,true);
 assert.equal(parsePanelPoints('').points,null);
 assert.equal(parsePanelPoints('garbled').points,null);
 assert.equal(parsePanelPoints('11,135,742').points,11135742);
});
test('OCR boxes align to the correct panel rather than shifting a score into the next row',()=>{
 const count=8,tileHeight=128;
 const blocks=[{paragraphs:[{lines:[
  {text:'Chester Lampwick',bbox:{y0:16,y1:61}},
  {text:'STROLLN',bbox:{y0:144,y1:190}},
  {text:'Sus',bbox:{y0:272,y1:318}},
  {text:'Mwplayer00',bbox:{y0:400,y1:446}},
  {text:'RylisPro',bbox:{y0:528,y1:574}},
  {text:'kittkattt',bbox:{y0:656,y1:702}},
  {text:'MFKN gb',bbox:{y0:784,y1:830}},
  {text:'TinyMayhem',bbox:{y0:912,y1:958}}
 ]}]}];
 const rows=splitMontageByPanel({blocks},count,tileHeight);
 assert.deepEqual(rows.map(r=>r[0]?.text),['Chester Lampwick','STROLLN','Sus','Mwplayer00','RylisPro','kittkattt','MFKN gb','TinyMayhem']);
 assert.equal(splitMontageByPanel({text:'one\nzero'},8,tileHeight).flat().length,0);
});
test('all zero scores and the pinned green self rank can be confirmed and stored',()=>{
 const names=['Chester Lampwick','STROLLN','Sus','Mwplayer00','RylisPro','kittkattt','MFKN gb','TinyMayhem'];
 const points=[1684688,1297500,363750,0,0,0,0,11135742];
 const pictures=[{rows:names.map((name,i)=>({name,points:points[i],confirmed:true,deleted:false}))}];
 assert.deepEqual(validateConfirmedRows(pictures),names.map((name,i)=>({name,points:points[i]})));
 pictures[0].rows[0].points='';
 assert.throws(()=>validateConfirmedRows(pictures),/Check the score/);
});
test('site actually uses detected panels and numeric-safe OCR rather than relying on one full-image pass',()=>{
 const browser=readFileSync('assets/r4-ocr-browser.mjs','utf8');
 const wizard=readFileSync('assets/r4-screenshot-wizard.mjs','utf8');
 assert.match(browser,/detectRankingPanels/);
 assert.match(browser,/scoreMontage/);
 assert.match(browser,/readMontage/);
 assert.match(browser,/green pinned/);
 assert.match(wizard,/SCANNER v5\.3 · OVERLAP REVIEW/);
 assert.match(wizard,/scanRankingScreenshot/);
 for(const path of ['assets/r4-ocr-browser.mjs','assets/r4-ranking-panels.mjs','assets/r4-screenshot-wizard.mjs']){
  const x=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  assert.equal(x.status,0,path+': '+x.stderr);
 }
});

test('visible printed 0 glyph can be detected on four blue rows after OCR misses it',()=>{
 const sample=screenshotPixels();
 const zeros=[3,4,5,6];
 for(const i of zeros){
  const row=positions[i],cy=Math.round((row.top+row.bottom)/2),x=648;
  // Reproduce the outlined, single-digit 0 from the supplied 709px screenshot.
  for(let y=cy-7;y<cy+7;y++)for(let dx=0;dx<11;dx++){
   const dy=y-(cy-7);
   const edge=dy<3||dy>10||dx<4||dx>7;
   if(!edge)continue;
   const index=(y*width+x+dx)*4;
   sample.data[index]=20;sample.data[index+1]=20;sample.data[index+2]=20;
  }
 }
 const panels=detectRankingPanels(sample);
 assert.equal(panels.length,8);
 for(const i of zeros)assert.equal(detectVisibleZeroGlyph(sample,panels[i]),true,'must recognize rank '+(84+i)+' zero');
 assert.equal(detectVisibleZeroGlyph(sample,panels[0]),false,'blank rank score is not a zero');
 assert.equal(detectVisibleZeroGlyph(sample,panels[7]),false,'green pinned row is not inferred to be zero');
});

test('podium screenshot detects gold, silver and bronze before blue rows and green pinned rank',()=>{
 // Representative actual sampled card colors and boundaries from a 709 x 1536
 // Last War Daily Rank image; no personal screenshot is committed to the repo.
 const screenshot=screenshotPixels();
 const panels=[
  {top:354,bottom:465,color:[250,221,85]},
  {top:477,bottom:588,color:[198,209,255]},
  {top:601,bottom:713,color:[248,203,182]},
  {top:727,bottom:839,color:[203,211,230]},
  {top:851,bottom:964,color:[203,211,230]},
  {top:975,bottom:1088,color:[203,211,230]},
  {top:1100,bottom:1212,color:[203,211,230]},
  {top:1231,bottom:1345,color:[173,241,138]}
 ];
 const xs=[.06,.09,.62,.69,.88].map(f=>Math.round(width*f));
 // Only the detector's stable sample columns need rewriting.
 for(const card of panels)for(let y=card.top;y<card.bottom;y++)for(const x of xs){
  const offset=(y*width+x)*4;
  screenshot.data[offset]=card.color[0];screenshot.data[offset+1]=card.color[1];
  screenshot.data[offset+2]=card.color[2];screenshot.data[offset+3]=255;
 }
 // Clear pre-existing sample columns outside the new card bounds.
 for(const x of xs)for(let y=0;y<height;y++){
  if(panels.some(card=>y>=card.top&&y<card.bottom))continue;
  const offset=(y*width+x)*4;
  screenshot.data[offset]=245;screenshot.data[offset+1]=245;screenshot.data[offset+2]=245;
 }
 const found=detectRankingPanels(screenshot);
 assert.equal(found.length,8,'top three must not be omitted');
 assert.deepEqual(found.map(x=>x.kind),['gold','silver','bronze','blue','blue','blue','blue','green']);
 assert.deepEqual(found.map(x=>x.isPinned),[false,false,false,false,false,false,false,true]);
 for(let i=0;i<panels.length;i++){
  assert(Math.abs(found[i].top-panels[i].top)<4,'expected card start '+i);
  assert(Math.abs(found[i].bottom-panels[i].bottom)<4,'expected card end '+i);
 }
});
