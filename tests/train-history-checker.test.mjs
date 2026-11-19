import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {trainHistoryRows,memberTrainHistory,compareTrainWait} from '../lib/train-history-checker.mjs';
import {GET} from '../api/r4-stats.mjs';
import {signedCookie} from '../lib/r4-auth.mjs';
import {latestThpSnapshotDate} from '../assets/r4-thp-roles.mjs';

const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const c='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const members=[{id:a,display_name:'CalllMeBaba'},{id:b,display_name:'Savvy'},{id:c,display_name:'Unrecorded'}];
const aliases=[{member_id:a,alias:'Baba',alias_key:'baba'}];
const awards=[
 {train_date:'2026-11-15',member_id:b,vip_member_id:a,source:'vs',slot:'VS winner'},
 {train_date:'2026-12-10',member_id:a,vip_member_id:b,source:'r4',slot:'Future train'}
];
const legacy=[
 {train_date:'2026-10-01',driver_name:'Baba',vip_name:'Savvy',source:'donations',selection_label:'Top donor'},
 {train_date:'2026-10-20',driver_name:'Savvy',vip_name:'Baba',source:'ds',selection_label:'Event MVP'},
 // Legacy on the same date is superseded by a final R4 save.
 {train_date:'2026-11-15',driver_name:'Baba',vip_name:'Savvy',source:'vs',selection_label:'Outdated sheet'},
 {train_date:'2026-09-18',driver_name:'Unlinked Historic',vip_name:'',source:'manual',selection_label:'Old train'}
];
test('full history reconciles legacy and final saves and maps only verified aliases',()=>{
 const data=trainHistoryRows({awards,legacy,members,aliases});
 assert.equal(data.rows.length,5); // 2 awards + 3 non-superseded legacy entries
 assert.equal(data.unlinkedLegacyCount,1);
 assert.equal(data.earliestRecordedDate,'2026-09-18');
 assert.equal(data.rows.filter(x=>x.date==='2026-11-15').length,1);
 assert.equal(data.rows.find(x=>x.date==='2026-10-01').conductorId,a);
 const baba=memberTrainHistory({memberId:a,rows:data.rows,today:'2026-11-18'});
 assert.equal(baba.total,3);
 assert.equal(baba.lastAny,'2026-11-15');
 assert.equal(baba.lastConductor,'2026-10-01');
 assert.equal(baba.lastVip,'2026-11-15');
 assert.equal(baba.daysSinceLast,3);
 assert.equal(baba.conductorCount,1);
 assert.equal(baba.vipCount,2);
 assert.equal(baba.future.length,1);
 assert.equal(baba.future[0].role,'conductor');
 const sav=memberTrainHistory({memberId:b,rows:data.rows,today:'2026-11-18'});
 assert.equal(sav.total,3);
 assert.equal(sav.lastConductor,'2026-11-15');
 assert.equal(sav.lastVip,'2026-10-01');
 assert.equal(sav.lastAny,'2026-11-15');
 assert.equal(sav.future.length,1);
});
test('comparison supports either role, conductor only, VIP only, ties and missing history',()=>{
 const {rows}=trainHistoryRows({awards,legacy,members,aliases});
 const baba=memberTrainHistory({memberId:a,rows,today:'2026-11-18'});
 const savvy=memberTrainHistory({memberId:b,rows,today:'2026-11-18'});
 const unknown=memberTrainHistory({memberId:c,rows,today:'2026-11-18'});
 assert.equal(compareTrainWait(baba,savvy,'any').tie,true);
 assert.equal(compareTrainWait(baba,savvy,'conductor').winnerId,a);
 assert.equal(compareTrainWait(baba,savvy,'vip').winnerId,b);
 assert.equal(compareTrainWait(unknown,baba,'any').winnerId,c);
 assert.equal(compareTrainWait(unknown,baba,'any').unverified,true);
 assert.equal(compareTrainWait(unknown,unknown,'any').tie,true);
 assert.equal(compareTrainWait(baba,null,'any'),null);
});
test('Train Desk checker is a separate searchable, read-only card with comparison scope',()=>{
 const page=readFileSync('lib/r4-stats-page.mjs','utf8');
 const js=readFileSync('assets/r4-stats.js','utf8');
 const frontend=readFileSync('assets/r4-train-history-checker.mjs','utf8');
 const api=readFileSync('api/r4-stats.mjs','utf8');
 for(const id of ['train-history-checker','train-check-first','train-check-second','train-check-role','train-check-results','train-check-status'])
  assert.ok(page.includes('id="'+id+'"'),'Missing '+id);
 assert.ok(page.includes('Either conductor or VIP'));
 assert.match(js,/trainHistoryChecker=initTrainHistoryChecker/);
 assert.match(js,/trainHistoryChecker\?\.refresh\(\)/);
 assert.match(frontend,/matchConductors/);
 assert.match(frontend,/role\.addEventListener\('change'/);
 assert.match(api,/train_history_checker/);
 assert.match(api,/authorizedAccess\(request\)/);
 for(const path of ['lib/train-history-checker.mjs','assets/r4-train-history-checker.mjs','assets/r4-stats.js','api/r4-stats.mjs']){
  const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  assert.equal(result.status,0,path+': '+result.stderr);
 }
});
test('full archive checker requires R4 login, validates input and ignores unrelated stage/week selection',async()=>{
 const saved={...process.env},prevFetch=globalThis.fetch;
 const actor={id:'52d4d198-29c8-45b8-a0ac-7012882bf005',username:'tiny',display_name:'Tiny',role:'admin',active:true,must_change_password:false,session_version:1};
 try{
  process.env.UTW_SESSION_SECRET='test-train-checker-session-secret-over-32-characters';
  process.env.SUPABASE_URL='https://db.example.invalid';
  process.env.SUPABASE_SECRET_KEY='test-private-db-secret';
  const endpoint='https://example.com/api/r4-stats?train_history_checker=1&first='+a+'&second='+b+'&role=vip';
  assert.equal((await GET(new Request(endpoint))).status,401);
  const calls=[];
  globalThis.fetch=async(url,opts={})=>{
   const path=new URL(url).pathname;
   calls.push({path,query:new URL(url).searchParams});
   if(path.endsWith('/utw_r4_accounts'))return Response.json([actor]);
   if(path.endsWith('/utw_stat_members'))return Response.json(members);
   if(path.endsWith('/utw_stat_aliases'))return Response.json(aliases);
   if(path.endsWith('/utw_stat_awards'))return Response.json(awards);
   if(path.endsWith('/utw_stat_train_legacy'))return Response.json(legacy);
   throw Error('Unexpected query '+path);
  };
  const cookie='utw_r4_user='+signedCookie(actor);
  const bad=new Request(endpoint.replace('role=vip','role=admin'),{headers:{Cookie:cookie}});
  assert.equal((await GET(bad)).status,400);
  const res=await GET(new Request(endpoint,{headers:{Cookie:cookie}}));
  assert.equal(res.status,200);
  const data=await res.json();
  assert.equal(data.role,'vip');
  assert.equal(data.today,latestThpSnapshotDate());
  assert.equal(data.first.name,'CalllMeBaba');
  assert.equal(data.first.history.some(x=>x.date==='2026-10-01'&&x.role==='conductor'),true);
  assert.equal(data.first.future.some(x=>x.date==='2026-12-10'),true);
  assert.equal(data.unlinkedLegacyCount,1);
  assert.equal(data.comparison.winnerId,b);
  for(const path of ['/utw_stat_awards','/utw_stat_train_legacy'])
   assert.ok(calls.some(x=>x.path.endsWith(path)&&x.query.get('limit')==='2000'));
 }finally{
  globalThis.fetch=prevFetch;
  for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];
  for(const [key,value] of Object.entries(saved))process.env[key]=value;
 }
});
