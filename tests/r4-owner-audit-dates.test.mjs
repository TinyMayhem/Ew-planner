import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReportDate,csvForReport,targetFromCsvDate,weekStart} from '../assets/r4-csv-utils.mjs';
import {GET as auditView} from '../lib/r4-audit-page.mjs';
import {GET as statsGet,POST as statsPost} from '../api/r4-stats.mjs';
import {signedCookie} from '../lib/r4-auth.mjs';
const base='https://utw.example.test';
test('CSV report date comes from content and Monday VS is October 26',()=>{
 const table=csvForReport('Date,Commander,Points\n2026-10-26,Tiny,1250\n2026-10-26,Catalyst,900\n');
 assert.equal(table.date,'2026-10-26');
 assert.equal(targetFromCsvDate('vs_daily',table.date),'2026-10-26');
 assert.equal(targetFromCsvDate('vs_weekly',table.date),'2026-10-26');
 assert.equal(targetFromCsvDate('donations_weekly',table.date),'2026-10-26');
 assert.equal(weekStart('2026-11-01'),'2026-10-26');
 const preamble=csvForReport('Report date: 2026-10-26\nName,Total VS\nTiny,90\n');
 assert.equal(preamble.date,'2026-10-26');
 const head=csvForReport('Name,VS 2026-10-26\nTiny,100\n');
 assert.equal(head.date,'2026-10-26');
 assert.equal(parseReportDate('10/26/2026 23:59'),'2026-10-26');
 assert.equal(parseReportDate('26 October 2026'),'2026-10-26');
});
test('CSV with no dates or mixed dates must not silently use file date or guess',()=>{
 const missing=csvForReport('Name,Points\nTiny,200\n');
 assert.equal(missing.date,'');
 assert.match(missing.error,/No reporting date/);
 const mixed=csvForReport('Date,Player,Points\n2026-10-26,Tiny,100\n2026-10-27,Catalyst,200\n');
 assert.equal(mixed.date,'');
 assert.match(mixed.error,/multiple reporting dates/);
});
test('owner audit is forbidden to an unauthenticated visitor',async()=>{
 const res=await auditView(new Request(base+'/r4-audit'));
 assert.equal(res.status,403);
 const plain=await res.text();
 assert.doesNotMatch(plain,/Raccoon Paper Trail/);
});
test('R4 personal user cannot read audit even if signed in; owner can',async()=>{
 const saved={...process.env},orig=globalThis.fetch;
 const account={id:'f7e3ce3b-08d4-4ed7-a4ec-c2beecfb00f5',username:'sample-r4',display_name:'R4',role:'r4',active:true,must_change_password:false,session_version:1};
 try{
  process.env.UTW_SESSION_SECRET='testing-only-secret-long-enough-for-signatures';
  process.env.SUPABASE_URL='https://db.example.invalid';
  process.env.SUPABASE_SECRET_KEY='fake-service-key';
  process.env.UTW_R4_PASSWORD='shared-long-test-password';
  globalThis.fetch=async url=>{
   if(String(url).includes('utw_r4_accounts'))return Response.json([account]);
   if(String(url).includes('rpc/utw_buddy_rate_limit'))return Response.json(1);
   if(String(url).includes('utw_stat_audit'))return Response.json([]);
   return Response.json([]);
  };
  const request=(url,options={})=>new Request(base+url,{...options,headers:{Cookie:'utw_r4_user='+signedCookie(account),...options.headers}});
  assert.equal((await auditView(request('/r4-audit'))).status,403);
  assert.equal((await statsGet(request('/api/r4-stats?audit=1'))).status,403);
  assert.equal((await statsPost(request('/api/r4-stats',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'undo_audit',id:1})}))).status,403);
  account.role='admin';
  assert.equal((await auditView(request('/r4-audit'))).status,200);
  const result=await statsGet(request('/api/r4-stats?audit=1'));
  assert.equal(result.status,200);
  assert.deepEqual((await result.json()).events,[]);
 }finally{
  globalThis.fetch=orig;
  for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];
  for(const [k,v] of Object.entries(saved))process.env[k]=v;
 }
});
