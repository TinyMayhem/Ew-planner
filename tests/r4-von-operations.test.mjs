import test from 'node:test';
import assert from 'node:assert/strict';
import {signedCookie} from '../lib/r4-auth.mjs';
import {GET as plannerGET,authorizedAlliance,authorizedAccess} from '../api/r4-planner.mjs';
import {GET as commentsGET,POST as commentsPOST} from '../api/r4-comments.mjs';
import {GET as statsGET} from '../api/r4-stats.mjs';
import {GET as auditGET} from '../lib/r4-audit-page.mjs';

const site='https://www.utw-example.test';
const sample={
  von:{id:'d5cb31a8-4f4b-490b-8667-fb4383b5a106',username:'von-test',role:'von',display_name:'VON',must_change_password:false,active:true,session_version:1},
  r4:{id:'7bdabdbb-b34c-4245-9ccd-dc90820ec9b4',username:'utw-test',role:'r4',display_name:'UTW',must_change_password:false,active:true,session_version:1},
  admin:{id:'761cb1e7-b0ab-4b4f-8f31-4c79af4131fa',username:'tiny',role:'admin',display_name:'Tiny',must_change_password:false,active:true,session_version:1}
};
const req=(key,path,options={})=>new Request(site+path,{...options,headers:{...options.headers,Cookie:'utw_r4_user='+signedCookie(sample[key])}});
async function setup(fn){
 const original={...process.env},oldFetch=globalThis.fetch;
 process.env.UTW_SESSION_SECRET='this-is-a-long-test-session-secret-abcdefghijk';
 process.env.UTW_R4_PASSWORD='old-shared-only-when-no-accounts';
 process.env.SUPABASE_URL='https://db.utw-test.invalid';
 process.env.SUPABASE_SECRET_KEY='test-db-key';
 const seen=[];
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url),path=u.pathname;
  if(path.endsWith('/utw_r4_accounts')){
   const selected=Object.values(sample).filter(a=>u.searchParams.get('id')==='eq.'+a.id);
   if(u.searchParams.get('id'))return Response.json(selected);
   return Response.json([sample.admin]);
  }
  if(path.endsWith('/utw_r4_comments')){
   const scope=u.searchParams.get('alliance')||'unknown';
   const alliance=scope.includes('von')?'von':'utw';
   if(options.method==='POST'){
    const body=JSON.parse(options.body);
    seen.push({alliance:body.alliance,method:'POST'});
    return Response.json([{...body,id:14,created_at:'2026-10-29T13:00:00Z'}]);
   }
   seen.push({alliance,method:'GET'});
   return Response.json([
    {id:5,task_key:'0-1-0',author:alliance,body:alliance+' private discussion',alliance,created_at:'2026-10-29T11:00:00Z'},
    {id:4,task_key:'0-0-0',author:'faction',body:'Shared land planning',alliance:'faction',created_at:'2026-10-29T10:00:00Z'}
   ]);
  }
  if(path.endsWith('/rpc/utw_buddy_rate_limit'))return Response.json(1);
  if(path.endsWith('/utw_stat_seasons'))return Response.json([{id:'post-s5',label:'Post Season 5'}]);
  return Response.json([]);
 };
 try{await fn(seen)}finally{
  globalThis.fetch=oldFetch;
  for(const k of Object.keys(process.env))if(!(k in original))delete process.env[k];
  for(const [k,v] of Object.entries(original))process.env[k]=v;
 }
}
test('VON sees the duplicated checklist, not UTW task list or UTW stats',()=>setup(async()=>{
 const von=req('von','/r4-planner');
 const page=await plannerGET(von);
 assert.equal(page.status,200);
 const html=await page.text();
 assert.match(html,/VON operations checklist/);
 assert.match(html,/VON readiness/);
 assert.match(html,/von-season6-r4-checks-v1/);
 assert.doesNotMatch(html,/href="\/r4-stats"/);
 assert.equal((await plannerGET(req('von','/r4-planner?alliance=utw'))).status,403);
 assert.equal((await statsGET(req('von','/api/r4-stats?week=2026-10-26'))).status,401);
 assert.equal((await auditGET(req('von','/r4-audit'))).status,403);
 assert.equal(await authorizedAccess(von),false);
 assert.equal(await authorizedAlliance(von,'von'),true);
 assert.equal(await authorizedAlliance(von,'utw'),false);
}));
test('UTW R4 does not get VON access; Tiny owner can switch both',()=>setup(async()=>{
 assert.equal((await plannerGET(req('r4','/r4-planner?alliance=von'))).status,403);
 assert.equal(await authorizedAccess(req('r4','/r4-planner')),true);
 const utwPage=await plannerGET(req('r4','/r4-planner'));
 assert.equal(utwPage.status,200);
 assert.match(await utwPage.text(),/UTW readiness/);
 assert.equal((await plannerGET(req('admin','/r4-planner?alliance=von'))).status,200);
 const owner=await plannerGET(req('admin','/r4-planner?alliance=utw'));
 assert.equal(owner.status,200);
 assert.match(await owner.text(),/VON checklist/);
 assert.equal(await authorizedAlliance(req('admin','/r4-planner'),'von'),true);
}));
test('VON and UTW share faction threads but isolate their other discussions and permissions',()=>setup(async(seen)=>{
 const vonUrl='/api/r4-comments?week=0&alliance=von',utwUrl='/api/r4-comments?week=0&alliance=utw';
 assert.equal((await commentsGET(req('von',utwUrl))).status,403);
 assert.equal((await commentsGET(req('r4',vonUrl))).status,403);
 const vonComments=await commentsGET(req('von',vonUrl));
 assert.equal(vonComments.status,200);
 assert.deepEqual((await vonComments.json()).comments.map(c=>c.author),['faction','von']);
 const utwComments=await commentsGET(req('r4',utwUrl));
 assert.equal(utwComments.status,200);
 assert.deepEqual((await utwComments.json()).comments.map(c=>c.author),['faction','utw']);
 const post=(key,alliance)=>req(key,'/api/r4-comments',{method:'POST',headers:{Origin:site,'Content-Type':'application/json'},body:JSON.stringify({taskKey:'0-0-0',author:'Test',body:'Alliance comment',alliance})});
 assert.equal((await commentsPOST(post('von','utw'))).status,403);
 assert.equal((await commentsPOST(post('r4','von'))).status,403);
 assert.equal((await commentsPOST(post('von','von'))).status,201);
 assert.deepEqual(seen.filter(s=>s.method==='GET').map(s=>s.alliance),['von','utw']);
 assert.deepEqual(seen.filter(s=>s.method==='POST').map(s=>s.alliance),['faction']);
 assert.equal((await commentsGET(new Request(site+vonUrl))).status,401);
}));
