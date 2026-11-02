import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {GET as statsPage} from '../lib/r4-stats-page.mjs';

test('the Train Desk browser module has valid JavaScript syntax',()=>{
 const result=spawnSync(process.execPath,['--check','assets/r4-stats.js'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
test('the secure Train Desk includes a stage selector, archive grid and rules',()=>{
 const source=readFileSync('lib/r4-stats-page.mjs','utf8');
 for(const key of ['id="train-stage"','id="train-calendar"','id="train-stage-warnings"','id="train-eligibility-warnings"','Da Rules'])
  assert.ok(source.includes(key),'Missing '+key);
});
test('the API keeps the legacy archive on the private data path',()=>{
 const source=readFileSync('api/r4-stats.mjs','utf8');
 assert.match(source,/utw_stat_train_legacy/);
 assert.match(source,/authorizedAccess\(request\)/);
});
