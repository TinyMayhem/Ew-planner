import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GET,POST,dayKey} from '../api/visitors.mjs';
test('Pacific midnight and daylight saving use the local calendar day',()=>{
 assert.equal(dayKey(new Date('2026-10-14T06:59:59Z')),'2026-10-13');
 assert.equal(dayKey(new Date('2026-10-14T07:00:00Z')),'2026-10-14');
 assert.equal(dayKey(new Date('2025-12-14T07:59:59Z')),'2025-12-13');
 assert.equal(dayKey(new Date('2025-12-14T08:00:00Z')),'2025-12-14');
});
test('shared counts deduplicate concurrent refreshes and keep visitor records private',async()=>{
 process.env.SUPABASE_URL='https://storage.test';process.env.SUPABASE_SECRET_KEY='test';process.env.UTW_SESSION_SECRET='test-session';
 const old=global.fetch,objects=new Set();let bucket=false;
 global.fetch=async(url,options={})=>{const path=new URL(url).pathname;assert.ok(path.includes('utw-visitor-counts')||path.endsWith('/bucket'));
 if(path.endsWith('/bucket/utw-visitor-counts'))return Response.json(bucket?{}:{message:'not found'},{status:bucket?200:404});
 if(path.endsWith('/bucket')){const body=JSON.parse(options.body);assert.equal(body.public,false);bucket=true;return Response.json({});}
 if(path.includes('/object/list/')){const {prefix,offset,limit}=JSON.parse(options.body);return Response.json([...objects].filter(k=>k.startsWith(prefix)).slice(offset,offset+limit).map(k=>({name:k.slice(prefix.length)})));}
 const key=path.split('utw-visitor-counts/')[1];assert.match(key,/^\d{4}-\d{2}-\d{2}\/[a-f0-9]{64}\.json$/);assert.equal(options.body,'{}');assert.equal(options.headers['x-upsert'],'false');if(objects.has(key))return Response.json({message:'The resource already exists'},{status:409});objects.add(key);return Response.json({});};
 const request=(id,origin='https://utw.test',ua='browser')=>new Request('https://utw.test/api/visitors',{method:'POST',headers:{origin,'user-agent':ua},body:JSON.stringify({visitorId:id})});
 const id='11111111-1111-4111-8111-111111111111';
 try{
 assert.equal((await (await GET()).json()).count,0);
 await Promise.all([POST(request(id)),POST(request(id)),POST(request(id))]);assert.equal(objects.size,1);
 assert.equal((await (await POST(request(id))).json()).count,1);
 assert.equal((await (await POST(request('22222222-2222-4222-8222-222222222222'))).json()).count,2);
 assert.equal((await POST(request(id,'https://other.test'))).status,403);
 assert.equal((await POST(request('bad'))).status,400);
 await POST(request('33333333-3333-4333-8333-333333333333','https://utw.test','testbot'));assert.equal(objects.size,2);
 const result=await (await GET()).json();assert.equal(result.count,2);assert.equal(result.timeZone,'America/Vancouver');assert.equal('visitors' in result,false);
 }finally{global.fetch=old;}
});
