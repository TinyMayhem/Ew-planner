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
  // Expandable explanations are guidance, not another set of assignments.
  const responsibilities={
    "diplomacy": [
      "Coordinate UTW and VON diplomacy, decisions, and faction agreements.",
      "Maintain positive relations among alliances on server 1395.",
      "Negotiate with other servers on borders, access, truces, and cooperation.",
      "Resolve conflicts and make sure the agreed rules reach leadership.",
      "Bring major diplomatic commitments to alliance leadership for approval."
    ],
    "land-war": [
      "Plan territory routes, city targets, capture order, and declarations.",
      "Own attack and defense strategies, target selection, and tactical priorities.",
      "Lead live war calls, rally coordination, and changes during battles.",
      "Plan Fishing Ground and stronghold priorities with the allied land team.",
      "Keep the season map and land outcomes up to date, including fallback routes."
    ],
    "trade-posts": [
      "Take full ownership of Trade Post planning, separate from land management.",
      "Organize Trade Post targets, capture schedules, allocations, and rotations.",
      "Coordinate Trade Post decisions and support with VON.",
      "Track ownership, results, participation, and upcoming opportunities.",
      "Flag timing conflicts with city battles and prepare backup arrangements."
    ],
    "communications": [
      "Prepare and send all alliance mails, general announcements, and weekly updates.",
      "Turn approved land and war plans into clear battle instructions.",
      "Create war attendance polls, event sign-ups, and timezone schedules.",
      "Send reminders, confirm availability, and communicate last-minute changes.",
      "Distribute updates from other departments without taking over their strategy."
    ],
    "research": [
      "Research Season 6 mechanics, event unlocks, and relevant updates.",
      "Prepare practical guides on Fishing Grounds, War Merit, faction tech, and donations.",
      "Recommend efficient upgrades, resource spending, and progression priorities.",
      "Check information against the in-game season calendar when possible.",
      "Share findings with other departments; daily War Merit follow-up belongs to its own team."
    ],
    "members": [
      "Welcome and onboard recruits and help members settle into the alliance.",
      "Answer member questions and help resolve concerns or conflicts.",
      "Monitor activity, absences, transfers, and membership changes.",
      "Support member development and identify when someone needs assistance.",
      "Coordinate with the statistics team when ongoing participation issues need review."
    ],
    "events": [
      "Organize Desert Storm and other available alliance events.",
      "Coordinate Marshal's Guard (MG) and Zombie Siege when those events are available.",
      "Arrange event schedules, sign-ups, substitutes, and participation reminders.",
      "Plan fun competitions and optional UTW/VON community activities.",
      "Encourage participation, teamwork, and alliance morale."
    ],
    "stats-rewards": [
      "Maintain member contribution, attendance, and performance records.",
      "Monitor participation trends and share clear summaries with leadership.",
      "Track ranking changes and help verify reward eligibility.",
      "Support accurate reward planning and distribution records.",
      "Coordinate with the War Merit team on daily gaps without duplicating their reminders."
    ],
    "accountability": [
      "Keep pre-season and weekly operations checklists organized.",
      "Make sure tasks have a clear owner, deadline, and backup.",
      "Follow up on outstanding tasks and flag blockers early.",
      "Watch for uneven workloads and recommend handing work to backups.",
      "Check that departments share updates and complete their responsibilities."
    ],
    "war-merit": [
      "Monitor members' War Merit progress against the daily targets set by leadership.",
      "Identify who has met their target and who may need a reminder or help.",
      "Coordinate ways for members to earn missing War Merit before daily reset.",
      "Follow up with members who repeatedly fall behind and escalate patterns to R4.",
      "Share participation updates with the statistics team, without assuming everyone has the same target."
    ]
  };
  const expandedDescriptions=new Set();
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
      const details=el('details','r4-role-details');
      details.open=expandedDescriptions.has(key);
      const summary=el('summary','r4-role-summary','What this role entails');
      const taskList=el('ul','r4-role-responsibilities');
      for(const duty of responsibilities[key]||[])taskList.append(el('li','',duty));
      details.append(summary,taskList);
      details.addEventListener('toggle',()=>{
        if(details.open)expandedDescriptions.add(key);
        else expandedDescriptions.delete(key);
      });
      card.append(details);
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
