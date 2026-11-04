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
 selected=id;$('nickname-member').value=id;$('nickname-collision').hidden=true;
 $('nickname-collision').replaceChildren();
 draw();
 document.querySelector('.nickname-editor')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function draw(){
 const selector=$('nickname-member');
 const keep=selected;selector.replaceChildren(new Option('Choose member…',''));
 for(const member of members)selector.append(new Option(member.display_name,member.id));
 selector.value=members.some(m=>m.id===keep)?keep:'';
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
function showCollision(original,canonical,existing){
 const root=$('nickname-collision');root.hidden=false;root.replaceChildren();
 const title=n('strong','This nickname already belongs to another member record.');
 const text=n('p','“'+original+'” currently belongs to '+existing+'. Do you want to combine that existing record into '+canonical+'? The old VS and donation scores, DS results, and linked names will follow '+canonical+'.');
 root.append(title,text);
 const info=n('p','Only combine records if you are certain both names are the same player. The merge cannot be undone here.','stat-muted');root.append(info);
 const source=members.find(m=>m.display_name===existing)||members.find(m=>m.id===root.dataset.sourceId);
 if(!source||source.id===selected)return;
 const merge=n('button','Combine '+existing+' into '+canonical,'stat-button');merge.type='button';
 merge.onclick=async()=>{
  if(busy)return;
  const expected='MERGE';
  const typed=prompt('This will permanently combine member records, including historical scores. Type MERGE to combine “'+existing+'” into “'+canonical+'”.');
  if(typed!==expected)return;
  busy=true;merge.disabled=true;
  try{
   await request({action:'merge',source:source.id,target:selected});
   $('nickname-new').value='';root.hidden=true;
   await reload();message('Combined '+existing+' into '+canonical+'. All linked nickname records now point to '+canonical+'.');
  }catch(err){message(err.message,true)}finally{busy=false;merge.disabled=false}
 };
 root.append(merge);
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
  showCollision(alias,target.display_name,mainName(existing.member_id));return;
 }
 busy=true;$('nickname-add').disabled=true;
 try{
  await request({action:'alias',member_id:memberId,alias});
  $('nickname-new').value='';await reload();
  message('Saved! “'+alias+'” now belongs to '+target.display_name+'. New VS and donation scores will match automatically.');
 }catch(error){
  if(error.status===409&&error.details?.existing_member_id){
   await reload();
   showCollision(alias,mainName(memberId),mainName(error.details.existing_member_id));
  }else message(error.message,true);
 }finally{busy=false;$('nickname-add').disabled=false}
}
$('nickname-member').addEventListener('change',e=>choose(e.target.value));
$('nickname-search').addEventListener('input',drawDirectory);
$('nickname-add').addEventListener('click',addNickname);
$('nickname-new').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addNickname()}});
reload().then(()=>message('Names loaded. Select a member and add any alternate in-game names.')).catch(error=>message(error.message,true));
