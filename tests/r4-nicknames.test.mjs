import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {GET as pageGet} from '../lib/r4-nicknames-page.mjs';
import {GET as statsGet,POST as statsPost} from '../api/r4-stats.mjs';
import {matchRoster,validateConfirmedRows} from '../assets/r4-ocr-parser.mjs';

const susId='11111111-1111-4111-8111-111111111111';
const couchId='22222222-2222-4222-8222-222222222222';
const roster=[{id:susId,display_name:'Sus'},{id:couchId,display_name:'Fkn Up Your Couch'}];
const aliases=[
 {alias:'Sus',alias_key:'sus',member_id:susId},
 {alias:'Fkn Up Your Couch',alias_key:'fkn up your couch',member_id:couchId}
];
function signedHeaders(){
 process.env.UTW_R4_PASSWORD='test-nicknames-pass';
 process.env.UTW_SESSION_SECRET='x'.repeat(64);
 process.env.SUPABASE_URL='https://database.test';
 process.env.SUPABASE_SECRET_KEY='test-service-role';
 const expiry=String(Date.now()+60000);
 const signature=createHmac('sha256',process.env.UTW_SESSION_SECRET).update('r4-planner:'+expiry).digest('hex');
 return {cookie:'utw_r4='+expiry+'.'+signature};
}
function fakeDb(url,options={}){
 const address=String(url),parsed=new URL(address);
 const path=parsed.pathname,params=parsed.searchParams;
 if(path.endsWith('/rpc/utw_buddy_rate_limit'))return Response.json(1);
 if(path.endsWith('/utw_stat_members')){
  if(options.method==='POST')return Response.json([]);
  if(params.get('id')?.startsWith('eq.'))return Response.json(roster.filter(m=>m.id===params.get('id').slice(3)));
  return Response.json(roster);
 }
 if(path.endsWith('/utw_stat_aliases')){
  if(options.method==='POST')return Response.json([]);
  if(options.method==='DELETE')return new Response(null,{status:204});
  const k=params.get('alias_key')?.slice(3);
  return Response.json(k?aliases.filter(a=>a.alias_key===k):aliases);
 }
 if(path.endsWith('/utw_stat_audit'))return Response.json([]);
 if(path.includes('/r4_')||path.endsWith('/utw_r4_accounts'))return Response.json([]);
 // Auth may query another account endpoint.
 return Response.json([]);
}
test('nicknames page is private and routes through existing R4 server function',async()=>{
 const denied=await pageGet(new Request('https://example.test/r4-nicknames'));
 assert.equal(denied.status,303);
 assert.equal(denied.headers.get('location'),'/r4-planner');
 const apiDenied=await statsGet(new Request('https://example.test/api/r4-stats?nicknames=1'));
 assert.equal(apiDenied.status,401);
 const routes=JSON.parse(readFileSync('vercel.json','utf8'));
 assert(routes.rewrites.some(r=>r.source==='/r4-nicknames'&&r.destination.includes('view=nicknames')));
});
test('authenticated nickname data lists all members and aliases',async()=>{
 const headers=signedHeaders(),saved=globalThis.fetch;globalThis.fetch=fakeDb;
 try{
  const response=await statsGet(new Request('https://example.test/api/r4-stats?nicknames=1',{headers}));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.deepEqual(body.members,roster);
  assert.deepEqual(body.aliases,aliases);
  const page=await pageGet(new Request('https://example.test/r4-nicknames',{headers}));
  assert.equal(page.status,200);
  assert.match(await page.text(),/Nickname Manager/);
 }finally{globalThis.fetch=saved}
});
test('an alias already belonging to a different person is rejected without moving history',async()=>{
 const headers={...signedHeaders(),origin:'https://example.test','content-type':'application/json'},saved=globalThis.fetch;
 globalThis.fetch=fakeDb;
 try{
  const res=await statsPost(new Request('https://example.test/api/r4-stats',{
   method:'POST',headers,body:JSON.stringify({action:'alias',member_id:susId,alias:'Fkn Up Your Couch'})
  }));
  assert.equal(res.status,409);
  const data=await res.json();
  assert.equal(data.existing_member_id,couchId);
 }finally{globalThis.fetch=saved}
});
test('main display name cannot be unlinked as an obsolete nickname',async()=>{
 const headers={...signedHeaders(),origin:'https://example.test','content-type':'application/json'},saved=globalThis.fetch;
 globalThis.fetch=fakeDb;
 try{
  const res=await statsPost(new Request('https://example.test/api/r4-stats',{
   method:'POST',headers,body:JSON.stringify({action:'delete_alias',member_id:susId,alias:'Sus'})
  }));
  assert.equal(res.status,400);
  assert.match((await res.json()).error,/Main member names cannot be removed/);
 }finally{globalThis.fetch=saved}
});
test('after explicit alias linkage, screenshot OCR matches two names to the same member',()=>{
 const linked=aliases.map(a=>a.member_id===couchId?{...a,member_id:susId}:a);
 const members=[{id:susId,display_name:'Sus'}];
 const sus=matchRoster('Sus',members,linked);
 const couch=matchRoster('Fkn Up Your Couch',members,linked);
 assert.equal(sus.id,susId);
 assert.equal(couch.id,susId);
 assert.equal(couch.name,'Sus');
 const upload=validateConfirmedRows([{rows:[
  {name:'Sus',points:1200000,confirmed:true},
  {name:'Sus',points:1200000,confirmed:true}
 ]}]);
 assert.deepEqual(upload,[{name:'Sus',points:1200000}]);
});
test('green pinned self row is excluded from review and import, including stale screenshots',()=>{
 const src=readFileSync('assets/r4-ocr-browser.mjs','utf8');
 assert.match(src,/detected\.filter\(panel=>!panel\.isPinned\)/);
 const result=validateConfirmedRows([{rows:[
  {name:'Mo',points:36192600,confirmed:true,deleted:false,pinned:false},
  {name:'TinyMayhem',points:10610400,confirmed:false,deleted:false,pinned:true}
 ]}]);
 assert.deepEqual(result,[{name:'Mo',points:36192600}]);
});
test('nickname page and server code are valid JavaScript and linked from R4',()=>{
 const files=['assets/r4-nicknames.js','lib/r4-nicknames-page.mjs','assets/r4-ocr-browser.mjs','api/r4-stats.mjs','api/r4-planner.mjs'];
 for(const file of files){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  assert.equal(result.status,0,file+': '+result.stderr);
 }
 const planner=readFileSync('api/r4-planner.mjs','utf8');
 const stats=readFileSync('lib/r4-stats-page.mjs','utf8');
 assert.match(planner,/Nickname Manager/);
 assert.match(stats,/Manage member nicknames/);
});

