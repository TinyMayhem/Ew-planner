import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GET} from '../api/r4-stats.mjs';
import {signedCookie} from '../lib/r4-auth.mjs';
import {latestThpSnapshotDate} from '../assets/r4-thp-roles.mjs';

test('THP entry picker date affects only exact record while latest display uses today',async()=>{
 const previous={...process.env},fetchOriginal=globalThis.fetch;
 const actor={id:'52d4d198-29c8-45b8-a0ac-7012882bf005',username:'tiny',display_name:'Tiny',role:'admin',active:true,must_change_password:false,session_version:1};
 const calls=[];
 try{
  process.env.UTW_SESSION_SECRET='test-thp-session-secret-has-at-least-32-characters';
  process.env.SUPABASE_URL='https://db.example.invalid';
  process.env.SUPABASE_SECRET_KEY='private-test-secret';
  globalThis.fetch=async (url,options={})=>{
   const target=new URL(url),p=target.pathname;
   calls.push({path:p,params:target.searchParams,body:options.body?JSON.parse(options.body):null});
   if(p.endsWith('/utw_r4_accounts'))return Response.json([actor]);
   if(p.endsWith('/utw_r4_member_thp_history')){
    assert.equal(target.searchParams.get('recorded_on'),'eq.2026-01-02');
    return Response.json([{source_member_id:'s1',member_name:'TinyMayhem',thp:42000000,recorded_on:'2026-01-02',updated_at:'2026-01-03T00:00:00Z'}]);
   }
   if(p.endsWith('/rpc/utw_r4_thp_latest')){
    assert.equal(JSON.parse(options.body).p_date,latestThpSnapshotDate());
    return Response.json([{source_member_id:'s1',member_name:'TinyMayhem',thp:55000000,recorded_on:'2026-11-15',updated_at:'2026-11-15T13:45:00Z'}]);
   }
   if(p.endsWith('/utw_stat_members'))return Response.json([{id:'1',display_name:'TinyMayhem'}]);
   if(p.endsWith('/utw_stat_aliases'))return Response.json([]);
   if(p.endsWith('/utw_r4_member_squad_profiles'))return Response.json([]);
   throw Error('Unexpected database request: '+p);
  };
  const request=new Request('https://test.example/api/r4-stats?member_thp=1&date=2026-01-02',{headers:{Cookie:'utw_r4_user='+signedCookie(actor)}});
  const response=await GET(request);
  assert.equal(response.status,200);
  const payload=await response.json();
  assert.equal(payload.date,'2026-01-02');
  assert.equal(payload.latestAsOf,latestThpSnapshotDate());
  assert.equal(payload.records[0].thp,42000000);
  assert.equal(payload.latest[0].thp,55000000);
  assert.equal(payload.latest[0].recorded_on,'2026-11-15');
  assert.deepEqual(payload.squads,[]);
  assert.equal(payload.mapped[0].thp,55000000);
  assert.ok(calls.some(c=>c.path.endsWith('/utw_r4_member_squad_profiles')));
 }finally{
  globalThis.fetch=fetchOriginal;
  for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];
  for(const [key,val] of Object.entries(previous))process.env[key]=val;
 }
});

test('THP rows show last measurement and save timestamp; date selector edits exact record only',()=>{
 const client=readFileSync('assets/r4-thp.js','utf8');
 const page=readFileSync('lib/r4-stats-page.mjs','utf8');
 assert.match(client,/Last THP update: '\+prior\.recorded_on/);
 assert.match(client,/Saved\/edited: '\+new Date\(prior\.updated_at\)/);
 assert.match(client,/input\.value=current\?fmt\(current\.thp\):''/);
 assert.match(client,/recorded_on:state\.date/);
 assert.doesNotMatch(client,/Latest THP available as of '\+state\.date/);
 assert.match(page,/THP entry date \(add or edit\)/);
 assert.match(page,/Choosing an entry date does not change the displayed THP/);
});
