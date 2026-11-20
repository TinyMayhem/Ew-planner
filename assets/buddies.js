const $=id=>document.getElementById(id),NAMES={winwin:'Win-Win',hospital:'Hospital Aid'};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let board={ready:false,members:[],pairings:[],audit:[],revision:0,admin:false},editingId=null,adminEditing=false;
function toast(message){$('toast').textContent=message;$('toast').classList.remove('hidden');setTimeout(()=>$('toast').classList.add('hidden'),3500);}
function message(id,text,error=false){$(id).textContent=text;$(id).className='notice'+(error?' error':'');}
async function api(body,profileId=null){
 const url=profileId?'/api/buddies?profile='+encodeURIComponent(profileId):'/api/buddies';
 const response=await fetch(url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify({...body,revision:board.revision}):undefined,cache:'no-store'});
 const data=await response.json();
 if(!response.ok)throw new Error(data.error||'Could not reach the board.');
 return data;
}
async function refresh(){
 try{
  board={ready:false,members:[],pairings:[],audit:[],revision:0,admin:false,...await api()};
  $('pageGate').classList.toggle('hidden',!board.locked);
  $('boardContent').classList.toggle('hidden',Boolean(board.locked));
  $('memberFields').disabled=!board.ready;
  $('serviceStatus').textContent=board.ready?'Shared board connected. Updates are saved for everyone.':board.message||'The shared board is temporarily unavailable.';
  $('serviceStatus').classList.toggle('error',!board.ready);
  render();
 }catch(error){message('serviceStatus',error.message,true);$('memberFields').disabled=true;}
}
function currentPair(id,skill){return board.pairings.find(p=>p.skill===skill&&p.status==='active'&&(p.providerId===id||p.recipientId===id));}
function member(id){return board.members.find(m=>m.id===id);}
function skillStatus(m,skill){const pair=currentPair(m.id,skill);if(pair){const providing=pair.providerId===m.id,other=member(providing?pair.recipientId:pair.providerId);return {status:'active',text:(providing?'Providing to ':'Receiving from ')+(other?.ign||'Removed member')};}const stale=board.pairings.filter(p=>p.skill===skill&&p.status==='reassign'&&p.wasPublished&&(p.providerId===m.id||p.recipientId===m.id)).at(-1);if(stale&&(m.skills[skill].need||m.skills[skill].provide))return {status:'reassign',text:stale.reason||'Needs reassignment'};if(m.skills[skill].need)return {status:'waiting',text:'Waiting for a buddy'};if(m.skills[skill].provide)return {status:'available',text:'Available to provide'};return {status:'none',text:'Not requested / not offered'};}
function fillForm(m,admin){
 editingId=m.id;adminEditing=admin;
 $('ign').value=m.ign;$('alliance').value=m.alliance;
 $('ign').readOnly=!admin;$('alliance').readOnly=!admin;
 $('profession').value=m.profession;
 for(const skill of Object.keys(NAMES)){
  $(skill+'Provide').checked=Boolean(m.skills[skill].provide);
  $(skill+'Need').checked=Boolean(m.skills[skill].need);
  $(skill+'CurrentBuddy').value=m.currentBuddies?.[skill]||'';
  $(skill+'HasBuddy').checked=Boolean(m.hasBuddies?.[skill]||m.currentBuddies?.[skill]);
 }
 $('formTitle').textContent=admin?'Edit '+m.ign:'Update my profile: '+m.ign;
 $('submitMember').textContent='Save my changes';$('newEntry').classList.remove('hidden');
 professionUI();
}
async function openOwnProfile(id){
 try{
  const data=await api(null,id);
  if(!data.member)throw new Error('Member not found.');
  fillForm(data.member,false);
  $('formMessage').textContent='';
  $('signup').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(error){toast(error.message);}
}
function buddyFieldsUI(){for(const skill of Object.keys(NAMES))$(skill+'BuddyField').classList.toggle('hidden',!$(skill+'HasBuddy').checked);}
for(const skill of Object.keys(NAMES))$(skill+'HasBuddy').addEventListener('change',buddyFieldsUI);
function professionUI(){buddyFieldsUI();const engineer=$('profession').value==='engineer';for(const skill of Object.keys(NAMES)){$(skill+'Provide').disabled=!engineer;if(!engineer)$(skill+'Provide').checked=false;}$('professionNote').textContent=engineer?'Only mark skills you have unlocked and can actually provide.':'War Leaders can request skills. Switch to Engineer to mark skills you have unlocked.';}

function render(){const alliances=[...new Set(board.members.map(m=>m.alliance))].sort(),old=$('allianceFilter').value;$('allianceFilter').innerHTML='<option value="all">All alliances</option>'+alliances.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('');$('allianceFilter').value=alliances.includes(old)?old:'all';$('stats').innerHTML=board.ready?`<span><b>${board.members.length}</b> members</span><span><b>${board.pairings.filter(p=>p.status==='active').length}</b> published pairings</span><span><b>${board.members.filter(m=>Object.keys(NAMES).some(s=>['waiting','reassign'].includes(skillStatus(m,s).status))).length}</b> members needing a buddy</span>`:'';$('publishedAt').textContent=board.publishedAt?'Pairings last published '+new Date(board.publishedAt).toLocaleString():'No pairings have been published yet.';$('adminPanel').classList.toggle('hidden',!board.admin);renderPublic();if(board.admin)renderAdmin();}
function renderPublic(){const search=$('search').value.toLowerCase(),alliance=$('allianceFilter').value,status=$('statusFilter').value;const list=board.members.filter(m=>m.ign.toLowerCase().includes(search)&&(alliance==='all'||m.alliance===alliance)&&(status==='all'||Object.keys(NAMES).some(s=>skillStatus(m,s).status===status))).sort((a,b)=>a.ign.localeCompare(b.ign));const cell=(m,skill)=>{const pairs=board.pairings.filter(p=>p.skill===skill&&p.status==='active'&&(p.providerId===m.id||p.recipientId===m.id));if(pairs.length)return pairs.map(p=>{const receiving=p.recipientId===m.id;return '<span class="buddy-name">'+esc(member(receiving?p.providerId:p.recipientId)?.ign||'Removed member')+'</span><small class="muted">'+(receiving?'Receiving from':'Providing to')+'</small>';}).join('<br>');const st=skillStatus(m,skill);return '<span class="'+(st.status==='reassign'?'buddy-warning':'muted')+'">'+esc(st.status==='waiting'?'Waiting':st.status==='available'?'Available':st.status==='reassign'?'Needs reassignment':'Not requested')+'</span>';};
$('publicMembers').innerHTML=list.length?'<table class="buddy-table"><caption class="hidden">Current published buddies by player and skill</caption><thead><tr><th scope="col">Player</th><th scope="col">Win-Win</th><th scope="col">Hospital Aid</th><th scope="col">Edit</th></tr></thead><tbody>'+list.map(m=>'<tr><th scope="row"><span class="buddy-name">'+esc(m.ign)+'</span><small class="muted">'+(m.profession==='engineer'?'Engineer':'War Leader')+' · '+esc(m.alliance)+'</small></th><td>'+cell(m,'winwin')+'</td><td>'+cell(m,'hospital')+'</td><td><button class="btn pale" type="button" data-self-edit="'+esc(m.id)+'" aria-label="Edit profile for '+esc(m.ign)+'">Edit</button></td></tr>').join('')+'</tbody></table>':'<p class="muted">No matching entries yet.</p>';}


function normalizedName(name){return String(name).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');}
function nameScore(a,b){a=normalizedName(a);b=normalizedName(b);if(!a||!b)return 0;if(a===b)return 1;const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return 1-row[b.length]/Math.max(a.length,b.length);}
function eligibleReportedPairs(m,skill){
 const busy=(id,role)=>board.pairings.some(p=>p.skill===skill&&['active','draft'].includes(p.status)&&p[role]===id);
 const result=[];
 for(const other of board.members){if(other.id===m.id||other.alliance!==m.alliance)continue;
 if(m.skills[skill].need&&other.profession==='engineer'&&other.skills[skill].provide&&!busy(other.id,'providerId')&&!busy(m.id,'recipientId'))result.push({providerId:other.id,recipientId:m.id,other,receiving:true});
 if(m.profession==='engineer'&&m.skills[skill].provide&&other.skills[skill].need&&!busy(m.id,'providerId')&&!busy(other.id,'recipientId'))result.push({providerId:m.id,recipientId:other.id,other,receiving:false});
 }
 return result;
}
function renderBuddySuggestions(){
 const rows=[];
 for(const m of board.members)for(const [skill,label] of Object.entries(NAMES)){
 const reported=m.currentBuddies?.[skill];if(!reported)continue;
 const existing=board.pairings.find(p=>p.skill===skill&&['active','draft'].includes(p.status)&&(p.providerId===m.id||p.recipientId===m.id)&&nameScore(reported,member(p.providerId===m.id?p.recipientId:p.providerId)?.ign||'')>=0.6);
 if(existing)continue;
 const options=eligibleReportedPairs(m,skill).map(p=>({...p,score:nameScore(reported,p.other.ign)})).sort((a,b)=>b.score-a.score);
 const key=m.id+'-'+skill;
 rows.push('<div class="member-card section"><strong>'+esc(m.ign)+' · '+label+'</strong><p class="small">Reported buddy: <b>'+esc(reported)+'</b></p><label class="small" for="suggest-'+key+'">Confirm the matching player</label><select id="suggest-'+key+'"><option value="">Choose a player to confirm</option>'+options.map(p=>'<option value="'+p.providerId+'|'+p.recipientId+'">'+esc(p.other.ign)+' · '+(p.receiving?'provides to this member':'receives from this member')+(p.score===1?' · Name match':p.score>=0.6?' · Possible name match':'')+'</option>').join('')+'</select><p class="small muted">'+(options.length?'Closest names appear first. Check the player and direction before approving.':'No eligible player registered yet. Ask the buddy to submit, or check their skills and existing assignments.')+'</p><button class="btn pale" data-approve-buddy="'+key+'" data-skill="'+skill+'">Approve as draft</button></div>');
 }
 $('buddySuggestions').innerHTML=rows.join('')||'<p class="muted">No unassigned reported buddies to review.</p>';
}

function renderAdmin(){renderBuddySuggestions();const taken=(id,skill,role)=>board.pairings.some(p=>p.skill===skill&&['draft','active'].includes(p.status)&&p[role]===id);$('adminQueue').innerHTML=Object.entries(NAMES).map(([skill,name])=>{const needs=board.members.filter(m=>m.skills[skill].need&&!taken(m.id,skill,'recipientId')),offers=board.members.filter(m=>m.profession==='engineer'&&m.skills[skill].provide&&!taken(m.id,skill,'providerId'));return `<div class="member-card"><h3>${name}</h3><strong class="small">Needs assignment (${needs.length})</strong><p class="small">${needs.map(m=>esc(m.ign)).join(', ')||'Everyone covered.'}</p><strong class="small">Available Engineers (${offers.length})</strong><p class="small">${offers.map(m=>esc(m.ign)).join(', ')||'None available.'}</p></div>`;}).join('');renderPairOptions();$('adminPairs').innerHTML=board.pairings.filter(p=>['active','draft','reassign'].includes(p.status)).slice().reverse().map(p=>`<div class="pair-row"><span><b>${NAMES[p.skill]}</b>: ${esc(member(p.providerId)?.ign||'Removed member')} → ${esc(member(p.recipientId)?.ign||'Removed member')} <span class="badge ${p.status==='active'?'good':p.status==='reassign'?'warn':''}">${p.status==='reassign'?'Needs reassignment':p.status}</span>${p.reason?'<br><small>'+esc(p.reason)+'</small>':''}</span>${p.status!=='reassign'?`<button class="btn pale" data-unassign="${p.id}">Remove pairing</button>`:''}</div>`).join('')||'<p class="muted">No assignments yet.</p>';$('adminMembers').innerHTML=board.members.map(m=>`<div class="pair-row"><span><b>${esc(m.ign)}</b> · ${esc(m.alliance)} · ${m.profession==='engineer'?'Engineer':'War Leader'}</span><div class="actions"><button class="btn pale" data-edit="${m.id}">Edit</button><button class="btn pale" data-remove="${m.id}">Remove</button></div></div>`).join('');renderAudit();}

function renderAudit(){
 if(!board.admin)return;
 const events=Array.isArray(board.audit)?board.audit:[];
 const filter=$('auditFilter'),selected=filter.value;
 const profiles=[...new Map(events.map(e=>[e.profileId,e.profileName])).entries()].sort((a,b)=>String(a[1]).localeCompare(String(b[1])));
 filter.innerHTML='<option value="all">All profiles</option>'+profiles.map(([id,name])=>'<option value="'+esc(id)+'">'+esc(name)+'</option>').join('');
 filter.value=profiles.some(([id])=>id===selected)?selected:'all';
 const newestByProfile=new Map();
 for(const entry of events)if(!newestByProfile.has(entry.profileId))newestByProfile.set(entry.profileId,entry.id);
 const visible=events.filter(e=>filter.value==='all'||e.profileId===filter.value);
 $('adminAudit').innerHTML=visible.length?visible.map(e=>{
  const canUndo=['Profile updated','Admin profile updated'].includes(e.kind)&&newestByProfile.get(e.profileId)===e.id&&Boolean(board.members.find(m=>m.id===e.profileId));
  const changes=(e.changes||[]).map(c=>'<div><strong>'+esc(c.field)+'</strong>: '+esc(c.from)+' → '+esc(c.to)+'</div>').join('');
  return '<div class="member-card section"><div class="section-head"><strong>'+esc(e.profileName)+'</strong><span class="badge">'+esc(e.kind)+'</span></div><p class="small muted">'+esc(new Date(e.at).toLocaleString())+' · '+esc(e.actor||'Unknown editor')+'</p><div class="small buddy-audit-diff">'+changes+'</div>'+(canUndo?'<button class="btn pale" data-undo-event="'+esc(e.id)+'" style="margin-top:12px">Undo latest edit</button>':'')+'</div>';
 }).join(''):'<p class="muted">No recorded profile edits yet.</p>';
}
$('auditFilter').addEventListener('change',renderAudit);

function renderPairOptions(){const skill=$('pairSkill').value,used=(id,role)=>board.pairings.some(p=>p.skill===skill&&['draft','active'].includes(p.status)&&p[role]===id);const providers=board.members.filter(m=>m.profession==='engineer'&&m.skills[skill].provide&&!used(m.id,'providerId'));$('provider').innerHTML='<option value="">Choose Engineer</option>'+providers.map(m=>`<option value="${m.id}">${esc(m.ign)} · ${esc(m.alliance)}</option>`).join('');recipientOptions();}
function recipientOptions(){const skill=$('pairSkill').value,provider=member($('provider').value);const recipients=board.members.filter(m=>m.skills[skill].need&&m.id!==provider?.id&&(!provider||m.alliance===provider.alliance)&&!board.pairings.some(p=>p.skill===skill&&['draft','active'].includes(p.status)&&p.recipientId===m.id));$('recipient').innerHTML='<option value="">Choose recipient</option>'+recipients.map(m=>`<option value="${m.id}">${esc(m.ign)} · ${esc(m.alliance)}</option>`).join('');}
$('profession').addEventListener('change',professionUI);professionUI();
$('memberForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const raw={
  ign:$('ign').value,alliance:$('alliance').value,profession:$('profession').value,
  hasBuddies:Object.fromEntries(Object.keys(NAMES).map(s=>[s,$(s+'HasBuddy').checked])),
  currentBuddies:Object.fromEntries(Object.keys(NAMES).map(s=>[s,$(s+'HasBuddy').checked?$(s+'CurrentBuddy').value:''])),
  skills:Object.fromEntries(Object.keys(NAMES).map(s=>[s,{provide:$(s+'Provide').checked,need:$(s+'Need').checked||$(s+'HasBuddy').checked}]))
 };
 const original=member(editingId);
 if(original&&original.profession!==raw.profession&&!confirm('Changing profession may flag affected buddy pairings for reassignment. Continue?'))return;
 $('submitMember').disabled=true;
 try{
  const data=await api({action:editingId?'update':'register',member:raw,id:editingId,website:$('website').value});
  await refresh();resetForm();
  message('formMessage',data.noChange?'No changes were needed.':'Saved! Your profile is updated. Thank you for keeping your buddy details current.');
  $('formMessage').scrollIntoView({behavior:'smooth',block:'nearest'});
 }catch(error){
  message('formMessage',error.message,true);
  if(error.message.includes('board changed')||error.message.includes('Another update'))await refresh();
 }finally{$('submitMember').disabled=false;}
});
function resetForm(){
 editingId=null;adminEditing=false;
 $('memberForm').reset();$('ign').readOnly=false;$('alliance').readOnly=false;
 $('formTitle').textContent='Join the buddy board';$('submitMember').textContent='Save my entry';
 $('newEntry').classList.add('hidden');professionUI();
}
$('newEntry').addEventListener('click',()=>{resetForm();$('formMessage').textContent='';});
for(const id of ['search','allianceFilter','statusFilter'])$(id).addEventListener(id==='search'?'input':'change',renderPublic);
$('refreshBoard').addEventListener('click',refresh);$('adminOpen').addEventListener('click',()=>{if(board.admin){$('adminPanel').scrollIntoView({behavior:'smooth'});return}if(!board.ready){toast('Tiny is connecting the shared board. Admin login opens afterward.');return}$('adminLogin').showModal();});$('cancelLogin').addEventListener('click',()=>$('adminLogin').close());
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();try{await api({action:'login',password:$('adminPassword').value});$('adminPassword').value='';$('adminLogin').close();await refresh();$('adminPanel').scrollIntoView({behavior:'smooth'});}catch(error){$('loginMessage').textContent=error.message;}});
$('adminLogout').addEventListener('click',async()=>{try{await api({action:'logout'});if(adminEditing)$('newEntry').click();await refresh();}catch(error){message('adminMessage',error.message,true);}});
async function adminAction(body){try{const data=await api(body);await refresh();message('adminMessage',body.action==='publish'?'Pairings published. Everyone can now see them.':'Saved.');return data;}catch(error){message('adminMessage',error.message,true);return null;}}
$('publishPairs').addEventListener('click',()=>adminAction({action:'publish'}));$('pairSkill').addEventListener('change',renderPairOptions);$('provider').addEventListener('change',recipientOptions);$('pairForm').addEventListener('submit',async e=>{e.preventDefault();await adminAction({action:'assign',pair:{skill:$('pairSkill').value,providerId:$('provider').value,recipientId:$('recipient').value}});});
document.addEventListener('click',async e=>{const button=e.target.closest('button');if(!button)return;const d=button.dataset;if(d.approveBuddy){const selection=$('suggest-'+d.approveBuddy).value;if(!selection){toast('Choose the matching player first.');return;}const [providerId,recipientId]=selection.split('|');await adminAction({action:'assign',pair:{skill:d.skill,providerId,recipientId}});return;}if(d.selfEdit)await openOwnProfile(d.selfEdit);if(d.edit){fillForm(member(d.edit),true);$('signup').scrollIntoView({behavior:'smooth'});}if(d.unassign)await adminAction({action:'unassign',id:d.unassign});if(d.remove&&confirm('Remove this member? Affected pairings will need reassignment.'))await adminAction({action:'remove',id:d.remove});if(d.undoEvent&&confirm('Restore the previous profile values? Published pairings will not be automatically reactivated.'))await adminAction({action:'undo',eventId:d.undoEvent});});
$('exportBoard').addEventListener('click',()=>{if(!board.admin)return;const url=URL.createObjectURL(new Blob([JSON.stringify(board,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='utw-buddy-board.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('pageLoginForm').addEventListener('submit',async e=>{e.preventDefault();try{await api({action:'pageLogin',password:$('pagePassword').value});$('pagePassword').value='';$('pageLoginMessage').textContent='';await refresh();}catch(error){$('pageLoginMessage').textContent=error.message;}});
await refresh();
