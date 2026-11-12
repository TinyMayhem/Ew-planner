import test from 'node:test';
import assert from 'node:assert/strict';
import {thpFromCell,parsedThpRows,isRealDate} from '../assets/r4-thp-import.mjs';
import {roleForPair} from '../assets/r4-thp-roles.mjs';

test('THP parser handles raw power, millions and billions without truncating a fractional million',()=>{
 assert.equal(thpFromCell('125,000,000'),125000000);
 assert.equal(thpFromCell('142.5M'),142500000);
 assert.equal(thpFromCell('1.25B'),1250000000);
 assert.equal(thpFromCell('0'),0);
 assert.equal(thpFromCell('123.456'),null);
 assert.equal(thpFromCell('hi'),null);
 assert.equal(isRealDate('2026-11-12'),true);
 assert.equal(isRealDate('2026-02-30'),false);
});

test('THP upload matches source roster, but does not invent power for absent members',()=>{
 const roster=[{id:'a',name:'Tiny'},{id:'b',name:'CallMeBaba'},{id:'c',name:'Savvy'}];
 const parsed=parsedThpRows({
  matrix:[['Tiny','123M'],['CallMeBaba','180000000'],['GhostAlias','192M']],
  nameCol:0,thpCol:1
 },roster);
 assert.equal(parsed.rows.length,2);
 assert.deepEqual(parsed.rows.map(x=>x.source_member_id),['a','b']);
 assert.deepEqual(parsed.rows.map(x=>x.thp),[123000000,180000000]);
 assert.deepEqual(parsed.unmatched.map(x=>x.name),['GhostAlias']);
 assert.equal(parsed.rows.some(x=>x.source_member_id==='c'),false);
});

test('Same member appearing twice in the THP file is held for review',()=>{
 const r=parsedThpRows({
  matrix:[['Tiny','100M'],['TINY','110M']],
  nameCol:0,thpCol:1
 },[{id:'a',name:'Tiny'}]);
 assert.equal(r.rows.length,1);
 assert.equal(r.unmatched.length,1);
});

test('VIP labels use only conductor-VIP THP comparison',()=>{
 assert.equal(roleForPair(200000000,150000000),'Special Guest');
 assert.equal(roleForPair(150000000,200000000),'Guest Defender');
 assert.equal(roleForPair(150000000,150000000),'Equal THP');
 assert.equal(roleForPair(null,150000000),null);
 assert.equal(roleForPair(undefined,150000000),null);
});
