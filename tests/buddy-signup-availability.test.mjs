import test from 'node:test';
import assert from 'node:assert/strict';
import {GET,POST} from '../api/buddies.mjs';
import {emptyBoard,sessionToken,adminPasswordOK} from '../lib/buddies.mjs';

test('Buddy Board login and member read stay available with no admin password configured',async()=>{
 const original={...process.env},nativeFetch=globalThis.fetch;
 try {
  process.env.SUPABASE_URL='https://example.invalid';
  process.env.SUPABASE_SECRET_KEY='test-only-service-key';
  process.env.UTW_SESSION_SECRET='unit-test-session-secret-is-at-least-32-characters';
  process.env.UTW_PAGE_PASSWORD='AB12';
  delete process.env.UTW_ADMIN_PASSWORD;
  globalThis.fetch=async (url)=>{
   if(String(url).includes('rpc/utw_buddy_rate_limit'))return new Response(JSON.stringify(1),{status:200});
   if(String(url).includes('utw_buddy_board'))return new Response(JSON.stringify([{revision:0,data:emptyBoard()}]),{status:200});
   throw Error('Unexpected database call');
  };
  const locked=await GET(new Request('https://utwtinyverse.test/api/buddies'));
  assert.equal((await locked.json()).locked,true,'outsiders stay locked out');
  const login=await POST(new Request('https://utwtinyverse.test/api/buddies',{
   method:'POST',headers:{origin:'https://utwtinyverse.test','content-type':'application/json'},
   body:JSON.stringify({action:'pageLogin',password:'AB12'})
  }));
  assert.equal(login.status,200,'valid page password must work without admin password');
  assert.match(login.headers.get('set-cookie'),/utw_page=/);
  assert.match(login.headers.get('set-cookie'),/HttpOnly/);
  const authorized=await GET(new Request('https://utwtinyverse.test/api/buddies',{
   headers:{cookie:'utw_page='+sessionToken('page')}
  }));
  assert.equal(authorized.status,200);
  const body=await authorized.json();
  assert.equal(body.ready,true,'ordinary member read is available without admin credentials');
  assert.equal(body.admin,false);
  assert.equal(adminPasswordOK('anything'),false,'admin desk is still inaccessible');
 } finally {
  globalThis.fetch=nativeFetch;
  for(const k of ['SUPABASE_URL','SUPABASE_SECRET_KEY','UTW_SESSION_SECRET','UTW_PAGE_PASSWORD','UTW_ADMIN_PASSWORD']){
   if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k];
  }
 }
});
