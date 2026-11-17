import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {orderThpPeople} from '../assets/r4-thp-order.mjs';
import {validSquadType,validSquadPower,GET,POST} from '../api/r4-stats.mjs';

const people=[
 {id:'missing',name:'No THP'}, {id:'small',name:'Small'},
 {id:'zero',name:'Recorded zero'},{id:'large',name:'Large'},
 {id:'tieA',name:'Alpha'},{id:'tieB',name:'Bravo'}
];
test('THP ranks highest to lowest, unknown last, ties alphabetically',()=>{
 const last=[
  {source_member_id:'small',thp:125000000},
  {source_member_id:'large',thp:350000000},
  {source_member_id:'zero',thp:0},
  {source_member_id:'tieB',thp:200000000},
  {source_member_id:'tieA',thp:200000000}
 ];
 assert.deepEqual(orderThpPeople(people,last).map(x=>x.id),['large','tieA','tieB','small','zero','missing']);
 assert.deepEqual(people.map(x=>x.id),['missing','small','zero','large','tieA','tieB'],'sorting must not mutate input');
});
test('Empty snapshot falls back to alphabetical, and selected date governs ranking',()=>{
 assert.deepEqual(orderThpPeople([{id:'b',name:'Zed'},{id:'a',name:'Alice'}],[]).map(x=>x.id),['a','b']);
 assert.deepEqual(orderThpPeople([{id:'a',name:'Alice'},{id:'b',name:'Zed'}],[{source_member_id:'a',thp:1},{source_member_id:'b',thp:2}]).map(x=>x.id),['b','a']);
});
test('Main squad type and power are independently optional but validated',()=>{
 for(const value of [null,'tank','air','missile'])assert.equal(validSquadType(value),true);
 for(const value of ['',undefined,'Tank','helikopter','boats',1])assert.equal(validSquadType(value),false);
 for(const value of [null,0,1,34500000,Number.MAX_SAFE_INTEGER])assert.equal(validSquadPower(value),true);
 for(const value of [-1,1.5,'35M',NaN,Infinity,Number.MAX_SAFE_INTEGER+1,undefined])assert.equal(validSquadPower(value),false);
});
test('Optional squad editing remains behind existing UTW R4 authentication',async()=>{
 const url='https://example.com/api/r4-stats';
 const res=await POST(new Request(url,{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:JSON.stringify({action:'member_squad',source_member_id:'abc',member_name:'Tiny',squad_type:'air',squad_power:30500000})}));
 assert.equal(res.status,401);
 assert.equal((await GET(new Request(url+'?member_thp=1&date=2026-11-17'))).status,401);
});
test('THP tracker offers independent squad controls while train THP rules stay intact',()=>{
 const thp=readFileSync('assets/r4-thp.js','utf8');
 const page=readFileSync('lib/r4-stats-page.mjs','utf8');
 const server=readFileSync('api/r4-stats.mjs','utf8');
 const sql=readFileSync('supabase/r4-member-squad-profiles.sql','utf8');
 for(const label of ['Not specified','Tank','Air','Missile','Save squad','Squad power (optional)'])assert.ok(thp.includes(label));
 assert.ok(thp.includes('orderThpPeople'));
 assert.ok(thp.includes("state.squads=data.squads||[]"));
 assert.ok(server.includes("case 'member_squad'"));
 assert.ok(page.includes('ranked by their latest available THP'));
 assert.ok(sql.includes('enable row level security'));
 assert.ok(sql.includes('revoke all'));
 for(const path of ['assets/r4-thp.js','assets/r4-thp-order.mjs','api/r4-stats.mjs']){
  const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
 }
});
