import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {GET} from '../api/r4-stats.mjs';

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
  if(route.endsWith('/utw_stat_members'))return Response.json([{id:ids.tiny,display_name:'TinyMayhem'},{id:ids.devi,display_name:'Devi'}]);
  if(route.endsWith('/utw_stat_aliases'))return Response.json([{alias_key:'tinymayhem',alias:'TinyMayhem',member_id:ids.tiny},{alias_key:'devi',alias:'Devi',member_id:ids.devi}]);
  if(route.endsWith('/utw_stat_imports')){
   if(q.get('metric')==='eq.vs_weekly'&&q.get('period')==='eq.2026-11-09'&&weeklyExists)
    return Response.json([{id:ids.report,period:'2026-11-09',row_count:2,created_at:'2026-11-16T04:00:00Z'}]);
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
  assert.equal(response.status,200,await response.text().catch(()=>'')); // response body already read only in failures
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
