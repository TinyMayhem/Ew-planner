import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {columnRects,scoreAnchors,alignRankColumns,cleanRankName,textLines} from '../assets/r4-ocr-columns.mjs';
import {matchRoster} from '../assets/r4-ocr-parser.mjs';

const members=['MXĶ','MFKN TABBY','Jãx','minionbenny','JMotty','leoNOB','TragicallyHiPPiE','TinyMayhem']
 .map((display_name,i)=>({display_name,id:String(i+1)}));
const y=[422,569,717,864,1010,1158,1305,1450];
const scores=[20400351,20328913,19822263,19467050,18886715,18838935,18354060,11135742];
const ocrName=['MXK','MFKN TABBY','Jax','minionbenny','JMotty','leoNOB','TragicallyHiPPiE','TingMayhem'];
const lines=ocrName.flatMap((name,i)=>[
 {text:name,y:y[i]-24,confidence:85},
 {text:'[UTW] UTW',y:y[i]+22,confidence:75}
]);
const scoreEntries=scores.map((points,i)=>({points,y:y[i],confidence:94,text:points.toLocaleString('en-US')}));
test('ranking column crop isolates the name and points bands',()=>{
 const r=columnRects(1080,1920);
 assert(r.name.x>=300&&r.name.x<=400);
 assert(r.score.x>=700&&r.score.x<=800);
 assert(r.name.x+r.name.w<r.score.x+r.score.w);
});
test('row alignment ignores alliance tags, avatars and ranks, preserving JMotty full score',()=>{
 const rows=alignRankColumns({names:lines,scores:scoreEntries,height:1800,roster:members});
 assert.equal(rows.length,8);
 assert.equal(rows[4].name,'JMotty');
 assert.equal(rows[4].points,18886715);
 assert.equal(rows[0].name,'MXĶ');
 assert.equal(rows[1].name,'MFKN TABBY');
 assert.equal(rows[2].name,'Jãx');
 assert.equal(rows[7].name,'TinyMayhem');
 assert.equal(rows[4].confirmed,true);
});
test('an unreadable name does not become an invented member or cause scores to shift',()=>{
 const noisy=lines.filter(x=>x.y!==y[4]-24);
 noisy.push({text:'ks —',y:y[4]-24,confidence:12});
 const rows=alignRankColumns({names:noisy,scores:scoreEntries,height:1800,roster:members});
 assert.equal(rows[4].name,'');
 assert.equal(rows[4].ocrGuess,'ks —');
 assert.equal(rows[4].points,18886715);
 assert.equal(rows[5].name,'leoNOB');
 assert.equal(rows[4].confirmed,false);
});
test('we never trust misleading million-point scores from the rank column',()=>{
 const data={lines:[
  {text:'Points',bbox:{y0:300,y1:320},confidence:95},
  {text:'18,886,715',bbox:{y0:1000,y1:1030},confidence:91},
  {text:'47',bbox:{y0:1400,y1:1430},confidence:95},
  {text:'1,000,000',bbox:{y0:700,y1:730},confidence:8}
 ]};
 const scores=scoreAnchors(data);
 assert(scores.find(x=>x.points===18886715));
 assert(!scores.find(x=>x.points===47));
 assert.equal(scores.find(x=>x.points===1000000).confidence,8);
});
test('roster matching normalizes stylized and accented names without silently approving guesses',()=>{
 assert.deepEqual(matchRoster('MXK',members).name,'MXĶ');
 assert.deepEqual(matchRoster('Jax',members).name,'Jãx');
 assert.equal(matchRoster('JMotty',members).type,'exact');
 assert.equal(matchRoster('ge JMotty',members).type,'unknown');
});
test('column OCR uses geometry-aware recognition, and the review page shows original row strips',()=>{
 const scan=readFileSync('assets/r4-ocr-browser.mjs','utf8');
 const wizard=readFileSync('assets/r4-screenshot-wizard.mjs','utf8');
 assert.match(scan,/scanRankingScreenshot/);
 assert.match(scan,/textLines/);
 assert.match(scan,/tessedit_pageseg_mode:'7'/);
 assert.match(wizard,/row\.preview/);
 assert.match(wizard,/Name and score checked/);
 assert.match(wizard,/scanRankingScreenshot/);
 assert.match(wizard,/validateConfirmedRows/);
});
