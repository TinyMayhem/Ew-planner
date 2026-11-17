import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {parsePollOcrText,parsePollCsv,cleanPollName} from '../assets/r4-poll-parser.mjs';
import {GET,POST} from '../api/r4-polls.mjs';
const members=[
 {id:'1',display_name:'Texas Bandit'},
 {id:'2',display_name:'Sorree Crank Meister'},
 {id:'3',display_name:'SeaBeast From Wren'},
 {id:'4',display_name:'StinkyStew'}
];
const aliases=[
 {alias:'Sorree Baba',alias_key:'sorree baba',member_id:'2'}
];
test('Voting Members OCR reads names but ignores Power/Level and labels',()=>{
 const raw='VOTING MEMBERS\nThe following members chose option 1 in this vote\nR4 SeaBeast From Wren\nPower:288716436    LV.35\nR3 Sorree Baba\nPower:347438616  LV.35\nR1 Texas Bandit\nPower:301226765 LV.35\n';
 const rows=parsePollOcrText(raw,members,aliases);
 assert.equal(rows.length,3);
 assert.deepEqual(new Set(rows.map(r=>r.member_id)),new Set(['1','2','3']));
 assert.ok(rows.every(x=>x.confidence==='matched'));
});
test('OCR overlap is a review concern, not new identity',()=>{
 const rows=parsePollOcrText('Texas Bandit\nPower:301226765 LV.35\nTexas Bandit\nPower:301226765 LV.35',members,aliases);
 assert.equal(rows.length,1);
});
test('poll name cleaning retains non-Latin nicknames',()=>{
 assert.equal(cleanPollName('R3 Sorree Baba'),'Sorree Baba');
 assert.equal(cleanPollName('R1 ♂ Texas Bandit'),'Texas Bandit');
});
test('CSV supports mixed votes, quoted commas and category-specific single columns',()=>{
 const csv='member_name,response\n"Texas Bandit",Yes\n"Sorree Baba",No\n"Alpha, Bravo",Maybe\n';
 assert.deepEqual(parsePollCsv(csv),[
  {name:'Texas Bandit',response:'yes'},
  {name:'Sorree Baba',response:'no'},
  {name:'Alpha, Bravo',response:'maybe'}
 ]);
 assert.deepEqual(parsePollCsv('Texas Bandit\nSorree Baba','maybe'),[
  {name:'Texas Bandit',response:'maybe'},{name:'Sorree Baba',response:'maybe'}
 ]);
 assert.throws(()=>parsePollCsv('member_name,response\nTexas Bandit,unknown'),/Invalid/);
});
test('Poll API and page both require private R4 access',async()=>{
 const denied=await GET(new Request('https://example.test/api/r4-polls'));
 assert.equal(denied.status,403);
 const blocked=await POST(new Request('https://example.test/api/r4-polls',{method:'POST',body:'{}',headers:{origin:'https://example.test','content-type':'application/json'}}));
 assert.equal(blocked.status,403);
});
test('Poll UI, API, reports and migration are integrated',()=>{
 const page=readFileSync('lib/r4-polls-page.mjs','utf8');
 const report=readFileSync('lib/r4-reports-page.mjs','utf8');
 const routes=JSON.parse(readFileSync('vercel.json','utf8'));
 const sql=readFileSync('supabase/r4-poll-participation.sql','utf8');
 const client=readFileSync('assets/r4-polls.js','utf8');
 assert.ok(routes.rewrites.some(x=>x.source==='/r4-polls'));
 for(const field of ['poll-images','poll-csv','poll-manual-save','poll-finalize','poll-missing','poll-report-no'])
  assert.ok(page.includes(field),field);
 assert.ok(report.includes('embedded-poll-no'));
 assert.match(sql,/enable row level security/);
 assert.match(sql,/utw_poll_change/);
 assert.match(sql,/revision=revision\+1/);
 assert.match(client,/parsePollOcrText/);
 for(const path of ['assets/r4-polls.js','assets/r4-poll-parser.mjs','assets/r4-poll-reports-embed.js','api/r4-polls.mjs']){
  const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
 }
});