test('existing-name dropdown and merge confirmation are visible without typing MERGE',()=>{
 const page=readFileSync('lib/r4-nicknames-page.mjs','utf8');
 const script=readFileSync('assets/r4-nicknames.js','utf8');
 assert.match(page,/id="nickname-existing-member"/);
 assert.match(page,/id="nickname-link-existing"/);
 assert.match(page,/id="nickname-new"/);
 assert.match(script,/for\(const member of members\.filter\(m=>m\.id!==keep\)\)/);
 assert.match(script,/Confirm and combine records/);
 assert.match(script,/checkbox\.checked/);
 assert.doesNotMatch(script,/prompt\('This will permanently combine/);
 assert.match(script,/nowLinked/);
 assert.match(script,/originalRemoved/);
});
test('merge API verifies the source member disappears and linked alias moves to target',async()=>{
 const headers={...signedHeaders(),origin:'https://example.test','content-type':'application/json'};
 const saved=globalThis.fetch;
 let activeMembers=roster.map(x=>({...x}));
 let activeAliases=aliases.map(x=>({...x}));
 let merged=false;
 globalThis.fetch=async(url,options={})=>{
  const path=new URL(String(url)).pathname;
  const params=new URL(String(url)).searchParams;
  if(path.endsWith('/rpc/utw_buddy_rate_limit'))return Response.json(1);
  if(path.endsWith('/rpc/utw_stat_merge_members')){
   const args=JSON.parse(options.body);
   assert.equal(args.p_source,couchId);
   assert.equal(args.p_target,susId);
   merged=true;
   activeMembers=activeMembers.filter(m=>m.id!==couchId);
   activeAliases=activeAliases.map(a=>a.member_id===couchId?{...a,member_id:susId}:a);
   return new Response(null,{status:204});
  }
  if(path.endsWith('/utw_stat_members')){
   const id=params.get('id')?.slice(3);
   return Response.json(id?activeMembers.filter(m=>m.id===id):activeMembers);
  }
  if(path.endsWith('/utw_stat_aliases')){
   const id=params.get('member_id')?.slice(3);
   return Response.json(id?activeAliases.filter(a=>a.member_id===id):activeAliases);
  }
  if(path.endsWith('/utw_stat_audit'))return Response.json([{id:'audit'}]);
  return Response.json([]);
 };
 try{
  const response=await statsPost(new Request('https://example.test/api/r4-stats',{
   method:'POST',headers,body:JSON.stringify({action:'merge',source:couchId,target:susId})
  }));
  assert.equal(response.status,200);
  assert.equal(merged,true);
  const payload=await response.json();
  assert.equal(payload.verified,true);
  assert.equal(payload.member_id,susId);
  assert(payload.aliases.includes('Fkn Up Your Couch'));
  assert(payload.aliases.includes('Sus'));
  assert.equal(activeMembers.length,1);
  assert.equal(activeAliases.every(a=>a.member_id===susId),true);
 }finally{globalThis.fetch=saved}
});
test('merge API never returns success when the database merge cannot be verified',async()=>{
 const headers={...signedHeaders(),origin:'https://example.test','content-type':'application/json'};
 const saved=globalThis.fetch;
 globalThis.fetch=async(url,options={})=>{
  const path=new URL(String(url)).pathname,q=new URL(String(url)).searchParams;
  if(path.endsWith('/rpc/utw_buddy_rate_limit'))return Response.json(1);
  if(path.endsWith('/rpc/utw_stat_merge_members'))return new Response(null,{status:204}); // broken no-op
  if(path.endsWith('/utw_stat_members')){
   const id=q.get('id')?.slice(3);
   return Response.json(id?roster.filter(x=>x.id===id):roster);
  }
  if(path.endsWith('/utw_stat_aliases')){
   const id=q.get('member_id')?.slice(3);
   return Response.json(id?aliases.filter(x=>x.member_id===id):aliases);
  }
  return Response.json([]);
 };
 try{
  const response=await statsPost(new Request('https://example.test/api/r4-stats',{
   method:'POST',headers,body:JSON.stringify({action:'merge',source:couchId,target:susId})
  }));
  assert.equal(response.status,409);
  assert.match((await response.json()).error,/could not be fully verified/);
 }finally{globalThis.fetch=saved}
});
