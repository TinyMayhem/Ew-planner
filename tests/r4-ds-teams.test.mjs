import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {buildTrainAdvice} from '../lib/train-advice.mjs';
import {GET,POST} from '../api/r4-stats.mjs';

const members=[
 {id:'tiny',display_name:'TinyMayhem'},
 {id:'devi',display_name:'Ɖevi'},
 {id:'mo',display_name:'Movich Mo'},
 {id:'crum',display_name:'Crüm'}
];
const aliases=[{alias:'Tiny',alias_key:'tiny',member_id:'tiny'}];
const legacy=(date,driver,vip,slot='Train')=>({
 train_date:date,driver_name:driver,vip_name:vip,source:'ds',selection_label:slot
});
const shared={date:'2026-11-21',mode:'ds',slot:'DS Team A',members,aliases,
 legacy:[legacy('2026-11-18','TinyMayhem','Ɖevi','DS Team A')],awards:[],exceptions:[]};
test('Team A skips its ineligible highest scorer and tries its own second place',()=>{
 const advice=buildTrainAdvice({...shared,dsTeam:'a',
  dsTeamRows:{event_date:'2026-11-20',rows:[
   {member_id:'tiny',points:10000000},{member_id:'mo',points:9000000},{member_id:'crum',points:8000000}
  ]}});
 assert.equal(advice.recommended.id,'mo');
 assert.equal(advice.recommended.place,2);
 assert.equal(advice.recommended.points,9000000);
 assert.equal(advice.rejected[0].id,'tiny');
 assert.match(advice.rejected[0].reasons.join(' '),/once per stage/);
 assert.match(advice.context,/Team A/);
});
test('Team B starts at its own top scorer, independent from Team A fallbacks',()=>{
 const b=buildTrainAdvice({...shared,slot:'DS Team B',dsTeam:'b',
  dsTeamRows:{event_date:'2026-11-20',rows:[
   {member_id:'devi',points:13000000},{member_id:'crum',points:11000000}
  ]}});
 assert.equal(b.recommended.id,'devi'); // prior VIP does not disqualify conductor
 assert.equal(b.recommended.place,1);
 assert.deepEqual(b.candidates.map(x=>x.id),['devi','crum']);
});
test('A team-specific exception skips that team top scorer independently',()=>{
 const b=buildTrainAdvice({...shared,dsTeam:'b',
  exceptions:[{member_id:'devi',scope:'ds',active:true,starts_on:'2026-11-17',ends_on:'2026-11-28',reason:'Not available'}],
  dsTeamRows:{event_date:'2026-11-20',rows:[{member_id:'devi',points:50},{member_id:'crum',points:40}]}});
 assert.equal(b.recommended.id,'crum');
 assert.equal(b.rejected[0].id,'devi');
});
test('Missing Team B scores never borrow the legacy unassigned podium',()=>{
 const a=buildTrainAdvice({...shared,dsTeam:'b',dsTeamRows:null,
  dsEvent:{event_date:'2026-11-20',first_member:'devi',second_member:'mo',third_member:'crum'}});
 assert.equal(a.recommended,null);
 assert.deepEqual(a.candidates,[]);
 assert.match(a.context,/No reviewed DS Team B/);
});
test('Same-date saved DS driver cannot drive a second DS train in this Stage',()=>{
 const advice=buildTrainAdvice({...shared,legacy:[],awards:[{
  train_date:'2026-11-21',member_id:'tiny',vip_member_id:'crum',source:'ds',slot:'DS Team A'
 }],dsTeam:'b',dsTeamRows:{event_date:'2026-11-21',rows:[
  {member_id:'tiny',points:100},{member_id:'mo',points:90}]}});
 assert.equal(advice.recommended.id,'mo');
 assert.match(advice.rejected[0].reasons[0],/Already conductor/);
});
test('DS team scoring API is R4-private and integrated with screenshot review and CSV',async()=>{
 assert.equal((await GET(new Request('https://example.org/api/r4-stats?ds_teams=1&date=2026-11-20'))).status,401);
 assert.equal((await GET(new Request('https://example.org/api/r4-stats?ds_history=1&season=post-s5'))).status,401);
 assert.equal((await POST(new Request('https://example.org/api/r4-stats',{
  method:'POST',headers:{Origin:'https://example.org','Content-Type':'application/json'},
  body:JSON.stringify({action:'ds_team',team:'a',event_date:'2026-11-20',rows:[]})
 }))).status,401);
 const page=readFileSync('lib/r4-stats-page.mjs','utf8');
 const wizard=readFileSync('assets/r4-screenshot-wizard.mjs','utf8');
 const client=readFileSync('assets/r4-stats.js','utf8');
 const api=readFileSync('api/r4-stats.mjs','utf8');
 const sql=readFileSync('supabase/r4-ds-team-rankings.sql','utf8');
 for(const v of ['ds-team-boards','ds-manual-save','train-ds-team','train-ds-teams'])assert.ok(page.includes(v),v);
 for(const v of ['ds_team_a','ds_team_b','ocr-ds-csv-read','validateConfirmedRows','groupScreenshotRows','rankPollMemberMatches'])
  assert.ok(wizard.includes(v),v);
 assert.match(client,/teamRecommendations/);
 assert.match(page,/DS Upload History/);
 assert.match(client,/function renderDsArchive/);
 assert.match(api,/q.get\('ds_history'\)/);
 assert.match(api,/historyPages\('utw_ds_team_changes'/);
 assert.match(api,/utw_ds_team_apply/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/changed since you opened them/);
 for(const path of ['assets/r4-stats.js','assets/r4-screenshot-wizard.mjs','api/r4-stats.mjs','lib/train-advice.mjs']){
  const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
 }
});
