import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {GET} from '../api/r4-stats.mjs';
import {buildTrainAdvice} from '../lib/train-advice.mjs';

const ids={tiny:'11111111-1111-4111-8111-111111111111',devi:'22222222-2222-4222-8222-222222222222',report:'33333333-3333-4333-8333-333333333333'};
function auth(){
 process.env.UTW_R4_PASSWORD='test-passphrase';
 process.env.UTW_SESSION_SECRET='x'.repeat(64);
 process.env.SUPABASE_URL='https://database.test';
 process.env.SUPABASE_SECRET_KEY='test-service-key';
 const expiry=String(Date.now()+60000);
 const hmac=createHmac('sha256',process.env.UTW_SESSION_SECRET).update('r4-planner:'+expiry).digest('hex');
 return {cookie:'utw_r4='+expiry+'.'+hmac};
}
function backend(queries,weeklyExists=true){
 return async (url,options={})=>{
  const u=new URL(String(url)),q=u.searchParams,route=u.pathname;
  queries.push({route,params:Object.fromEntries(q)});
  if(route.endsWith('/rpc/utw_stat_member_report_data'))return Response.json({
   snapshots:[
    {id:'vs-a',metric:'vs_daily',date:'2026-11-06'},
    {id:'vs-b',metric:'vs_weekly',date:'2026-11-02'},
    {id:'vs-c',metric:'vs_daily',date:'2026-11-07'},
    {id:'donation',metric:'donations_weekly',date:'2026-11-02'}],
   observations:[
    {snapshotId:'vs-a',memberId:ids.tiny},
    {snapshotId:'vs-b',memberId:ids.tiny},
    {snapshotId:'vs-c',memberId:ids.tiny},
    {snapshotId:'vs-c',memberId:ids.devi},
    {snapshotId:'donation',memberId:ids.devi}],
   roster:[ids.tiny,ids.devi],rosterDate:'2026-11-07'
  });
  if(route.endsWith('/utw_stat_members'))return Response.json([{id:ids.tiny,display_name:'TinyMayhem'},{id:ids.devi,display_name:'Devi'}]);
  if(route.endsWith('/utw_stat_aliases'))return Response.json([{alias_key:'tinymayhem',alias:'TinyMayhem',member_id:ids.tiny},{alias_key:'devi',alias:'Devi',member_id:ids.devi}]);
  if(route.endsWith('/utw_stat_imports')){
   if(q.get('metric')==='eq.vs_weekly'&&['eq.2026-11-09','eq.2026-11-16'].includes(q.get('period'))&&weeklyExists)
    return Response.json([{id:ids.report,period:q.get('period').slice(3),row_count:2,created_at:'2026-11-21T22:00:00Z'}]);
   return Response.json([]);
  }
  if(route.endsWith('/utw_stat_values'))return Response.json([
   {alias_key:'tinymayhem',points:79000000},
   {alias_key:'devi',points:84000000}
  ]);
  if(route.endsWith('/utw_stat_train_legacy')||route.endsWith('/utw_stat_awards')||route.endsWith('/utw_stat_exceptions'))return Response.json([]);
  return Response.json([]);
 };
}
test('VS train desk requests previous completed week VS weekly totals, not daily scores',async()=>{
 const queries=[],saved=globalThis.fetch;globalThis.fetch=backend(queries);
 try{
  const response=await GET(new Request('https://test.example/api/r4-stats?train_advice=1&date=2026-11-22&mode=vs&slot=VS%20MVP',{headers:auth()}));
  assert.equal(response.status,200);
  const advice=await response.json();
  assert.equal(advice.dataDate,'2026-11-09');
  assert.equal(advice.recommended.name,'Devi');
  assert.deepEqual(advice.candidates.map(x=>x.points),[84000000,79000000]);
  assert.match(advice.context,/completed VS weekly total/);
  assert.equal(queries.filter(x=>x.route.endsWith('/utw_stat_imports')).length,1);
  const reportQuery=queries.find(x=>x.route.endsWith('/utw_stat_imports')).params;
  assert.equal(reportQuery.metric,'eq.vs_weekly');
  assert.equal(reportQuery.period,'eq.2026-11-09');
  assert(!queries.some(x=>x.params.metric==='eq.vs_daily'));
 }finally{globalThis.fetch=saved}
});
test('VS train recommendations do not fall back to daily scores when weekly totals are missing',async()=>{
 const queries=[],saved=globalThis.fetch;globalThis.fetch=backend(queries,false);
 try{
  const response=await GET(new Request('https://test.example/api/r4-stats?train_advice=1&date=2026-11-22&mode=vs',{headers:auth()}));
  assert.equal(response.status,200);
  const advice=await response.json();
  assert.equal(advice.recommended,null);
  assert.equal(advice.candidates.length,0);
  assert.match(advice.context,/No completed VS weekly total/);
  assert(!queries.some(x=>x.params.metric==='eq.vs_daily'));
 }finally{globalThis.fetch=saved}
});
test('Saturday VS train uses current-week weekly total, never previous-week or daily points',async()=>{
 const queries=[],saved=globalThis.fetch;globalThis.fetch=backend(queries);
 try{
  const response=await GET(new Request('https://test.example/api/r4-stats?train_advice=1&date=2026-11-21&mode=vs&season=s6',{headers:auth()}));
  assert.equal(response.status,200);
  const advice=await response.json();
  assert.equal(advice.dataDate,'2026-11-16');
  assert.equal(advice.saturdayVs,true);
  assert.equal(advice.recommended.name,'Devi');
  assert.equal(advice.recommendedVip.name,'TinyMayhem');
  assert.equal(advice.vipCandidates[0].name,'Devi');
  assert.equal(advice.vipCandidates[1].name,'TinyMayhem');
  assert.match(advice.context,/this week's VS weekly total/);
  const importQuery=queries.find(x=>x.route.endsWith('/utw_stat_imports')).params;
  assert.equal(importQuery.period,'eq.2026-11-16');
  assert.equal(importQuery.metric,'eq.vs_weekly');
  assert.equal(importQuery.season_id,'eq.s6');
  assert(!queries.some(x=>x.params.metric==='eq.vs_daily'));
 }finally{globalThis.fetch=saved}
});
test('Saturday VS with no current-week total does not silently fall back to another week',async()=>{
 const queries=[],saved=globalThis.fetch;globalThis.fetch=backend(queries,false);
 try{
  const response=await GET(new Request('https://test.example/api/r4-stats?train_advice=1&date=2026-11-21&mode=vs',{headers:auth()}));
  const advice=await response.json();
  assert.equal(advice.recommended,null);
  assert.equal(advice.recommendedVip,null);
  assert.match(advice.context,/No VS weekly total has been uploaded for this Saturday/);
  assert.equal(queries.find(x=>x.route.endsWith('/utw_stat_imports')).params.period,'eq.2026-11-16');
 }finally{globalThis.fetch=saved}
});
test('Saturday VS skips used Stage conductors and same-week VIPs, but not past VIPs when choosing driver',()=>{
 const members=['Alpha','Bravo','Charlie','Delta'].map((name,i)=>({id:String(i+1),display_name:name}));
 const result=buildTrainAdvice({
  date:'2026-11-21',mode:'vs',vipMode:'stage',members,scoreDate:'2026-11-16',
  scoreboard:[{member_id:'1',points:100},{member_id:'2',points:90},{member_id:'3',points:80},{member_id:'4',points:70}],
  awards:[
   {train_date:'2026-11-17',member_id:'1',vip_member_id:'4',source:'manual',slot:'Roulette'},
   {train_date:'2026-11-19',member_id:'4',vip_member_id:'2',source:'manual',slot:'Train'}
  ]
 });
 assert.equal(result.candidates[0].eligible,false);
 assert.equal(result.recommended.name,'Bravo'); // Was VIP this week but can conduct.
 assert.equal(result.recommended.place,2);
 assert.equal(result.recommendedVip.name,'Charlie'); // Next VS rank.
 assert.equal(result.recommendedVip.vsRank,3);
 assert.equal(result.vipCandidates.find(x=>x.id==='2').eligible,false);
 assert.equal(result.vipCandidates.find(x=>x.id==='4').eligible,false);
 assert.deepEqual(result.vipCandidates.map(x=>x.name),['Alpha','Bravo','Charlie','Delta']);
});
test('Saturday VS VIP cap only spans current week even when Stage VIP preference is enabled',()=>{
 const members=[{id:'1',display_name:'Alpha'},{id:'2',display_name:'Bravo'}];
 const result=buildTrainAdvice({date:'2026-11-21',mode:'vs',vipMode:'stage',members,scoreDate:'2026-11-16',
  scoreboard:[{member_id:'1',points:100},{member_id:'2',points:90}],
  awards:[{train_date:'2026-11-09',member_id:'2',vip_member_id:'1',source:'manual',slot:'Train'}]
 });
 assert.equal(result.recommended.name,'Alpha');
 assert.equal(result.recommendedVip.name,'Bravo');
 assert.equal(result.vipCandidates.find(x=>x.id==='1').eligible,true); // Last week's VIP is not barred this week.
});
test('Spanish labels preserve actual member names and weeks without translating source records',async()=>{
 const {translateR4Text}=await import('../assets/r4-es-core.mjs');
 const {ES_CHECKLIST}=await import('../assets/r4-es-checklists.mjs');
 assert.equal(translateR4Text('Train Desk'),'Gestión de trenes');
 assert.equal(translateR4Text('Weekly VS total (previous completed week)'),'Total VS semanal (semana anterior completada)');
 assert.equal(translateR4Text('Stage 16'),'Etapa 16');
 assert.equal(translateR4Text('TinyMayhem'),'TinyMayhem');
 assert.equal(translateR4Text('트로이Roy'),'트로이Roy');
 assert.equal(translateR4Text('秋犬大哥'),'秋犬大哥');
 assert.equal(translateR4Text('Train Desk','en'),'Train Desk');
 assert.equal(ES_CHECKLIST['Season settlement & after-action review'],'Cierre de temporada y evaluación final');
 assert.equal(ES_CHECKLIST['Confirm all eight participating servers and their two factions'],'Confirmar los ocho servidores participantes y sus dos facciones');
});

test('never-had API uses distinct active VS reports as tenure tie-breaker',async()=>{
 const queries=[],saved=globalThis.fetch;globalThis.fetch=backend(queries);
 try{
  const response=await GET(new Request('https://test.example/api/r4-stats?train_advice=1&date=2026-11-22&mode=never',{headers:auth()}));
  assert.equal(response.status,200);
  const advice=await response.json();
  assert.equal(advice.recommended.name,'TinyMayhem');
  assert.deepEqual(advice.candidates.map(x=>x.name),['TinyMayhem','Devi']);
  assert.match(advice.candidates[0].notes.join(' '),/3 archived VS reports/);
  assert.equal(advice.candidates[1].vsRecords,undefined);
  assert.equal(queries.filter(x=>x.route.endsWith('/rpc/utw_stat_member_report_data')).length,1);
 }finally{globalThis.fetch=saved}
});
