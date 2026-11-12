import {parseCsv,guessColumn,detectedFileDate,isRealDate} from './r4-csv-utils.mjs';

const utf8=new TextDecoder();
const readXml=source=>{
 const document=new DOMParser().parseFromString(source,'application/xml');
 if(document.querySelector('parsererror'))throw Error('Invalid Excel XML.');
 return document;
};
const local=(element,name)=>[...element.getElementsByTagName('*')].find(el=>el.localName===name);
const all=(element,name)=>[...element.getElementsByTagName('*')].filter(el=>el.localName===name);
function cellColumn(ref){
 const letters=String(ref||'').match(/^[A-Z]+/i)?.[0]?.toUpperCase()||'A';
 let value=0;
 for(const ch of letters)value=value*26+ch.charCodeAt(0)-64;
 return value-1;
}
async function unzipEntries(arrayBuffer){
 const bytes=new Uint8Array(arrayBuffer),view=new DataView(arrayBuffer);
 let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
  if(view.getUint32(i,true)===0x06054b50){end=i;break}
 }
 if(end<0)throw Error('Not a valid Excel .xlsx ZIP file.');
 const count=view.getUint16(end+10,true),offset=view.getUint32(end+16,true);
 const entries=new Map();let p=offset;
 for(let i=0;i<count;i++){
  if(view.getUint32(p,true)!==0x02014b50)throw Error('Malformed Excel ZIP directory.');
  const method=view.getUint16(p+10,true),size=view.getUint32(p+20,true);
  const nameLen=view.getUint16(p+28,true),extraLen=view.getUint16(p+30,true);
  const commentLen=view.getUint16(p+32,true),headerOffset=view.getUint32(p+42,true);
  const name=utf8.decode(bytes.subarray(p+46,p+46+nameLen));
  entries.set(name,{method,size,headerOffset});
  p+=46+nameLen+extraLen+commentLen;
 }
 return async path=>{
  const entry=entries.get(path);
  if(!entry)return null;
  const p=entry.headerOffset;
  if(view.getUint32(p,true)!==0x04034b50)throw Error('Malformed Excel worksheet.');
  const start=p+30+view.getUint16(p+26,true)+view.getUint16(p+28,true);
  const payload=bytes.slice(start,start+entry.size);
  if(entry.method===0)return utf8.decode(payload);
  if(entry.method!==8)throw Error('Unsupported Excel compression.');
  if(typeof DecompressionStream==='undefined')throw Error('Excel unpacking unsupported by this browser. Save as CSV instead.');
  const output=await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
  return utf8.decode(output);
 };
}
async function excelMatrix(file){
 if(file.size>4*1024*1024)throw Error('Excel file exceeds 4MB.');
 const unzip=await unzipEntries(await file.arrayBuffer());
 const sheet=await unzip('xl/worksheets/sheet1.xml');
 if(!sheet)throw Error('Cannot read the first worksheet. Export the sheet to CSV.');
 const stringsXml=await unzip('xl/sharedStrings.xml');
 const shared=stringsXml?all(readXml(stringsXml),'si').map(el=>all(el,'t').map(t=>t.textContent||'').join('')):[];
 const sheetXml=readXml(sheet),rows=all(sheetXml,'row'),matrix=[];
 for(const row of rows){
  const cols=[];
  for(const cell of all(row,'c')){
   const idx=cellColumn(cell.getAttribute('r'));
   const type=cell.getAttribute('t');
   const raw=local(cell,'v')?.textContent||'';
   cols[idx]=type==='s'?(shared[Number(raw)]||''):type==='inlineStr'?(all(cell,'t').map(t=>t.textContent||'').join('')):raw;
  }
  if(cols.some(x=>String(x||'').trim()))matrix.push(cols.map(x=>String(x??'')));
  if(matrix.length>501)throw Error('Excel worksheet contains more than 500 member rows.');
 }
 if(matrix.length<2)throw Error('Excel worksheet needs a heading and member rows.');
 return {head:matrix[0].map((v,i)=>v||'Column '+(i+1)),matrix:matrix.slice(1)};
}
export async function readThpFile(file){
 const ext=file.name.toLowerCase();
 let parsed;
 if(ext.endsWith('.csv')){if(file.size>1024*1024)throw Error('CSV file exceeds 1MB.');parsed=parseCsv(await file.text())}
 else if(ext.endsWith('.xlsx'))parsed=await excelMatrix(file);
 else throw Error('Upload .csv or .xlsx files. Save old .xls files as .xlsx first.');
 const head=parsed.head;
 const nameCol=guessColumn(head,/(name|commander|member|player|ign)/i,0);
 const thpCol=guessColumn(head,/(^thp$|total.{0,10}power|hero.{0,10}power|^power$)/i,head.length>1?1:0);
 return {...parsed,nameCol,thpCol,date:detectedFileDate(file.name)};
}
export const thpFromCell=raw=>{
 const value=String(raw??'').trim().replace(/[,\s]/g,'');
 const match=value.match(/^(\d+(?:\.\d+)?)([kmb])?$/i);
 if(!match)return null;
 const factor={k:1e3,m:1e6,b:1e9}[String(match[2]||'').toLowerCase()]||1;
 const n=Number(match[1])*factor;
 return Number.isSafeInteger(n)&&n>=0?Math.round(n):null;
};
export function parsedThpRows(fileData,sourceRoster){
 const {matrix,nameCol,thpCol}=fileData;
 if(nameCol===thpCol)return {rows:[],unmatched:[],error:'Choose separate Name and THP columns'};
 const lookup=new Map(),conflicts=new Set();
 for(const member of sourceRoster){
  const key=String(member.name).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  if(lookup.has(key)&&lookup.get(key).id!==member.id)conflicts.add(key);
  lookup.set(key,member);
 }
 for(const key of conflicts)lookup.delete(key);
 const matched=[],unmatched=[],used=new Set();
 for(const [i,row] of matrix.entries()){
  const rawName=String(row[nameCol]??'').trim(),thp=thpFromCell(row[thpCol]);
  if(!rawName&&!String(row[thpCol]??'').trim())continue;
  if(!rawName||thp===null){unmatched.push({line:i+2,name:rawName||'(blank)',reason:'Invalid name or THP',thp,memberId:''});continue}
  const normalized=rawName.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const member=lookup.get(normalized);
  if(!member){unmatched.push({line:i+2,name:rawName,reason:'No matching VS roster name',thp,memberId:''});continue}
  if(used.has(String(member.id))){unmatched.push({line:i+2,name:rawName,reason:'Duplicate member in file',thp,memberId:''});continue}
  used.add(String(member.id));
  matched.push({source_member_id:String(member.id),member_name:member.name,thp});
 }
 return {rows:matched,unmatched,error:''};
}
export {isRealDate};