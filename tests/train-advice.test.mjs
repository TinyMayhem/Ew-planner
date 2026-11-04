import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTrainAdvice,resolveNames} from '../lib/train-advice.mjs';
import {stageRange} from '../assets/r4-train-rules.mjs';
import {trainLabelForDate} from '../assets/r4-train-schedule.mjs';

const m=(id,name)=>({id,display_name:name});
const members=[m('tiny','TinyMayhem'),m('devi','Ɖevi'),m('mo','Movich Mo'),m('crum','Crüm'),m('new','New Recruit')];
const aliases=[{alias:'Tiny',alias_key:'tiny',member_id:'tiny'}];
const t=(date,driver,vip,source='manual',slot='Train')=>({train_date:date,driver_name:driver,vip_name:vip,source,selection_label:slot});
const args={date:'2026-11-22',mode:'vs',slot:'VS MVP',members,aliases,legacy:[],awards:[],exceptions:[]};
test('VS ranking skips a prior same-stage VS recipient and shows the replacement',()=>{
 const advice=buildTrainAdvice({...args,legacy:[t('2026-11-16','Tiny','Mo','vs','VS MVP')],
  scoreboard:[{member_id:'tiny',points:9200000},{member_id:'devi',points:8500000}],
  scoreDate:'2026-11-21'});
 assert.equal(advice.recommended.name,'Ɖevi');
 assert.equal(advice.rejected[0].name,'TinyMayhem');
 assert.match(advice.rejected[0].reasons.join(' '),/2026-11-16/);
 assert.match(advice.substitution,/TinyMayhem.*Ɖevi/);
 assert.match(advice.context,/2026-11-21/);
});
test('R4 train does not disqualify a VS winner',()=>{
 const a=buildTrainAdvice({...args,legacy:[t('2026-11-19','Tiny','Mo','r4','R4 Mo')],
  scoreboard:[{member_id:'tiny',points:10000000}]});
 assert.equal(a.recommended.id,'tiny');
});
test('never had means neither driver nor VIP in recorded history',()=>{
 const a=buildTrainAdvice({...args,mode:'never',slot:'R4 Vote (no train for a while)',legacy:[
  t('2026-08-12','Mo','Devi','r4','R4 choice'),
  t('2026-08-15','TinyMayhem','Crüm','r4','R4 choice')
 ]});
 assert.equal(a.recommended.id,'new');
 assert.equal(a.candidates.find(x=>x.id==='devi').eligible,true);
 assert.match(a.candidates.find(x=>x.id==='devi').notes.join(' '),/2026-08-12/);
 assert.match(a.context,/Stage 7/);
});
test('R4 rotation host recognized and marked as proposal without saving assignment',()=>{
 const date='2026-12-03';
 const label=trainLabelForDate(16,date);
 assert.equal(label,'R4 Crum (proposed)');
 const a=buildTrainAdvice({...args,date,mode:'r4',slot:label});
 assert.equal(a.recommended.id,'crum');
 assert.equal(a.hostProposed,true);
 assert.equal(a.sameDate.length,0);
 assert.equal(trainLabelForDate(16,'2026-12-05'),'R4 Devi (proposed)');
});
test('existing saved assignments replace legacy in the same date',()=>{
 const a=buildTrainAdvice({...args,mode:'never',legacy:[t('2026-10-12','TinyMayhem','Mo','vs','VS MVP')],
  awards:[{train_date:'2026-10-12',member_id:'devi',vip_member_id:'new',source:'vs',slot:'VS MVP'}]});
 assert.equal(a.candidates.find(x=>x.id==='tiny').eligible,true);
 assert.equal(a.candidates.find(x=>x.id==='devi').eligible,true);
});
test('missing VS data never invents score rankings',()=>{
 const a=buildTrainAdvice({...args});
 assert.equal(a.candidates.length,0);
 assert.equal(a.recommended,null);
 assert.match(a.context,/No matching VS/);
});
test('weekly regular driver conflicts block another regular assignment',()=>{
 const a=buildTrainAdvice({...args,legacy:[t('2026-11-18','Tiny','Mo','manual','Roulette')],
  scoreboard:[{member_id:'tiny',points:9},{member_id:'devi',points:8}]});
 assert.equal(a.recommended.id,'devi');
 assert.match(a.rejected[0].reasons.join(' '),/this week/);
});
test('Stage 16 preserves the 35-day dates and only proposes the newer third-week hosts',()=>{
 assert.deepEqual(stageRange(16),{stage:16,start:'2026-11-16',end:'2026-12-20'});
 assert.equal(trainLabelForDate(16,'2026-11-19'),'R4 Mo');
 assert.equal(trainLabelForDate(16,'2026-12-03'),'R4 Crum (proposed)');
 assert.equal(trainLabelForDate(16,'2026-12-05'),'R4 Devi (proposed)');
});

test('after everyone on the VS roster had a train, earliest last turn is recommended',()=>{
 const old=[
  t('2026-01-21','TinyMayhem','Mo'),
  t('2026-02-20','Ɖevi','Crüm'),
  t('2026-04-10','New Recruit','Ɖevi'),
  t('2026-08-01','Mo','New Recruit'),
  t('2026-10-19','Crüm','Ɖevi')
 ];
 const advice=buildTrainAdvice({...args,mode:'never',date:'2026-11-25',legacy:old,rosterIds:['tiny','devi','mo','crum','new'],rosterDate:'2026-10-28'});
 assert.equal(advice.recommended.id,'tiny');
 assert.equal(advice.candidates[1].id,'mo');
 assert.equal(advice.candidates[2].id,'new');
 assert.match(advice.context,/Everyone in this roster/);
 assert.match(advice.candidates[0].notes.join(' '),/Stage 7/);
});
test('latest VS roster excludes departed historical members from never-had suggestions',()=>{
 const advice=buildTrainAdvice({...args,mode:'never',date:'2026-11-25',rosterIds:['devi','mo'],rosterDate:'2026-11-21'});
 assert.equal(advice.candidates.length,2);
 assert(!advice.candidates.some(x=>x.id==='tiny'));
});
