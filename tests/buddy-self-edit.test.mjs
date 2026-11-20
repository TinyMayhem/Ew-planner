import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,register,update,assign,publish,publicBoard,snapshotMember,logBuddyChange,undoBuddyChange} from '../lib/buddies.mjs';

const member=(name,profession,provide=false,need=false)=>({
 ign:name,alliance:'UTW',profession,
 hasBuddies:{winwin:false,hospital:false},currentBuddies:{winwin:'',hospital:''},
 skills:{winwin:{provide,need},hospital:{provide,need}}
});
function loggedUpdate(board,id,values,actor='Member (unverified)'){
 const before=snapshotMember(board.members.find(m=>m.id===id));
 update(board,id,values);
 const after=snapshotMember(board.members.find(m=>m.id===id));
 return logBuddyChange(board,{kind:actor==='Admin'?'Admin profile updated':'Profile updated',profileId:id,actor,before,after});
}
test('audit records exact edits and is hidden from non-admin board responses',()=>{
 const board=emptyBoard();
 const made=register(board,member('Demo Owl','warleader'));
 logBuddyChange(board,{kind:'Profile registered',profileId:made.member.id,after:snapshotMember(board.members[0])});
 const next=member('Demo Owl','engineer',true,false);
 next.currentBuddies.winwin='Demo Fox';
 next.hasBuddies.winwin=true;
 const changed=loggedUpdate(board,made.member.id,next);
 assert(changed.changes.some(x=>x.field==='Profession'&&x.from==='warleader'&&x.to==='engineer'));
 assert(changed.changes.some(x=>x.field.includes('Reported buddy')&&x.to==='Demo Fox'));
 assert.equal(changed.profileName,'Demo Owl');
 assert.equal(changed.actor,'Member (unverified)');
 const publicJson=JSON.stringify(publicBoard(board));
 assert(!publicJson.includes('audit'));
 assert(!publicJson.includes('Demo Fox'));
 assert(!publicJson.includes('editHash'));
 const admin=publicBoard(board,true);
 assert.equal(admin.audit.length,2);
 assert.equal(admin.audit[0].id,changed.id);
 assert(!JSON.stringify(admin.audit).includes('editHash'));
});
test('undo is admin-only operation with a new event and cannot restore old published pairings',()=>{
 const board=emptyBoard();
 const engineer=register(board,member('Demo Fox','engineer',true,false));
 const recipient=register(board,member('Demo Owl','warleader',false,true));
 assign(board,{skill:'winwin',providerId:engineer.member.id,recipientId:recipient.member.id});
 publish(board);
 const event=loggedUpdate(board,engineer.member.id,member('Demo Fox','warleader',false,false));
 assert(board.pairings.every(x=>x.status==='reassign'));
 assert.equal(undoBuddyChange(board,event.id).profession,'engineer');
 assert(board.pairings.every(x=>x.status==='reassign'));
 const history=board.audit;
 assert.equal(history.at(-1).kind,'Admin undo');
 assert.equal(history.at(-1).reverseOf,event.id);
 assert.equal(history.length,2);
});
test('undo rejects stale edits and tampered profile state',()=>{
 const board=emptyBoard();
 const original=register(board,member('Demo Raccoon','warleader'));
 const first=loggedUpdate(board,original.member.id,member('Demo Raccoon','engineer',true));
 const second=loggedUpdate(board,original.member.id,member('Demo Raccoon','warleader'));
 assert.throws(()=>undoBuddyChange(board,first.id),/most recent/);
 board.members[0].currentBuddies.winwin='Unexpected change';
 assert.throws(()=>undoBuddyChange(board,second.id),/no longer matches/);
});
test('no-op changes do not create misleading audit history',()=>{
 const board=emptyBoard();
 const first=register(board,member('Demo Fox','engineer'));
 const snap=snapshotMember(board.members[0]);
 assert.equal(logBuddyChange(board,{kind:'Profile updated',profileId:first.member.id,before:snap,after:snap}),null);
 assert.equal(board.audit,undefined);
});
