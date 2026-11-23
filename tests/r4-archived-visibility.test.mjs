import test from 'node:test';
import assert from 'node:assert/strict';
import {activeMembers,searchActiveMembers} from '../assets/r4-active-members.mjs';
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
