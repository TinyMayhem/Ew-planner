const $=id=>document.getElementById(id);
const n=(tag,content,cls)=>{const e=document.createElement(tag);if(content!==undefined&&content!==null)e.textContent=String(content);if(cls)e.className=cls;return e};
let members=[],aliases=[],selected='',busy=false;
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
 members=payload.members||[];aliases=payload.aliases||[];
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
 for(const member of members)selector.append(new Option(member.display_name,member.id));
 selector.value=members.some(m=>m.id===keep)?keep:'';
 const other=$('nickname-existing-member'),prior=other.value;
 other.replaceChildren(new Option('Choose an existing name…',''));
 for(const member of members.filter(m=>m.id!==keep)){
  const known=namesOf(member.id).filter(a=>normalized(a.alias)!==normalized(member.display_name)).map(a=>a.alias);
  other.append(new Option(member.display_name+(known.length?' (also: '+known.join(', ')+')':''),member.id));
 }
 other.value=members.some(m=>m.id===prior&&m.id!==keep)?prior:'';
 $('nickname-link-existing').disabled=!keep;
 const linked=$('nickname-linked');linked.replaceChildren();
 if(!keep)linked.append(n('p','Select a member to view their linked nicknames.','nickname-empty'));
 else{
  const member=members.find(m=>m.id===keep);
  const rows=namesOf(keep);
  const ordered=rows.slice().sort((a,b)=>Number(normalized(b.alias)===normalized(member.display_name))-Number(normalized(a.alias)===normalized(member.display_name))||a.alias.localeCompare(b.alias));
  for(const entry of ordered){
   const primary=normalized(entry.alias)===normalized(member.display_name);
   const chip=n('div',null,'nickname-alias'+(primary?' main':''));
   chip.append(n('span',entry.alias+(primary?' (main name)':'')));
   if(!primary){
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
 drawDirectory();
}
function drawDirectory(){
 const query=normalized($('nickname-search').value),root=$('nickname-directory');root.replaceChildren();
 const matched=members.filter(m=>normalized(m.display_name).includes(query)||namesOf(m.id).some(a=>normalized(a.alias).includes(query)));
 $('nickname-count').textContent=matched.length+' members shown of '+members.length+'.';
 for(const person of matched.slice(0,250)){
  const button=n('button',null,'nickname-person'+(person.id===selected?' selected':''));button.type='button';
  button.append(n('strong',person.display_name));
  const list=namesOf(person.id).filter(a=>normalized(a.alias)!==normalized(person.display_name)).map(x=>x.alias);
  button.append(n('small',list.length?'Other names: '+list.join(' · '):'No other nicknames'));
  button.onclick=()=>choose(person.id);root.append(button);
 }
 if(!matched.length)root.append(n('p','No member or nickname matched.','nickname-empty'));
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
$('nickname-member').addEventListener('change',e=>choose(e.target.value));
$('nickname-link-existing').addEventListener('click',linkExistingMember);
$('nickname-existing-member').addEventListener('change',()=>{$('nickname-collision').hidden=true;$('nickname-collision').replaceChildren()});
$('nickname-search').addEventListener('input',drawDirectory);
$('nickname-add').addEventListener('click',addNickname);
$('nickname-new').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addNickname()}});
reload().then(()=>message('Names loaded. Select a member and add any alternate in-game names.')).catch(error=>message(error.message,true));
