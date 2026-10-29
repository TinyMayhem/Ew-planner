import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {DAILY_TARGET,WEEKLY_TARGET,scoreFlag,weekOf,archivedWeeks,vsWeekSlots,vsLeaderboard} from '../assets/r4-vs-archive.mjs';
import {GET as statsGET} from '../api/r4-stats.mjs';

const sampleImports=[
 {id:'monday-v1',metric:'vs_daily',period:'2026-10-26',created_at:'2026-10-27T00:00:00Z',row_count:2,filename:'monday.csv'},
 {id:'monday-v2',metric:'vs_daily',period:'2026-10-26',created_at:'2026-10-27T01:00:00Z',row_count:3,filename:'monday-corrected.csv'},
 {id:'tuesday',metric:'vs_daily',period:'2026-10-27',created_at:'2026-10-28T00:00:00Z',row_count:2,filename:'tue.csv'},
 {id:'weekly',metric:'vs_weekly',period:'2026-10-26',created_at:'2026-11-02T01:00:00Z',row_count:3,filename:'weekly.csv'},
 {id:'donations',metric:'donations_weekly',period:'2026-10-26',created_at:'2026-11-02T01:00:00Z',row_count:3,filename:'donations.csv'},
 {id:'previous',metric:'vs_daily',period:'2026-10-19',created_at:'2026-10-20T01:00:00Z',row_count:2,filename:'last-week.csv'},
 {id:'sunday',metric:'vs_daily',period:'2026-11-01',created_at:'2026-11-02T00:00:00Z',row_count:3,filename:'sunday.csv'}
];
test('VS archive keeps Monday-to-Saturday as days 1 to 6 and a separate weekly total',()=>{
 assert.equal(weekOf('2026-10-26'),'2026-10-26');
 assert.equal(weekOf('2026-11-01'),'2026-10-26');
 const slots=vsWeekSlots('2026-10-26',sampleImports);
 assert.equal(slots.length,7);
 assert.deepEqual(slots.slice(0,6).map(x=>x.label),['VS Day 1','VS Day 2','VS Day 3','VS Day 4','VS Day 5','VS Day 6']);
 assert.deepEqual(slots.slice(0,6).map(x=>x.period),['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31']);
 assert.equal(slots[0].import.id,'monday-v2');
 assert.equal(slots[1].import.id,'tuesday');
 assert.equal(slots[2].import,null);
 assert.equal(slots[6].label,'Weekly Total');
 assert.equal(slots[6].import.id,'weekly');
 assert.equal(slots[6].threshold,42_000_000);
 assert.equal(slots[0].threshold,7_200_000);
});
test('the archive is saved per week, includes missing days without treating Sunday as Day 7',()=>{
 const weeks=archivedWeeks(sampleImports);
 assert.equal(weeks.length,2);
 assert.deepEqual(weeks.map(x=>x.week),['2026-10-26','2026-10-19']);
 assert.equal(weeks[0].dailyCount,2);
 assert.equal(weeks[0].hasWeekly,true);
 assert.equal(weeks[1].dailyCount,1);
 assert.equal(weeks[1].hasWeekly,false);
});
test('daily 7.2m and weekly 42m targets flag only strictly below',()=>{
 assert.equal(DAILY_TARGET,7_200_000);
 assert.equal(WEEKLY_TARGET,42_000_000);
 assert.equal(scoreFlag('vs_daily',7_199_999),true);
 assert.equal(scoreFlag('vs_daily',7_200_000),false);
 assert.equal(scoreFlag('vs_daily',7_200_001),false);
 assert.equal(scoreFlag('vs_weekly',41_999_999),true);
 assert.equal(scoreFlag('vs_weekly',42_000_000),false);
 assert.equal(scoreFlag('vs_weekly',42_000_001),false);
 assert.equal(scoreFlag('donations_weekly',0),false);
});
test('full leaderboard contains every player in the imported CSV, ranking and below-target flags',()=>{
 const data={
  imports:[sampleImports[1],sampleImports[3]],
  aliases:[{alias_key:'tiny',member_id:'a'},{alias_key:'old tiny',member_id:'a'},{alias_key:'catalyst',member_id:'b'},{alias_key:'mo',member_id:'c'}],
  members:[{id:'a',display_name:'Tiny'},{id:'b',display_name:'Catalyst'},{id:'c',display_name:'Mo'}],
  values:[
   {import_id:'monday-v2',alias_key:'tiny',original_name:'Tiny',points:7_199_999},
   {import_id:'monday-v2',alias_key:'old tiny',original_name:'old tiny',points:7_100_000},
   {import_id:'monday-v2',alias_key:'catalyst',original_name:'Catalyst',points:7_200_000},
   {import_id:'monday-v2',alias_key:'mo',original_name:'Mo',points:8_000_000},
   {import_id:'weekly',alias_key:'tiny',original_name:'Tiny',points:41_999_999},
   {import_id:'weekly',alias_key:'catalyst',original_name:'Catalyst',points:42_000_000}
  ]
 };
 const daily=vsLeaderboard(data,'vs_daily','2026-10-26');
 assert.equal(daily.length,3);
 assert.deepEqual(daily.map(x=>x.name),['Mo','Catalyst','Tiny']);
 assert.deepEqual(daily.map(x=>x.belowTarget),[false,false,true]);
 assert.equal(daily.find(x=>x.name==='Tiny').duplicate,true);
 assert.deepEqual(daily.map(x=>x.rank),[1,2,3]);
 const weekly=vsLeaderboard(data,'vs_weekly','2026-10-26');
 assert.equal(weekly.length,2);
 assert.equal(weekly[0].name,'Catalyst');
 assert.equal(weekly[0].belowTarget,false);
 assert.equal(weekly[1].belowTarget,true);
 assert.deepEqual(vsLeaderboard(data,'vs_daily','2026-10-28'),[]);
});
test('R4 page shows archive tab, seven click-to-open rows and a score threshold legend',()=>{
 const html=readFileSync(new URL('../lib/r4-stats-page.mjs',import.meta.url),'utf8');
 const app=readFileSync(new URL('../assets/r4-stats.js',import.meta.url),'utf8');
 assert.match(html,/data-tab="vsarchive"/);
 assert.match(html,/id="vs-weeks"/);
 assert.match(html,/id="vs-week-results"/);
 assert.match(html,/Daily under <b>7\.2M<\/b>/);
 assert.match(html,/Weekly under <b>42M<\/b>/);
 assert.match(app,/text\('details'/);
 assert.match(app,/vsLeaderboard\(state\.data/);
 assert.match(app,/showTab\('vsarchive'\)/);
 assert.match(app,/Donations Record/);
});
test('archive listing requires R4 authentication and is restricted to the selected season',async()=>{
 const original={...process.env},oldFetch=globalThis.fetch;
 try{
  process.env.UTW_R4_PASSWORD='tests-vs-week-secret';
  process.env.UTW_SESSION_SECRET='v'.repeat(64);
  process.env.SUPABASE_URL='https://supabase.example.test';
  process.env.SUPABASE_SECRET_KEY='test-db-key';
  let importsCalled=false;
  globalThis.fetch=async url=>{
   const s=String(url);
   if(s.includes('/utw_r4_accounts'))return Response.json([]);
   if(s.includes('/utw_stat_seasons'))return Response.json([{id:'s6',label:'Season 6'}]);
   if(s.includes('/utw_stat_imports')){importsCalled=true;assert.match(s,/season_id=eq.s6/);assert.match(s,/metric=in.%28vs_daily%2Cvs_weekly%29/);return Response.json([sampleImports[1]])}
   return Response.json([]);
  };
  const url='https://utw.example.test/api/r4-stats?archive=1&season=s6';
  assert.equal((await statsGET(new Request(url))).status,401);
  const expiry=String(Date.now()+60_000);
  const signature=createHmac('sha256',process.env.UTW_SESSION_SECRET).update('r4-planner:'+expiry).digest('hex');
  const req=new Request(url,{headers:{Cookie:'utw_r4='+expiry+'.'+signature}});
  const resp=await statsGET(req);
  assert.equal(resp.status,200);
  const body=await resp.json();
  assert.equal(body.season,'s6');
  assert.equal(body.imports[0].filename,'monday-corrected.csv');
  assert.equal(importsCalled,true);
 }finally{globalThis.fetch=oldFetch;for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];for(const [k,v] of Object.entries(original))process.env[k]=v}
});
