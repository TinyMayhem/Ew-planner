import {createHash, randomBytes, randomUUID, timingSafeEqual, createHmac} from 'node:crypto';
export const SKILLS=['winwin','hospital'];
export const hash=value=>createHash('sha256').update(String(value)).digest('hex');
export const emptyBoard=()=>({revision:0,members:[],pairings:[],publishedAt:null,updatedAt:null});
export function cleanMember(raw){
 const text=(value,max)=>String(value??'').trim().slice(0,max);
 const ign=text(raw.ign,50),alliance=text(raw.alliance||'UTW',12).toUpperCase(),profession=raw.profession;
 if(!ign||!alliance||!['engineer','warleader'].includes(profession))throw new Error('Enter your name, alliance and current profession.');
 const currentBuddies=Object.fromEntries(SKILLS.map(key=>[key,text(raw.currentBuddies?.[key],50)]));
 const hasBuddies=Object.fromEntries(SKILLS.map(key=>[key,raw.hasBuddies?.[key]===true||Boolean(currentBuddies[key])]));
 const skills=Object.fromEntries(SKILLS.map(key=>[key,{provide:profession==='engineer'&&raw.skills?.[key]?.provide===true,need:raw.skills?.[key]?.need===true||hasBuddies[key]}]));
 return {ign,alliance,profession,skills,currentBuddies,hasBuddies};
}
const identity=m=>m.alliance.normalize('NFKC').toLowerCase()+'|'+m.ign.normalize('NFKC').toLowerCase();
export const receivesSkill=(member,skill)=>Boolean(member.skills?.[skill]?.need||member.hasBuddies?.[skill]||member.currentBuddies?.[skill]?.trim());
export function validatePair(board,pair,ignoreId){
 if(!SKILLS.includes(pair.skill)||pair.providerId===pair.recipientId)return 'Choose two different members and a skill.';
 const provider=board.members.find(m=>m.id===pair.providerId),recipient=board.members.find(m=>m.id===pair.recipientId);
 if(!provider||!recipient)return 'A member is no longer registered.';
 if(provider.profession!=='engineer'||!provider.skills[pair.skill].provide)return 'The provider no longer offers this skill.';
 if(!receivesSkill(recipient,pair.skill))return 'The recipient no longer requests this skill.';
 if(provider.alliance!==recipient.alliance)return 'Choose members from the same alliance.';
 if(board.pairings.some(p=>p.id!==ignoreId&&['draft','active'].includes(p.status)&&p.skill===pair.skill&&(p.providerId===pair.providerId||p.recipientId===pair.recipientId)))return 'One of these members already has this skill assigned. Remove that pairing first.';
 return null;
}
export function invalidatePairs(board,changedId,reason){
 for(const p of board.pairings){if(!['active','draft'].includes(p.status))continue;
 const error=reason&&(p.providerId===changedId||p.recipientId===changedId)?reason:validatePair(board,p,p.id);
 if(error){p.wasPublished=p.status==='active'||p.wasPublished;p.status='reassign';p.reason=error;p.updatedAt=new Date().toISOString();}}
}
export function register(board,raw){const member=cleanMember(raw);if(board.members.some(m=>identity(m)===identity(member)))throw new Error('This name is already registered. Select Edit beside your name instead of registering again.');if(board.members.length>=500)throw new Error('The board is full. Contact Tiny.');const token=randomBytes(32).toString('base64url'),now=new Date().toISOString();const result={...member,id:randomUUID(),editHash:hash(token),createdAt:now,updatedAt:now};board.members.push(result);return {member:publicMember(result),token};}
export function update(board,id,raw){const member=board.members.find(m=>m.id===id);if(!member)throw new Error('Member not found.');const changes=cleanMember(raw);if(board.members.some(m=>m.id!==id&&identity(m)===identity(changes)))throw new Error('That name is already registered.');const professionChanged=changes.profession!==member.profession;Object.assign(member,changes,{updatedAt:new Date().toISOString()});invalidatePairs(board,id,professionChanged?'Buddy changed profession. Needs reassignment.':null);return publicMember(member);}
export function assign(board,raw){const pair={id:randomUUID(),skill:raw.skill,providerId:raw.providerId,recipientId:raw.recipientId,status:'draft',createdAt:new Date().toISOString(),wasPublished:false};const error=validatePair(board,pair);if(error)throw new Error(error);board.pairings.push(pair);return pair;}
export function publish(board){invalidatePairs(board);for(const p of board.pairings)if(p.status==='draft'){p.status='active';p.wasPublished=true;}board.publishedAt=new Date().toISOString();}
export function publicMember(m){const {editHash,...rest}=m;return {...rest,hasBuddies:Object.fromEntries(SKILLS.map(s=>[s,Boolean(m.hasBuddies?.[s]||m.currentBuddies?.[s]?.trim())])),skills:Object.fromEntries(SKILLS.map(s=>[s,{...m.skills[s],need:receivesSkill(m,s)}]))};}

