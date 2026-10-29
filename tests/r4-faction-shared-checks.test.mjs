import test from 'node:test';
import assert from 'node:assert/strict';
import {signedCookie,r4Username} from '../lib/r4-auth.mjs';
import {weeks} from '../api/r4-planner.mjs';
import {isFactionTask,scopeForTask} from '../lib/r4-workspace.mjs';
import {GET as checkGET,POST as checkPOST} from '../api/r4-comments.mjs';
import {GET as commentGET,POST as commentPOST} from '../api/r4-comments.mjs';
import {GET as statsGET} from '../api/r4-stats.mjs';

const site='https://utw.test.example';
const users={
 von:{id:'712c87a2-8f42-4db7-96b6-b7ab9af63120',username:'disco panda',role:'von',active:true,must_change_password:false,session_version:1},
 utw:{id:'b5e0f425-17b7-42eb-9783-31bd8ee6f879',username:'catalyst',role:'r4',active:true,must_change_password:false,session_version:1},
 owner:{id:'37754d30-7b25-4e68-bc51-0f0f8ab8b1bd',username:'tiny',role:'admin',active:true,must_change_password:false,session_version:1}
};
const request=(user,path,method='GET',body)=>new Request(site+path,{method,headers:{Cookie:'utw_r4_user='+signedCookie(users[user]),...(method==='POST'?{'Content-Type':'application/json',Origin:site}:{})},...(method==='POST'?{body:JSON.stringify(body)}:{})});
async function environment(task){
 const prior={...process.env},saved=globalThis.fetch,changes=[],state=new Map();
 process.env.UTW_SESSION_SECRET='test-secret-value-more-than-thirty-two-chars';
 process.env.UTW_R4_PASSWORD='fake-legacy-for-tests';
 process.env.SUPABASE_URL='https://fake-db.utw.invalid';
 process.env.SUPABASE_SECRET_KEY='test-only';
 globalThis.fetch=async(url,options={})=>{
  const target=new URL(String(url)),path=target.pathname;
  if(path.endsWith('/utw_r4_accounts'))return Response.json(Object.values(users).filter(u=>target.searchParams.get('id')==='eq.'+u.id));
  if(path.endsWith('/utw_r4_task_state')){
   if(options.method==='POST'){
    const rows=JSON.parse(options.body);
    for(const row of rows){state.set(row.scope+'|'+row.task_key,row);changes.push(row)}
    return Response.json(rows);
   }
   const valid=(target.searchParams.get('scope')||'').match(/in\.\(([^)]+)\)/)?.[1].split(',')||[];
   const week=Number((target.searchParams.get('task_key')||'').replace(/^like\./,'').split('-')[0]);
   return Response.json([...state.values()].filter(x=>valid.includes(x.scope)&&x.task_key.startsWith(week+'-')));
  }
  if(path.endsWith('/utw_r4_comments')){
   if(options.method==='POST'){
    const post=JSON.parse(options.body);changes.push(post);
    return Response.json([{id:1,...post,created_at:'2026-10-29T15:00:00Z'}]);
   }
   const values=(target.searchParams.get('alliance')||'').match(/in\.\(([^)]+)\)/)?.[1].split(',')||[];
   return Response.json([
    {id:1,task_key:'0-0-0',alliance:'faction',author:'Tiny',body:'Shared border planning',created_at:'2026-10-29T10:00:00Z'},
    {id:2,task_key:'0-1-0',alliance:'utw',author:'Crum',body:'UTW private planning',created_at:'2026-10-29T11:00:00Z'},
    {id:3,task_key:'0-1-0',alliance:'von',author:'Panda',body:'VON private planning',created_at:'2026-10-29T11:00:00Z'}
   ].filter(c=>values.includes(c.alliance)));
  }
  if(path.endsWith('/rpc/utw_buddy_rate_limit'))return Response.json(1);
  return Response.json([]);
 };
 try{await task({changes,state})}finally{
  globalThis.fetch=saved;
  for(const k of Object.keys(process.env))if(!(k in prior))delete process.env[k];
  for(const [k,v] of Object.entries(prior))process.env[k]=v;
 }
}
test('Disco panda is accepted as a multiword username but not as a UTW login',()=>{
 assert.equal(r4Username('Disco panda'),'disco panda');
 assert.equal(r4Username('  Disco   panda  '),'disco panda');
 assert.equal(r4Username('bad@user'),null);
});
test('only faction land planning groups are cross-alliance shared',()=>{
 assert.equal(isFactionTask('0-0-0',weeks),true);
 assert.equal(isFactionTask('5-0-0',weeks),true);
 assert.equal(isFactionTask('8-0-0',weeks),true);
 assert.equal(isFactionTask('9-0-0',weeks),false);
 assert.equal(isFactionTask('0-1-0',weeks),false);
 assert.equal(scopeForTask('von','0-0-0',weeks),'faction');
 assert.equal(scopeForTask('utw','0-0-0',weeks),'faction');
 assert.equal(scopeForTask('von','0-1-0',weeks),'von');
 assert.equal(scopeForTask('utw','0-1-0',weeks),'utw');
 assert.equal(scopeForTask('von','0-200-0',weeks),null);
});
test('shared faction tick is visible to both, UTW-only tick not visible to VON',()=>environment(async({state})=>{
 const post=(user,taskKey,completed)=>checkPOST(request(user,'/api/r4-comments?checks=1','POST',{alliance:user,action:'toggle',taskKey,completed}));
 assert.equal((await post('von','0-0-0',true)).status,200);
 assert.equal((await post('utw','0-1-0',true)).status,200);
 assert.equal(state.get('faction|0-0-0').completed,true);
 assert.equal(state.get('utw|0-1-0').completed,true);
 const von=await checkGET(request('von','/api/r4-comments?checks=1&alliance=von&week=0'));
 assert.equal(von.status,200);
 assert.deepEqual((await von.json()).items.map(x=>x.task_key),['0-0-0']);
 const utw=await checkGET(request('utw','/api/r4-comments?checks=1&alliance=utw&week=0'));
 assert.deepEqual((await utw.json()).items.map(x=>x.task_key),['0-0-0','0-1-0']);
 assert.equal((await checkGET(request('von','/api/r4-comments?checks=1&alliance=utw&week=0'))).status,403);
 assert.equal((await checkGET(new Request(site+'/api/r4-comments?checks=1&alliance=von&week=0'))).status,401);
 assert.equal((await statsGET(request('von','/api/r4-stats?week=2026-10-26'))).status,401);
}));
test('reset one alliance week clears shared faction and own private tasks only',()=>environment(async({state})=>{
 state.set('faction|0-0-0',{scope:'faction',task_key:'0-0-0',completed:true});
 state.set('utw|0-1-0',{scope:'utw',task_key:'0-1-0',completed:true});
 state.set('von|0-1-0',{scope:'von',task_key:'0-1-0',completed:true});
 const response=await checkPOST(request('von','/api/r4-comments?checks=1','POST',{alliance:'von',action:'reset_week',week:0}));
 assert.equal(response.status,200);
 assert.equal(state.get('faction|0-0-0').completed,false);
 assert.equal(state.get('von|0-1-0').completed,false);
 assert.equal(state.get('utw|0-1-0').completed,true);
}));
test('faction comment is shared but private discussion is never exposed to the other alliance',()=>environment(async({changes})=>{
 const v=await commentGET(request('von','/api/r4-comments?alliance=von&week=0'));
 assert.equal(v.status,200);
 assert.deepEqual((await v.json()).comments.map(c=>c.author),['Panda','Tiny']);
 const u=await commentGET(request('utw','/api/r4-comments?alliance=utw&week=0'));
 assert.deepEqual((await u.json()).comments.map(c=>c.author),['Crum','Tiny']);
 const post=(user,key)=>commentPOST(request(user,'/api/r4-comments','POST',{alliance:user,taskKey:key,author:'Panda',body:'test'}));
 assert.equal((await post('von','0-0-0')).status,201);
 assert.equal(changes[0].alliance,'faction');
 assert.equal((await post('von','0-1-0')).status,201);
 assert.equal(changes[1].alliance,'von');
}));
test('site checklist import validates source keys and requires access',()=>environment(async()=>{
 const result=await checkPOST(request('utw','/api/r4-comments?checks=1','POST',{action:'import_checked',alliance:'utw',keys:['0-0-0','0-1-0']}));
 assert.equal(result.status,200);
 assert.equal((await checkPOST(request('von','/api/r4-comments?checks=1','POST',{action:'import_checked',alliance:'utw',keys:['0-0-0']}))).status,403);
 assert.equal((await checkPOST(request('utw','/api/r4-comments?checks=1','POST',{action:'import_checked',alliance:'utw',keys:['0-0-0','0-0-0']}))).status,400);
}));
