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

test('train editor supports historical conductor replacements and preserves original name',()=>{
 const client=readFileSync('assets/r4-stats.js','utf8');
 const server=readFileSync('api/r4-stats.mjs','utf8');
 assert.match(client,/function openLegacyTrainEditor/);
 assert.match(client,/update_legacy_train/);
 assert.match(client,/originalDriverName/);
 assert.match(client,/No-show/);
 assert.match(server,/original_driver_name/);
 assert.match(server,/recordAudit\(request,'update_legacy_train'/);
});
test('dedicated R4 source is selectable independently from DS',()=>{
 const page=readFileSync('lib/r4-stats-page.mjs','utf8');
 assert.match(page,/<option value="r4">R4 train/);
 assert.match(page,/same person from receiving an eligible DS train/);
});

test('historical stage selector and original worksheet slot labels are included',()=>{
 const r4=readFileSync('assets/r4-stats.js','utf8');
 const den=readFileSync('assets/members.js','utf8');
 const labels=readFileSync('assets/r4-train-schedule.mjs','utf8');
 assert.match(r4,/for\(let stage=7;stage<=30;stage\+\+\)/);
 assert.match(r4,/trainLabelForDate/);
 assert.match(den,/trainLabelForDate/);
 assert.match(labels,/Top donation last week/);
});
