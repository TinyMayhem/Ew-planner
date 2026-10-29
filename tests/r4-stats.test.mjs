
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {GET as pageGet} from '../lib/r4-stats-page.mjs';
import {GET as apiGet,POST as apiPost} from '../api/r4-stats.mjs';

process.env.UTW_R4_PASSWORD='test-passcode-change-me';
process.env.UTW_SESSION_SECRET='x'.repeat(64);
process.env.SUPABASE_URL='https://test.invalid';
process.env.SUPABASE_SECRET_KEY='test-only-secret';
const base='https://example.vercel.app';
function cookie(){
 const expiry=String(Date.now()+60_000);
 const signature=createHmac('sha256',process.env.UTW_SESSION_SECRET).update('r4-planner:'+expiry).digest('hex');
 return 'utw_r4='+expiry+'.'+signature;
}
function req(path,options={}){
 return new Request(base+path,{...options,headers:{cookie:cookie(),...(options.headers||{})}});
}
test('the stats page redirects unauthenticated visitors to R4 login',async()=>{
 const res=await pageGet(new Request(base+'/r4-stats'));
 assert.equal(res.status,303);
 assert.equal(res.headers.get('location'),'/r4-planner');
});
test('authenticated stats page is private and links the client app',async()=>{
 const res=await pageGet(req('/r4-stats'));
 assert.equal(res.status,200);
 assert.match(await res.text(),/Raccoon Receipts/);
 assert.match(res.headers.get('cache-control'),/no-store/);
});
test('data API denies visitors without R4 session',async()=>{
 const res=await apiGet(new Request(base+'/api/r4-stats?week=2026-10-26'));
 assert.equal(res.status,401);
});
test('data API rejects non-Monday weeks without making a database request',async()=>{
 const res=await apiGet(req('/api/r4-stats?week=2026-10-28'));
 assert.equal(res.status,400);
});
test('POST blocks cross-origin edits',async()=>{
 const res=await apiPost(req('/api/r4-stats',{method:'POST',headers:{origin:'https://evil.invalid','content-type':'application/json'},body:JSON.stringify({action:'award'})}));
 assert.equal(res.status,403);
});
test('valid, empty week returns only protected structured records',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async url=>Response.json([]);
 try{
  const res=await apiGet(req('/api/r4-stats?week=2026-10-26'));
  assert.equal(res.status,200);
  const data=await res.json();
  assert.deepEqual(data.members,[]);
  assert.deepEqual(data.imports,[]);
  assert.deepEqual(data.ds,[]);
 }finally{globalThis.fetch=original}
});
test('CSV import rejects duplicate nickname rows instead of double counting',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async url=>Response.json(1);
 try{
  const res=await apiPost(req('/api/r4-stats',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({action:'import',metric:'vs_daily',period:'2026-10-28',filename:'vs.csv',rows:[{name:'Tiny',points:100},{name:'Tiny',points:200}]})}));
  assert.equal(res.status,400);
 }finally{globalThis.fetch=original}
});
