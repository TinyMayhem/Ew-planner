import test from 'node:test';
import assert from 'node:assert/strict';
import {TRAIN_R4_ROSTER,currentTrainR4Ids} from '../lib/r4-train-roster.mjs';
import {buildTrainAdvice} from '../lib/train-advice.mjs';

const members=TRAIN_R4_ROSTER.map(x=>({id:x.memberId,display_name:'Game name: '+x.label,archived_at:null}));
test('exact verified UTW Train Desk roster stays independent of nickname spelling and R4 login accounts',()=>{
 assert.deepEqual(TRAIN_R4_ROSTER.map(x=>x.label),['Savvy','Baba','Catalyst','Devi','Noosh','Mo','Tiny','Chibi','Crum','Rylis','Sea']);
 assert.equal(new Set(TRAIN_R4_ROSTER.map(x=>x.memberId)).size,11);
 const ids=currentTrainR4Ids(members);
 assert.equal(ids.size,11);
 for(const m of members)assert.equal(ids.has(m.id),true);
});
test('archived members leave the active R4 roster, but missing identity mappings are reported',()=>{
 const changed=members.map(m=>m.id===TRAIN_R4_ROSTER[0].memberId?{...m,archived_at:'2026-11-23T00:00:00Z'}:m);
 assert.equal(currentTrainR4Ids(changed).size,10);
 assert.equal(currentTrainR4Ids(changed).has(TRAIN_R4_ROSTER[0].memberId),false);
 assert.throws(()=>currentTrainR4Ids(members.slice(1)),/Savvy/);
});
test('Top Donation suggestions block verified R4s but still recommend eligible ordinary members',()=>{
 const guest={id:'c42b125f-8a73-48e0-9fb9-985dbd5daa2f',display_name:'Other member',archived_at:null};
 const all=[...members,guest],r4MemberIds=[...currentTrainR4Ids(all)];
 const a=buildTrainAdvice({date:'2026-11-24',mode:'donations',slot:'Top donation',members:all,
  scoreboard:[{member_id:members[0].id,points:900},{member_id:guest.id,points:800}],scoreDate:'2026-11-23',r4MemberIds});
 assert.equal(a.recommended.id,guest.id);
 assert.equal(a.candidates.find(x=>x.id===members[0].id).r4DonationBlocked,true);
 assert.equal(a.candidates.find(x=>x.id===guest.id).r4DonationBlocked,false);
 assert.equal(a.r4MemberIds.length,11);
});
test('outdated R4 calendar holder is not auto-recommended as active R4',()=>{
 const old={id:'c42b125f-8a73-48e0-9fb9-985dbd5daa2f',display_name:'Izard',archived_at:null};
 const all=[...members,old];
 const a=buildTrainAdvice({date:'2026-11-26',mode:'r4',slot:'R4 Izard',members:all,r4MemberIds:[...currentTrainR4Ids(all)]});
 assert.equal(a.recommended,null);
 assert.match(a.context,/not on the current R4 roster/);
});
