import {activeMembers,searchActiveMembers} from './r4-active-members.mjs';
import {trainAliasSuggestions} from './r4-train-alias-suggestions.mjs?version=review-v1-20261106';
const $=id=>document.getElementById(id);
const n=(tag,content,cls)=>{const e=document.createElement(tag);if(content!==undefined&&content!==null)e.textContent=String(content);if(cls)e.className=cls;return e};
let members=[],aliases=[],trainLegacy=[],weeklyChanges=[],selected='',busy=false;
const hiddenSuggestions=new Set();
const normalized=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
const namesOf=id=>aliases.filter(a=>a.member_id===id).sort((a,b)=>a.alias.localeCompare(b.alias));
function message(value,error=false){
 const out=$('nickname-message');out.textContent=value;out.classList.toggle('error',error);
}
function ownerOf(alias){
 const key=normalized(alias);return aliases.find(a=>normalized(a.alias_key||a.alias)===key);
}
function mainName(id){return members.find(x=>x.id===id)?.display_name||'Unknown member'}
async function request(body){
 const result=await fetch('/api/r4-stats',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body)});
 const data=await result.json();
 if(result.status===401){location.href='/r4-planner';throw Error('Sign in again')}
 if(!result.ok){const error=new Error(data.error||'Could not save nickname');error.status=result.status;error.details=data;throw error}
 return data;
}
async function reload(){
 const data=await fetch('/api/r4-stats?nicknames=1',{credentials:'same-origin',cache:'no-store'});
 if(data.status===401){location.href='/r4-planner';return}
 const payload=await data.json();if(!data.ok)throw Error(payload.error||'Could not load member nicknames');
 members=payload.members||[];aliases=payload.aliases||[];trainLegacy=payload.trainLegacy||[];weeklyChanges=payload.weeklyChanges||[];
 if(selected&&!members.some(m=>m.id===selected))selected='';
 draw();
}
function choose(id){
 selected=id;$('nickname-member').value=id;
 $('nickname-existing-member').value='';
 $('nickname-collision').hidden=true;$('nickname-collision').replaceChildren();
 draw();
 document.querySelector('.nickname-editor')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function draw(){
 const selector=$('nickname-member');
 const keep=selected;selector.replaceChildren(new Option('Choose member…',''));
 for(const member of activeMembers(members))selector.append(new Option(member.display_name,member.id));
 selector.value=activeMembers(members).some(m=>m.id===keep)?keep:'';
 const other=$('nickname-existing-member'),prior=other.value;
 other.replaceChildren(new Option('Choose an existing name…',''));
 for(const member of activeMembers(members).filter(m=>m.id!==keep)){
  const known=namesOf(member.id).filter(a=>normalized(a.alias)!==normalized(member.display_name)).map(a=>a.alias);
  other.append(new Option(member.display_name+(known.length?' (also: '+known.join(', ')+')':''),member.id));
 }
 other.value=activeMembers(members).some(m=>m.id===prior&&m.id!==keep)?prior:'';
 const restoring=Boolean(members.find(m=>m.id===keep)?.archived_at);
 $('nickname-link-existing').disabled=!keep||restoring;
 $('nickname-add').disabled=restoring;
 const linked=$('nickname-linked');linked.replaceChildren();
 if(!keep)linked.append(n('p','Select a member to view their linked nicknames.','nickname-empty'));
 else{
  const member=members.find(m=>m.id===keep);
  const rows=namesOf(keep);
  if(restoring)linked.append(n('p','Archived record: '+member.display_name+'. Restore this member before making changes.','stat-muted'));
  const ordered=rows.slice().sort((a,b)=>Number(normalized(b.alias)===normalized(member.display_name))-Number(normalized(a.alias)===normalized(member.display_name))||a.alias.localeCompare(b.alias));
  for(const entry of ordered){
   const primary=normalized(entry.alias)===normalized(member.display_name);
   const chip=n('div',null,'nickname-alias'+(primary?' main':''));
   chip.append(n('span',entry.alias+(primary?' (main name)':'')));
   if(!primary&&!restoring){
    const setCurrent=n('button','Make current','stat-button');
    setCurrent.type='button';
    setCurrent.title='Show '+entry.alias+' as this member’s main name in all R4 reports';
    setCurrent.onclick=async()=>{
     if(busy||!confirm('Make “'+entry.alias+'” the current display name for this player? Previous names will stay linked for historical records.'))return;
     busy=true;setCurrent.disabled=true;
     try{
      await request({action:'set_display_name',member_id:keep,alias:entry.alias});
      await reload();
      message('Current display name updated to “'+entry.alias+'”. Previous names still match old records.');
     }catch(error){message(error.message,true)}
     finally{busy=false;setCurrent.disabled=false}
    };
    chip.append(setCurrent);
    const remove=n('button','×');remove.type='button';remove.title='Remove alias '+entry.alias;
    remove.onclick=async()=>{
     if(busy||!confirm('Stop linking '+entry.alias+' to '+member.display_name+'? Older scores may become unlinked until that nickname is added back.'))return;
     busy=true;remove.disabled=true;
     try{await request({action:'delete_alias',member_id:keep,alias:entry.alias});await reload();message('Nickname unlinked. Existing score snapshots were not deleted.')}
     catch(error){message(error.message,true)}finally{busy=false;remove.disabled=false}
    };
    chip.append(remove);
   }
   linked.append(chip);
  }
  if(!rows.length)linked.append(n('p','No nicknames linked yet.','nickname-empty'));
 }
 const archiveButton=$('nickname-archive-toggle');
 const member=members.find(m=>m.id===keep);
 archiveButton.hidden=!member;
 if(member){
  archiveButton.textContent=member.archived_at?'↩ Restore to active roster':'📦 Archive member';
  archiveButton.classList.toggle('nickname-restore',Boolean(member.archived_at));
  archiveButton.onclick=async()=>{
   if(busy)return;
   const archive=!member.archived_at;
   if(archive&&!confirm('Archive '+member.display_name+' as a former UTW member? Saved nicknames, scores and train history will be preserved. They will no longer appear in new Train Desk recommendations.'))return;
   busy=true;archiveButton.disabled=true;
   try{
    await request({action:archive?'archive_member':'restore_member',member_id:member.id});
    if(archive)selected='';
    await reload();
    message(member.display_name+(archive?' archived. Historical data was preserved.':' restored to the active roster.'));
   }catch(e){message(e.message,true)}finally{busy=false;archiveButton.disabled=false}
  };
 }
 drawWeekly();
 drawDirectory();
 drawTrainNameSuggestions();
}
function drawTrainNameSuggestions(){
 const root=$('nickname-train-suggestions');if(!root)return;
 root.replaceChildren();
 const suggestions=trainAliasSuggestions(trainLegacy,activeMembers(members),aliases).filter(x=>!hiddenSuggestions.has(x.alias));
 if(!suggestions.length){
  root.append(n('p','No likely unlinked train-name matches found right now.','stat-muted'));return;
 }
 root.append(n('p',suggestions.length+' unconfirmed historical spelling'+(suggestions.length===1?'':'s')+
  ' found. Only approve a pair when you know it is the same person.','stat-muted'));
 for(const x of suggestions.slice(0,40)){
  const card=n('div',null,'stat-row');
  card.append(n('strong','“'+x.alias+'”  →  '+x.member_name),
   n('p','Possible match · '+x.confidence+'% text similarity · '+x.occurrences+
    ' train record'+(x.occurrences===1?'':'s'),'stat-muted'));
  const actions=n('div',null,'nickname-actions');
  const confirmButton=n('button','Yes, same player','stat-button primary');confirmButton.type='button';
  confirmButton.onclick=async()=>{
   if(busy||!confirm('Confirm “'+x.alias+'” is the SAME player as '+x.member_name+
    '? This links past train records to that member without merging member accounts.'))return;
   busy=true;confirmButton.disabled=true;
   try{
    await request({action:'alias',member_id:x.member_id,alias:x.alias});
    await reload();
    message('Linked “'+x.alias+'” to '+x.member_name+' for future train matching and screenshot uploads.');
   }catch(e){message(e.message,true)}finally{busy=false;confirmButton.disabled=false}
  };
  const skip=n('button','Not the same / skip','stat-button');skip.type='button';
  skip.onclick=()=>{hiddenSuggestions.add(x.alias);drawTrainNameSuggestions()};
  actions.append(confirmButton,skip);card.append(actions);root.append(card);
 }
 if(suggestions.length>40)root.append(n('p','Showing the first 40 likely matches. Link or skip reviewed names to reveal more.','stat-muted'));
}
function drawWeekly(){
 const root=$('nickname-weekly-list');if(!root)return;
 root.replaceChildren();
 const seen=new Set(),rows=[];
 for(const event of weeklyChanges){
  const info=event.details||{},member=members.find(m=>m.id===info.member_id);
  const nickname=event.action==='set_display_name'?info.display_name:info.alias;
  if(!member||member.archived_at||!nickname)continue;
  const id=member.id+'|'+normalized(nickname);
  if(seen.has(id))continue;seen.add(id);
  rows.push({event,member,nickname,previous:info.previous_name||''});
 }
 $('nickname-week-count').textContent=rows.length+' recorded';
 if(!rows.length){
  root.append(n('p','No nickname changes recorded since Monday.','stat-muted'));return;
 }
 for(const row of rows.slice(0,70)){
  const item=n('div',null,'nickname-week-row');
  const who=n('div',null,'nickname-week-person');
  who.append(n('strong',row.event.action==='set_display_name'&&row.previous?row.previous:row.member.display_name),
   n('small',row.event.action==='set_display_name'?'Main name changed':'Nickname added','stat-muted'));
  const changed=n('div',null,'nickname-week-new');
  changed.append(n('span','→','nickname-week-arrow'),n('strong',row.nickname));
  const when=n('small',new Date(row.event.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric'}),'stat-muted');
  item.append(who,changed,when);
  root.append(item);
 }
 if(rows.length>70)root.append(n('p','Showing the 70 most recent changes.','stat-muted'));
}
function drawDirectory(){
 const query=normalized($('nickname-search').value);
 // The normal Search members box never includes archived names or their aliases.
 const active=searchActiveMembers(members,aliases,query);
 // Restore is an explicit, separate management action with its own search.
 const archivedQuery=normalized($('nickname-archived-search')?.value);
 const archived=members.filter(m=>m.archived_at&&
  (normalized(m.display_name).includes(archivedQuery)||namesOf(m.id).some(a=>normalized(a.alias).includes(archivedQuery))));
 const allActive=activeMembers(members).length,allArchived=members.length-allActive;
 $('nickname-count').textContent=active.length+' active members shown of '+allActive+'.';
 $('nickname-archived-count').textContent=allArchived+' archived';
 const render=(root,people,empty)=>{
  root.replaceChildren();
  for(const person of people.slice(0,250)){
   const button=n('button',null,'nickname-person'+(person.id===selected?' selected':''));button.type='button';
   button.append(n('strong',person.display_name));
   const other=namesOf(person.id).filter(a=>normalized(a.alias)!==normalized(person.display_name)).map(a=>a.alias);
   button.append(n('small',other.length?'Other names: '+other.join(' · '):'No other nicknames'));
   if(person.archived_at)button.append(n('small','Archived '+new Date(person.archived_at).toLocaleDateString(),'stat-muted'));
   button.onclick=()=>choose(person.id);root.append(button);
  }
  if(!people.length)root.append(n('p',empty,'nickname-empty'));
 };
 render($('nickname-directory'),active,'No active members matched.');
 render($('nickname-archived-directory'),archived,archivedQuery?'No archived records matched.':'No members archived yet.');
}
function showCollision(alias,memberToKeepId,existingMemberId){
 const root=$('nickname-collision');root.hidden=false;root.replaceChildren();
 const canonical=mainName(memberToKeepId),existing=mainName(existingMemberId);
 if(!canonical||!existing||memberToKeepId===existingMemberId){
  message('Choose two different members.',true);root.hidden=true;return;
 }
 const title=n('strong','Review before combining these two member records');
 const summary=n('p','Keep: '+canonical+' · Combine into this record: '+existing);
 const aliasNote=n('p','“'+alias+'” is already linked to '+existing+'. Combining will move the old VS scores, donations, Desert Storm records, and known nicknames into '+canonical+'.');
 const details=n('p','The extra member record will be deleted. This cannot be undone from this page. Only continue if both records belong to the same person.','stat-muted');
 const confirmLabel=n('label',null,'nickname-confirm');
 const checkbox=document.createElement('input');checkbox.type='checkbox';
 confirmLabel.append(checkbox,n('span','Yes, these are the same player. Keep '+canonical+'.'));
 const button=n('button','Confirm and combine records','stat-button primary');
 button.type='button';button.disabled=true;
 checkbox.onchange=()=>{button.disabled=!checkbox.checked||busy};
 button.onclick=async()=>{
  if(busy||!checkbox.checked)return;
  busy=true;button.disabled=true;
  message('Combining records and checking the saved nickname links…');
  try{
   const result=await request({action:'merge',source:existingMemberId,target:memberToKeepId});
   if(!result.ok||!result.verified)throw Error('The merge could not be verified. Refresh and review the member records before trying again.');
   await reload();
   const nowLinked=namesOf(memberToKeepId).some(a=>normalized(a.alias)===normalized(alias));
   const originalRemoved=!members.some(m=>m.id===existingMemberId);
   if(!nowLinked||!originalRemoved)throw Error('The server returned a merge response, but the updated nickname list is incomplete. Do not repeat the merge until it is checked.');
   $('nickname-new').value='';$('nickname-existing-member').value='';
   root.hidden=true;root.replaceChildren();
   message('Saved! '+existing+' is now listed under '+canonical+'. Historical scores are linked to '+canonical+'.');
   const list=$('nickname-linked');list.scrollIntoView({behavior:'smooth',block:'center'});
  }catch(err){
   message('Could not confirm the merge: '+err.message,true);
   checkbox.checked=false;button.disabled=true;
  }finally{busy=false}
 };
 root.append(title,summary,aliasNote,details,confirmLabel,button);
 root.scrollIntoView({behavior:'smooth',block:'center'});
}
function linkExistingMember(){
 const target=$('nickname-member').value,source=$('nickname-existing-member').value;
 if(!target){message('First choose the member to keep.',true);return}
 if(!source){message('Choose an existing member name from the dropdown.',true);return}
 if(target===source){message('Choose a different existing member to link.',true);return}
 showCollision(mainName(source),target,source);
}
async function addNickname(){
 if(busy)return;
 const memberId=$('nickname-member').value,alias=$('nickname-new').value.trim();
 if(!memberId){message('Choose the member whose scores should receive this nickname.',true);return}
 if(!alias||alias.length>60){message('Enter a nickname between 1 and 60 characters.',true);return}
 const target=members.find(x=>x.id===memberId);if(!target)return;
 const collision=$('nickname-collision');collision.hidden=true;collision.replaceChildren();
 const existing=ownerOf(alias);
 if(existing){
  if(existing.member_id===memberId){message('That name is already linked to '+target.display_name+'.');return}
  showCollision(alias,memberId,existing.member_id);return;
 }
 busy=true;$('nickname-add').disabled=true;
 try{
  await request({action:'alias',member_id:memberId,alias});
  $('nickname-new').value='';await reload();
  message('Saved! “'+alias+'” now belongs to '+target.display_name+'. New VS and donation scores will match automatically.');
 }catch(error){
  if(error.status===409&&error.details?.existing_member_id){
   await reload();
   showCollision(alias,memberId,error.details.existing_member_id);
  }else message(error.message,true);
 }finally{busy=false;$('nickname-add').disabled=false}
}
async function createMembers(bulk){
 if(busy)return;
 const root=$('create-member-result');root.replaceChildren();
 const parseLine=line=>{const [name,...aliases]=line.split('|').map(s=>s.trim());return {name,aliases:aliases.filter(Boolean)}};
 const entries=bulk?$('create-members-bulk').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(parseLine):
  [{name:$('create-member-name').value.trim(),aliases:$('create-member-aliases').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)}];
 const say=(msg,error=false)=>{root.replaceChildren(n('p',msg,error?'stat-flag blocked':'stat-muted'))};
 if(!entries.length||entries.length>100||entries.some(m=>!m.name||m.name.length>60||m.aliases.length>10||m.aliases.some(a=>a.length>60))){
  say('Enter 1 to 100 names, up to 60 characters each, with at most 10 nicknames per player.',true);return;
 }
 const seen=new Set(),issues=[];
 for(const m of entries){
  const own=new Set();
  for(const label of [m.name,...m.aliases]){
   const k=normalized(label);if(own.has(k))continue;own.add(k);
   if(seen.has(k))issues.push(label+' appears more than once in this batch.');
   seen.add(k);
   const alias=ownerOf(label),existing=members.find(x=>x.id===alias?.member_id||normalized(x.display_name)===k);
   if(existing)issues.push(label+' already belongs to '+existing.display_name+(existing.archived_at?' (archived: restore the original record).':' (active member).'));
  }
 }
 if(issues.length){say(issues.join(' '),true);return}
 const review=n('div',null,'stat-card');
 review.append(n('h3','Review '+entries.length+' new member'+(entries.length===1?'':'s')));
 for(const m of entries)review.append(n('p',m.name+(m.aliases.length?' · Nicknames: '+m.aliases.join(', '):'')));
 const save=n('button','Confirm and add','stat-button primary'),cancel=n('button','Cancel','stat-button');
 save.type=cancel.type='button';cancel.onclick=()=>root.replaceChildren();
 save.onclick=async()=>{
  if(busy)return;busy=true;save.disabled=cancel.disabled=true;
  $('create-member').disabled=$('create-members').disabled=true;
  try{
   const result=await request({action:'create_members',members:entries});
   if(!result.ok||result.count!==entries.length)throw Error('The server could not confirm all member records. Refresh the directory before retrying.');
   if(bulk)$('create-members-bulk').value='';else{$('create-member-name').value='';$('create-member-aliases').value=''}
   await reload();say('Saved '+result.count+' new member'+(result.count===1?'':'s')+'! They are now in the active roster.');
  }catch(error){say(error.message,true);try{await reload()}catch{}}
  finally{busy=false;$('create-member').disabled=$('create-members').disabled=false}
 };
 review.append(save,cancel);root.append(review);
}
$('create-member').addEventListener('click',()=>createMembers(false));
$('create-members').addEventListener('click',()=>createMembers(true));
$('nickname-member').addEventListener('change',e=>choose(e.target.value));
$('nickname-link-existing').addEventListener('click',linkExistingMember);
$('nickname-existing-member').addEventListener('change',()=>{$('nickname-collision').hidden=true;$('nickname-collision').replaceChildren()});
$('nickname-search').addEventListener('input',drawDirectory);
$('nickname-archived-search').addEventListener('input',drawDirectory);
$('nickname-add').addEventListener('click',addNickname);
$('nickname-new').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addNickname()}});
reload().then(()=>message('Names loaded. Select a member and add any alternate in-game names.')).catch(error=>message(error.message,true));
