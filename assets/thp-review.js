import {powerFromInput} from './thp-power.mjs';
// Private R4 review queue for Members Den self-service THP submissions.
const $=id=>document.getElementById(id);
const fmt=n=>Number(n).toLocaleString('en-CA');
const norm=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
let latestResponse=null;
async function api(url,body){
 const options=body?{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{credentials:'same-origin',cache:'no-store'};
 const response=await fetch(url,options),data=await response.json().catch(()=>({}));
 if(response.status===401){location.href='/r4-planner';throw Error('R4 sign-in expired')}
 if(!response.ok)throw Error(data.error||'Review queue unavailable');
 return data;
}
function label(content,child){
 const wrap=document.createElement('label');wrap.textContent=content;wrap.append(child);return wrap;
}
function node(tag,content,cls){
 const el=document.createElement(tag);if(content!==null&&content!==undefined)el.textContent=String(content);
 if(cls)el.className=cls;return el;
}
function rankedMatches(name,roster,aliases){
 const target=norm(name),byId=new Map();
 for(const a of aliases||[]){
  const id=String(a.source_member_id||'');
  if(!byId.has(id))byId.set(id,[]);
  byId.get(id).push(norm(a.alias));
 }
 return [...roster].map(m=>{
  const canonical=norm(m.name),old=byId.get(String(m.source_member_id))||[];
  const rank=canonical===target?0:old.includes(target)?1:canonical.startsWith(target)?2:old.some(s=>s.startsWith(target))?3:canonical.includes(target)?4:old.some(s=>s.includes(target))?5:6;
  return {...m,rank};
 }).sort((a,b)=>a.rank-b.rank||String(a.name).localeCompare(b.name,undefined,{sensitivity:'base'}));
}
function renderCard(item,response){
 const root=node('article',null,'thp-review-card');
 const head=node('div',null,'thp-review-head'),title=node('div');
 title.append(node('h3',item.submitted_name),node('small','Submitted '+new Date(item.submitted_at).toLocaleString()+' · THP date '+item.measurement_date));
 head.append(title);
 if(item.evidence_path){
  const link=node('a','View private screenshot ↗','stat-button');
  link.href='/api/thp-update?evidence='+encodeURIComponent(item.id);
  link.target='_blank';link.rel='noopener noreferrer';head.append(link);
 }
 root.append(head);
 const sameName=response.rows.filter(r=>r.status==='pending'&&norm(r.submitted_name)===norm(item.submitted_name));
 if(sameName.length>1)root.append(node('p','Possible duplicate: '+sameName.length+' pending submissions under this in-game name. Check dates and numbers before approving.','thp-review-note'));
 const facts=node('p','Submitted: '+fmt(item.hero_power)+' Hero Power · '+item.squad_type.toUpperCase()+' · '+fmt(item.squad_power)+' squad power','thp-review-facts');
 root.append(facts);
 if(item.member_note)root.append(node('p','Member note: '+item.member_note,'thp-review-note'));
 const form=node('div',null,'thp-review-fields');
 const pool=rankedMatches(item.submitted_name,response.roster,response.aliases);
 const choose=document.createElement('select');
 choose.append(new Option('Choose confirmed player identity',''));
 for(const player of pool)choose.append(new Option((player.rank<=1?'✓ ':player.rank<=3?'≈ ':'')+player.name,player.source_member_id));
 const find=document.createElement('input');find.type='search';find.placeholder='Filter player list';find.autocomplete='off';
 find.addEventListener('input',()=>{
  const current=choose.value,term=norm(find.value);choose.replaceChildren(new Option('Choose confirmed player identity',''));
  for(const p of pool.filter(p=>!term||norm(p.name).includes(term)))choose.append(new Option(p.name,p.source_member_id));
  if([...choose.options].some(o=>o.value===current))choose.value=current;
 });
 const history=node('p','Choose a member to view their previous THP. Always verify the identity before approving.','thp-review-history');
 const old=new Map(response.latest.map(m=>[String(m.source_member_id),m]));
 const squadOld=new Map(response.squads.map(m=>[String(m.source_member_id),m]));
 function showHistory(){
  const past=old.get(choose.value),sq=squadOld.get(choose.value);
  history.textContent=past?'Last saved THP: '+fmt(past.thp)+' on '+past.recorded_on+(sq?' · Previous squad: '+(sq.squad_type||'unspecified')+' '+fmt(sq.squad_power??0):''):
   choose.value?'No earlier THP for this member.':'Choose a member to review their previous THP.';
  const candidate=pool.find(p=>String(p.source_member_id)===choose.value);
  if(candidate&&candidate.rank>1)history.textContent+=' Confirm this is the same player; the name is not an exact match.';
 }
 choose.addEventListener('change',showHistory);
 form.append(label('Find the right member',find),label('Confirm matching player',choose),history);
 const hero=document.createElement('input');hero.value=fmt(item.hero_power);hero.inputMode='decimal';
 const squadType=document.createElement('select');
 for(const [v,t] of [['tank','Tank'],['air','Air'],['missile','Missile']])squadType.append(new Option(t,v));
 squadType.value=item.squad_type;
 const squadPower=document.createElement('input');squadPower.value=fmt(item.squad_power);squadPower.inputMode='decimal';
 const note=document.createElement('textarea');note.rows=2;note.maxLength=500;note.placeholder='Internal reviewer note or rejection reason';
 const edit=node('div',null,'thp-review-edit');
 edit.append(label('Approved Hero Power',hero),label('Main squad type',squadType),label('Squad power',squadPower));
 form.append(edit,label('Review note',note));
 const feedback=node('p','', 'thp-review-feedback');feedback.setAttribute('role','status');
 const buttons=node('div',null,'thp-review-actions');
 const approve=node('button','Approve & update THP','stat-button primary'),reject=node('button','Reject','stat-button');
 approve.type='button';reject.type='button';
 async function send(decision){
  const id=choose.value,power=powerFromInput(hero.value),squad=powerFromInput(squadPower.value);
  if(decision==='approved'&&(!id||power===null||squad===null)){
   feedback.textContent='Choose the correct member and verify both power values first.';return;
  }
  if(decision==='approved'&&!confirm('Approve '+item.submitted_name+' for '+pool.find(p=>String(p.source_member_id)===id)?.name+' and update the THP Tracker?'))return;
  if(decision==='rejected'&&!confirm('Reject the THP submission from '+item.submitted_name+'?'))return;
  approve.disabled=true;reject.disabled=true;feedback.textContent='Saving review…';
  try{
   await api('/api/thp-update',{
    action:'review',id:item.id,decision,sourceMemberId:id,
    heroPower:hero.value,squadPower:squadPower.value,squadType:squadType.value,reviewNote:note.value.trim()
   });
   feedback.textContent='Saved. Refreshing the approval queue…';
   await load();
   $('thp-refresh')?.click();
  }catch(e){feedback.textContent=e.message;approve.disabled=false;reject.disabled=false}
 }
 approve.addEventListener('click',()=>send('approved'));reject.addEventListener('click',()=>send('rejected'));
 buttons.append(approve,reject);form.append(buttons,feedback);root.append(form);
 return root;
}
async function load(){
 const root=$('thp-review-list'),status=$('thp-review-status');
 if(!root||!status)return;
 status.textContent='Checking member submissions…';
 try{
  const response=await api('/api/thp-update?review=1');
  latestResponse=response;root.replaceChildren();
  const pending=response.rows.filter(r=>r.status==='pending'),recent=response.rows.filter(r=>r.status!=='pending').slice(0,8);
  status.textContent=pending.length+' pending member update'+(pending.length===1?'':'s')+'. R4 must confirm names before publishing.';
  const tab=document.querySelector('[data-tab="thp"]');
  if(tab)tab.textContent=pending.length?'Member THP ('+pending.length+' pending)':'Member THP';
  if(!pending.length)root.append(node('p','No pending member THP updates. All caught up!','stat-muted'));
  for(const item of pending)root.append(renderCard(item,response));
  const history=$('thp-review-recent');history.replaceChildren();
  for(const r of recent)history.append(node('p',r.submitted_name+' · '+r.status+' · '+(r.approved_member_name||'not updated')+' · '+new Date(r.reviewed_at).toLocaleString(),'stat-muted'));
 }catch(e){status.textContent='Unable to load private THP updates: '+e.message}
}
$('thp-review-refresh')?.addEventListener('click',load);
document.querySelector('[data-tab="thp"]')?.addEventListener('click',load);
if(new URLSearchParams(location.search).get('thp')==='1')window.addEventListener('load',load,{once:true});
