// Alliance-only R4 department assignments on the existing Season 6 command board.
(function(){
  const select=document.getElementById('week-select');
  const panel=document.getElementById('r4-roles-panel');
  if(!select||!panel)return;
  const alliance=window.r4Alliance;
  if(!['utw','von'].includes(alliance))return;
  const departments=[
    ['diplomacy','Faction Diplomacy & Server Relations'],
    ['land-war','Land & War Strategy'],
    ['trade-posts','Trade Post Operations'],
    ['communications','Alliance Communications & War Operations'],
    ['research','Season Research & Progression'],
    ['members','Member Management'],
    ['events','Alliance Events & Member Engagement'],
    ['stats-rewards','Data, Statistics & Rewards'],
    ['accountability','Operations & Accountability'],
    ['war-merit','War Merit & Daily Targets']
  ];
  const list=document.getElementById('r4-roles-list');
  const status=document.getElementById('r4-roles-status');
  const weekHeader=document.getElementById('r4-week-header');
  const weekActions=document.getElementById('r4-week-actions');
  const weekGroups=document.getElementById('check-groups');
  const commentsState=document.getElementById('r4-comments-state');
  const next=document.getElementById('next-week');
  const progress=document.getElementById('complete-count');
  const bar=document.querySelector('.r4-bar');
  let records={},busy=false;
  const el=(tag,className,content)=>{const node=document.createElement(tag);if(className)node.className=className;if(content!==undefined)node.textContent=content;return node};
  function field(parent,label,value){
    const wrap=el('label','r4-role-label',label);
    const input=el('input');input.type='text';input.maxLength=50;input.placeholder='In-game R4 name';input.value=value||'';
    wrap.append(input);parent.append(wrap);return input;
  }
  function draw(){
    list.replaceChildren();
    for(const [key,title] of departments){
      const saved=records[key]||{};
      const card=el('form','r4-role-card');
      card.append(el('h3','',title));
      if(key==='war-merit')card.append(el('p','r4-mute','Check individual War Merit progress daily, follow up on missed goals, coordinate opportunities to earn more, and report gaps to R4 leadership.'));
      const fields=el('div','r4-role-fields');
      const leader=field(fields,'Leader',saved.leader);
      const backup=field(fields,'Backup',saved.backup);
      const extras=el('div','r4-role-fields');
      const extraInputs=[];
      function addExtra(value=''){
        if(extraInputs.length>=15)return;
        const line=el('div','r4-role-extra');
        const name=field(line,'Additional backup '+(extraInputs.length+1),value);
        const remove=el('button','r4-btn','Remove');remove.type='button';
        remove.addEventListener('click',()=>{line.remove();const i=extraInputs.indexOf(name);if(i>=0)extraInputs.splice(i,1)});
        line.append(remove);extras.append(line);extraInputs.push(name);
      }
      for(const person of saved.additional_backups||[])addExtra(person);
      const add=el('button','r4-btn','+ Add another backup');add.type='button';
      add.addEventListener('click',()=>addExtra());
      fields.append(extras,add);card.append(fields);
      const save=el('button','r4-btn primary r4-role-save','Save '+title);save.type='submit';
      const message=el('p','r4-role-status');message.setAttribute('role','status');
      card.append(save,message);
      if(saved.updated_at)card.append(el('p','r4-role-updated','Last updated: '+new Date(saved.updated_at).toLocaleString()+(saved.updated_by?' by '+saved.updated_by:'')));
      card.addEventListener('submit',async event=>{
        event.preventDefault();if(busy)return;
        const payload={alliance,department_key:key,leader:leader.value.trim(),backup:backup.value.trim(),additional_backups:extraInputs.map(i=>i.value.trim()).filter(Boolean)};
        busy=true;save.disabled=true;message.textContent='Saving…';
        try{
          const res=await fetch('/api/r4-comments?roles=1',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
          if(res.status===401){location.reload();return}
          const result=await res.json().catch(()=>({}));
          if(!res.ok)throw Error(result.error||'Could not save roles');
          records[key]=result.role;
          message.textContent='Saved for '+alliance.toUpperCase()+' leadership.';
        }catch(error){message.textContent='Not saved: '+error.message}
        finally{busy=false;save.disabled=false}
      });
      list.append(card);
    }
  }
  async function load(){
    if(busy)return;
    status.textContent='Loading '+alliance.toUpperCase()+' roles…';
    try{
      const res=await fetch('/api/r4-comments?roles=1&alliance='+alliance,{credentials:'same-origin',cache:'no-store'});
      if(res.status===401){location.reload();return}
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(data.error||'Unable to load roles');
      records=Object.fromEntries((data.roles||[]).map(row=>[row.department_key,row]));
      draw();
      status.textContent='Assignments saved on the site for authorized '+alliance.toUpperCase()+' leadership.';
    }catch(error){
      status.textContent='Roles unavailable: '+error.message;
      list.replaceChildren();
    }
  }
  function toggle(){
    const show=select.value==='roles';
    panel.hidden=!show;
    for(const item of [weekHeader,weekActions,weekGroups,next,progress,bar])if(item)item.hidden=show;
    if(show){commentsState.hidden=true;load()}
  }
  document.getElementById('r4-roles-title').textContent=alliance.toUpperCase()+' R4 Department Roles';
  select.addEventListener('change',toggle);
  document.getElementById('r4-roles-refresh').addEventListener('click',load);
  toggle();
})();
