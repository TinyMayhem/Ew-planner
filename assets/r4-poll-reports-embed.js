const el=(tag,content,cls)=>{const x=document.createElement(tag);if(content!==undefined&&content!==null)x.textContent=String(content);if(cls)x.className=cls;return x};
async function pollReportEmbed(){
 const status=document.getElementById('embedded-poll-status');if(!status)return;
 try{
  const response=await fetch('/api/r4-polls?report=1',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw Error('Sign in with an individual UTW R4 account to view poll participation.');
  const data=await response.json(),s=data.summary;
  const box=document.getElementById('embedded-poll-counts');box.replaceChildren();
  for(const [label,value] of [['Finalized polls',s.polls],['Yes responses',s.yes],['No responses',s.no],['No response',s.missing]]){
   const item=el('div',null,'stat-summary');item.append(el('b',value),el('span',label));box.append(item);
  }
  const draw=(target,people,description)=>{
   const root=document.getElementById(target);root.replaceChildren();
   for(const p of people.slice(0,12)){
    const line=el('div',null,'poll-report-row');
    line.append(el('strong',p.name),el('span',description(p)));root.append(line);
   }
   if(!people.length)root.append(el('p','Not enough finalized polls yet.','stat-muted'));
  };
  const eligible=data.profiles.filter(x=>x.eligible>=3);
  draw('embedded-poll-no',eligible.filter(x=>x.no>0&&x.responded>0).sort((a,b)=>b.noRate-a.noRate||b.no-a.no),
   x=>x.no+' No of '+x.responded+' votes ('+Math.round(x.noRate*100)+'%)');
  draw('embedded-poll-missing',eligible.filter(x=>x.missing>0).sort((a,b)=>b.missing/a.eligible-a.missing/b.eligible||b.missing-a.missing),
   x=>x.missing+' No Response of '+x.eligible+' polls');
  status.textContent=s.polls+' finalized polls included. These are voting intentions, not actual attendance.';
 }catch(e){status.textContent=e.message}
}
pollReportEmbed();