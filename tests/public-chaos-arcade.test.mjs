import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {GET,POST} from '../lib/arcade.mjs';

const html=readFileSync(new URL('../u-dodge.html',import.meta.url),'utf8');
const members=readFileSync(new URL('../members.html',import.meta.url),'utf8');
const buddies=readFileSync(new URL('../api/buddies.mjs',import.meta.url),'utf8');

test('public lobby contains only public game before alliance authentication',()=>{
 assert.match(members,/id="arcadeLobby"/);
 assert.match(members,/href="\/u-dodge.html"/);
 assert.match(members,/id="memberContent" class="container" hidden/);
 assert.match(members,/id="memberGate"/);
 assert.ok(members.indexOf('id="arcadeLobby"')<members.indexOf('id="memberGate"'));
 assert.match(buddies,/const pageAllowed=request=>validSession/);
 assert.doesNotMatch(buddies,/!process\.env\.UTW_PAGE_PASSWORD\|\|validSession/);
});
test('guest name and alliance tag are distinct from existing UTW roster entry',()=>{
 assert.match(html,/id="guestName"/);
 assert.match(html,/id="guestTag"/);
 assert.match(html,/id="player"/);
 assert.match(html,/id="lbGroup"/);
 assert.match(html,/UTW Chaos Arcade is open to everyone!/);
 assert.match(html,/const playerKey=/);
 const code=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
 assert.ok(code,'game script exists');assert.doesNotThrow(()=>new Script(code));
});
test('access status for outsiders does not require or expose database data',async()=>{
 const response=await GET(new Request('https://utwtinyverse.test/api/arcade?view=access'));
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{memberAccess:false});
});
test('server refuses unauthorized attempts to submit as UTW members',async()=>{
 const old={...process.env};const nativeFetch=globalThis.fetch;
 try{
  process.env.UTW_SESSION_SECRET='test-only-nonprod-signing-secret-1234567890';
  process.env.SUPABASE_URL='https://example.invalid';
  process.env.SUPABASE_SECRET_KEY='test-value';
  globalThis.fetch=async url=>new Response(JSON.stringify(1),{status:200,headers:{'content-type':'application/json'}});
  const request=new Request('https://utwtinyverse.test/api/arcade',{method:'POST',headers:{'origin':'https://utwtinyverse.test','content-type':'application/json'},body:JSON.stringify({action:'start',kind:'member',name:'Tiny',mode:'quick'})});
  const response=await POST(request);
  assert.equal(response.status,403);
  assert.match((await response.json()).error,/Unlock UTW member access/);
 }finally{globalThis.fetch=nativeFetch;for(const k of ['UTW_SESSION_SECRET','SUPABASE_URL','SUPABASE_SECRET_KEY']){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
test('guest sessions retain their tag and do not write to the roster',async()=>{
 const old={...process.env};const nativeFetch=globalThis.fetch;let writes=[];
 try{
  process.env.UTW_SESSION_SECRET='test-only-nonprod-signing-secret-1234567890';
  process.env.SUPABASE_URL='https://example.invalid';
  process.env.SUPABASE_SECRET_KEY='test-value';
  globalThis.fetch=async (url,opts)=>{writes.push({url:String(url),opts});return new Response(JSON.stringify(1),{status:200,headers:{'content-type':'application/json'}})};
  const request=new Request('https://utwtinyverse.test/api/arcade',{method:'POST',headers:{origin:'https://utwtinyverse.test','content-type':'application/json'},body:JSON.stringify({action:'start',kind:'guest',name:'NuggetBandit',tag:'VON',mode:'quick'})});
  const response=await POST(request),data=await response.json();
  assert.equal(response.status,200);assert.equal(data.kind,'guest');assert.equal(data.tag,'VON');
  assert.match(data.token,/\./);assert.ok(writes.every(x=>!x.url.includes('utw_stat_members')));
 }finally{globalThis.fetch=nativeFetch;for(const k of ['UTW_SESSION_SECRET','SUPABASE_URL','SUPABASE_SECRET_KEY']){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
