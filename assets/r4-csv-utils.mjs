// Shared, side-effect-free helpers for the R4 bulk CSV uploader.
export function parseCsv(input){
 const raw=input.replace(/^\uFEFF/,'');const first=raw.split(/\r?\n/).find(l=>l.trim())||'';
 const counts=[',',';','\t'].map(delimiter=>({delimiter,count:first.split(delimiter).length}));
 const delimiter=counts.sort((a,b)=>b.count-a.count)[0].delimiter;
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<raw.length;i++){const c=raw[i],next=raw[i+1];
  if(c==='"'){if(quoted&&next==='"'){field+='"';i++}else quoted=!quoted}
  else if(c===delimiter&&!quoted){row.push(field);field=''}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&next==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field=''}
  else field+=c;
 }
 if(quoted)throw Error('CSV contains an unclosed quoted field.');
 row.push(field);if(row.some(x=>x.trim()))rows.push(row);
 if(rows.length<2)throw Error('CSV requires a header row and at least one member.');
 if(rows.length>501)throw Error('CSV cannot exceed 500 members.');
 const head=rows[0].map((x,i)=>x.trim()||'Column '+(i+1));
 if(head.length<2)throw Error('CSV must have at least two columns.');
 return {head,matrix:rows.slice(1)};
}
export function guessColumn(head,pattern,fallback){
 const n=head.findIndex(h=>pattern.test(h.toLowerCase()));return n<0?fallback:n;
}
export function isRealDate(d){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))return false;
 const date=new Date(d+'T00:00:00Z');return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===d;
}
export function weekStart(d){
 if(!isRealDate(d))return '';
 const date=new Date(d+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);return date.toISOString().slice(0,10);
}
export function detectedFileDate(filename){
 // Support date-stamped game exports like VS_2026-10-28.csv or 20261028_vs.csv.
 const match=/(?:^|[^0-9])(20\d{2})[-_. ]?(0[1-9]|1[0-2])[-_. ]?([0-3]\d)(?!\d)/.exec(filename);
 if(!match)return '';
 const date=match[1]+'-'+match[2]+'-'+match[3];return isRealDate(date)?date:'';
}
export function defaultsForFile(filename,globalMetric,globalPeriod){
 const lower=filename.toLowerCase();
 const metric=/donat|contribut/.test(lower)?'donations_weekly':lower.includes('weekly')&&lower.includes('vs')?'vs_weekly':globalMetric;
 const stamped=detectedFileDate(filename);
 return {metric,period:stamped?(metric==='vs_daily'?stamped:weekStart(stamped)):(metric==='vs_daily'?globalPeriod:weekStart(globalPeriod))};
}
export function validTarget(metric,period){
 if(!['vs_daily','vs_weekly','donations_weekly'].includes(metric)||!isRealDate(period))return false;
 return metric==='vs_daily'||weekStart(period)===period;
}
export function rowsFromCsv(matrix,nameColumn,pointsColumn){
 const n=Number(nameColumn),p=Number(pointsColumn);
 if(!Number.isInteger(n)||!Number.isInteger(p)||n<0||p<0||n===p)throw Error('Choose different name and points columns.');
 const rows=[],seen=new Set();
 for(const [i,row] of matrix.entries()){
  const name=String(row[n]||'').trim().replace(/\s+/g,' '),raw=String(row[p]||'').trim().replace(/[\s,]/g,''),points=Number(raw);
  if(!name||name.length>60||!/^\d+(?:\.0+)?$/.test(raw)||!Number.isSafeInteger(points))throw Error('Invalid member name or points on row '+(i+2)+'. Check your column choices.');
  const key=name.normalize('NFKC').toLowerCase();
  if(seen.has(key))throw Error('Duplicate name on row '+(i+2)+': '+name);
  seen.add(key);rows.push({name,points});
 }
 if(!rows.length||rows.length>500)throw Error('CSV must have 1 to 500 members.');
 return rows;
}
