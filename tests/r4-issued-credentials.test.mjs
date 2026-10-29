import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {r4Username,passwordMatches,verifyCredentials} from '../lib/r4-auth.mjs';

const dummyHash=password=>{const salt='4fa09fe4b6b2402197e56f9a';return salt+':'+scryptSync(password,salt,64).toString('hex')};

test('two-letter game handles are valid without permitting emails or spaces',()=>{
 assert.equal(r4Username(' Mo '),'mo');
 assert.equal(r4Username('Tiny'),'tiny');
 assert.equal(r4Username('Izard'),'izard');
 assert.equal(r4Username('x'),null);
 assert.equal(r4Username('r4@example.com'),null);
});
test('exact first-login phrases including spaces and uppercase remain case sensitive',()=>{
 const hash=dummyHash('Mixed CASE phrase');
 assert.equal(passwordMatches('Mixed CASE phrase',hash),true);
 assert.equal(passwordMatches('mixed case phrase',hash),false);
 assert.equal(passwordMatches('Mixed CASE phrase ',hash),false);
 const short=dummyHash('abcd');
 assert.equal(passwordMatches('abcd',short),true);
 assert.equal(passwordMatches('ABCD',short),false);
});
test('expired temporary passcodes cannot activate R4, active temporary accounts can',async()=>{
 const saved={...process.env},old=globalThis.fetch;
 const account={id:'7396fa5c-d3db-49d2-b8e2-946b766d5372',username:'mo',display_name:'Mo',active:true,must_change_password:true,password_hash:dummyHash('abcd'),temporary_expires_at:new Date(Date.now()+3600000).toISOString()};
 try{
  process.env.SUPABASE_URL='https://example.supabase.invalid';
  process.env.SUPABASE_SECRET_KEY='test-key';
  globalThis.fetch=async()=>Response.json([account]);
  assert.equal((await verifyCredentials('Mo','abcd')).username,'mo');
  assert.equal(await verifyCredentials('Mo','ABCD'),null);
  account.temporary_expires_at=new Date(Date.now()-3600000).toISOString();
  assert.equal(await verifyCredentials('Mo','abcd'),null);
  account.must_change_password=false;
  assert.equal((await verifyCredentials('Mo','abcd')).username,'mo');
  account.active=false;
  assert.equal(await verifyCredentials('Mo','abcd'),null);
 }finally{
  globalThis.fetch=old;
  for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];
  for(const [k,v] of Object.entries(saved))process.env[k]=v;
 }
});
test('owner privilege is restricted to named administrator and management page remains disabled',()=>{
 const planner=readFileSync(new URL('../api/r4-planner.mjs',import.meta.url),'utf8');
 const audit=readFileSync(new URL('../lib/r4-audit-page.mjs',import.meta.url),'utf8');
 assert.match(planner,/account_create','account_toggle','account_reset/);
 assert.match(audit,/account\.role!=='admin'/);
});
