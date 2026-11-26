import {randomBytes,createHash} from 'node:crypto';
export const TERMS_VERSION='2026-11-25-v1';
export const acceptedTerms=b=>b?.terms_version===TERMS_VERSION&&Array.isArray(b.terms)&&b.terms.length===4&&b.terms.every(x=>x===true);
export const tiers={'Squad Check':1,'Growth Plan':2,'Full Account Strategy':4};
export const admins=new Set(['tiny','devi']);
export const code=()=> 'DV-'+randomBytes(24).toString('base64url');
export const codeHash=s=>createHash('sha256').update(String(s)).digest('hex');
export const validCode=s=>/^DV-[A-Za-z0-9_-]{32}$/.test(s||'');
export const isAdmin=a=>Boolean(a?.active&&!a.must_change_password&&admins.has(a.username)&&['admin','r4'].includes(a.role));
export const text=(v,n=3000)=>String(v??'').trim().slice(0,n);
export const uuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s||'');
export function intake(b){const count=Number(b.squad_count),tier=b.tier,types=b.squad_types; if(!Object.hasOwn(tiers,tier)||!Number.isInteger(count)||count<1||count>tiers[tier]||!text(b.ign,80)||!/^\d{1,8}$/.test(b.server)||!['upload','ingame'].includes(b.method)||b.pvp_confirmed!==true||!Array.isArray(types)||types.length!==count||types.some(t=>!['Tank','Aircraft','Missile','Mixed / Other',''].includes(t)))throw Error('Check your review tier, squad details and PvP confirmation.');return {ign:text(b.ign,80),server:b.server,tier,squad_count:count,squad_types:types,goals:text(b.goals),spending:text(b.spending,50),method:b.method,pvp_confirmed:true};}
export const transitions={intake:['submitted','awaiting_screenshots','abandoned'],submitted:['awaiting_payment','awaiting_screenshots','in_progress','abandoned'],awaiting_payment:['awaiting_screenshots','in_progress','abandoned'],awaiting_screenshots:['awaiting_payment','in_progress','abandoned'],in_progress:['awaiting_screenshots','abandoned'],completed:[],abandoned:[]};
export function canTransition(row,next,paid){return transitions[row.status]?.includes(next)&&(!['in_progress','completed'].includes(next)||paid);}
export function queueMessage(n,paused,max){return paused?'Requests are temporarily paused.':n>=max?'There are '+n+' reviews in the queue. New requests are temporarily closed.':n+' '+(n===1?'review':'reviews')+' in the queue.'+(n>=5?' It may take a while to complete your review.':'');}
export const fileType=(mime,report=false)=>({'image/jpeg':'jpg','image/png':'png','image/webp':'webp',...(report?{'application/pdf':'pdf'}:{})})[mime];
export function genuineImage(bytes,mime){return mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255||mime==='image/png'&&[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x)||mime==='image/webp'&&Buffer.from(bytes.slice(0,4)).toString()==='RIFF'&&Buffer.from(bytes.slice(8,12)).toString()==='WEBP';}
