import test from 'node:test';
import assert from 'node:assert/strict';
import {activeR4MemberOptions,validR4RoleNames} from '../lib/r4-eligible-members.mjs';

const members=[
 {id:'one',display_name:'TinyMayhem'},
 {id:'two',display_name:'CalllMeBaba'},
 {id:'three',display_name:'Ɖevi'},
 {id:'four',display_name:'Non-R4 Member'}
];
const aliases=[{alias:'Tiny',member_id:'one'},{alias:'Baba',member_id:'two'}];
const accounts=[
 {username:'tiny',display_name:'Tiny',role:'admin',active:true},
 {username:'baba',display_name:'Baba',role:'r4',active:true},
 {username:'bambi',display_name:'Bambi',role:'r4',active:false},
 {username:'devi',display_name:'Devi',role:'r4',active:true},
 {username:'random',display_name:'Non-R4 Member',role:'von',active:true},
 {username:'missing',display_name:'Unlinked R4',role:'r4',active:true},
 {username:'same-player',display_name:'Tiny',role:'r4',active:true}
];
test('active R4 roster deduplicates accounts and resolves current names from aliases',()=>{
 const roster=activeR4MemberOptions(accounts,members,aliases);
 assert.deepEqual(roster.members.map(x=>x.name),['CalllMeBaba','TinyMayhem','Ɖevi']);
 assert.deepEqual(roster.unmatched,['Unlinked R4']);
 assert.equal(roster.members.filter(x=>x.name==='TinyMayhem').length,1);
});
test('non-R4 members and unsaved names cannot be used in department assignments',()=>{
 const roster=activeR4MemberOptions(accounts,members,aliases);
 const assignment={leader:'TinyMayhem',backup:'CalllMeBaba',additional_backups:['Ɖevi']};
 assert.equal(validR4RoleNames(assignment,roster.members),true);
 assert.equal(validR4RoleNames({...assignment,backup:'Non-R4 Member'},roster.members),false);
 assert.equal(validR4RoleNames({...assignment,backup:'Old mistyped nickname'},roster.members),false);
 assert.equal(validR4RoleNames({leader:'',backup:'',additional_backups:[]},roster.members),true);
});
