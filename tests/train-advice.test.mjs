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
 const a=buildTrainAdvice({...args,legacy:[t('2026-11-21','Tiny','Mo','r4','R4 Mo')],
  scoreboard:[{member_id:'tiny',points:10000000}]});
 assert.equal(a.recommended.id,'tiny');
});
test('Sunday VS selection suggests next eligible weekly scorer for both conductor and VIP',()=>{
 const ranked=buildTrainAdvice({...args,date:'2026-11-22',mode:'vs',vipMode:'weekly',legacy:[
  t('2026-11-17','TinyMayhem','Movich Mo','manual','Roulette'),
  t('2026-11-19','New Recruit','Crüm','manual','Train')
 ],scoreDate:'2026-11-16',scoreboard:[
  {member_id:'tiny',points:100},
  {member_id:'mo',points:90},
  {member_id:'crum',points:80},
  {member_id:'devi',points:70},
  {member_id:'new',points:60}
 ]});
 assert.equal(ranked.scoreRanked,true);
 assert.equal(ranked.saturdayVs,false);
 assert.equal(ranked.recommended.id,'mo'); // Was VIP, never a conductor this Stage
 assert.equal(ranked.recommended.place,2);
 assert.equal(ranked.recommendedVip.id,'devi'); // Crüm already rode VIP this week
 assert.equal(ranked.recommendedVip.scoreRank,4);
 assert.deepEqual(ranked.vipCandidates.map(x=>x.id),['tiny','mo','crum','devi','new']);
 assert.equal(ranked.vipCandidates.find(x=>x.id==='crum').eligible,false);
 assert.match(ranked.substitution,/TinyMayhem.*Movich Mo/);
});
test('weekly donation source suggests the highest eligible donor and next-ranked VIP',()=>{
 const result=buildTrainAdvice({...args,date:'2026-11-24',mode:'donations',vipMode:'weekly',
  legacy:[t('2026-11-17','TinyMayhem','Ɖevi','manual','Roulette')],
  scoreDate:'2026-11-16',scoreboard:[
   {member_id:'tiny',points:5000},
   {member_id:'mo',points:4000},
   {member_id:'devi',points:3000},
   {member_id:'crum',points:2000}
  ]});
 assert.equal(result.scoreRanked,true);
 assert.equal(result.recommended.id,'mo');
 assert.equal(result.recommendedVip.id,'devi'); // Prior-week VIP eligible again
 assert.equal(result.recommendedVip.scoreRank,3);
 assert.equal(result.vipCandidates[0].points,5000);
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
 assert.match(a.context,/No completed VS weekly total/);
 assert.match(a.context,/Daily VS points are not used/);
});
test('weekly regular driver conflicts block another regular assignment',()=>{
 const a=buildTrainAdvice({...args,legacy:[t('2026-11-18','Tiny','Mo','manual','Roulette')],
  scoreboard:[{member_id:'tiny',points:9},{member_id:'devi',points:8}]});
 assert.equal(a.recommended.id,'devi');
 assert.match(a.rejected[0].reasons.join(' '),/once per stage/);
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

test('previous VIP turns do not disqualify a ranked conductor later in the same stage',()=>{
 const advice=buildTrainAdvice({...args,legacy:[
  t('2026-11-16','Devi','TinyMayhem','vs','VS points')
 ],scoreboard:[{member_id:'tiny',points:20000000},{member_id:'devi',points:15000000}],scoreDate:'2026-11-21'});
 assert.equal(advice.recommended.id,'tiny');
 assert.equal(advice.candidates.find(c=>c.id==='tiny').eligible,true);
 assert.equal(advice.candidates.find(c=>c.id==='devi').eligible,false);
});
test('a conductor from the first week is excluded from later weeks of the same stage',()=>{
 const advice=buildTrainAdvice({...args,date:'2026-12-12',legacy:[
  t('2026-11-18','TinyMayhem','Mo','manual','Roulette')
 ],scoreboard:[{member_id:'tiny',points:20000000},{member_id:'devi',points:15000000}],scoreDate:'2026-12-11'});
 assert.equal(advice.recommended.id,'devi');
 assert.match(advice.rejected[0].reasons.join(' '),/2026-11-18/);
 assert.match(advice.rejected[0].reasons.join(' '),/Stage 16/);
});
test('prior R4 VIP does not disqualify R4 conductor, but prior R4 conductor does',()=>{
 const label='R4 Tiny';
 const justVip=buildTrainAdvice({...args,date:'2026-12-05',mode:'r4',slot:label,
  legacy:[t('2026-11-21','Mo','TinyMayhem','r4','R4 Mo')]});
 assert.equal(justVip.recommended.id,'tiny');
 const priorDriver=buildTrainAdvice({...args,date:'2026-12-05',mode:'r4',slot:label,
  legacy:[t('2026-11-21','TinyMayhem','Mo','r4','R4 Mo')]});
 assert.equal(priorDriver.recommended,null);
 assert.ok(priorDriver.rejected[0].reasons.some(x=>x.includes('once per stage')));
});
test('VIP on a regular train does not disqualify R4 candidate and vice versa',()=>{
 const r4=buildTrainAdvice({...args,date:'2026-12-05',mode:'r4',slot:'R4 Tiny',
  legacy:[t('2026-11-18','TinyMayhem','Mo','vs','VS winner')]});
 assert.equal(r4.recommended.id,'tiny');
 const regular=buildTrainAdvice({...args,date:'2026-12-01',mode:'vs',slot:'VS winner',
  legacy:[t('2026-11-21','TinyMayhem','Mo','r4','R4 Mo')],
  scoreboard:[{member_id:'tiny',points:9999999}]});
 assert.equal(regular.recommended.id,'tiny');
});

test('VS candidates are explicitly described as completed weekly VS rankings, not daily scores',()=>{
 const data=buildTrainAdvice({...args,scoreDate:'2026-11-09',
  scoreboard:[{member_id:'devi',points:92000000},{member_id:'tiny',points:88000000}]});
 assert.equal(data.recommended.id,'devi');
 assert.match(data.context,/completed VS weekly total for week starting 2026-11-09/);
 assert.doesNotMatch(data.context,/VS day|VS daily/);
});

test('VIP stage option skips a prior VIP from the same five-week Stage',()=>{
 const prior=[t('2026-11-16','Devi','TinyMayhem','vs','VS MVP')];
 const weekly=buildTrainAdvice({...args,date:'2026-12-05',mode:'manual',vipMode:'weekly',legacy:prior});
 const stage=buildTrainAdvice({...args,date:'2026-12-05',mode:'manual',vipMode:'stage',legacy:prior});
 assert.equal(weekly.vipCandidates.find(c=>c.id==='tiny').eligible,true);
 assert.equal(stage.vipCandidates.find(c=>c.id==='tiny').eligible,false);
 assert.match(stage.vipCandidates.find(c=>c.id==='tiny').reasons.join(' '),/Stage 16/);
 assert.equal(stage.vipCandidates.find(c=>c.id==='new').eligible,true);
});
test('previous conductor does not count as having had VIP',()=>{
 const data=buildTrainAdvice({...args,date:'2026-12-05',mode:'manual',vipMode:'stage',
  legacy:[t('2026-11-16','TinyMayhem','Mo','manual','Roulette')]});
 assert.equal(data.vipCandidates.find(c=>c.id==='tiny').eligible,true);
 assert.equal(data.vipCandidates.find(c=>c.id==='mo').eligible,false);
});
test('R4 VIP turn counts toward both weekly and optional Stage VIP filters',()=>{
 const prior=[t('2026-11-21','Devi','TinyMayhem','r4','R4 Devi')];
 const weekly=buildTrainAdvice({...args,date:'2026-11-22',mode:'manual',vipMode:'weekly',legacy:prior});
 const stage=buildTrainAdvice({...args,date:'2026-12-05',mode:'manual',vipMode:'stage',legacy:prior});
 assert.equal(weekly.vipCandidates.find(c=>c.id==='tiny').eligible,false);
 assert.equal(stage.vipCandidates.find(c=>c.id==='tiny').eligible,false);
});
test('VIP suggestions prefer players with no matched VIP history, then oldest previous VIP',()=>{
 const data=buildTrainAdvice({...args,date:'2026-12-05',mode:'manual',vipMode:'weekly',legacy:[
  t('2026-08-12','Mo','Devi'),t('2026-10-14','Crum','Mo')
 ]});
 assert.ok(data.vipCandidates.find(c=>c.id==='new').place<data.vipCandidates.find(c=>c.id==='devi').place);
 assert.ok(data.vipCandidates.find(c=>c.id==='devi').place<data.vipCandidates.find(c=>c.id==='mo').place);
});

test('VS history wins alphabetical ties among members who have never had a train',()=>{
 const roster=[m('newcomer','A Newcomer'),m('veteran','Z Veteran')];
 const advice=buildTrainAdvice({date:'2026-11-25',mode:'never',members:roster,
  rosterIds:['newcomer','veteran'],rosterDate:'2026-11-23',
  vsRecordCounts:{newcomer:2,veteran:37}});
 assert.equal(advice.recommended.id,'veteran');
 assert.deepEqual(advice.candidates.map(x=>x.id),['veteran','newcomer']);
 assert.match(advice.candidates[0].notes.join(' '),/37 archived VS reports/);
});
test('longest wait still outranks VS participation after everyone has a train',()=>{
 const roster=[m('older','A Older'),m('recent','Z Recent')];
 const advice=buildTrainAdvice({date:'2026-11-25',mode:'never',members:roster,
  rosterIds:['older','recent'],rosterDate:'2026-11-23',
  legacy:[t('2026-02-15','A Older','Unknown'),t('2026-10-18','Z Recent','Unknown')],
  vsRecordCounts:{older:2,recent:55}});
 // The actual latest train turn determines priority, not participation count.
 assert.equal(advice.candidates[0].id,'older');
});
test('non-score VIP recommendations use VS history instead of alphabetical ties',()=>{
 const roster=[m('newcomer','A Newcomer'),m('veteran','Z Veteran')];
 const advice=buildTrainAdvice({date:'2026-11-25',mode:'manual',members:roster,
  vsRecordCounts:{newcomer:2,veteran:37}});
 assert.equal(advice.vipCandidates[0].id,'veteran');
 assert.equal(advice.vipCandidates[0].vsRecords,37);
});
test('VS score ranking stays above VS history counts',()=>{
 const roster=[m('top','A Top Score'),m('veteran','Z Veteran')];
 const advice=buildTrainAdvice({date:'2026-11-25',mode:'vs',members:roster,
  scoreboard:[{member_id:'top',points:100},{member_id:'veteran',points:90}],
  vsRecordCounts:{top:1,veteran:100}});
 assert.equal(advice.recommended.id,'top');
 assert.equal(advice.vipCandidates[0].id,'top');
});


test('confirmed Train Desk aliases resolve correctly without merging distinct lookalikes',()=>{
 const actualMembers=[
  m('yi','YI ᝰ'),m('evo','Mr EvoSan'),m('tally','MFKN Tally'),
  m('tabby','MFKN TABBY'),m('diz','Lil Diz')
 ];
 const actualAliases=[
  {alias:'Yi',alias_key:'yi',member_id:'yi'},
  {alias:'Mr Byuk Temu Version',alias_key:'mr byuk temu version',member_id:'evo'},
  {alias:'mrevosan',alias_key:'mrevosan',member_id:'evo'},
  {alias:'Tally',alias_key:'tally',member_id:'tally'},
  {alias:'Tabby',alias_key:'tabby',member_id:'tabby'},
  {alias:'Diz',alias_key:'diz',member_id:'diz'}
 ];
 const match=resolveNames(actualMembers,actualAliases);
 assert.equal(match('Yi'),match('YI ᝰ'));
 assert.equal(match('Mr Byuk Temu Version'),match('Mr EvoSan'));
 assert.equal(match('mrevosan'),match('Mr EvoSan'));
 assert.equal(match('Mr Byuk'),null);
 assert.equal(match('Tally'),'tally');
 assert.equal(match('Tabby'),'tabby');
 assert.notEqual(match('Tally'),match('Tabby'));
 assert.equal(match('Diz'),match('Lil Diz'));
});
test('Lil Diz history from both Diz and Lil Diz is counted as one player',()=>{
 const people=[m('diz','Lil Diz'),m('someone','Other Member')];
 const data=buildTrainAdvice({date:'2026-11-22',mode:'never',members:people,
  aliases:[{alias:'Diz',alias_key:'diz',member_id:'diz'}],
  rosterIds:['diz','someone'],rosterDate:'2026-11-21',
  legacy:[
   t('2026-02-14','Diz','Other Member'),
   t('2026-03-19','Other Member','Diz'),
   t('2026-06-29','Other Member','Lil Diz'),
   t('2026-09-10','Other Member','Lil Diz')
  ]});
 const lilDiz=data.candidates.find(x=>x.id==='diz');
 assert.ok(lilDiz);
 assert.match(lilDiz.notes.join(' '),/2026-09-10/);
 assert.equal(data.candidates.filter(x=>x.name==='Lil Diz').length,1);
});
test('former members disappear from conductor and VIP recommendations after their departure',()=>{
 const people=[m('old','A Departed'),m('current','B Current'),m('vip','C Current VIP')];
 const departed=[{active:true,member_id:'old',scope:'all',starts_on:'2026-11-10',
  ends_on:'2099-12-31',reason:'No longer in UTW (confirmed November 10, 2026)'}];
 const advice=buildTrainAdvice({date:'2026-11-22',mode:'never',members:people,
  rosterIds:people.map(x=>x.id),rosterDate:'2026-11-21',exceptions:departed,
  vsRecordCounts:{old:200,current:10,vip:5}});
 assert.equal(advice.recommended.id,'current');
 assert.ok(!advice.candidates.some(x=>x.id==='old'));
 assert.ok(!advice.vipCandidates.some(x=>x.id==='old'));
 assert.equal(advice.excludedDepartedCount,1);
 const ranked=buildTrainAdvice({date:'2026-11-21',mode:'vs',members:people,
  exceptions:departed,scoreDate:'2026-11-16',
  scoreboard:[{member_id:'old',points:300},{member_id:'current',points:200},
   {member_id:'vip',points:100}]});
 assert.equal(ranked.recommended.id,'current');
 assert.equal(ranked.recommended.place,2);
 assert.equal(ranked.recommendedVip.id,'vip');
 assert.equal(ranked.recommendedVip.scoreRank,3);
 assert.ok(!ranked.candidates.some(x=>x.id==='old'));
 assert.ok(!ranked.vipCandidates.some(x=>x.id==='old'));
});
test('historical train dates still allow members who left later',()=>{
 const people=[m('old','A Departed'),m('current','B Current')];
 const advice=buildTrainAdvice({date:'2026-11-01',mode:'never',members:people,
  rosterIds:['old','current'],rosterDate:'2026-10-31',
  exceptions:[{active:true,member_id:'old',scope:'all',starts_on:'2026-11-10',
   ends_on:'2099-12-31',reason:'No longer in UTW'}],
  vsRecordCounts:{old:30,current:5}});
 assert.equal(advice.recommended.id,'old');
 assert.ok(advice.vipCandidates.some(x=>x.id==='old'));
 assert.equal(advice.excludedDepartedCount,0);
});
