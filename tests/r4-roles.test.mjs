import test from 'node:test';
import assert from 'node:assert/strict';
import {signedCookie} from '../lib/r4-auth.mjs';
import {GET as plannerGET,departments} from '../api/r4-planner.mjs';
import {GET,POST} from '../api/r4-comments.mjs';
import {cleanAssignment} from '../lib/r4-roles.mjs';

const site='https://r4.example.test';
const users={
 utw:{id:'52d4d198-29c8-45b8-a0ac-7012882bf005',username:'utw',display_name:'UTW R4',role:'r4',active:true,must_change_password:false,session_version:1},
 von:{id:'fd69c3c3-3191-4141-a753-b13b391b6b7f',username:'von',display_name:'VON R4',role:'von',active:true,must_change_password:false,session_version:1},
 admin:{id:'91f5cd13-60a6-41ac-86b0-86bdc7f80f15',username:'tiny',display_name:'Tiny',role:'admin',active:true,must_change_password:false,session_version:1}
};
const request=(who,path,options={})=>new Request(site+path,{...options,headers:{...options.headers,...(who?{Cookie:'utw_r4_user='+signedCookie(users[who])}:{})}});
const post=(who,alliance,fields={})=>request(who,'/api/r4-comments?roles=1',{
 method:'POST',headers:{Origin:site,'Content-Type':'application/json'},
 body:JSON.stringify({alliance,department_key:'land-war',leader:'Captain',backup:'Support',additional_backups:['Reserve'],...fields})
});
async function fixture(fn){
 const env={...process.env},oldFetch=globalThis.fetch,queries=[];
 process.env.UTW_SESSION_SECRET='a-valid-test-session-secret-that-is-long-enough';
 process.env.UTW_R4_PASSWORD='legacy-unused-passcode';
 process.env.SUPABASE_URL='https://db.example.invalid';
 process.env.SUPABASE_SECRET_KEY='test-secret';
 globalThis.fetch=async (url,options={})=>{
  const u=new URL(url);
  if(u.pathname.endsWith('/utw_r4_accounts')){
   if(u.searchParams.has('id'))return Response.json(Object.values(users).filter(a=>'eq.'+a.id===u.searchParams.get('id')));
   return Response.json([users.admin]);
  }
  if(u.pathname.endsWith('/utw_r4_roles')){
   const body=options.body?JSON.parse(options.body):null;
   queries.push({url:u.toString(),method:options.method||'GET',body});
   if(options.method==='POST')return Response.json([body]);
   return Response.json([{department_key:'diplomacy',leader:'First',backup:'Second',additional_backups:['Third']}]);
  }
  return Response.json([]);
 };
 try{await fn(queries)}finally{
  globalThis.fetch=oldFetch;
  for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];
  for(const [k,v] of Object.entries(env))process.env[k]=v;
 }
}
test('Both alliance R4 boards offer Roles alongside weeks',()=>fixture(async()=>{
 for(const alliance of ['utw','von']){
  const response=await plannerGET(request(alliance,'/r4-planner'));
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/rolesOption\.value='roles'/);
  assert.match(html,/r4-roles-panel/);
  assert.match(html,/assets\/r4-roles\.js/);
  assert.match(html,/r4-role-grid/);
  assert.ok(departments.some(d=>d.name==='Trade Post Operations'));
  assert.equal(departments.length,10);
  assert.deepEqual(departments.find(d=>d.key==='war-merit'),{key:'war-merit',name:'War Merit & Daily Targets'});
 }
}));
test('Alliances only see their own role assignments, owner can see both',()=>fixture(async queries=>{
 const url=a=>'/api/r4-comments?roles=1&alliance='+a;
 assert.equal((await GET(request('von',url('utw')))).status,403);
 assert.equal((await GET(request('utw',url('von')))).status,403);
 assert.equal((await GET(request(null,url('von')))).status,401);
 assert.equal((await GET(request('von',url('von')))).status,200);
 assert.equal((await GET(request('utw',url('utw')))).status,200);
 assert.equal((await GET(request('admin',url('von')))).status,200);
 assert.equal((await GET(request('admin',url('utw')))).status,200);
 assert.deepEqual(queries.map(q=>new URL(q.url).searchParams.get('alliance')),['eq.von','eq.utw','eq.von','eq.utw']);
}));
test('Saves one leader, backup and multiple additional backups per department',()=>fixture(async queries=>{
 assert.equal((await POST(post('von','utw'))).status,403);
 assert.equal((await POST(post('utw','von'))).status,403);
 const saved=await POST(post('von','von',{additional_backups:['Reserve 1','Reserve 2']}));
 assert.equal(saved.status,200);
 assert.deepEqual((await saved.json()).role.additional_backups,['Reserve 1','Reserve 2']);
 assert.equal((await POST(post('admin','utw',{department_key:'trade-posts'}))).status,200);
 assert.deepEqual(queries.filter(q=>q.method==='POST').map(q=>q.body.alliance),['von','utw']);
 assert.deepEqual(queries.filter(q=>q.method==='POST').map(q=>q.body.department_key),['land-war','trade-posts']);
 assert.equal((await POST(post('utw','utw',{department_key:'war-merit',leader:'Merit Lead',backup:'Backup',additional_backups:['Extra 1','Extra 2']}))).status,200);
 assert.equal(queries.at(-1).body.department_key,'war-merit');
}));
test('Rejects malformed names, duplicate assignments and cross-site writes',()=>fixture(async()=>{
 assert.equal(cleanAssignment({department_key:'unknown',leader:'Lead',backup:'Back',additional_backups:[]}),null);
 assert.equal(cleanAssignment({department_key:'land-war',leader:'Same',backup:'same',additional_backups:[]}),null);
 assert.equal(cleanAssignment({department_key:'land-war',leader:'A',backup:'B',additional_backups:['B']}),null);
 assert.equal(cleanAssignment({department_key:'land-war',leader:'A',backup:'B',additional_backups:['C']}).additional_backups[0],'C');
 assert.equal((await POST(post('utw','utw',{department_key:'invalid-department'}))).status,400);
 assert.equal((await POST(request('utw','/api/r4-comments?roles=1',{method:'POST',headers:{Origin:'https://evil.invalid','Content-Type':'application/json'},body:JSON.stringify({alliance:'utw'})}))).status,403);
}));
