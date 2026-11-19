import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {powerFromInput,cleanThpSubmission,nameSuggestions} from '../lib/thp-submission-utils.mjs';
import {isImplicitMillions} from '../assets/thp-power.mjs';
import {GET,POST} from '../api/thp-update.mjs';
import {sessionToken} from '../lib/buddies.mjs';
import {signedCookie} from '../lib/r4-auth.mjs';

const site='https://utw.example.test';
const actor={id:'52d4d198-29c8-45b8-a0ac-7012882bf005',username:'tiny',display_name:'Tiny',role:'admin',active:true,must_change_password:false,session_version:1};
async function fixture(fn){
 const saved={...process.env},previous=globalThis.fetch,calls=[];
 process.env.UTW_SESSION_SECRET='private-utw-session-secret-longer-than-thirty-two';
 process.env.SUPABASE_URL='https://db.example.invalid';
 process.env.SUPABASE_SECRET_KEY='test-server-key';
 globalThis.fetch=async (url,opt={})=>{
  const path=new URL(url).pathname,search=new URL(url).searchParams;
  calls.push({path,options:opt,params:search});
  if(path.endsWith('/utw_r4_accounts'))return Response.json([actor]);
  if(path.endsWith('/rpc/utw_buddy_rate_limit'))return Response.json(1);
  if(path.endsWith('/utw_thp_submissions')){
   if(opt.method==='POST'){
    const row=JSON.parse(opt.body)[0];
    return Response.json([row]);
   }
   return Response.json([{id:'afea1c74-46cc-4f0b-9af3-66913e6d5d10',status:'pending',submitted_name:'Baba',submitted_at:'2026-11-19T00:00:00Z',measurement_date:'2026-11-18',squad_type:'air',squad_power:52780000,hero_power:159890405}]);
  }
  if(path.endsWith('/utw_duel_backup_members'))return Response.json([{source_member_id:'54',name:'Movich Mo'},{source_member_id:'33',name:'CalllMeBaba'}]);
  if(path.endsWith('/utw_duel_backup_aliases'))return Response.json([{source_member_id:'33',alias:'Baba'}]);
  if(path.endsWith('/rpc/utw_r4_thp_latest'))return Response.json([]);
  if(path.endsWith('/utw_r4_member_squad_profiles'))return Response.json([]);
  if(path.endsWith('/rpc/utw_review_member_thp'))return Response.json({id:'afea1c74-46cc-4f0b-9af3-66913e6d5d10',status:'approved'});
  if(path.includes('/storage/v1/object/utw-thp-evidence/'))return Response.json({ok:true});
  throw Error('Unexpected fetch path '+path);
 };
 try{await fn(calls)}finally{
  globalThis.fetch=previous;
  for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];
  for(const [key,v] of Object.entries(saved))process.env[key]=v;
 }
}
test('Member THP inputs accept 52.78M and correctly distinguish Hero Power',()=>{
 assert.equal(powerFromInput('52.78m'),52780000);
 assert.equal(powerFromInput('52.78'),52780000,'Unsuffixed decimal squad power is millions');
 assert.equal(powerFromInput('58.02'),58020000,'Player input without M saves 58.02M');
 assert.equal(powerFromInput('159.98'),159980000,'Player input without M saves 159.98M');
 assert.equal(powerFromInput('159.98M'),159980000,'Explicit M is unchanged');
 assert.equal(powerFromInput('159.980'),159980000);
 assert.equal(powerFromInput('159980000'),159980000,'Raw integer is not multiplied');
 assert.equal(powerFromInput('159,890,405'),159890405);
 assert.equal(powerFromInput('159'),159,'Unsuffixed whole numbers remain exact');
 assert.equal(powerFromInput('1.225B'),1225000000);
 assert.equal(isImplicitMillions('159.98'),true);
 assert.equal(isImplicitMillions('159.98M'),false);
 assert.equal(isImplicitMillions('159980000'),false);
 for(const v of ['-52M','hi','0','1.2345M','159.9801'])assert.equal(powerFromInput(v),null);
 assert.deepEqual(cleanThpSubmission({name:'Tiny',squadType:'air',squadPower:'58.02',heroPower:'159.98',note:'Used to be TinyMayhem'}),{
  submitted_name:'Tiny',squad_type:'air',squad_power:58020000,hero_power:159980000,member_note:'Used to be TinyMayhem'
 });
 assert.throws(()=>cleanThpSubmission({name:'Baba',squadType:'wrong',squadPower:'52M',heroPower:'100M'}),/Choose Tank/);
});
test('Member name matching returns verified roster suggestions, not made-up identities',()=>{
 const m=[{source_member_id:'54',name:'Movich Mo'},{source_member_id:'33',name:'CalllMeBaba'}];
 const a=[{source_member_id:'33',alias:'Baba'}];
 assert.deepEqual(nameSuggestions('Ba',m,a),[{id:'33',name:'CalllMeBaba'}]);
 assert.deepEqual(nameSuggestions('Zed',m,a),[]);
});
test('THP API needs existing member passcode, without requiring individual accounts',()=>fixture(async calls=>{
 const locked=await GET(new Request(site+'/api/thp-update'));
 assert.deepEqual(await locked.json(),{locked:true});
 const unauthorized=new FormData();unauthorized.set('name','Tiny');
 const response=await POST(new Request(site+'/api/thp-update',{method:'POST',headers:{Origin:site},body:unauthorized}));
 assert.equal(response.status,401);
 const cookie='utw_page='+sessionToken('page');
 const open=await GET(new Request(site+'/api/thp-update',{headers:{Cookie:cookie}}));
 assert.equal((await open.json()).locked,false);
 const form=new FormData();
 for(const [key,value] of Object.entries({name:'Tiny',squadType:'air',squadPower:'58.02',heroPower:'159.98',note:'Old: TinyMayhem'}))form.set(key,value);
 const saved=await POST(new Request(site+'/api/thp-update',{method:'POST',headers:{Origin:site,Cookie:cookie},body:form}));
 assert.equal(saved.status,201);
 const data=await saved.json();
 assert.equal(data.status,'pending');
 const insertion=calls.find(x=>x.path.endsWith('/utw_thp_submissions')&&x.options.method==='POST');
 const written=JSON.parse(insertion.options.body)[0];
 assert.equal(written.hero_power,159980000);
 assert.equal(written.squad_power,58020000);
 assert.equal(written.status,undefined);
 assert.equal(written.evidence_path,null);
 assert.equal(written.submitted_name,'Tiny');
 assert.ok(!calls.some(x=>x.path.endsWith('/utw_r4_member_thp_history')),'Member submission must not write live THP');
}));
test('Private screenshots upload with the member submission and are not publicly readable',()=>fixture(async calls=>{
 const cookie='utw_page='+sessionToken('page'),form=new FormData();
 for(const [key,value] of Object.entries({name:'Tiny',squadType:'tank',squadPower:'52.78M',heroPower:'159890405',note:''}))form.set(key,value);
 const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
 form.set('screenshot',new File([png],'power.png',{type:'image/png'}));
 const response=await POST(new Request(site+'/api/thp-update',{method:'POST',headers:{Origin:site,Cookie:cookie},body:form}));
 assert.equal(response.status,201);
 const storage=calls.find(x=>x.path.includes('/storage/v1/object/utw-thp-evidence/proof/'));
 assert.ok(storage,'Screenshot should be uploaded only through the server');
 assert.equal(storage.options.headers['Content-Type'],'image/png');
 const dbCall=calls.find(x=>x.path.endsWith('/utw_thp_submissions')&&x.options.method==='POST');
 const record=JSON.parse(dbCall.options.body)[0];
 assert.match(record.evidence_path,/^proof\/[0-9a-f-]{36}\.png$/);
 const denied=await GET(new Request(site+'/api/thp-update?evidence='+record.id));
 assert.equal(denied.status,401);
}));

