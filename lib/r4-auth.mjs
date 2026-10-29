import {createHmac,createHash,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
const noStore={'Cache-Control':'no-store'};
const base=()=>({url:process.env.SUPABASE_URL?.replace(/\/$/,''),key:process.env.SUPABASE_SECRET_KEY});
export const r4Username=s=>typeof s==='string'&&/^[a-zA-Z0-9_.-]{2,30}$/.test(s.trim())?s.trim().toLowerCase():null;
export const strongPassword=s=>typeof s==='string'&&s.length>=10&&s.length<=128;
export function passwordHash(password){if(!strongPassword(password))throw Error('Password must contain 10 to 128 characters.');const salt=randomBytes(24).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');}
export function passwordMatches(password,stored){try{const [salt,hex]=stored.split(':');if(typeof password!=='string'||password.length>128||!salt||!hex)return false;return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(hex,'hex'))}catch{return false}}
export async function r4Db(path,options={}){
 const {url,key}=base();if(!url||!key)throw Error('R4 database unavailable');
 const r=await fetch(url+'/rest/v1/'+path,{...options,headers:{apikey:key,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('R4 database unavailable ('+r.status+')');
 return r.status===204?null:r.json();
}
export async function accountCount(){const rows=await r4Db('utw_r4_accounts?select=id&limit=1');if(!Array.isArray(rows))throw Error('R4 database unavailable');return rows.length}
export async function adminCount(){const rows=await r4Db('utw_r4_accounts?select=id&role=eq.admin&limit=1');if(!Array.isArray(rows))throw Error('R4 database unavailable');return rows.length}
export async function fetchAccount(username){const rows=await r4Db('utw_r4_accounts?'+new URLSearchParams({username:'eq.'+username,select:'*',limit:'1'}));return rows?.[0]||null}
export async function fetchAccountId(id){if(!/^[0-9a-f-]{36}$/i.test(id||''))return null;const rows=await r4Db('utw_r4_accounts?'+new URLSearchParams({id:'eq.'+id,select:'*',limit:'1'}));return rows?.[0]||null}
export async function allAccounts(){return r4Db('utw_r4_accounts?select=id,username,display_name,role,active,must_change_password,created_at,last_login_at&order=username.asc&limit=100')}
export async function createAccount({username,display_name,password,role='r4'}){
 const user=r4Username(username);if(!user||!strongPassword(password)||!['admin','r4'].includes(role))throw Error('Use a username of 2 to 30 letters/numbers and a 10+ character temporary password.');
 const rows=await r4Db('utw_r4_accounts',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({username:user,display_name:String(display_name||user).trim().slice(0,50),password_hash:passwordHash(password),role,must_change_password:true})});
 if(!Array.isArray(rows)||rows.length!==1)throw Error('Account was not saved');
 return rows[0];
}
export async function updateAccount(id,fields){const rows=await r4Db('utw_r4_accounts?'+new URLSearchParams({id:'eq.'+id}),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(fields)});if(!Array.isArray(rows)||rows.length!==1)throw Error('Account update failed');return rows[0]}
function signingKey(){if(!process.env.UTW_SESSION_SECRET||process.env.UTW_SESSION_SECRET.length<32)throw Error('Session configuration missing');return process.env.UTW_SESSION_SECRET}
function sign(s){return createHmac('sha256',signingKey()).update('utw-r4-account:'+s).digest('hex')}
export function signedCookie(account,kind='active'){const data={id:account.id,sv:account.session_version,kind,exp:Date.now()+8*3600000};const payload=Buffer.from(JSON.stringify(data)).toString('base64url');return payload+'.'+sign(payload)}
export function readSession(request){
 try{const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(x=>x.startsWith('utw_r4_user='))?.slice(12);if(!token)return null;
 const [payload,signature,extra]=token.split('.');if(extra||!payload||!signature)return null;const expected=sign(payload);if(!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return null;
 const data=JSON.parse(Buffer.from(payload,'base64url').toString());if(typeof data.id!=='string'||!Number.isInteger(data.sv)||!['active','pending'].includes(data.kind)||data.exp<Date.now()||data.exp>Date.now()+8*3600000)return null;return data;
 }catch{return null}
}
export async function sessionUser(request,{allowPending=false}={}){
 const data=readSession(request);if(!data||(!allowPending&&data.kind!=='active'))return null;
 const account=await fetchAccountId(data.id);
 if(!account||!account.active||account.session_version!==data.sv)return null;
 if(!allowPending&&account.must_change_password)return null;
 return account;
}
export function sessionSetCookie(request,account,kind='active'){return 'utw_r4_user='+signedCookie(account,kind)+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'+(new URL(request.url).protocol==='https:'?'; Secure':'')}
export function sessionClearCookie(request){return 'utw_r4_user=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+(new URL(request.url).protocol==='https:'?'; Secure':'')}
export async function rateLogin(request,username=null){
 const ip=(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'unknown').split(',')[0];
 const h=createHash('sha256').update(ip).digest('hex');
 const count=await r4Db('rpc/utw_buddy_rate_limit',{method:'POST',body:JSON.stringify({p_key:'r4-account-login:'+h})});
 if(!Number.isInteger(count)||count>10)throw Error('Too many attempts. Try again later.');
 const normalized=r4Username(username);
 if(normalized){
  // Limit guessing against a single account, even across different IP addresses.
  const perAccount=await r4Db('rpc/utw_buddy_rate_limit',{method:'POST',body:JSON.stringify({p_key:'r4-account-name:'+createHash('sha256').update(normalized).digest('hex')})});
  if(!Number.isInteger(perAccount)||perAccount>5)throw Error('Too many attempts. Try again later.');
 }
}
const TEST_DUMMY_HASH='243cf632cdee80da4c8d4715d62e21f49a31b:'+createHash('sha512').update('r4-login-dummy-value').digest('hex');
export async function verifyCredentials(username,password){
 const id=r4Username(username);const account=id?await fetchAccount(id):null;
 // Equal-cost hash for missing account to discourage account enumeration.
 if(!account){passwordMatches(password,TEST_DUMMY_HASH);return null}
 const valid=account.active&&passwordMatches(password,account.password_hash);
 if(!valid)return null;
 // Short issued passcodes are only valid for first-time activation. Full passwords do not expire here.
 if(account.must_change_password&&account.temporary_expires_at&&Date.parse(account.temporary_expires_at)<=Date.now())return null;
 return account;
}
export const secureText=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
