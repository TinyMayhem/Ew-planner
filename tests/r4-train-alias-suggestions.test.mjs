import test from 'node:test';
import assert from 'node:assert/strict';
import {trainAliasSuggestions} from '../assets/r4-train-alias-suggestions.mjs';
const members=[{id:'1',display_name:'TinyMayhem'},{id:'2',display_name:'BabaSpuddy'},{id:'3',display_name:'Ghøstlyy'}];
test('unlinked near-match from saved train history is suggested, not saved',()=>{
 const list=trainAliasSuggestions([{driver_name:'TinyMayheh',vip_name:'Spuddy'}],members,[]);
 assert(list.some(x=>x.alias==='TinyMayheh'&&x.member_id==='1'));
 assert(list.some(x=>x.alias==='Spuddy'&&x.member_id==='2'));
});
test('already linked names and annotated notes are excluded',()=>{
 const rows=[{driver_name:'Spuddy',vip_name:'Tiny 100%'},{driver_name:'Bob (no show)',vip_name:'Ghostlyy'}];
 const aliases=[{member_id:'2',alias:'Spuddy'},{member_id:'3',alias:'Ghostlyy'}];
 const list=trainAliasSuggestions(rows,members,aliases);
 assert.equal(list.some(x=>x.alias==='Spuddy'),false);
 assert.equal(list.some(x=>x.alias==='Ghostlyy'),false);
 assert.equal(list.some(x=>/no show|100%/.test(x.alias)),false);
});
test('ambiguous partial names are never proposed',()=>{
 const roster=[{id:'a',display_name:'BabaSpuddy'},{id:'b',display_name:'BabaSpudster'}];
 const candidates=trainAliasSuggestions([{driver_name:'BabaSpud',vip_name:'No one'}],roster,[]);
 assert.equal(candidates.some(x=>x.alias==='BabaSpud'),false);
});
