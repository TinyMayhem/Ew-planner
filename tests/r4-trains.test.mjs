import test from 'node:test';
import assert from 'node:assert/strict';
import {stageRange,stageForDate,trainWarnings,weekStart} from '../assets/r4-train-rules.mjs';

test('train stages are exact five-week calendars starting on Monday',()=>{
 assert.deepEqual(stageRange(7),{stage:7,start:'2025-12-29',end:'2026-02-01'});
 assert.deepEqual(stageRange(8),{stage:8,start:'2026-02-02',end:'2026-03-08'});
 assert.deepEqual(stageRange(9),{stage:9,start:'2026-03-16',end:'2026-04-19'});
 assert.deepEqual(stageRange(13),{stage:13,start:'2026-08-03',end:'2026-09-06'});
 assert.deepEqual(stageRange(14),{stage:14,start:'2026-09-07',end:'2026-10-11'});
 assert.deepEqual(stageRange(15),{stage:15,start:'2026-10-12',end:'2026-11-15'});
 assert.equal(stageForDate('2026-01-01'),7);
 assert.equal(stageForDate('2026-02-20'),8);
 assert.equal(stageForDate('2026-03-20'),9);
 assert.equal(stageForDate('2026-11-01'),15);
 assert.equal(stageForDate('2026-11-16'),16);
 assert.equal(weekStart('2026-11-01'),'2026-10-26');
});
const a=(id,date,driver,vip,source='manual',slot='Train 1')=>({id,train_date:date,member_id:driver,vip_member_id:vip,source,slot});
test('warnings catch repeated VIP and Driver in the same stage, including cross-role repeat',()=>{
 const awards=[a('1','2026-10-12','a','b','donations')];
 const w=trainWarnings(awards,a('2','2026-10-19','c','a','manual'),id=>id.toUpperCase());
 assert.ok(w.some(s=>s.includes('A already appeared as Driver')));
 assert.ok(w.some(s=>s.includes('VIP assignment')));
});
test('week limit and roulette rule apply to drivers',()=>{
 const awards=[a('1','2026-10-12','a','b')];
 const w=trainWarnings(awards,a('2','2026-10-16','a','c','manual','Roulette'));
 assert.ok(w.some(s=>s.includes('Monday-to-Sunday week')));
 assert.ok(w.some(s=>s.includes('not eligible for roulette')));
});
test('source-specific winners are warned again in the same calendar',()=>{
 const w=trainWarnings([a('1','2026-10-12','a','b','donations')],a('2','2026-10-26','c','a','donations'));
 assert.ok(w.some(s=>s.includes('Top donor')));
});
test('new stage resets the duplicate calendar warnings',()=>{
 const w=trainWarnings([a('1','2026-10-11','a','b','ds')],a('2','2026-10-12','a','c','ds'));
 assert.deepEqual(w,[]);
});
test('editing the same saved assignment does not flag itself',()=>{
 const item=a('same','2026-10-15','a','b');
 assert.deepEqual(trainWarnings([item],item),[]);
});


test('VIP passengers repeated in the same week are warned',()=>{
 const w=trainWarnings([a('1','2026-10-12','a','b')],a('2','2026-10-15','c','b'));
 assert.ok(w.some(s=>s.includes('VIP passenger this Monday-to-Sunday week')));
});


test('R4 driver remains eligible for DS train in the same week and calendar',()=>{
 const r4=a('r4','2026-10-15','a','b','r4','R4 Mo');
 const ds=a('ds','2026-10-16','a','c','ds','Desert Storm MVP');
 assert.deepEqual(trainWarnings([r4],ds),[]);
 assert.deepEqual(trainWarnings([ds],r4),[]);
});
test('two R4 trains still warn about a repeat within the R4 category',()=>{
 const first=a('r4-1','2026-10-15','a','b','r4','R4 Mo');
 const later=a('r4-2','2026-10-17','a','c','r4','R4 Tiny');
 const issues=trainWarnings([first],later);
 assert.ok(issues.some(s=>s.includes('already driven')));
 assert.ok(issues.some(s=>s.includes('same calendar')));
});
test('historical R4 labels are recognized even before source migration',()=>{
 const r4=a('r4','2026-10-15','a','b','manual','R4 Mo');
 const ds=a('ds','2026-10-16','a','c','ds','DS MVP');
 assert.deepEqual(trainWarnings([r4],ds),[]);
});
test('R4 recipient is not ruled out of regular roulette',()=>{
 const r4=a('r4','2026-10-15','a','b','r4','R4 Mo');
 const roulette=a('roulette','2026-10-16','a','c','manual','Roulette');
 assert.deepEqual(trainWarnings([r4],roulette),[]);
});

test('unfilled historical VIP placeholders do not create false duplicate warnings',()=>{
 const prior=a('x','2026-02-27','a','not recorded','manual');
 const next=a('y','2026-03-05','b','not recorded','manual');
 assert.deepEqual(trainWarnings([prior],next),[]);
});
