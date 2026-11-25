import test from 'node:test';
import assert from 'node:assert/strict';
import {matchRoster} from '../assets/r4-ocr-parser.mjs';
import {rankPollMemberMatches} from '../assets/r4-poll-parser.mjs';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const members=[{id:'a',display_name:'Active Player'},{id:'b',display_name:'Former Player',archived_at:'2026-11-22'}];
const aliases=[{member_id:'b',alias:'Former Alias',alias_key:'former alias'}];
test('OCR and poll matching never return archived identities or aliases',()=>{
 assert.equal(matchRoster('Former Alias',members,aliases).id,null);
 assert.equal(matchRoster('Former Alias',[members[0]],aliases).id,null);
 assert.deepEqual(rankPollMemberMatches('Former Player',members,aliases).map(x=>x.id),['a']);
});
test('all edited current picker entrypoints parse and opt into active selection',()=>{
 const sources=['assets/r4-polls.js','assets/r4-nicknames.js','assets/r4-stats.js','assets/r4-thp.js','assets/r4-roles.js','api/r4-stats.mjs','api/thp-update.mjs','lib/r4-polls-handler.mjs'];
 for(const path of sources){const r=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});assert.equal(r.status,0,r.stderr)}
 assert.match(readFileSync('assets/r4-polls.js','utf8'),/const selectableMembers=\(\)=>activeMembers\(store.members\)/);
 assert.match(readFileSync('assets/r4-thp.js','utf8'),/active_roster=1/);
 assert.match(readFileSync('assets/r4-nicknames.js','utf8'),/for\(const member of activeMembers\(members\)\)selector.append/);
});

test('poll alias picker uses directory aliases without recursion',()=>{
 assert.match(readFileSync('assets/r4-polls.js','utf8'),/const selectableAliases=\(\)=>activeAliases\(store.members,store.aliases\)/);
});

test('legacy podium creation is removed without removing history or the scoreboard date',()=>{
 const page=readFileSync('lib/r4-stats-page.mjs','utf8'),client=readFileSync('assets/r4-stats.js','utf8'),wizard=readFileSync('assets/r4-screenshot-wizard.mjs','utf8');
 assert.doesNotMatch(page,/id="ds-form"|Log a Desert Storm podium/);
 assert.equal((page.match(/id="ds-date"/g)||[]).length,1);
 for(const id of ['ds-archive-list','ds-history','ds-csv-card','ds-team-boards'])assert.ok(page.includes('id="'+id+'"'));
 assert.doesNotMatch(client,/\$\('ds-form'\)|'ds-first'|'ds-second'|'ds-third'/);
 assert.match(client,/podiumTeamControl/);
 assert.doesNotMatch(wizard,/<option value="ds">/);
});
