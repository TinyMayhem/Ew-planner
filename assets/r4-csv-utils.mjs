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

/**
 * Read the reporting date from CSV CONTENT, never from the machine's upload date
 * or file name. A file with mixed/ambiguous dates is rejected instead of guessed.
 */
export function parseReportDate(value){
 const input=String(value||'').trim();
 let m=/(?:^|[^\d])(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.]([0-3]?\d)(?!\d)/.exec(input);
 if(m){const d=m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');return isRealDate(d)?d:''}
 m=/(?:^|[^\d])(0?[1-9]|1[0-2])\/([0-3]?\d)\/(20\d{2})(?!\d)/.exec(input);
 if(m){const d=m[3]+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');return isRealDate(d)?d:''}
 m=/(?:^|[^\d])([0-3]?\d)[ ]+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[ ,]+(20\d{2})(?!\d)/i.exec(input);
 if(m){const n=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[2].slice(0,3).toLowerCase())+1;const d=m[3]+'-'+String(n).padStart(2,'0')+'-'+m[1].padStart(2,'0');return isRealDate(d)?d:''}
 return '';
}
export function csvDateFromContent(raw,head,matrix){
 const matches=new Set(),notes=[];
 // Report titles, date-bearing header labels and the first preamble lines.
 for(const line of String(raw||'').split(/\r?\n/).slice(0,12)){
  const date=parseReportDate(line);
  if(date&&/(?:date|day|period|week|report|snapshot|vs|point|donat|as of|daily|season)/i.test(line)){
   matches.add(date);notes.push('report header');
  }
 }
 for(const h of head){const date=parseReportDate(h);if(date){matches.add(date);notes.push('column header')}}
 const dateColumns=head.map((h,i)=>/(?:^|[^a-z])(date|day|timestamp|reporting|period|as of|snapshot)(?:$|[^a-z])/i.test(h)?i:-1).filter(i=>i>=0);
 for(const row of matrix){
  for(const col of dateColumns){
   const date=parseReportDate(row[col]);if(date){matches.add(date);notes.push('date column')}
  }
 }
 if(matches.size>1)return {date:'',error:'This CSV contains multiple reporting dates. Upload one reporting date per file.'};
 if(matches.size===0)return {date:'',error:'No reporting date found inside the CSV. The file needs a dated header, report title, or date column.'};
 return {date:[...matches][0],source:notes[0]||'CSV'};
}
export function csvForReport(raw){
 // Some exports include "Date: yyyy-mm-dd" or title lines before the table.
 // Find the real table header while preserving the original raw text for date extraction.
 const lines=String(raw).replace(/^\uFEFF/,'').split(/\r?\n/);
 const headerIndex=lines.findIndex(line=>{
  const normalized=line.toLowerCase();
  return /(?:member|player|commander|nickname|ign|name)/.test(normalized)&&/[,;\t]/.test(line)
   &&/(?:point|score|total|donat|contribut|vs|value)/.test(normalized);
 });
 const data=headerIndex>0?lines.slice(headerIndex).join('\n'):raw;
 const parsed=parseCsv(data);
 const report=csvDateFromContent(raw,parsed.head,parsed.matrix);
 return {...parsed,...report};
}
export function targetFromCsvDate(metric,date){
 if(!date)return '';
 return metric==='vs_daily'?date:weekStart(date);
}
