
import {createHash,randomUUID} from 'node:crypto';
import {authorized} from './r4-planner.mjs';

const HEADERS={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
const json=(body,status=200)=>Response.json(body,{status,headers:HEADERS});
const isoDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const isMonday=v=>isoDate(v)&&new Date(v+'T00:00:00Z').getUTCDay()===1;
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const name=v=>typeof v==='string'?v.trim().replace(/\s+/g,' ').slice(0,100):'';
const key=v=>name(v).normalize('NFKC').toLocaleLowerCase('und');
const clean=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const dateAdd=(v,days)=>new Date(Date.parse(v+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
const sb=()=>{const url=process.env.SUPABASE_URL?.replace(/\/$/,'');const secret=process.env.SUPABASE_SECRET_KEY;if(!url||!secret)throw Error('Server database is not configured');return {url,secret}};
async function db(path,options={}){
 const {url,secret}=sb();
 const res=await fetch(url+'/rest/v1/'+path,{...options,headers:{apikey:secret,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});
 if(!res.ok){const txt=await res.text();throw Error('Database operation failed ('+res.status+'): '+txt.slice(0,200))}
 if(res.status===204)return null;
 return res.json();
}
const urlParams=(obj)=>new URLSearchParams(obj).toString();
async function list(table,params){return db(table+'?'+urlParams(params))}
async function insert(table,data){const rows=await db(table,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(data)});return rows}
async function del(table,filters){await db(table+'?'+urlParams(filters),{method:'DELETE',headers:{Prefer:'return=minimal'}})}
function authorizeWrite(request){return request.headers.get('origin')===new URL(request.url).origin}
async function rateLimit(request){
 const ip=(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'unknown').split(',')[0];
 const count=await db('rpc/utw_buddy_rate_limit',{method:'POST',body:JSON.stringify({p_key:'r4-stats:'+createHash('sha256').update(ip).digest('hex')})});
 if(!Number.isInteger(count)||count>50)throw Error('Too many changes. Please try again later.');
}
function sendErr(e){const m=e?.message||'Unexpected error';if(m.startsWith('Too many'))return json({error:m},429);if(m.includes('duplicate key')||m.includes('unique constraint'))return json({error:'This entry already exists. Check existing names, uploads, or train slots.'},409);return json({error:'Unable to complete this request. '+m.replace(/https?:\/\/\S+/g,'').slice(0,160)},503)}
async function storage(path,options={}){const {url,secret}=sb();const res=await fetch(url+'/storage/v1/object/'+path,{...options,headers:{apikey:secret,...options.headers},signal:AbortSignal.timeout(18000)});return res}
async function getData(week){
 const end=dateAdd(week,6),startHistory=dateAdd(week,-35);
 const [members,aliases,allImports,ds,exceptions,awards]=await Promise.all([
  list('utw_stat_members',{select:'id,display_name,created_at',order:'display_name.asc',limit:'1000'}),
  list('utw_stat_aliases',{select:'alias_key,alias,member_id',limit:'3000'}),
  list('utw_stat_imports',{select:'id,metric,period,filename,row_count,created_at',period:'gte.'+week,order:'created_at.desc',limit:'500'}),
  list('utw_stat_ds',{select:'*',event_date:'gte.'+week,order:'event_date.desc',limit:'200'}),
  list('utw_stat_exceptions',{select:'*',order:'created_at.desc',limit:'1000'}),
  list('utw_stat_awards',{select:'*',train_date:'gte.'+startHistory,order:'train_date.desc',limit:'500'})
 ]);
 if([members,aliases,allImports,ds,exceptions,awards].some(x=>!Array.isArray(x)))throw Error('Invalid database response');
 // Only the most recently uploaded CSV is active for a metric and date.
 const current=new Map();
 for(const imp of allImports){if(imp.period<=end){const k=imp.metric+':'+imp.period;if(!current.has(k))current.set(k,imp)}}
 const imports=[...current.values()],values=(await Promise.all(imports.map(i=>list('utw_stat_values',{select:'import_id,alias_key,original_name,points',import_id:'eq.'+i.id,limit:'501'})))).flat();
 if(imports.some(i=>values.filter(v=>v.import_id===i.id).length!==i.row_count))throw Error('CSV data appears incomplete');
 return {members,aliases,imports,values,ds:ds.filter(d=>d.event_date<=end),exceptions,awards};
}
async function evidence(request,id){
 if(!uuid(id))return json({error:'Invalid evidence ID'},400);
 const found=await list('utw_stat_ds',{select:'screenshot_path',id:'eq.'+id,limit:'1'});
 if(found.length!==1)return json({error:'Screenshot not found'},404);
 const path=found[0].screenshot_path.split('/').map(encodeURIComponent).join('/');
 const res=await storage('authenticated/utw-r4-ds-evidence/'+path);
 if(!res.ok)return json({error:'Screenshot unavailable'},503);
 const type=res.headers.get('content-type')||'';
 if(!['image/jpeg','image/png','image/webp'].includes(type))return json({error:'Invalid screenshot content type'},503);
 return new Response(res.body,{status:200,headers:{...HEADERS,'Content-Type':type,'Content-Disposition':'inline; filename="ds-evidence"','X-Content-Type-Options':'nosniff'}});
}
export async function GET(request){
 if(!authorized(request))return json({error:'R4 sign-in required'},401);
 const q=new URL(request.url).searchParams;
 try{
  if(q.get('image'))return await evidence(request,q.get('image'));
  const week=q.get('week');
  if(!isMonday(week))return json({error:'Select a valid Monday to start the week'},400);
  return json(await getData(week));
 }catch(e){return sendErr(e)}
}
async function importCsv(body){
 const {metric,period,filename,rows}=body;
 if(!['vs_daily','vs_weekly','donations_weekly'].includes(metric)||!isoDate(period)||(metric!=='vs_daily'&&!isMonday(period)))return json({error:'Invalid upload type or date'},400);
 if(typeof filename!=='string'||filename.length>180||!filename.toLowerCase().endsWith('.csv'))return json({error:'Upload a named CSV file'},400);
 if(!Array.isArray(rows)||rows.length<1||rows.length>500)return json({error:'CSV must contain 1 to 500 rows'},400);
 const cleanRows=[],seen=new Set();
 for(const row of rows){
  const display=name(row.name),aliasKey=key(display),points=Number(row.points);
  if(!display||display.length>60||!Number.isSafeInteger(points)||points<0||seen.has(aliasKey))return json({error:'Invalid, missing, or duplicated member name / points in CSV. Fix the preview and retry.'},400);
  seen.add(aliasKey);cleanRows.push({name:display,alias_key:aliasKey,points});
 }
 const hash=createHash('sha256').update(JSON.stringify({metric,period,cleanRows})).digest('hex');
 const existing=await list('utw_stat_aliases',{select:'alias_key',limit:'3000'});
 const known=new Set(existing.map(a=>a.alias_key));
 const fresh=cleanRows.filter(r=>!known.has(r.alias_key)).map(r=>({memberId:randomUUID(),name:r.name,aliasKey:r.alias_key}));
 if(fresh.length){
  await insert('utw_stat_members',fresh.map(x=>({id:x.memberId,display_name:x.name})));
  await insert('utw_stat_aliases',fresh.map(x=>({alias_key:x.aliasKey,alias:x.name,member_id:x.memberId})));
 }
 const created=await insert('utw_stat_imports',{metric,period,filename:clean(filename,180),file_hash:hash,row_count:cleanRows.length});
 if(created.length!==1)throw Error('Upload did not create a batch');
 const importId=created[0].id;
 try{
  await insert('utw_stat_values',cleanRows.map(x=>({import_id:importId,alias_key:x.alias_key,original_name:x.name,points:x.points})));
 }catch(e){await del('utw_stat_imports',{id:'eq.'+importId}).catch(()=>{});throw e}
 return json({ok:true,rows:cleanRows.length,new_members:fresh.length},201);
}
async function dsUpload(form){
 const eventDate=form.get('date'),first=form.get('first'),second=form.get('second')||null,third=form.get('third')||null;
 const opponent=clean(form.get('opponent'),80),notes=clean(form.get('notes'),500),file=form.get('screenshot');
 if(!isoDate(eventDate)||!uuid(first)||((second||third)&&![second,third].filter(Boolean).every(uuid))||new Set([first,second,third].filter(Boolean)).size!==[first,second,third].filter(Boolean).length)return json({error:'Select valid, different MVP / second / third members and a match date'},400);
 if(!file||typeof file.arrayBuffer!=='function'||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size<100||file.size>5*1024*1024)return json({error:'Upload a JPG, PNG, or WebP screenshot under 5 MB'},400);
 const bytes=new Uint8Array(await file.arrayBuffer());
 const isPng=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
 const isJpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const isWebp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!((file.type==='image/png'&&isPng)||(file.type==='image/jpeg'&&isJpg)||(file.type==='image/webp'&&isWebp)))return json({error:'Screenshot contents do not match the file type'},400);
 const ext=file.type==='image/png'?'png':file.type==='image/jpeg'?'jpg':'webp';
 const path=eventDate+'/'+randomUUID()+'.'+ext;
 const upload=await storage('utw-r4-ds-evidence/'+path,{method:'POST',headers:{'Content-Type':file.type,'x-upsert':'false'},body:bytes});
 if(!upload.ok)throw Error('Secure screenshot upload failed');
 try{
  await insert('utw_stat_ds',{event_date:eventDate,first_member:first,second_member:second,third_member:third,opponent,notes,screenshot_path:path});
 }catch(e){await storage('utw-r4-ds-evidence/'+path,{method:'DELETE'}).catch(()=>{});throw e}
 return json({ok:true},201);
}
export async function POST(request){
 if(!authorized(request))return json({error:'R4 sign-in required'},401);
 if(!authorizeWrite(request))return json({error:'Invalid request origin'},403);
 try{
  await rateLimit(request);
  const type=request.headers.get('content-type')||'';
  if(type.startsWith('multipart/form-data')){
   const declared=Number(request.headers.get('content-length')||0);
   if(declared>5.5*1024*1024)return json({error:'Screenshot too large'},413);
   const form=await request.formData();
   if(form.get('action')!=='ds')return json({error:'Unknown upload'},400);
   return await dsUpload(form);
  }
  if(!type.startsWith('application/json'))return json({error:'JSON required'},415);
  const raw=await request.text();
  if(raw.length>150000)return json({error:'Request too large'},413);
  const body=JSON.parse(raw);
  switch(body.action){
   case 'import':return await importCsv(body);
   case 'alias':{
    const alias=name(body.alias),memberId=body.member_id;
    if(alias.length<1||alias.length>60||!uuid(memberId))return json({error:'Enter a valid alias and member'},400);
    await insert('utw_stat_aliases',{alias_key:key(alias),alias,member_id:memberId});
    return json({ok:true},201);
   }
   case 'merge':{
    if(!uuid(body.source)||!uuid(body.target)||body.source===body.target)return json({error:'Choose two distinct members'},400);
    await db('rpc/utw_stat_merge_members',{method:'POST',body:JSON.stringify({p_source:body.source,p_target:body.target})});
    return json({ok:true});
   }
   case 'exception':{
    if(!uuid(body.member_id)||!['all','ds','donations','vs'].includes(body.scope)||!isoDate(body.starts_on)||!isoDate(body.ends_on)||body.ends_on<body.starts_on||clean(body.reason,301).length<1||clean(body.reason,301).length>300)return json({error:'Enter a valid member, scope, date range and reason'},400);
    await insert('utw_stat_exceptions',{member_id:body.member_id,scope:body.scope,starts_on:body.starts_on,ends_on:body.ends_on,reason:clean(body.reason,300)});
    return json({ok:true},201);
   }
   case 'clear_exception':{
    if(!uuid(body.id))return json({error:'Invalid exception'},400);
    await db('utw_stat_exceptions?'+urlParams({id:'eq.'+body.id}),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({active:false})});
    return json({ok:true});
   }
   case 'award':{
    if(!isoDate(body.train_date)||!uuid(body.member_id)||!['ds','donations','vs','manual'].includes(body.source)||!name(body.slot)||name(body.slot).length>50)return json({error:'Enter a valid train date, member, source and slot'},400);
    await insert('utw_stat_awards',{train_date:body.train_date,member_id:body.member_id,source:body.source,slot:name(body.slot),reason:clean(body.reason,500)});
    return json({ok:true},201);
   }
   case 'delete_award':{
    if(!uuid(body.id))return json({error:'Invalid train assignment'},400);
    await del('utw_stat_awards',{id:'eq.'+body.id});
    await insert('utw_stat_audit',{action:'delete_award',details:{award_id:body.id}});
    return json({ok:true});
   }
   default:return json({error:'Unknown action'},400);
  }
 }catch(e){return sendErr(e)}
}
