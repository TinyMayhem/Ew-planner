import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseDsCsv,parseDsCsvOutcome,matchDsCsvRows} from '../assets/r4-ds-csv.mjs';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
test('DS CSV recognizes exported columns, quoted scores and suffixes',()=>{
 assert.deepEqual(parseDsCsv('member_name,points\nMo,"1,200"\nTiny,12.5M'),[{name:'Mo',points:1200},{name:'Tiny',points:12500000}]);
 assert.deepEqual(parseDsCsv('player,score\nMo,0'),[{name:'Mo',points:0}]);
});
test('DS CSV blocks duplicates and invalid or missing scores',()=>{
 for(const raw of ['name,points\nMo,1\nmo,2','name,points\nMo,-1','name,points\nMo,','foo,bar\nMo,1'])assert.throws(()=>parseDsCsv(raw));
});
test('DS CSV only maps unique active members and known nicknames',()=>{
 const rows=[{name:'Old Name',points:5},{name:'Unknown',points:1},{name:'Archived',points:4}];
 assert.deepEqual(matchDsCsvRows(rows,[{id:'a',display_name:'Current'}],[{alias:'Old Name',member_id:'a'},{alias:'Archived',member_id:'b'}]).map(r=>r.memberId),['a',null,null]);
});
test('direct DS CSV controls use existing reviewed team save',()=>{
 const page=readFileSync('lib/r4-stats-page.mjs','utf8'),client=readFileSync('assets/r4-stats.js','utf8');
 for(const id of ['ds-csv-date','ds-csv-team','ds-csv-file','ds-csv-preview','ds-csv-template'])assert.ok(page.includes(id));
 assert.match(client,/revision:saved\?\.revision\?\?0,rows:payload/);
 for(const path of ['assets/r4-stats.js','lib/r4-stats-page.mjs']){
  const r=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 }
});

test('DS CSV result is optional and consistent for the whole team',()=>{
 assert.equal(parseDsCsvOutcome('member_name,points,outcome\nMo,1,Win\nTiny,2,won'),'win');
 assert.equal(parseDsCsvOutcome('player,score,result\nMo,1,lose'),'loss');
 assert.equal(parseDsCsvOutcome('player,score\nMo,1'),null);
 assert.throws(()=>parseDsCsvOutcome('player,score,outcome\nMo,1,win\nTiny,2,loss'));
});
