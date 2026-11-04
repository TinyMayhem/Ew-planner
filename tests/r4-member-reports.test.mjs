import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {buildMemberPerformance,selectMemberReports} from '../lib/member-performance.mjs';
import {GET as pageGet} from '../lib/r4-reports-page.mjs';
import {GET as reportGet} from '../api/r4-reports.mjs';

const raw={
 members:[{id:'a',name:'TinyMayhem'},{id:'b',name:'Devi'},{id:'c',name:'FormerMember'}],
 snapshots:[
  {id:'d1',metric:'vs_daily',date:'2026-10-26',season:'post-s5'},
  {id:'d2',metric:'vs_daily',date:'2026-10-27',season:'post-s5'},
  {id:'d3',metric:'vs_daily',date:'2026-10-28',season:'post-s5'},
  {id:'w1',metric:'vs_weekly',date:'2026-10-26',season:'post-s5'},
  {id:'g1',metric:'donations_weekly',date:'2026-10-26',season:'post-s5'}
 ],
 observations:[
  {snapshotId:'d1',memberId:'a',points:7200000},
  {snapshotId:'d2',memberId:'a',points:7100000},
  {snapshotId:'d3',memberId:'a',points:6000000},
  {snapshotId:'d2',memberId:'b',points:0},
  {snapshotId:'w1',memberId:'a',points:41000000},
  {snapshotId:'g1',memberId:'a',points:0}
 ],
 roster:['a','b'],rosterDate:'2026-10-28'
};
test('daily 7.2m exactly meets minimum; two lower days are correctly flagged',()=>{
 const report=buildMemberPerformance(raw);
 const a=report.members.find(x=>x.id==='a');
 assert.equal(a.metrics.vs_daily.recorded,3);
 assert.equal(a.metrics.vs_daily.below,2);
 assert.equal(a.metrics.vs_daily.rate,67);
 assert.equal(a.metrics.vs_daily.consistent,true);
 assert.deepEqual(a.metrics.vs_daily.missedDates,['2026-10-28','2026-10-27']);
 assert.equal(a.metrics.vs_weekly.below,1);
});
test('missing reports and missing rows never imply a zero or a failed minimum',()=>{
 const report=buildMemberPerformance(raw);
 const b=report.members.find(x=>x.id==='b');
 assert.equal(b.metrics.vs_daily.recorded,1);
 assert.equal(b.metrics.vs_daily.missing,2);
 assert.equal(b.metrics.vs_daily.below,1);
 assert.equal(b.metrics.vs_daily.consistent,false);
 assert.equal(b.metrics.vs_weekly.recorded,0);
 assert.equal(b.metrics.vs_weekly.below,0);
 assert.equal(b.metrics.donations_weekly.zero,0);
 assert.equal(report.summary.recordedZeroDonations,1);
 assert.equal(report.summary.rosterCount,2);
});
test('real recorded zero donations differ from no donation uploads',()=>{
 const report=buildMemberPerformance(raw,{minSamples:1});
 const a=report.members.find(x=>x.id==='a');
 assert.equal(a.metrics.donations_weekly.recorded,1);
 assert.equal(a.metrics.donations_weekly.zero,1);
 assert.equal(a.metrics.donations_weekly.consistent,true);
 const noDon=buildMemberPerformance({...raw,snapshots:raw.snapshots.filter(x=>x.id!=='g1'),observations:raw.observations.filter(x=>x.snapshotId!=='g1')});
 assert.equal(noDon.summary.uploads.donations_weekly,0);
 assert.equal(noDon.summary.recordedZeroDonations,0);
});
test('all-time and date-filtered reports support repeated, always, zero and missing filters',()=>{
 const data=buildMemberPerformance(raw,{minSamples:1,missPercent:100});
 assert.equal(selectMemberReports(data,{filter:'always_vs'}).some(x=>x.name==='Devi'),true);
 assert.deepEqual(selectMemberReports(data,{filter:'zero_donations'}).map(x=>x.id),['a']);
 assert.deepEqual(selectMemberReports(data,{filter:'no_donation_data'}).map(x=>x.id),['b']);
 assert.equal(selectMemberReports(data,{filter:'all',search:'tiny'}).length,1);
 const all=buildMemberPerformance(raw,{rosterOnly:false});
 assert.equal(all.summary.rosterCount,3);
 assert.equal(all.members.find(x=>x.id==='c').missingData,true);
});
test('only the newest independent observation per snapshot/member is counted',()=>{
 const changed=structuredClone(raw);
 changed.observations.push({snapshotId:'d2',memberId:'a',points:1000000});
 const data=buildMemberPerformance(changed);
 assert.equal(data.members.find(x=>x.id==='a').metrics.vs_daily.recorded,3);
 assert.equal(data.members.find(x=>x.id==='a').metrics.vs_daily.entries.find(x=>x.date==='2026-10-27').points,7100000);
});
test('UTW reports page and data API deny unauthenticated visitors',async()=>{
 const res=await pageGet(new Request('https://site.test/r4-reports'));
 assert.equal(res.status,303);
 assert.equal(res.headers.get('location'),'/r4-planner');
 const data=await reportGet(new Request('https://site.test/api/r4-reports?to=2026-11-03'));
 assert.equal(data.status,401);
});
test('authenticated reports validate dates and securely query the reporting function',async()=>{
 process.env.UTW_R4_PASSWORD='test-password-for-report';
 process.env.UTW_SESSION_SECRET='x'.repeat(64);
 process.env.SUPABASE_URL='https://database.test';
 process.env.SUPABASE_SECRET_KEY='test-service-only';
 const expiry=String(Date.now()+60000);
 const signature=createHmac('sha256',process.env.UTW_SESSION_SECRET).update('r4-planner:'+expiry).digest('hex');
 const headers={cookie:'utw_r4='+expiry+'.'+signature};
 const invalid=await reportGet(new Request('https://site.test/api/r4-reports?from=2026-99-99&to=2026-11-03',{headers}));
 assert.equal(invalid.status,400);
 let path='',payload=null;
 const before=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  path=String(url);payload=JSON.parse(options.body);
  return Response.json(raw);
 };
 try{
  const res=await reportGet(new Request('https://site.test/api/r4-reports?to=2026-11-03&daily=7200000&weekly=42000000&donations=1',{headers}));
  assert.equal(res.status,200);
  const report=await res.json();
  assert.equal(report.summary.repeatedDaily,1);
  assert.match(path,/rpc\/utw_stat_member_report_data$/);
  assert.deepEqual(payload,{p_from:null,p_to:'2026-11-03',p_season:null});
  const page=await pageGet(new Request('https://site.test/r4-reports',{headers}));
  assert.equal(page.status,200);
  assert.match(await page.text(),/Member Performance Reports/);
 }finally{globalThis.fetch=before}
});
test('private reports route, filters, and export module are valid',()=>{
 const routes=JSON.parse(readFileSync('vercel.json','utf8'));
 assert(routes.rewrites.some(x=>x.source==='/r4-reports'));
 const code=readFileSync('assets/r4-reports.js','utf8');
 for(const id of ['report-from','report-to','report-preset','report-view','report-export'])assert(code.includes(id));
 assert.match(code,/show/i);
 for(const file of ['assets/r4-reports.js','lib/member-performance.mjs','api/r4-reports.mjs']){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
 }
});
