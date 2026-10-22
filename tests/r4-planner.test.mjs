import test from 'node:test';
import assert from 'node:assert/strict';
import {GET as getPlanner,POST as postPlanner,authorized} from '../api/r4-planner.mjs';
import {GET as getComments,POST as postComments} from '../api/r4-comments.mjs';

test('Season 6 R4 page and discussions require authentication',async()=>{
  const names=['UTW_R4_PASSWORD','UTW_SESSION_SECRET','SUPABASE_URL','SUPABASE_SECRET_KEY'];
  const previous=Object.fromEntries(names.map(k=>[k,process.env[k]]));
  const originalFetch=globalThis.fetch;
  const site='https://example.com';
  const base=site+'/r4-planner';
  const makeForm=(params,headers={})=>new Request(base,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Origin':site,...headers},body:new URLSearchParams(params)});
  const makeComment=(payload,headers={})=>new Request(site+'/api/r4-comments',{method:'POST',headers:{'Content-Type':'application/json','Origin':site,...headers},body:JSON.stringify(payload)});
  const comment={taskKey:'0-0-0',author:'Tiny',body:'Who is contacting the other servers?'};
  try{
    process.env.UTW_SESSION_SECRET='a-secret-for-unit-tests-only-with-32-characters';
    delete process.env.UTW_R4_PASSWORD;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    assert.equal((await getPlanner(new Request(base))).status,503);
    process.env.UTW_R4_PASSWORD='test-r4-password';
    process.env.SUPABASE_URL='https://database.example.test';
    process.env.SUPABASE_SECRET_KEY='test-service-key';
    globalThis.fetch=async(url,options={})=>{
      const target=String(url);
      if(target.includes('/rpc/utw_buddy_rate_limit'))return Response.json(1);
      if(target.includes('/utw_r4_comments')){
        if(options.method==='POST'){
          const data=JSON.parse(options.body);
          return Response.json([{id:12,...data,created_at:'2026-10-22T10:00:00Z'}]);
        }
        return Response.json([{id:4,task_key:'0-0-0',author:'Catalyst',body:'I can coordinate.',created_at:'2026-10-22T09:00:00Z'}]);
      }
      return new Response('Unknown', {status:404});
    };
    const locked=await getPlanner(new Request(base));
    assert.equal(locked.status,200);
    assert.match(await locked.text(),/R4 passcode/);
    const denied=await postPlanner(makeForm({password:'not-correct'}));
    assert.equal(denied.status,401);
    assert.equal((await postPlanner(makeForm({password:process.env.UTW_R4_PASSWORD},{Origin:'https://attacker.example'}))).status,403);
    const session=await postPlanner(makeForm({password:process.env.UTW_R4_PASSWORD}));
    assert.equal(session.status,303);
    const cookieHeader=session.headers.get('set-cookie');
    assert.match(cookieHeader,/HttpOnly/);
    assert.match(cookieHeader,/SameSite=Strict/);
    assert.match(cookieHeader,/Secure/);
    assert.match(cookieHeader,/Path=\//);
    const cookie=cookieHeader.split(';')[0];
    const authed=new Request(base,{headers:{Cookie:cookie}});
    assert.equal(authorized(authed),true);
    const unlocked=await getPlanner(authed);
    const page=await unlocked.text();
    assert.match(page,/Faction diplomacy/);
    assert.match(page,/Week 7/);
    assert.match(page,/48 hours/);
    assert.match(page,/Checkmarks stay on this browser/);
    assert.match(page,/Shared discussions/);
    assert.match(page,/r4-discussion/);
    assert.equal(unlocked.headers.get('cache-control'),'private, no-store, max-age=0');
    assert.equal(authorized(new Request(base,{headers:{Cookie:cookie.replace(/.$/,'x')}})),false);
    assert.equal((await getComments(new Request(site+'/api/r4-comments?week=0'))).status,401);
    assert.equal((await postComments(makeComment(comment))).status,401);
    const comments=await getComments(new Request(site+'/api/r4-comments?week=0',{headers:{Cookie:cookie}}));
    assert.equal(comments.status,200);
    assert.equal((await comments.json()).comments[0].body,'I can coordinate.');
    const posted=await postComments(makeComment(comment,{Cookie:cookie}));
    assert.equal(posted.status,201);
    assert.equal((await posted.json()).comment.body,comment.body);
    assert.equal((await postComments(makeComment({...comment,taskKey:'99-0-0'},{Cookie:cookie}))).status,400);
    assert.equal((await postComments(makeComment(comment,{Cookie:cookie,Origin:'https://attacker.example'}))).status,403);
    assert.equal((await getComments(new Request(site+'/api/r4-comments?week=99',{headers:{Cookie:cookie}}))).status,400);
    const loggedOut=await postPlanner(makeForm({action:'logout'}));
    assert.equal(loggedOut.status,303);
    assert.match(loggedOut.headers.get('set-cookie'),/Max-Age=0/);
  }finally{
    globalThis.fetch=originalFetch;
    for(const k of names){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k]}
  }
});
