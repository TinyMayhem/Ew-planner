import test from 'node:test';
import assert from 'node:assert/strict';
import {trainLabelForDate,stageTrainLabels} from '../assets/r4-train-schedule.mjs';
import {stageRange} from '../assets/r4-train-rules.mjs';
import {buildTrainAdvice} from '../lib/train-advice.mjs';

test('Upcoming Stage 16 R4 Iz slot is assigned to Chibi Tsarina Aura',()=>{
 const day='2026-12-17';
 assert.deepEqual(stageRange(16),{stage:16,start:'2026-11-16',end:'2026-12-20'});
 assert.equal(trainLabelForDate(16,day),'R4 Chibi Tsarina Aura');
 assert.equal(stageTrainLabels['16'].filter(x=>x==='R4 Iz').length,0);
});
test('Historical stage calendars are preserved',()=>{
 for(const stage of [12,13,14,15]){
  assert.ok(stageTrainLabels[String(stage)].includes('R4 Iz'),'Stage '+stage+' archived slots are unchanged');
 }
 assert.equal(trainLabelForDate(15,'2026-11-12'),'R4 Iz');
});
test('R4 train recommendation resolves the replacement to current member',()=>{
 const label=trainLabelForDate(16,'2026-12-17');
 const advice=buildTrainAdvice({
  date:'2026-12-17',mode:'r4',slot:label,
  members:[
   {id:'chibi',display_name:'Chibi Tsarina Aura'},
   {id:'iz',display_name:'IZ4RD'}
  ],aliases:[{member_id:'chibi',alias:'Tsarina Aüra',alias_key:'tsarina aura'}],
  awards:[],legacy:[],exceptions:[]
 });
 assert.equal(advice.host,'Chibi Tsarina Aura');
 assert.equal(advice.recommended.id,'chibi');
 assert.equal(advice.recommended.eligible,true);
});