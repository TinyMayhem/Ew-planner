import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTrainAdvice} from '../lib/train-advice.mjs';

const members=[
 {id:'active',display_name:'Active',archived_at:null},
 {id:'former',display_name:'Former',archived_at:'2026-11-17T00:00:00Z'}
];
const aliases=[
 {member_id:'active',alias:'Active',alias_key:'active'},
 {member_id:'former',alias:'Former',alias_key:'former'}
];
const defaults={date:'2026-11-22',mode:'vs',slot:'VS MVP',members,aliases,legacy:[],awards:[],exceptions:[]};

test('archived member remains in score history but is skipped for both train seats',()=>{
 const result=buildTrainAdvice({...defaults,scoreDate:'2026-11-16',scoreboard:[
  {member_id:'former',points:900},{member_id:'active',points:800}
 ]});
 assert.equal(result.recommended?.name,'Active');
 assert.equal(result.recommended?.place,2);
 assert.ok(!result.vipCandidates.some(m=>m.id==='former'));
 assert.equal(result.excludedArchivedCount,1);
});

test('former members never appear in current longest-wait train pool',()=>{
 const result=buildTrainAdvice({...defaults,mode:'never',rosterIds:['former','active'],rosterDate:'2026-11-16'});
 assert.ok(result.candidates.some(m=>m.id==='active'));
 assert.ok(!result.candidates.some(m=>m.id==='former'));
});

test('past trains retain archived players by their historical name',()=>{
 const result=buildTrainAdvice({...defaults,mode:'never',
  legacy:[{train_date:'2026-11-22',driver_name:'Former',vip_name:'Active',source:'manual',selection_label:'Old'}]
 });
 assert.equal(result.sameDate[0].driver,'Former');
});
