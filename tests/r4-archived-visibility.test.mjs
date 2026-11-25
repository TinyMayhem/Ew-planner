import test from 'node:test';
import assert from 'node:assert/strict';
import {activeMembers,activeAliases,filterExternalRoster,searchActiveMembers} from '../assets/r4-active-members.mjs';
import {buildMemberPerformance} from '../lib/member-performance.mjs';

const members=[
 {id:'active',display_name:'Active Player',archived_at:null},
 {id:'former',display_name:'Former Player',archived_at:'2026-11-22T00:00:00Z'}
];
const aliases=[
 {member_id:'active',alias:'Active Alt'},
 {member_id:'former',alias:'Old Nickname'}
];

test('search members excludes archived names and aliases while keeping active aliases',()=>{
 assert.deepEqual(searchActiveMembers(members,aliases,'').map(m=>m.id),['active']);
 assert.deepEqual(searchActiveMembers(members,aliases,'active alt').map(m=>m.id),['active']);
 assert.deepEqual(searchActiveMembers(members,aliases,'former'),[]);
 assert.deepEqual(searchActiveMembers(members,aliases,'old nickname'),[]);
 assert.deepEqual(activeMembers(members).map(m=>m.id),['active']);
});

test('historical observation data is preserved when current reports omit ex-members',()=>{
 const raw={
  members:[{id:'active',name:'Active Player'},{id:'former',name:'Former Player'}],
  snapshots:[{id:'v1',metric:'vs_weekly',date:'2026-11-16',season:'s6'}],
  observations:[{snapshotId:'v1',memberId:'active',points:45000000},{snapshotId:'v1',memberId:'former',points:49000000}],
  roster:['active','former']
 };
 const visible=new Set(activeMembers(members).map(m=>m.id));
 const report=buildMemberPerformance({...raw,members:raw.members.filter(m=>visible.has(m.id))},{rosterOnly:false});
 assert.deepEqual(report.members.map(m=>m.id),['active']);
 assert.equal(raw.observations.length,2);
 assert.equal(raw.observations.find(o=>o.memberId==='former').points,49000000);
});


test('current selectors exclude archived aliases even if given complete historical data',()=>{
 assert.deepEqual(activeAliases(members,aliases).map(a=>a.member_id),['active']);
});
test('external roster excludes archived players by current name, historical alias or external ID alias',()=>{
 const source=[
  {id:'1',name:'Active Player'},
  {id:'2',name:'Former Player'},
  {id:'3',name:'Old Nickname'},
  {id:'4',name:'Changed after leaving'},
  {id:'5',name:'New recruit'}
 ];
 assert.deepEqual(filterExternalRoster(source,members,aliases,[{source_member_id:'4',alias:'Old Nickname'}]).map(m=>m.id),['1','5']);
 assert.equal(source.length,5,'Historical source untouched');
});
test('archive status is removed when the member is restored',()=>{
 const restored=members.map(m=>({...m,archived_at:null}));
 assert.equal(activeMembers(restored).length,2);
 assert.equal(filterExternalRoster([{id:'2',name:'Old Nickname'}],restored,aliases).length,1);
});
