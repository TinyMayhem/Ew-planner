import test from 'node:test';
import assert from 'node:assert/strict';
import {stageRange,stageForDate,trainWarnings,weekStart,isR4Train} from '../assets/r4-train-rules.mjs';

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
test('previous conductor is not a VIP repeat, including the same week',()=>{
 const first=a('1','2026-10-12','ube','b','donations');
 const later=a('2','2026-10-15','c','ube','manual');
 assert.deepEqual(trainWarnings([first],later),[]);
});
test('previous VIP can be conductor in the same stage, even on the same week',()=>{
 const first=a('1','2026-10-12','a','ube','vs','VS train');
 const later=a('2','2026-10-14','ube','c','ds','DS MVP');
 assert.deepEqual(trainWarnings([first],later),[]);
});
test('conductor cannot be conductor again in a five-week stage, across different weeks and train categories',()=>{
 const first=a('1','2026-10-12','ube','b','donations');
 const later=a('2','2026-11-11','ube','c','manual','Roulette');
 const warnings=trainWarnings([first],later,id=>id.toUpperCase());
 assert.ok(warnings.some(s=>s.includes('UBE already drove')));
 assert.ok(warnings.some(s=>s.includes('five-week stage')));
 assert.ok(!warnings.some(s=>s.includes('VIP cannot')));
});
test('repeated VIP only triggers the weekly limit, without other role warnings',()=>{
 const first=a('1','2026-10-12','a','ube','manual');
 const later=a('2','2026-10-15','c','ube','manual');
 const warnings=trainWarnings([first],later);
 assert.ok(warnings.some(s=>s.includes('VIP cannot be selected again in the same Monday-to-Sunday week')));
 assert.ok(!warnings.some(s=>s.includes('conductor cannot')));
});
test('VIP can serve again in a later week with a different general train source',()=>{
 const prior=a('1','2026-10-12','a','ube','manual');
 assert.deepEqual(trainWarnings([prior],a('2','2026-10-19','b','ube','manual')),[]);
});
test('special donor/DS/VS category winners keep their category-specific role restrictions',()=>{
 const first=a('1','2026-10-12','a','ube','donations');
 const again=a('2','2026-10-26','c','ube','donations');
 const warnings=trainWarnings([first],again);
 assert.ok(warnings.some(s=>s.includes('Top donor VIP assignment')));
 assert.ok(!warnings.some(s=>s.includes('VIP cannot be selected again in the same Monday-to-Sunday week')));
 const crossed=a('3','2026-10-26','ube','d','donations');
 assert.deepEqual(trainWarnings([first],crossed),[]);
});
test('new stage resets conductor and VIP repeats',()=>{
 assert.deepEqual(trainWarnings([a('1','2026-10-11','a','b','ds')],a('2','2026-10-12','a','b','ds')),[]);
});
test('editing same saved assignment never flags itself',()=>{
 const item=a('same','2026-10-15','a','b');
 assert.deepEqual(trainWarnings([item],item),[]);
});
test('warnings can be shown before both roles have been chosen',()=>{
 const first=a('1','2026-10-12','a','b');
 assert.ok(trainWarnings([first],a('2','2026-10-20','a','')).some(s=>s.includes('five-week stage')));
 assert.ok(trainWarnings([first],a('2','2026-10-15','','b')).some(s=>s.includes('VIP')));
 assert.deepEqual(trainWarnings([first],a('2','2026-10-15','','')),[]);
});
test('a person cannot hold both roles on the same train',()=>{
 const warnings=trainWarnings([],a('1','2026-10-15','ube','ube'));
 assert.ok(warnings.some(s=>s.includes('both conductor and VIP')));
});
test('only Wednesday and Saturday R4 conductor trains use the exception lane',()=>{
 const wed=a('r4-wed','2026-10-14','a','b','r4','R4 Mo');
 const sat=a('r4-sat','2026-10-17','c','d','r4','R4 Devi');
 const thurs=a('r4-thu','2026-10-15','e','f','r4','R4 Mo');
 assert.equal(isR4Train(wed),true);
 assert.equal(isR4Train(sat),true);
 assert.equal(isR4Train(thurs),false);
 assert.equal(isR4Train(a('vote','2026-10-14','x','y','r4','R4 vote')),false);
});
test('Wednesday/Saturday R4 conductors are independent of regular conductor stage cap',()=>{
 const wed=a('r4','2026-10-14','a','b','r4','R4 Mo');
 const regular=a('regular','2026-10-16','a','c','ds','DS MVP');
 assert.deepEqual(trainWarnings([wed],regular),[]);
 assert.deepEqual(trainWarnings([regular],wed),[]);
});
test('a second Wednesday/Saturday R4 conductor turn repeats inside its own stage lane',()=>{
 const first=a('r4-1','2026-10-14','a','b','r4','R4 Mo');
 const repeat=a('r4-2','2026-10-17','a','c','r4','R4 Tiny');
 assert.ok(trainWarnings([first],repeat).some(s=>s.includes('five-week stage')));
 assert.deepEqual(trainWarnings([first],a('switch','2026-10-17','b','c','r4','R4 Tiny')),[]);
});
test('Thursday R4 labels do not grant a conductor exception',()=>{
 const thurs=a('r4-thu','2026-10-15','a','b','r4','R4 Mo');
 const regular=a('ds','2026-10-16','a','c','ds','DS MVP');
 assert.ok(trainWarnings([thurs],regular).some(s=>s.includes('five-week stage')));
});
test('VIPs have no R4 exception: same-week repeats are flagged across both lanes',()=>{
 const r4=a('r4','2026-10-14','a','b','r4','R4 Mo');
 const regular=a('normal','2026-10-16','c','b','manual','Roulette');
 const warnings=trainWarnings([r4],regular);
 assert.ok(warnings.some(s=>s.includes('same Monday-to-Sunday week')));
 assert.ok(!warnings.some(s=>s.includes('conductor cannot')));
});
test('historic R4 labels on Saturdays count even with manual source',()=>{
 const r4=a('r4','2026-10-17','a','b','manual','R4 Mo');
 const regular=a('regular','2026-10-18','a','c','manual','Roulette');
 assert.equal(isR4Train(r4),true);
 assert.deepEqual(trainWarnings([r4],regular),[]);
});
test('unfilled historical VIP placeholders are not treated as real VIPs',()=>{
 const prior=a('x','2026-02-27','a','not recorded','manual');
 const next=a('y','2026-03-05','b','not recorded','manual');
 assert.deepEqual(trainWarnings([prior],next),[]);
});
