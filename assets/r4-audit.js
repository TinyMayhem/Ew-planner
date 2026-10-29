(()=>{'use strict';
const $=id=>document.getElementById(id);
const names={import:'CSV upload',delete_import:'Deleted CSV upload',ds:'Desert Storm result',delete_ds:'Deleted DS result',alias:'Added nickname',merge:'Merged members',merge_members:'Legacy member merge',exception:'Train exception added',clear_exception:'Cleared exception',award:'Train assigned',delete_award:'Train assignment deleted',undo:'Undid a change'};
function el(tag,string,cls){const e=document.createElement(tag);if(cls)e.className=cls;if(string!==undefined)e.textContent=String(string);return e}
function description(e){
 const d=e.details||{};switch(e.action){
 case 'import':return [d.filename,d.metric,d.period,d.rows+' rows',d.season].filter(Boolean).join(' · ');
 case 'delete_import':return [d.filename,d.metric,d.period,d.season].filter(Boolean).join(' · ');
 case 'award':case 'delete_award':return [d.date||d.row?.train_date,d.slot||d.row?.slot].filter(Boolean).join(' · ');
 case 'ds':case 'delete_ds':return [d.date||d.row?.event_date,d.opponent||d.row?.opponent].filter(Boolean).join(' · ');
 case 'alias':return 'Nickname: '+(d.alias||d.alias_key);
 case 'exception':return [d.scope,d.starts_on+' through '+d.ends_on,d.reason].filter(Boolean).join(' · ');
 case 'clear_exception':return d.reason||'Exception marked inactive';
 case 'merge':return 'Merged '+d.source+' into '+d.target;
 case 'undo':return 'Reversed entry #'+d.original_audit_id;
 default:return [d.source_name,d.award_id].filter(Boolean).join(' · ')||'Recorded change';
 }}
let busy=false;
async function load(){
 $('status').textContent='Loading audit history…';
 try{
  const r=await fetch('/api/r4-stats?audit=1',{credentials:'same-origin',cache:'no-store'});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Audit unavailable');
  const root=$('audit-events');root.replaceChildren();
  const events=data.events||[];
  for(const e of events){
   const row=el('article',undefined,'audit-event'),details=el('div');
   details.append(el('strong','#'+e.id+' · '+(names[e.action]||e.action)),el('p',description(e),'audit-desc'),el('div',(e.actor||'Shared R4 / unattributed')+' · '+new Date(e.created_at).toLocaleString(),'audit-meta'));
   if(e.undone_at)details.append(el('div','Undone by '+e.undone_by+' · '+new Date(e.undone_at).toLocaleString(),'audit-meta'));
   row.append(details);
   if(e.reversible&&!e.undone_at){
    const button=el('button','Undo','stat-button');button.type='button';
    button.addEventListener('click',async()=>{
     if(busy||!confirm('Undo audit entry #'+e.id+' ('+(names[e.action]||e.action)+')? This changes shared UTW records.'))return;
     busy=true;button.disabled=true;
     try{
      const response=await fetch('/api/r4-stats',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'undo_audit',id:e.id})});
      const result=await response.json();if(!response.ok)throw Error(result.error||'Undo failed');
      $('status').textContent=result.message||'Record restored';await load();
     }catch(error){$('status').textContent='Undo failed: '+error.message;button.disabled=false}
     finally{busy=false}
    });row.append(button)
   }root.append(row);
  }
  $('status').textContent=events.length+' event(s) shown · newest first';
  if(!events.length)root.append(el('p','No recorded R4 activity yet.','stat-muted'));
 }catch(e){$('status').textContent=e.message}
}
$('refresh').addEventListener('click',load);load();
})();