export function snapshotMember(member){
 if(!member)return null;
 return {
  ign:member.ign,alliance:member.alliance,profession:member.profession,
  skills:Object.fromEntries(SKILLS.map(s=>[s,{provide:Boolean(member.skills?.[s]?.provide),need:Boolean(member.skills?.[s]?.need)}])),
  hasBuddies:Object.fromEntries(SKILLS.map(s=>[s,Boolean(member.hasBuddies?.[s])])),
  currentBuddies:Object.fromEntries(SKILLS.map(s=>[s,String(member.currentBuddies?.[s]||'')]))
 };
}
const PROFILE_PATHS=[
 [['ign'],'Name'],[['alliance'],'Alliance'],[['profession'],'Profession'],
 ...SKILLS.flatMap(s=>[
  [['skills',s,'provide'],(s==='winwin'?'Win-Win':'Hospital Aid')+' · Can provide'],
  [['skills',s,'need'],(s==='winwin'?'Win-Win':'Hospital Aid')+' · Needs buddy'],
  [['hasBuddies',s],(s==='winwin'?'Win-Win':'Hospital Aid')+' · Already has buddy'],
  [['currentBuddies',s],(s==='winwin'?'Win-Win':'Hospital Aid')+' · Reported buddy']
 ])
];
const atPath=(object,path)=>path.reduce((v,key)=>v?.[key],object);
const valueText=value=>typeof value==='boolean'?(value?'Yes':'No'):String(value??'');
export function memberChanges(before,after){
 if(!before)return [{field:'Member',from:'Not registered',to:after?.ign||''}];
 if(!after)return [{field:'Member',from:before?.ign||'',to:'Removed'}];
 return PROFILE_PATHS.flatMap(([path,field])=>{
  const from=atPath(before,path),to=atPath(after,path);
  return from===to?[]:[{field,from:valueText(from),to:valueText(to)}];
 });
}
export function logBuddyChange(board,{kind,before=null,after=null,profileId,actor='Member (unverified)',reverseOf=null}){
 const changes=memberChanges(before,after);
 if(!changes.length)return null;
 const event={
  id:randomUUID(),kind,profileId,profileName:after?.ign||before?.ign||'Unknown',
  at:new Date().toISOString(),actor,changes,before,after,reverseOf,
  revision:board.revision+1
 };
 // Retain the most recent 2,000 events in the existing revision-controlled board.
 // Records are never exposed in public GET responses.
 if(!Array.isArray(board.audit))board.audit=[];
 board.audit.push(event);
 if(board.audit.length>2000)board.audit.splice(0,board.audit.length-2000);
 return event;
}
export function undoBuddyChange(board,eventId){
 const history=Array.isArray(board.audit)?board.audit:[];
 const event=history.find(e=>e.id===eventId);
 if(!event||!['Profile updated','Admin profile updated'].includes(event.kind)||!event.before)throw new Error('Only a saved profile edit can be undone.');
 const latest=history.findLast(e=>e.profileId===event.profileId);
 if(latest?.id!==event.id)throw new Error('This profile changed again. Only its most recent edit can be undone.');
 const member=board.members.find(m=>m.id===event.profileId);
 if(!member)throw new Error('This member is no longer registered.');
 const before=snapshotMember(member);
 if(memberChanges(before,event.after).length)throw new Error('The profile no longer matches this edit. Refresh before undoing.');
 const restored=update(board,member.id,event.before);
 logBuddyChange(board,{kind:'Admin undo',profileId:member.id,actor:'Admin',before,after:snapshotMember(board.members.find(m=>m.id===event.profileId)),reverseOf:event.id});
 return restored;
}
export function publicBoard(board,admin=false){
 const {audit,...safe}=board;
 return {...safe,members:board.members.map(m=>{const clean=publicMember(m);if(!admin)delete clean.currentBuddies;return clean;}),
  pairings:board.pairings.filter(p=>admin||p.status==='active'||p.wasPublished),
  ...(admin?{audit:(audit||[]).slice().reverse()}:{} )};
}

export function memberByToken(board,token){if(typeof token!=='string'||token.length<30||token.length>100)return null;const digest=hash(token);return board.members.find(m=>m.editHash===digest);}
export function adminPasswordOK(password){const expected=process.env.UTW_ADMIN_PASSWORD;if(!expected||expected.length<16||typeof password!=='string'||password.length>200)return false;return timingSafeEqual(Buffer.from(hash(password)),Buffer.from(hash(expected)));}
function signature(payload){return createHmac('sha256',process.env.UTW_SESSION_SECRET).update(payload).digest('base64url');}
export function sessionToken(purpose='admin'){const payload=Buffer.from(JSON.stringify({purpose,exp:Date.now()+8*3600000,nonce:randomBytes(16).toString('hex')})).toString('base64url');return payload+'.'+signature(payload);}
export function validSession(cookie,purpose='admin'){if(!process.env.UTW_SESSION_SECRET)return false;try{const match=(cookie||'').match(new RegExp('(?:^|;\\s*)utw_'+purpose+'=([^;]+)'));if(!match)return false;const [payload,sig]=match[1].split('.');const expected=signature(payload);if(sig?.length!==expected.length||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return false;const data=JSON.parse(Buffer.from(payload,'base64url'));return data.purpose===purpose&&data.exp>Date.now();}catch{return false;}}

export function pagePasswordOK(password){const expected=process.env.UTW_PAGE_PASSWORD;return typeof expected==='string'&&expected.length===4&&typeof password==='string'&&timingSafeEqual(Buffer.from(hash(password)),Buffer.from(hash(expected)));}
