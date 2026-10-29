import test from 'node:test';
import assert from 'node:assert/strict';
import {passwordHash,passwordMatches,strongPassword,r4Username,readSession,signedCookie,sessionUser} from '../lib/r4-auth.mjs';
import {authorizedAccess,GET as plannerGET} from '../api/r4-planner.mjs';
import {GET as statsGET} from '../api/r4-stats.mjs';
const site='https://test.utw.example';
test('email-free username rules and password hashing',()=>{
 assert.equal(r4Username(' CatalystX '),'catalystx');
 assert.equal(r4Username('not allowed @ example'),null);
 assert.ok(strongPassword('temporary-for-r4-2026'));
 assert.equal(strongPassword('short'),false);
 assert.equal(strongPassword('123456789'),false);
 assert.equal(strongPassword('1234567890'),true);
 assert.equal(strongPassword('12345678901'),true);
 assert.throws(()=>passwordHash('123456789'),/10 to 128/);
 assert.equal(passwordMatches('1234567890',passwordHash('1234567890')),true);
 const hash=passwordHash('temporary-for-r4-2026');
 assert.notEqual(hash,'temporary-for-r4-2026');
 assert.equal(passwordMatches('temporary-for-r4-2026',hash),true);
 assert.equal(passwordMatches('incorrect-password',hash),false);
});
test('a forced-change account cannot open R4 stats even with signed login token',async()=>{
 const before={...process.env};
 const realFetch=globalThis.fetch;
 const account={id:'47fd2bdb-854f-4ff8-99c6-2894477a8853',username:'test_r4',display_name:'R4 Test',password_hash:passwordHash('temporary-for-r4-2026'),active:true,must_change_password:true,role:'r4',session_version:3};
 try{
 process.env.UTW_SESSION_SECRET='test-long-session-secret-12345678901234567890';
 process.env.UTW_R4_PASSWORD='legacy-test-password';
 process.env.SUPABASE_URL='https://db.example.test';process.env.SUPABASE_SECRET_KEY='example-service-key';
 globalThis.fetch=async url=>{
  if(String(url).includes('utw_r4_accounts'))return Response.json([account]);
  return Response.json([]);
 };
 const token=signedCookie(account,'active');
 const req=new Request(site+'/api/r4-stats?week=2026-10-26',{headers:{cookie:'utw_r4_user='+token}});
 assert.equal(readSession(req).id,account.id);
 assert.equal(await authorizedAccess(req),false);
 assert.equal((await statsGET(req)).status,401);
 account.must_change_password=false;
 assert.equal(await authorizedAccess(req),true);
 account.active=false;
 assert.equal(await authorizedAccess(req),false);
 }finally{globalThis.fetch=realFetch;for(const key of Object.keys(process.env)){if(!(key in before))delete process.env[key]}for(const [k,v] of Object.entries(before))process.env[k]=v}
});
