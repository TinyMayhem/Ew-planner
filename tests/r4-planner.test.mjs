import test from 'node:test';
import assert from 'node:assert/strict';
import {GET,POST,authorized} from '../api/r4-planner.mjs';

test('R4 command centre requires an independent passcode and a valid signed session',async()=>{
  const names=['UTW_R4_PASSWORD','UTW_SESSION_SECRET','SUPABASE_URL','SUPABASE_SECRET_KEY'];
  const previous=Object.fromEntries(names.map(k=>[k,process.env[k]]));
  const restore=()=>{for(const k of names){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k]}};
  const base='https://example.com/r4-planner';
  const form=(params,headers={})=>new Request(base,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Origin':'https://example.com',...headers},body:new URLSearchParams(params)});
  try{
    delete process.env.UTW_R4_PASSWORD;
    process.env.UTW_SESSION_SECRET='a-secret-for-unit-tests-only-with-32-characters';
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    assert.equal((await GET(new Request(base))).status,503);
    process.env.UTW_R4_PASSWORD='r4-test-password-keep-private-2026';
    const locked=await GET(new Request(base));
    assert.equal(locked.status,200);
    assert.match(await locked.text(),/R4 passcode/);
    const rejected=await POST(form({password:'wrong-passcode-123456'}));
    assert.equal(rejected.status,401);
    const csrf=await POST(form({password:process.env.UTW_R4_PASSWORD},{Origin:'https://attacker.example'}));
    assert.equal(csrf.status,403);
    const signed=await POST(form({password:process.env.UTW_R4_PASSWORD}));
    assert.equal(signed.status,303);
    assert.equal(signed.headers.get('location'),'/r4-planner');
    assert.match(signed.headers.get('set-cookie'),/HttpOnly/);
    assert.match(signed.headers.get('set-cookie'),/SameSite=Strict/);
    assert.match(signed.headers.get('set-cookie'),/Secure/);
    const cookie=signed.headers.get('set-cookie').split(';')[0];
    const authed=new Request(base,{headers:{Cookie:cookie}});
    assert.equal(authorized(authed),true);
    const unlocked=await GET(authed);
    const body=await unlocked.text();
    assert.match(body,/Faction diplomacy/);
    assert.match(body,/Week 7/);
    assert.match(body,/48 hours/);
    assert.match(body,/saved only in this browser/);
    assert.equal(unlocked.headers.get('cache-control'),'private, no-store, max-age=0');
    assert.equal(authorized(new Request(base,{headers:{Cookie:cookie.replace(/.$/,'x')}})),false);
    const loggedOut=await POST(form({action:'logout'}));
    assert.equal(loggedOut.status,303);
    assert.match(loggedOut.headers.get('set-cookie'),/Max-Age=0/);
  }finally{restore()}
});
