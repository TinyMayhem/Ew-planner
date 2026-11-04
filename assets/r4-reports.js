import {selectMemberReports} from '../lib/member-performance.mjs';

const $=id=>document.getElementById(id);
const fmt=value=>Number(value).toLocaleString('en-CA');
const el=(tag,text,cls)=>{const item=document.createElement(tag);if(text!==undefined&&text!==null)item.textContent=String(text);if(cls)item.className=cls;return item};
const today=()=>{const entries=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Noronha',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const parts=Object.fromEntries(entries.map(x=>[x.type,x.value]));return parts.year+'-'+parts.month+'-'+parts.day};
const dateAdd=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
let report=null,loading=false;
const categories=[
 {key:'vs_daily',label:'Daily VS'},
 {key:'vs_weekly',label:'Weekly VS'},
 {key:'donations_weekly',label:'Weekly donations'}
];
function period(){
 const choice=$('report-preset').value,now=today();
 if(choice==='all'){$('report-from').value='';$('report-to').value=now}
 else if(['4','8','12'].includes(choice)){$('report-to').value=now;$('report-from').value=dateAdd(now,1-Number(choice)*7)}
}
const pct=value=>value===null?'N/A':value+'%';
function metricCell(metric,label){
 const box=el('div',null,'report-metric');
 if(metric.uploads===0){box.append(el('span','No uploads','report-unknown'));return box}
 if(metric.recorded===0){box.append(el('span','Not recorded','report-unknown'));return box}
 const isDonation=label==='Weekly donations';
 const line=isDonation?
  metric.zero+' zero / '+metric.recorded+' recorded':
  metric.below+' below / '+metric.recorded+' recorded';
 box.append(el('strong',line,metric.consistent?'report-low':''));
 box.append(el('small',(isDonation?'Below target: '+metric.below+' ('+pct(metric.rate)+')':'Miss rate: '+pct(metric.rate))+
   (metric.missing?' · '+metric.missing+' unavailable':''),'stat-muted'));
 if(metric.alwaysBelow&&!isDonation)box.append(el('small','Always below minimum in recorded results','report-low'));
 return box;
}
function detail(m){
 const section=el('details',null,'report-member-detail'),sum=el('summary','Show dates and scores');
 section.append(sum);
 const list=el('div',null,'report-member-evidence');
 for(const c of categories){
  const metric=m.metrics[c.key];
  const group=el('div',null,'report-evidence-group');
  group.append(el('strong',c.label+' · minimum '+fmt(metric.min)));
  if(!metric.uploads)group.append(el('p','No '+c.label.toLowerCase()+' report uploads in this period.','stat-muted'));
  else if(!metric.recorded)group.append(el('p','Name not found in an uploaded '+c.label.toLowerCase()+' report. This is unknown, not zero.','stat-muted'));
  else{
   const ul=el('ul');
   for(const x of metric.entries){
    const li=el('li',x.date+' · '+fmt(x.points)+(x.below?' · Below target':' · Met target')+(x.zero?' · Zero recorded':''),'report-evidence-'+(x.below?'low':'ok'));
    ul.append(li);
   }
   group.append(ul);
   if(metric.missing)group.append(el('small','Not present in '+metric.missing+' uploaded snapshot'+(metric.missing===1?'':'s')+'. Missing is not a failure.','stat-muted'));
  }
  list.append(group);
 }
 section.append(list);return section;
}
function renderSummary(){
 const summary=report.summary,root=$('report-summary');root.replaceChildren();
 const cards=[
  ['Members reviewed',summary.rosterCount,'Roster: '+summary.rosterSource],
  ['Repeated daily VS misses',summary.repeatedDaily,summary.uploads.vs_daily+' daily uploads'],
  ['Repeated weekly VS misses',summary.repeatedWeekly,summary.uploads.vs_weekly+' weekly uploads'],
  ['Below donation target',summary.repeatedDonation,summary.uploads.donations_weekly+' donation uploads']
 ];
 for(const [name,value,note] of cards){
  const card=el('div',null,'report-summary-card');card.append(el('b',fmt(value)),el('strong',name),el('small',note));root.append(card);
 }
 const coverage=$('report-coverage');coverage.replaceChildren();
 coverage.append(el('p','Roster: '+summary.rosterSource+(summary.rosterDate?' · Latest VS roster '+summary.rosterDate:''),'stat-muted'));
 for(const c of categories){
  const uploads=summary.uploads[c.key];
  const observed=c.key==='vs_daily'?summary.withDailyData:c.key==='vs_weekly'?summary.withWeeklyData:summary.withDonationData;
  const text=el('p',c.label+': '+uploads+' recorded snapshot'+(uploads===1?'':'s')+' · '+observed+' member'+(observed===1?'':'s')+' with scores','stat-muted');
  coverage.append(text);
 }
 if(!summary.uploads.donations_weekly)coverage.append(el('p','No donation uploads exist in this range. We cannot identify non-donors from missing information.','report-alert'));
 if(!summary.uploads.vs_weekly)coverage.append(el('p','No weekly VS uploads exist in this range. Weekly minimum failures are unknown.','report-alert'));
}
function render(){
 if(!report)return;
 const rows=selectMemberReports(report,{filter:$('report-view').value,search:$('report-search').value}),tbody=$('report-rows');tbody.replaceChildren();
 for(const m of rows){
  const tr=el('tr'),name=el('td');name.append(el('strong',m.name));
  for(const flag of m.flags.slice(0,3))name.append(el('small',flag,'report-member-flag'));
  tr.append(name);
  for(const c of categories){const td=el('td');td.append(metricCell(m.metrics[c.key],c.label));tr.append(td)}
  const td=el('td');td.append(detail(m));tr.append(td);tbody.append(tr);
 }
 $('report-count').textContent=rows.length+' of '+report.members.length+' members match these filters. Criteria: at least '+report.settings.minSamples+' recorded results, missing the minimum in '+report.settings.missPercent+'% or more of those results.';
 $('report-empty').hidden=rows.length!==0;
 $('report-export').disabled=rows.length===0;
}
async function fetchReport(){
 if(loading)return;
 loading=true;
 const form=$('report-form'),message=$('report-message'),button=$('report-run');
 if(!form.reportValidity()){loading=false;return}
 const from=$('report-from').value,to=$('report-to').value;
 if(from&&from>to){message.textContent='The start date must be on or before the end date.';loading=false;return}
 button.disabled=true;message.textContent='Loading saved VS and donation results…';
 const params=new URLSearchParams({to,roster:$('report-roster').value,daily:$('report-daily').value,
  weekly:$('report-weekly').value,donations:$('report-donations').value,samples:$('report-samples').value,percent:$('report-percent').value});
 if(from)params.set('from',from);
 if($('report-season').value)params.set('season',$('report-season').value);
 try{
  const res=await fetch('/api/r4-reports?'+params.toString(),{credentials:'same-origin',cache:'no-store'});
  const data=await res.json();
  if(res.status===401){location.href='/r4-planner';return}
  if(!res.ok)throw Error(data.error||'Could not load member reports');
  report=data;$('report-results').hidden=false;
  message.textContent='Report updated for '+(from||'all recorded history')+' through '+to+'. Records were not altered.';
  renderSummary();render();
 }catch(e){message.textContent=e.message;$('report-results').hidden=true}
 finally{loading=false;button.disabled=false}
}
function csvCell(value){
 let s=String(value??'');
 // Protect spreadsheets against CSV formula interpretation.
 if(/^[\s]*[=+@\-]/.test(s))s="'"+s;
 return '"'+s.replaceAll('"','""')+'"';
}
function exportCsv(){
 if(!report)return;
 const columns=['Member','Daily VS below','Daily VS recorded','Daily miss %','Weekly VS below','Weekly VS recorded',
  'Weekly miss %','Donation zero','Donation below target','Donation recorded','Donation miss %','Flags','Daily below dates',
  'Weekly below dates','Donation zero dates','Last recorded data'];
 const rows=selectMemberReports(report,{filter:$('report-view').value,search:$('report-search').value});
 const data=[columns,...rows.map(m=>{
  const d=m.metrics.vs_daily,w=m.metrics.vs_weekly,g=m.metrics.donations_weekly;
  return [m.name,d.below,d.recorded,d.rate??'',w.below,w.recorded,w.rate??'',g.zero,g.below,g.recorded,g.rate??'',
   m.flags.join('; '),d.missedDates.join('; '),w.missedDates.join('; '),
   g.entries.filter(x=>x.zero).map(x=>x.date).join('; '),m.lastRecorded??''];
 })];
 const blob=new Blob(['\ufeff'+data.map(line=>line.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='UTW-member-performance-'+today()+'.csv';document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('report-to').value=today();period();
$('report-preset').addEventListener('change',()=>{if($('report-preset').value!=='custom')period()});
for(const id of ['report-from','report-to'])$(id).addEventListener('change',()=>{$('report-preset').value='custom'});
$('report-form').addEventListener('submit',e=>{e.preventDefault();fetchReport()});
$('report-reset').addEventListener('click',()=>{
 $('report-form').reset();$('report-preset').value='all';period();$('report-view').value='any_issue';$('report-search').value='';fetchReport();
});
for(const id of ['report-view','report-search'])$(id).addEventListener(id==='report-search'?'input':'change',render);
$('report-export').addEventListener('click',exportCsv);
fetchReport();
