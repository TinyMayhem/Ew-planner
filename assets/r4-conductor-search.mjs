// Search current and former player names while keeping the saved Train Desk member ID.
export function normalizeConductorName(value){
 return String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
}
export function matchConductors(options,aliases,query,limit=12){
 const term=normalizeConductorName(query),names=new Map();
 for(const alias of aliases||[]){
  if(!alias?.member_id)continue;
  if(!names.has(alias.member_id))names.set(alias.member_id,[]);
  for(const raw of [alias.alias,alias.alias_key]){
   if(raw&&!names.get(alias.member_id).includes(raw))names.get(alias.member_id).push(raw);
  }
 }
 return (options||[]).map(option=>{
  const name=option.name,canonical=normalizeConductorName(name);
  const oldNames=names.get(option.id)||[];
  const aliasMatch=term?oldNames.find(a=>normalizeConductorName(a).includes(term)):null;
  const rank=!term?4:canonical.startsWith(term)?0:oldNames.some(a=>normalizeConductorName(a).startsWith(term))?1:canonical.includes(term)?2:aliasMatch?3:99;
  return {...option,rank,aliasMatch:aliasMatch&&normalizeConductorName(aliasMatch)!==canonical?aliasMatch:null};
 }).filter(option=>option.rank!==99)
  .sort((a,b)=>a.rank-b.rank||a.name.localeCompare(b.name,undefined,{sensitivity:'base'}))
  .slice(0,limit);
}
export function initConductorSearch({select,input,list,getAliases}){
 const shell=input.closest('.train-conductor-picker');
 let results=[],active=-1,editing=false;
 const choices=()=>[...select.options].filter(o=>o.value).map(o=>({id:o.value,name:o.textContent||''}));
 function close(){
  list.hidden=true;list.replaceChildren();results=[];active=-1;
  input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');
 }
 function sync(){
  const selected=[...select.options].find(o=>o.value&&o.value===select.value);
  input.value=selected?.textContent||'';
  close();
 }
 function notify(){select.dispatchEvent(new Event('change',{bubbles:true}))}
 function choose(id){
  if(!choices().some(c=>c.id===id))return;
  select.value=id;sync();notify();
 }
 function highlight(index){
  if(!results.length)return;
  active=(index+results.length)%results.length;
  for(const [i,item] of [...list.querySelectorAll('[role="option"]')].entries()){
   const current=i===active;
   item.setAttribute('aria-selected',current?'true':'false');
   if(current){input.setAttribute('aria-activedescendant',item.id);item.scrollIntoView({block:'nearest'})}
  }
 }
 function show(){
  results=matchConductors(choices(),getAliases(),input.value);
  active=-1;list.replaceChildren();
  if(!results.length){
   const empty=document.createElement('p');empty.className='train-conductor-empty';
   empty.textContent='No matching active members. Try another nickname.';
   list.append(empty);
  }
  for(const [i,item] of results.entries()){
   const option=document.createElement('div');
   option.id='train-member-option-'+i;
   option.className='train-conductor-option';option.setAttribute('role','option');
   option.setAttribute('aria-selected','false');option.dataset.memberId=item.id;
   const current=document.createElement('strong');current.textContent=item.name;option.append(current);
   if(item.aliasMatch){
    const previous=document.createElement('small');previous.textContent='Also known as '+item.aliasMatch;option.append(previous);
   }
   option.addEventListener('pointerdown',event=>event.preventDefault());
   option.addEventListener('click',()=>choose(item.id));
   list.append(option);
  }
  list.hidden=false;input.setAttribute('aria-expanded','true');
 }
 input.addEventListener('focus',show);
 input.addEventListener('input',()=>{
  // Never leave an old conductor selected after someone starts typing a new name.
  const selected=[...select.options].find(o=>o.value&&o.value===select.value);
  if(selected&&input.value!==selected.textContent){
   select.value='';editing=true;
   try{notify()}finally{editing=false}
  }
  show();
 });
 input.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();sync();return}
  if(event.key==='Tab'){if(!select.value)input.value='';close();return}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();
   if(list.hidden)show();
   highlight(active<0?(event.key==='ArrowUp'?results.length-1:0):active+(event.key==='ArrowDown'?1:-1));
  }
  if(event.key==='Enter'&&!list.hidden&&results.length){
   event.preventDefault();choose(results[active<0?0:active].id);
  }
 });
 select.addEventListener('change',()=>{if(!editing)sync()});
 document.addEventListener('pointerdown',event=>{
  if(shell&&!shell.contains(event.target)){if(!select.value)input.value='';close()}
 });
 sync();
 return {sync};
}
