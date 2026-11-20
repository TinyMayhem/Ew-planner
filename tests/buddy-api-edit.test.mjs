import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBoard,register,sessionToken} from '../lib/buddies.mjs';
import {GET,POST} from '../api/buddies.mjs';

const raw=(ign,profession='warleader')=>({
 ign,alliance:'UTW',profession,skills:{
  winwin:{provide:profession==='engineer',need:profession!=='engineer'},
  hospital:{provide:profession==='engineer',need:profession!=='engineer'}
 }
});
test('self-service member edits work without a personal token, while audit and undo require admin',async t=>{
 const previousFetch=globalThis.fetch;
 const names=['SUPABASE_URL','SUPABASE_SECRET_KEY','UTW_SESSION_SECRET','UTW_PAGE_PASSWORD','UTW_ADMIN_PASSWORD'];
 const oldEnv=Object.fromEntries(names.map(n=>[n,process.env[n]]));
 t.after(()=>{
  globalThis.fetch=previousFetch;
  for(const name of names){if(oldEnv[name]===undefined)delete process.env[name];else process.env[name]=oldEnv[name];}
 });
 process.env.SUPABASE_URL='https://db.utw.test';
 process.env.SUPABASE_SECRET_KEY='test-secret-not-real';
 process.env.UTW_SESSION_SECRET='long-test-session-secret-000000000000000000';
 process.env.UTW_PAGE_PASSWORD='ABCD';
 process.env.UTW_ADMIN_PASSWORD='test-admin-password-long';
 const board=emptyBoard();
 const profile=register(board,raw('Demo Owl'));
 let stored={revision:0,data:board};
 globalThis.fetch=async (url,options={})=>{
  const name=String(url);
  if(name.includes('/rest/v1/rpc/utw_buddy_rate_limit'))
   return Response.json(1);
  if(name.includes('/rest/v1/utw_buddy_board')){
   if(options.method==='PATCH'){
    const expected=Number(new URL(name).searchParams.get('revision')?.replace('eq.',''));
    if(expected!==stored.revision)return Response.json([]);
    const patch=JSON.parse(options.body);
    stored={revision:patch.revision,data:patch.data};
    return Response.json([stored]);
   }
   return Response.json([stored]);
  }
  throw Error('Unexpected URL '+name);
 };
 const origin='https://utw.test';
 const page='utw_page='+sessionToken('page');
 const admin='utw_admin='+sessionToken();
 const GETRequest=(path,cookie)=>new Request(origin+path,{headers:{cookie}});
 const POSTRequest=(body,cookie)=>new Request(origin+'/api/buddies',{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const publicBefore=await GET(GETRequest('/api/buddies',page));
 assert.equal(publicBefore.status,200);
 const pub=await publicBefore.json();
 assert(!Object.hasOwn(pub,'audit'));
 assert(!Object.hasOwn(pub.members[0],'currentBuddies'));
 const detail=await GET(GETRequest('/api/buddies?profile='+profile.member.id,page));
 assert.equal((await detail.json()).member.ign,'Demo Owl');
 const updateMember={...raw('Impersonated Name','engineer'),alliance:'NOTUTW'};
 const changed=await POST(POSTRequest({revision:0,action:'update',id:profile.member.id,member:updateMember},page));
 assert.equal(changed.status,200);
 assert.equal((await changed.json()).member.ign,'Demo Owl'); // unverified members cannot rename profiles
 assert.equal(stored.data.members[0].alliance,'UTW');
 assert.equal(stored.data.audit.length,1);
 const publicAfter=await GET(GETRequest('/api/buddies',page));
 assert(!Object.hasOwn(await publicAfter.json(),'audit'));
 const denied=await POST(POSTRequest({revision:1,action:'undo',eventId:stored.data.audit[0].id},page));
 assert.equal(denied.status,401);
 const adminView=await GET(GETRequest('/api/buddies',page+'; '+admin));
 const adminBoard=await adminView.json();
 assert.equal(adminBoard.audit.length,1);
 const undo=await POST(POSTRequest({revision:1,action:'undo',eventId:stored.data.audit[0].id},page+'; '+admin));
 assert.equal(undo.status,200);
 assert.equal(stored.data.members[0].profession,'warleader');
 assert.equal(stored.data.audit.at(-1).kind,'Admin undo');
});
