import {emptyBoard,hash,publicBoard,publicMember,memberByToken,register,update,assign,publish,adminPasswordOK,sessionToken,validSession,invalidatePairs,pagePasswordOK} from '../lib/buddies.mjs';
const configured=()=>Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY&&process.env.UTW_ADMIN_PASSWORD?.length>=16&&process.env.UTW_SESSION_SECRET?.length>=32);
async function database(path,options={}) {
 try {
  const response=await fetch(process.env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/'+path,{
   ...options,headers:{apikey:process.env.SUPABASE_SECRET_KEY,'Content-Type':'application/json',...options.headers},
   signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)throw new Error('Database unavailable.');
  return await response.json();
 }catch{throw new Error('Database unavailable.');}
}
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
async function limited(request,kind,max){
 const ip=request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'unknown';
 const count=await database('rpc/utw_buddy_rate_limit',{method:'POST',body:JSON.stringify({p_key:kind+':'+hash(ip.split(',')[0])})});
 if(!Number.isInteger(count))throw new Error('Database unavailable.');
 return count>max;
}
async function readBoard(){
 const rows=await database('utw_buddy_board?id=eq.main&select=revision,data');
 if(!Array.isArray(rows)||rows.length!==1||rows[0].data?.revision!==rows[0].revision)throw new Error('Database unavailable.');
 return {raw:rows[0].revision,board:rows[0].data};
}
async function save(board,revision){
 board.revision++;board.updatedAt=new Date().toISOString();
 const rows=await database('utw_buddy_board?id=eq.main&revision=eq.'+revision,{
  method:'PATCH',headers:{Prefer:'return=representation'},
  body:JSON.stringify({revision:board.revision,data:board,updated_at:board.updatedAt})
 });
 return Array.isArray(rows)&&rows.length===1;
}
const pageAllowed=request=>!process.env.UTW_PAGE_PASSWORD||validSession(request.headers.get('cookie'),'page')||validSession(request.headers.get('cookie'));
export async function GET(request){if(!pageAllowed(request))return json({ready:false,locked:true,message:'Enter the alliance password to open the buddy board.'});if(!configured())return json({ready:false,message:'Buddy signup is not open yet. Check the production settings.',setupNeeded:[!process.env.SUPABASE_URL&&'SUPABASE_URL',!process.env.SUPABASE_SECRET_KEY&&'SUPABASE_SECRET_KEY',!(process.env.UTW_ADMIN_PASSWORD?.length>=16)&&'UTW_ADMIN_PASSWORD must have at least 16 characters',!(process.env.UTW_SESSION_SECRET?.length>=32)&&'UTW_SESSION_SECRET must have at least 32 characters'].filter(Boolean)});try{if(new URL(request.url).searchParams.get('view')==='trains'){const [records,players,seasons]=await Promise.all([database('utw_stat_awards?select=train_date,slot,member_id,season_id,source&order=train_date.desc,slot.asc&limit=500'),database('utw_stat_members?select=id,display_name&limit=1000'),database('utw_stat_seasons?select=id,label,sort_order&order=sort_order.asc')]);const names=new Map(players.map(p=>[p.id,p.display_name]));return json({ready:true,trains:records.map(r=>({date:r.train_date,slot:r.slot,member:names.get(r.member_id)||'Former member',season:r.season_id,source:r.source})),seasons});}const {board}=await readBoard();const token=request.headers.get('authorization')?.replace(/^Bearer /,'');const member=token?memberByToken(board,token):null;if(token&&!member)return json({error:'This edit link is invalid. Ask Tiny to recover your entry.'},401);const admin=validSession(request.headers.get('cookie'));return json({ready:true,admin,...publicBoard(board,admin),myMember:member?publicMember(member):null});}catch(error){console.error('UTW buddy read failed:',error.message);return json({ready:false,error:'The shared board is temporarily unavailable. Try again.'},503);}}
export async function POST(request){if(!configured())return json({error:'Buddy signup is not open yet. Your submission has not been saved.'},503);const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)return json({error:'Request must come from the UTW site.'},403);if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON request required.'},415);let body;try{const text=await request.text();if(text.length>12000)return json({error:'Submission is too large.'},413);body=JSON.parse(text);}catch{return json({error:'Invalid submission.'},400);}try{
 if(await limited(request,['login','pageLogin'].includes(body.action)?'login':'write',['login','pageLogin'].includes(body.action)?10:60))return json({error:'Too many attempts. Try again in 15 minutes.'},429);
 const cookieAttributes='; HttpOnly; SameSite=Strict; Path=/'+(new URL(request.url).protocol==='https:'?'; Secure':'');
 if(body.action==='pageLogin'){if(!pagePasswordOK(body.password))return json({error:'Incorrect page password.'},401);return json({ok:true},200,{'Set-Cookie':'utw_page='+sessionToken('page')+'; Max-Age=28800'+cookieAttributes});}
 if(!pageAllowed(request))return json({error:'Page password required.'},401);
 if(body.action==='login'){if(!adminPasswordOK(body.password))return json({error:'Incorrect admin password.'},401);return json({ok:true},200,{'Set-Cookie':'utw_admin='+sessionToken()+'; Max-Age=28800'+cookieAttributes});}
 if(body.action==='logout')return json({ok:true},200,{'Set-Cookie':'utw_admin=; Max-Age=0'+cookieAttributes});
 const admin=validSession(request.headers.get('cookie'));const {raw,board}=await readBoard();if(body.revision!==board.revision)return json({error:'The board changed. Refresh and try again.'},409);
 let result={};if(body.action==='register'){if(body.website)return json({error:'Invalid submission.'},400);result=register(board,body.member);}
 else if(body.action==='update'){const member=admin?board.members.find(m=>m.id===body.id):memberByToken(board,body.token);if(!member||member.id!==body.id)return json({error:'Your private edit link is required.'},401);result={member:update(board,member.id,body.member)};}
 else {if(!admin)return json({error:'Admin login required.'},401);switch(body.action){case 'assign':result={pair:assign(board,body.pair)};break;case 'publish':publish(board);break;case 'unassign':{const pair=board.pairings.find(p=>p.id===body.id);if(!pair)throw new Error('Pairing not found.');pair.wasPublished=pair.wasPublished||pair.status==='active';pair.status='reassign';pair.reason='Pairing removed by Tiny. Waiting for reassignment.';break;}case 'remove':board.members=board.members.filter(m=>m.id!==body.id);invalidatePairs(board,body.id,'Member removed. Needs reassignment.');break;case 'recover':{const member=board.members.find(m=>m.id===body.id);if(!member)throw new Error('Member not found.');const {randomBytes}=await import('node:crypto');const token=randomBytes(32).toString('base64url');member.editHash=hash(token);result={token,id:member.id};break;}default:return json({error:'Unknown action.'},400);}}
 if(!await save(board,raw))return json({error:'Another update arrived. Refresh and try again.'},409);return json({ok:true,revision:board.revision,...result});
 }catch(error){if(error.message==='Database unavailable.'||error.name==='TimeoutError'){console.error('UTW buddy write failed:',error.message);return json({error:'The shared board is unavailable. Your changes were not saved.'},503);}return json({error:error.message},400);}}
