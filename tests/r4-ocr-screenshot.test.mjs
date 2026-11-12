import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {parseRankLines,scoreValue,matchRoster,validateConfirmedRows,groupScreenshotRows} from '../assets/r4-ocr-parser.mjs';

test('score scanner recognizes standard, K and M formats without reading leaderboard ranks',()=>{
 assert.equal(scoreValue('8,235,712'),8235712);
 assert.equal(scoreValue('12.5M'),12500000);
 assert.equal(scoreValue('125K'),125000);
 assert.equal(scoreValue('1'),null);
 assert.equal(scoreValue('a lot'),null);
});
test('screenshot OCR reads names and points from ranked rows, and flags unread lines',()=>{
 const p=parseRankLines('Rank  Commander  Points\n1. TinyMayhem 8,235,712\n2  Ɖevi   12.5M\n3) SeaBeast From Wren  9,800,250\n4. MysteryName ???\n');
 assert.deepEqual(p.rows.map(x=>[x.name,x.points]),[['TinyMayhem',8235712],['Ɖevi',12500000],['SeaBeast From Wren',9800250]]);
 assert(p.unread.some(x=>x.includes('MysteryName')));
});
test('name and score split across OCR lines are recombined',()=>{
 const p=parseRankLines('TinyMayhem\n1,245,000\nOtherPlayer\n2,000,000');
 assert.deepEqual(p.rows.map(x=>x.name),['TinyMayhem','OtherPlayer']);
});
test('OCR matcher never silently approves fuzzy guesses',()=>{
 const members=[{id:'a',display_name:'TinyMayhem'},{id:'b',display_name:'SeaBeast From Wren'}];
 assert.equal(matchRoster('TinyMayhem',members).type,'exact');
 assert.equal(matchRoster('TinyMayhemx',members).type,'suggested');
 assert.equal(matchRoster('??',members).type,'unknown');
});
test('confirmation checks names and scores and safely deduplicates repeated green rows across 11 screenshots',()=>{
 const imgs=Array.from({length:11},(_,i)=>({rows:[{name:'Member'+i,points:100+i,confirmed:true},{name:'TinyMayhem',points:11355742,confirmed:true}]}));
 assert.equal(validateConfirmedRows(imgs).length,12);
 imgs[1].rows[0].name='Member0';
 assert.throws(()=>validateConfirmedRows(imgs),/Conflicting scores/);
 imgs[1].rows[0].name='Member1';imgs[2].rows[0].confirmed=false;
 assert.throws(()=>validateConfirmedRows(imgs),/Confirm the name/);
});

test('overlapping screenshot entries share one verification when name and score match',()=>{
 const members=[{id:'tiny',display_name:'Tiny'},{id:'mo',display_name:'Mo'}];
 const images=[
  {file:{name:'one.png'},rows:[{name:'Tiny',points:12000000,confirmed:false},{name:'Mo',points:15000000,confirmed:false}]},
  {file:{name:'two.png'},rows:[{name:'Tiny',points:12000000,confirmed:false}]}
 ];
 const grouped=groupScreenshotRows(images,members,[]);
 assert.equal(grouped.groups.length,2);
 assert.equal(grouped.duplicateCount,1);
 assert.equal(grouped.byImage[1].length,0);
 assert.equal(grouped.overlapsByImage[1].length,1);
 assert.deepEqual(grouped.conflicts,[]);
 assert.equal(grouped.groups[0].occurrences.length,2);
 grouped.groups.forEach(group=>{group.row.confirmed=true});
 assert.deepEqual(validateConfirmedRows([{rows:grouped.groups.map(group=>group.row)}]),[
  {name:'Tiny',points:12000000},{name:'Mo',points:15000000}
 ]);
 assert.equal(images[1].rows[0].confirmed,false,'hidden duplicate does not require another tap');
});

test('different scores for the same player remain separate and are marked as conflicts',()=>{
 const members=[{id:'tiny',display_name:'Tiny'}];
 const images=[
  {rows:[{name:'Tiny',points:12000000,confirmed:false}]},
  {rows:[{name:'Tiny',points:13000000,confirmed:false}]}
 ];
 const grouped=groupScreenshotRows(images,members,[]);
 assert.equal(grouped.groups.length,2);
 assert.equal(grouped.duplicateCount,0);
 assert.equal(grouped.conflicts.length,1);
 assert(grouped.groups.every(group=>group.conflict));
 assert.deepEqual(grouped.conflicts[0].scores,[12000000,13000000]);
 images[1].rows[0].points=12000000;
 const fixed=groupScreenshotRows(images,members,[]);
 assert.equal(fixed.conflicts.length,0);
 assert.equal(fixed.groups.length,1);
 assert.equal(fixed.duplicateCount,1);
});

test('known aliases group by player identity but invalid names or scores are not silently collapsed',()=>{
 const members=[{id:'t',display_name:'Tiny'}];
 const aliases=[{member_id:'t',alias:'TinyMayhem'}];
 const images=[
  {rows:[{name:'Tiny',points:0},{name:'',points:20},{name:'Unknown',points:null}]},
  {rows:[{name:'TinyMayhem',points:0},{name:'',points:20},{name:'Unknown',points:null}]}
 ];
 const grouped=groupScreenshotRows(images,members,aliases);
 assert.equal(grouped.duplicateCount,1);
 assert.equal(grouped.groups.length,5);
 assert.equal(grouped.conflicts.length,1,'unreadable scores require checking');
 images[1].rows[2].deleted=true;
 const fixed=groupScreenshotRows(images,members,aliases);
 assert.equal(fixed.conflicts.length,0);
 assert.equal(fixed.groups.length,4);
});

test('R4 scanner includes private screenshot upload, audit-backed undo and confirmation',()=>{
 const page=readFileSync('lib/r4-stats-page.mjs','utf8'),client=readFileSync('assets/r4-screenshot-wizard.mjs','utf8'),api=readFileSync('api/r4-stats.mjs','utf8');
 assert.match(page,/id="ocr-wizard"/);
 assert.match(page,/id="tab-scanner" hidden/);
 assert.match(client,/createWorker\(langs,1\)/);
 assert.doesNotMatch(client,/I checked this picture/);
 assert.match(client,/groupScreenshotRows/);
 assert.match(client,/Duplicate, counted once/);
 assert.match(client,/scan_recent=1/);
 assert.match(client,/delete_import/);
 assert.match(client,/delete_ds/);
 assert.match(api,/return json\(\{ok:true,id:importId/);
 assert.match(api,/return json\(\{ok:true,id:created\[0\]\.id\}/);
});

test('screenshot scanner module is valid JavaScript',()=>{
 const checked=spawnSync(process.execPath,['--check','assets/r4-screenshot-wizard.mjs'],{encoding:'utf8'});
 assert.equal(checked.status,0,checked.stderr);
});
