(()=>{'use strict';
const $=id=>document.getElementById(id);let trains=[],seasons=[];
const cell=s=>{const e=document.createElement('td');e.textContent=String(s);return e};
function draw(){
 const tbody=$('trainRows');tbody.replaceChildren();
 const season=$('trainSeason').value,from=$('trainFrom').value,to=$('trainTo').value;
 const shown=trains.filter(x=>(season==='all'||x.season===season)&&(!from||x.date>=from)&&(!to||x.date<=to));
 for(const x of shown){const row=document.createElement('tr');for(const value of [x.date,x.slot,x.member,x.vip||'Not recorded',({ds:'Desert Storm',vs:'VS',donations:'Donations',manual:'R4 selection'})[x.source]||x.source])row.append(cell(value));tbody.append(row)}
 $('trainStatus').textContent=shown.length?shown.length+' dated train assignment(s) found.':'No recorded trains for this selection.';
}
async function refresh(){
 try{
  const res=await fetch('/api/buddies?view=trains',{credentials:'same-origin',cache:'no-store'});
  const data=await res.json();if(!res.ok)throw Error(data.error||'Train schedule unavailable');
  if(data.locked){$('memberGate').hidden=false;$('memberContent').hidden=true;return}
  if(!data.ready)throw Error(data.message||data.error||'Member tools are not configured');
  trains=Array.isArray(data.trains)?data.trains:[];seasons=data.seasons||[];
  $('memberGate').hidden=true;$('memberContent').hidden=false;
  const sel=$('trainSeason'),current=sel.value;sel.replaceChildren(new Option('All seasons','all'));
  seasons.forEach(s=>sel.append(new Option(s.label,s.id)));if([...sel.options].some(o=>o.value===current))sel.value=current;
  draw();
 }catch(e){$('memberMessage').textContent=e.message;$('trainStatus').textContent=e.message}
}
$('memberLogin').addEventListener('submit',async event=>{
 event.preventDefault();$('memberMessage').textContent='';
 try{
  const res=await fetch('/api/buddies',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'pageLogin',password:$('memberPassword').value})});
  const data=await res.json();if(!res.ok)throw Error(data.error||'Passcode rejected');
  $('memberPassword').value='';await refresh();
 }catch(e){$('memberMessage').textContent=e.message}
});
for(const id of ['trainSeason','trainFrom','trainTo'])$(id).addEventListener('change',draw);
$('trainRefresh').addEventListener('click',refresh);refresh();
})();