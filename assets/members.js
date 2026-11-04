import {addDays,stageRange} from './r4-train-rules.mjs';
import {trainLabelForDate} from './r4-train-schedule.mjs';

const $=id=>document.getElementById(id);
const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const templateLabels=['Top donation last week','Event MVP (DS MVP or other)','R4 vote (no train for a while)','R4 choice','Roulette / special choice','R4 choice','VS MVP'];
let trains=[],seasons=[],stages=[];

function elem(tag,content,cls){
 const node=document.createElement(tag);
 if(content!==undefined&&content!==null)node.textContent=String(content);
 if(cls)node.className=cls;
 return node;
}
const cell=value=>elem('td',value);
const displayDate=date=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric'}).format(new Date(date+'T12:00:00Z'));
function trainTypeClass(slot,source){
 const title=String(slot||'').toLowerCase();
 if(/roul/.test(title))return 'roulette';
 if(/donat|top donor/.test(title)||source==='donations')return 'donations';
 if(/r4 vote/.test(title))return 'vote';
 if(/r5|rylis.*choice|special choice/.test(title))return 'choice';
 if(/r4/.test(title)||source==='r4')return 'r4';
 if(/event mvp|ds mvp|top 2 scores/.test(title)||source==='ds')return 'mvp';
 if(/vs|alliance star/.test(title)||source==='vs')return 'vs';
 if(/contest|mystery|prize/.test(title))return 'choice';
 return 'r4';
}
function trainPeople(record){
 const detail=elem('div',null,'member-train-people');
 const driver=elem('div'),vip=elem('div');
 driver.append(elem('span','Conductor'),elem('strong',record.member||'Not recorded'));
 vip.append(elem('span','VIP'),elem('strong',record.vip||'Not recorded'));
 detail.append(driver,vip);
 return detail;
}
function stageCalendar(stage,entries){
 const section=elem('section',null,'member-stage');
 section.setAttribute('aria-label','Stage '+stage.stage+' train calendar');
 const head=elem('div',null,'member-stage-heading');
 const heading=elem('div');
 heading.append(elem('h3','Stage '+stage.stage),elem('p',displayDate(stage.start)+' to '+displayDate(stage.end)+', '+stage.start.slice(0,4)));
 head.append(heading,elem('div','5 weeks · 35 days','member-stage-meta'));section.append(head);
 const wrap=elem('div',null,'member-calendar-scroll');
 wrap.setAttribute('role','region');
 wrap.setAttribute('aria-label','Stage '+stage.stage+' train calendar, scroll horizontally');
 wrap.tabIndex=0;
 const table=elem('table',null,'member-calendar-grid'),thead=elem('thead'),header=elem('tr'),body=elem('tbody');
 for(const day of weekdays){const th=elem('th',day);th.scope='col';header.append(th)}
 thead.append(header);
 const map=new Map();
 for(const item of entries){if(!map.has(item.date))map.set(item.date,[]);map.get(item.date).push(item)}
 for(let week=0;week<5;week++){
  const row=elem('tr');
  for(let day=0;day<7;day++){
   const date=addDays(stage.start,week*7+day),td=elem('td'),box=elem('div',null,'member-train-day');
   box.append(elem('div',displayDate(date),'member-train-date'));
   const assignments=map.get(date)||[];
   if(assignments.length){
    for(const assignment of assignments){
     box.append(elem('div',assignment.slot||trainLabelForDate(stage.stage,date)||templateLabels[day],'member-train-type '+trainTypeClass(assignment.slot,assignment.source)));
     box.append(trainPeople(assignment));
    }
   }else{
    const label=trainLabelForDate(stage.stage,date)||templateLabels[day];
    box.append(elem('div',label,'member-train-type '+trainTypeClass(label,'')));
    box.append(elem('div','No assignment recorded','member-train-no-entry'));
   }
   td.append(box);row.append(td);
  }
  body.append(row);
 }
 table.append(thead,body);wrap.append(table);section.append(wrap);
 const n=entries.length;
 section.append(elem('div',n+' recorded train assignment'+(n===1?'':'s')+' · Dates use server time','member-stage-note'));
 return section;
}
function draw(){
 const choice=$('trainView').value;
 // Upcoming calendars remain selectable without replacing the latest two completed or active stages.
 const serverDate=new Date(Date.now()-2*3600000).toISOString().slice(0,10);
 const selected=choice==='latest'?stages.filter(s=>s.start<=serverDate).slice(0,2):choice==='all'?stages:stages.filter(s=>String(s.stage)===choice);
 const container=$('trainCalendars');container.replaceChildren();
 if(!selected.length)container.append(elem('p','No saved train calendars yet.','member-stage-empty'));
 let total=0;
 for(const stage of selected){
  const entries=trains.filter(x=>x.stage===stage.stage&&x.date>=stage.start&&x.date<=stage.end);
  total+=entries.length;container.append(stageCalendar(stage,entries));
 }
 const season=$('trainSeason').value,from=$('trainFrom').value,to=$('trainTo').value;
 const shown=trains.filter(x=>(season==='all'||x.season===season)&&(!from||x.date>=from)&&(!to||x.date<=to))
  .sort((a,b)=>b.date.localeCompare(a.date)||a.slot.localeCompare(b.slot));
 const tbody=$('trainRows');tbody.replaceChildren();
 for(const entry of shown){
  const row=elem('tr');
  for(const value of [entry.date,entry.slot,entry.member,entry.vip||'Not recorded',({r4:'R4 Train',ds:'Desert Storm',vs:'VS',donations:'Donations',manual:'Other / special'})[entry.source]||entry.source])row.append(cell(value));
  tbody.append(row);
 }
 $('trainStatus').textContent=selected.length+' calendar'+(selected.length===1?'':'s')+' shown, with '+total+' recorded assignments.';
}
async function refresh(){
 try{
  const response=await fetch('/api/buddies?view=trains',{credentials:'same-origin',cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Train schedule unavailable');
  if(data.locked){$('memberGate').hidden=false;$('memberContent').hidden=true;return}
  if(!data.ready)throw Error(data.message||data.error||'Member tools are not configured');
  trains=Array.isArray(data.trains)?data.trains:[];
  seasons=Array.isArray(data.seasons)?data.seasons:[];
  stages=Array.isArray(data.stages)?data.stages:[];
  $('memberGate').hidden=true;$('memberContent').hidden=false;
  const selector=$('trainView'),previous=selector.value;
  selector.replaceChildren(new Option('Latest two stages','latest'));
  for(const stage of stages)selector.append(new Option('Stage '+stage.stage+' · '+displayDate(stage.start)+' to '+displayDate(stage.end),String(stage.stage)));
  selector.append(new Option('All saved stages','all'));
  if([...selector.options].some(option=>option.value===previous))selector.value=previous;
  const season=$('trainSeason'),oldSeason=season.value;
  season.replaceChildren(new Option('All seasons','all'));
  for(const s of seasons)season.append(new Option(s.label,s.id));
  if([...season.options].some(option=>option.value===oldSeason))season.value=oldSeason;
  draw();
 }catch(error){
  $('memberMessage').textContent=error.message;
  $('trainStatus').textContent=error.message;
 }
}
$('memberLogin').addEventListener('submit',async event=>{
 event.preventDefault();$('memberMessage').textContent='';
 try{
  const response=await fetch('/api/buddies',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'pageLogin',password:$('memberPassword').value})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Passcode rejected');
  $('memberPassword').value='';await refresh();
 }catch(error){$('memberMessage').textContent=error.message}
});
for(const id of ['trainView','trainSeason','trainFrom','trainTo'])$(id).addEventListener('change',draw);
$('trainRefresh').addEventListener('click',refresh);
refresh();
