import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {GET} from '../api/buddies.mjs';
import {sessionToken} from '../lib/buddies.mjs';

const values=['SUPABASE_URL','SUPABASE_SECRET_KEY','UTW_ADMIN_PASSWORD','UTW_SESSION_SECRET','UTW_PAGE_PASSWORD'];
const envBefore=Object.fromEntries(values.map(k=>[k,process.env[k]]));
const setup=()=>{
 process.env.SUPABASE_URL='https://database.test';
 process.env.SUPABASE_SECRET_KEY='test-only-key';
 process.env.UTW_ADMIN_PASSWORD='test-password-long-enough';
 process.env.UTW_SESSION_SECRET='test-secret-at-least-32-characters-2026';
 process.env.UTW_PAGE_PASSWORD='abcd';
};
const request=(cookie='')=>new Request('https://site.test/api/buddies?view=trains',{headers:cookie?{cookie}:{}});
const fixture=(url)=>{
 const path=new URL(url).pathname;
 if(path.endsWith('/utw_stat_awards'))return Response.json([{train_date:'2026-11-01',slot:'VS top score',member_id:'driver-id',vip_member_id:'vip-id',source:'vs',season_id:'post-s5'}]);
 if(path.endsWith('/utw_stat_train_legacy'))return Response.json([
  {train_date:'2026-08-03',driver_name:'Jax',vip_name:'Sauron',selection_label:'Top donation last week',source:'donations',notes:'PRIVATE NOTE'},
  {train_date:'2026-09-07',driver_name:'Neoo',vip_name:'Spuddy',selection_label:'Top donation last week',source:'donations'},
  {train_date:'2026-10-12',driver_name:'Benny',vip_name:'Seppu',selection_label:'Top donation last week',source:'donations'},
  {train_date:'2026-11-01',driver_name:'Outdated Driver',vip_name:'Old VIP',selection_label:'VS top score',source:'vs'}
 ]);
 if(path.endsWith('/utw_stat_members'))return Response.json([{id:'driver-id',display_name:'Corrected Driver'},{id:'vip-id',display_name:'Current VIP'}]);
 if(path.endsWith('/utw_stat_seasons'))return Response.json([{id:'post-s5',label:'Post Season 5',sort_order:1}]);
 throw Error('Unexpected database request: '+path);
};
test('member train calendar keeps the member gate, combines screenshots and saved changes, and hides private notes',async()=>{
 const saved=globalThis.fetch;
 setup();globalThis.fetch=async(url)=>fixture(url);
 try{
  const denied=await GET(request());
  const locked=await denied.json();
  assert.equal(locked.locked,true);
  assert.equal('trains' in locked,false);
  const response=await GET(request('utw_page='+sessionToken('page')));
  assert.equal(response.status,200);
  const data=await response.json();
  assert.deepEqual(data.stages.map(s=>s.stage),[16,15,14,13,12,11,10,9,8,7]);
  assert.equal(data.stages[0].start,'2026-11-16');
  assert.equal(data.stages[0].end,'2026-12-20');
  assert.equal(data.stages[1].start,'2026-10-12');
  assert.equal(data.stages[1].end,'2026-11-15');
  assert.equal(data.stages[9].start,'2025-12-29');
  assert.equal(data.trains.length,4);
  assert.equal(data.trains.find(t=>t.date==='2026-11-01').member,'Corrected Driver');
  assert.equal(data.trains.find(t=>t.date==='2026-09-07').vip,'Spuddy');
  assert(!JSON.stringify(data).includes('PRIVATE NOTE'));
  assert(!JSON.stringify(data).includes('Outdated Driver'));
 }finally{
  globalThis.fetch=saved;
  for(const k of values){if(envBefore[k]===undefined)delete process.env[k];else process.env[k]=envBefore[k]}
 }
});
test('Members Den defaults to the latest two full five-week calendars with old date filters intact',()=>{
 const html=readFileSync('members.html','utf8');
 const js=readFileSync('assets/members.js','utf8');
 assert.match(html,/id="trainView"/);
 assert.match(html,/id="trainCalendars"/);
 assert.match(html,/id="trainRows"/);
 assert.match(html,/type="module" src="\/assets\/members\.js"/);
 assert.match(js,/stages\.filter\(s=>s\.start<=serverDate\)\.slice\(0,2\)/);
 assert.match(js,/trainLabelForDate/);
 assert.match(js,/week<5/);
 assert.match(js,/day<7/);
 assert.match(js,/stageCalendar\(stage,entries\)/);
 assert.match(js,/trainSeason/);
 assert.equal(spawnSync(process.execPath,['--check','assets/members.js'],{encoding:'utf8'}).status,0);
});
