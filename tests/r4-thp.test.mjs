import test from 'node:test';
import assert from 'node:assert/strict';
import {validThp,GET,POST} from '../api/r4-stats.mjs';

test('THP allows a whole-number value including zero and rejects unsafe or negative values',()=>{
 for(const value of [0,1,120000000,9007199254740991])assert.equal(validThp(value),true);
 for(const value of [-1,1.5,'120000000',NaN,Infinity,9007199254740992])assert.equal(validThp(value),false);
});

test('Member THP endpoints require R4 sign-in',async()=>{
 const original=Object.fromEntries(['UTW_R4_PASSWORD','UTW_SESSION_SECRET','SUPABASE_URL','SUPABASE_SECRET_KEY'].map(k=>[k,process.env[k]]));
 try{
  delete process.env.UTW_R4_PASSWORD;
  delete process.env.UTW_SESSION_SECRET;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  const url='https://example.com/api/r4-stats?member_thp=1&date=2026-11-12';
  assert.equal((await GET(new Request(url))).status,401);
  assert.equal((await POST(new Request(url,{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:JSON.stringify({action:'member_thp',mode:'save',source_member_id:'123',member_name:'Tiny',recorded_on:'2026-11-12',thp:100})}))).status,401);
 }finally{
  for(const [k,value] of Object.entries(original)){if(value===undefined)delete process.env[k];else process.env[k]=value}
 }
});
