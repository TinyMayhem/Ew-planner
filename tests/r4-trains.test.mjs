import test from 'node:test';
import assert from 'node:assert/strict';
import {stageRange,stageForDate,trainWarnings,weekStart} from '../assets/r4-train-rules.mjs';

test('train stages are exact five-week calendars starting on Monday',()=>{
 assert.deepEqual(stageRange(13),{stage:13,start:'2026-08-03',end:'2026-09-06'});
 assert.deepEqual(stageRange(14),{stage:14,start:'2026-09-07',end:'2026-10-11'});
 assert.deepEqual(stageRange(15),{stage:15,start:'2026-10-12',end:'2026-11-15'});
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
