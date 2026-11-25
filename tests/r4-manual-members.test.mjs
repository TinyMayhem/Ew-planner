import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {POST} from '../api/r4-stats.mjs';
test('manual roster creation requires an R4 session',async()=>{
 const request=new Request('https://example.org/api/r4-stats',{method:'POST',headers:{Origin:'https://example.org','Content-Type':'application/json'},body:JSON.stringify({action:'create_members',members:[{name:'Example',aliases:[]}]})});
 assert.equal((await POST(request)).status,401);
});
test('manual roster creation checks collisions and uses atomic service-only RPC',()=>{
 const api=readFileSync('api/r4-stats.mjs','utf8'),client=readFileSync('assets/r4-nicknames.js','utf8'),page=readFileSync('lib/r4-nicknames-page.mjs','utf8'),sql=readFileSync('supabase/r4-manual-member-creation.sql','utf8');
 for(const v of ['create-member-name','create-members-bulk','create-member-result'])assert.ok(page.includes(v));
 assert.match(client,/Confirm and add/);
 assert.match(api,/Duplicate name or nickname in this batch/);
 assert.match(api,/restore the original record/);
 assert.match(api,/rpc\/utw_create_members/);
 assert.match(sql,/security invoker/);
 assert.match(sql,/from public,anon,authenticated/);
 assert.match(sql,/utw_stat_audit/);
 for(const path of ['api/r4-stats.mjs','assets/r4-nicknames.js','lib/r4-nicknames-page.mjs']){
  const r=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
 }
});