test('THP review is R4-only and records an explicit member match',()=>fixture(async calls=>{
 const denied=await GET(new Request(site+'/api/thp-update?review=1'));
 assert.equal(denied.status,401);
 const cookie='utw_r4_user='+signedCookie(actor);
 const reviewed=await GET(new Request(site+'/api/thp-update?review=1',{headers:{Cookie:cookie}}));
 assert.equal(reviewed.status,200);
 const data=await reviewed.json();
 assert.equal(data.pending,1);
 const body={action:'review',id:'afea1c74-46cc-4f0b-9af3-66913e6d5d10',decision:'approved',
  sourceMemberId:'33',heroPower:'159.98',squadType:'air',squadPower:'58.02',reviewNote:'Matched to Baba'};
 const res=await POST(new Request(site+'/api/thp-update',{method:'POST',headers:{Origin:site,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)}));
 assert.equal(res.status,200);
 const rpc=calls.find(x=>x.path.endsWith('/rpc/utw_review_member_thp'));
 const p=JSON.parse(rpc.options.body);
 assert.equal(p.p_member_id,'33');assert.equal(p.p_hero_power,159980000);assert.equal(p.p_squad_power,58020000);
 const imageDenied=await GET(new Request(site+'/api/thp-update?evidence=afea1c74-46cc-4f0b-9af3-66913e6d5d10'));
 assert.equal(imageDenied.status,401);
}));
test('Member Den and private R4 Tracker both include THP entrypoints and guide',()=>{
 const den=readFileSync('members.html','utf8');
 const page=readFileSync('thp-update.html','utf8');
 const stats=readFileSync('lib/r4-stats-page.mjs','utf8');
 assert.match(den,/id="memberContent"/);
 assert.match(den,/href="\/thp-update\.html"/);
 assert.match(page,/id="thp-member-form"/);
 assert.match(page,/id="thp-gate-form"/);
 assert.match(page,/240,538,823/);
 assert.match(page,/159,890,405/);
 assert.match(page,/TINY'S CHAOS-PROOF GUIDE/);
 assert.match(page,/159\.98 = 159,980,000/);
 assert.match(page,/58\.02 = 58,020,000/);
 assert.match(readFileSync('assets/thp-update.js','utf8'),/import \{powerFromInput,isImplicitMillions\} from '\.\/thp-power\.mjs'/);
 assert.match(readFileSync('assets/thp-review.js','utf8'),/import \{powerFromInput\} from '\.\/thp-power\.mjs'/);
 const svg=readFileSync('assets/thp-guide.svg','utf8');
 assert.equal((svg.match(/data:image\/webp;base64,/g)||[]).length,3,'Actual user screenshots and generated Tiny should be embedded');
 assert.match(svg,/159,890,405/);
 assert.match(page,/assets\/thp-guide\.svg/);
 assert.match(stats,/id="thp-review-panel"/);
 assert.match(stats,/assets\/thp-review\.js/);
 for(const path of ['api/thp-update.mjs','assets/thp-power.mjs','assets/thp-update.js','assets/thp-review.js','lib/thp-submission-utils.mjs']){
  const r=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
 }
});
