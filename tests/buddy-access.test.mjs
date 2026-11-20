import test from 'node:test';
import assert from 'node:assert/strict';
import {BUDDY_ACCESS_KEY,editTokenFromHash,readRememberedToken,rememberToken,forgetRememberedToken} from '../assets/buddy-access.mjs';

function browserStore(){
 const data=new Map();
 return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),data};
}
const token='a'.repeat(43);
test('members can return on the same device without remembering their edit link',()=>{
 const storage=browserStore();
 assert.equal(readRememberedToken(storage),null);
 assert.equal(rememberToken(storage,token),true);
 assert.equal(storage.data.get(BUDDY_ACCESS_KEY),token);
 assert.equal(readRememberedToken(storage),token);
});
test('private link opens on another device, and switching profiles clears saved access',()=>{
 const storage=browserStore();
 assert.equal(editTokenFromHash('#edit='+token),token);
 assert.equal(editTokenFromHash('#signup'),null);
 assert.equal(rememberToken(storage,editTokenFromHash('#edit='+token)),true);
 forgetRememberedToken(storage);
 assert.equal(readRememberedToken(storage),null);
});
test('refuse invalid tokens and fail safely when browser storage is blocked',()=>{
 const storage=browserStore();
 assert.equal(rememberToken(storage,'short'),false);
 assert.equal(editTokenFromHash('#edit=short'),null);
 storage.data.set(BUDDY_ACCESS_KEY,'not-a-real-token');
 assert.equal(readRememberedToken(storage),null);
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
 assert.equal(readRememberedToken(blocked),null);
 assert.equal(rememberToken(blocked,token),false);
 assert.doesNotThrow(()=>forgetRememberedToken(blocked));
});
