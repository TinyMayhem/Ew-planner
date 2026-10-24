import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GET,POST} from '../api/comics.mjs';
import {sessionToken} from '../lib/buddies.mjs';
test('comics require admin uploads, preserve captions and provide public downloads',async()=>{
 process.env.SUPABASE_URL='https://storage.test';process.env.SUPABASE_SECRET_KEY='test';process.env.UTW_SESSION_SECRET='test-session-secret';
 const old=global.fetch,objects=new Map();let bucket=false;
 global.fetch=async(url,options={})=>{const path=new URL(url).pathname;assert.ok(path.includes('utw-comics')||path.endsWith('/bucket')||path.endsWith('/utw_buddy_rate_limit'));
 if(path.endsWith('/utw_buddy_rate_limit'))return Response.json(1);
 if(path.endsWith('/bucket')){bucket=true;return Response.json({});}
 if(path.endsWith('/bucket/utw-comics'))return Response.json(bucket?{}:{message:'not found'},{status:bucket?200:404});
 if(path.includes('/object/list/')){const {prefix}=JSON.parse(options.body);return Response.json(prefix? [...objects.keys()].filter(k=>k.startsWith(prefix)).map(k=>({name:k.slice(prefix.length),metadata:{size:8}})):[{name:'season-1'}]);}
 if(options.method==='DELETE'){for(const k of JSON.parse(options.body).prefixes)objects.delete(k);return Response.json({});}
 const key=path.split('utw-comics/')[1];if(options.method==='POST'){objects.set(key,options.body);return Response.json({});}return new Response(objects.get(key),{status:objects.has(key)?200:404});};
 const req=(body,cookie)=>new Request('https://utw.test/api/comics',{method:'POST',headers:{origin:'https://utw.test',...(cookie?{cookie}:{})},body});
 try{
 const form=new FormData();form.set('title','Tiny’s plans');form.set('caption','The chickens saw everything.');form.set('file',new Blob([new Uint8Array([137,80,78,71,13,10,26,10])]),'plan.png');
 assert.equal((await POST(req(form))).status,401);
 const cookie='utw_admin='+sessionToken();const upload=await POST(req(form,cookie));assert.equal(upload.status,201);const {path}=await upload.json();
 const listing=await (await GET(new Request('https://utw.test/api/comics'))).json();assert.equal(listing.files[0].caption,'The chickens saw everything.');assert.equal(listing.files[0].title,'Tiny’s plans');assert.equal(listing.admin,false);
 const download=await GET(new Request('https://utw.test/api/comics?file='+encodeURIComponent(path)+'&download=1'));assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/^attachment/);assert.equal((await download.arrayBuffer()).byteLength,8);
 assert.equal((await GET(new Request('https://utw.test/api/comics?file=other-bucket/file.pdf'))).status,400);
 assert.equal((await POST(new Request('https://utw.test/api/comics',{method:'POST',headers:{origin:'https://other.test',cookie},body:form}))).status,403);
 const bad=new FormData();bad.set('title','Unsafe');bad.set('file',new Blob(['<svg onload=alert(1)>']),'unsafe.svg');assert.equal((await POST(req(bad,cookie))).status,415);
 const big=new FormData();big.set('title','Too big');big.set('file',new Blob([new Uint8Array(3*1024*1024+1)]),'big.png');assert.equal((await POST(req(big,cookie))).status,413);
 }finally{global.fetch=old;}
});
