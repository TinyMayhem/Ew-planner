export const LOCATIONS=[
{id:'vancouver',name:'Canada West · Vancouver / BC',zone:'America/Vancouver',code:'PT',group:'Canada'},
{id:'edmonton',name:'Canada Mountain · Alberta',zone:'America/Edmonton',code:'MT',group:'Canada'},
{id:'winnipeg',name:'Canada Central · Winnipeg',zone:'America/Winnipeg',code:'CT',group:'Canada'},
{id:'regina',name:'Canada · Saskatchewan',zone:'America/Regina',code:'SK',group:'Canada'},
{id:'toronto',name:'Canada Eastern · Toronto / Montréal',zone:'America/Toronto',code:'ET',group:'Canada'},
{id:'halifax',name:'Canada Atlantic · Halifax',zone:'America/Halifax',code:'AT',group:'Canada'},
{id:'stjohns',name:'Canada · Newfoundland',zone:'America/St_Johns',code:'NT',group:'Canada'},
{id:'losangeles',name:'US Pacific · Los Angeles',zone:'America/Los_Angeles',code:'US-PT',group:'Americas'},
{id:'denver',name:'US Mountain · Denver',zone:'America/Denver',code:'US-MT',group:'Americas'},
{id:'phoenix',name:'US · Arizona / Phoenix',zone:'America/Phoenix',code:'AZ',group:'Americas'},
{id:'chicago',name:'US Central · Chicago',zone:'America/Chicago',code:'US-CT',group:'Americas'},
{id:'newyork',name:'US Eastern · New York',zone:'America/New_York',code:'US-ET',group:'Americas'},
{id:'santiago',name:'Chile · Santiago',zone:'America/Santiago',code:'Chile',group:'Americas'},
{id:'london',name:'UK · London',zone:'Europe/London',code:'UK',group:'Europe'},
{id:'berlin',name:'Central Europe · Berlin / Paris',zone:'Europe/Berlin',code:'Europe',group:'Europe'},
{id:'istanbul',name:'Turkey · Istanbul',zone:'Europe/Istanbul',code:'TRT',group:'Europe'},
{id:'seoul',name:'Korea · Seoul',zone:'Asia/Seoul',code:'KST',group:'Asia'},
{id:'tokyo',name:'Japan · Tokyo',zone:'Asia/Tokyo',code:'JST',group:'Asia'},
{id:'taipei',name:'Taiwan · Taipei',zone:'Asia/Taipei',code:'Taiwan',group:'Asia'},
{id:'hochiminh',name:'Vietnam · Ho Chi Minh City',zone:'Asia/Ho_Chi_Minh',code:'VN',group:'Asia'},
{id:'bangkok',name:'Thailand · Bangkok',zone:'Asia/Bangkok',code:'TH',group:'Asia'},
{id:'jakarta',name:'Indonesia West · Jakarta',zone:'Asia/Jakarta',code:'WIB',group:'Asia'},
{id:'makassar',name:'Indonesia Central · Bali / Makassar',zone:'Asia/Makassar',code:'WITA',group:'Asia'},
{id:'jayapura',name:'Indonesia East · Jayapura',zone:'Asia/Jayapura',code:'WIT',group:'Asia'},
{id:'singapore',name:'Singapore',zone:'Asia/Singapore',code:'SGT',group:'Asia'},
{id:'kualalumpur',name:'Malaysia · Kuala Lumpur',zone:'Asia/Kuala_Lumpur',code:'MYT',group:'Asia'},
{id:'manila',name:'Philippines · Manila',zone:'Asia/Manila',code:'PHT',group:'Asia'},
{id:'kolkata',name:'India · Kolkata',zone:'Asia/Kolkata',code:'IST',group:'Asia'},
{id:'sydney',name:'Australia East · Sydney',zone:'Australia/Sydney',code:'Sydney',group:'Oceania'},
{id:'perth',name:'Australia West · Perth',zone:'Australia/Perth',code:'AWST',group:'Oceania'},
{id:'auckland',name:'New Zealand · Auckland',zone:'Pacific/Auckland',code:'NZ',group:'Oceania'}
];
function parts(date,zone){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));}
const dateString=p=>p.year+'-'+p.month+'-'+p.day;
const dayNumber=p=>Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day))/86400000;
export function parseTime(raw){const text=String(raw||'').trim();let h,m;if(/^\d{1,2}:\d{2}$/.test(text)){[h,m]=text.split(':').map(Number);}else if(/^\d{1,4}$/.test(text)){const padded=text.length<=2?text.padStart(2,'0')+'00':text.padStart(4,'0');h=Number(padded.slice(0,2));m=Number(padded.slice(2));}else throw Error('Enter server time as 1200 or 12:00.');if(h>23||m>59)throw Error('Use a time from 0000 to 2359.');return {h,m,text:String(h).padStart(2,'0')+String(m).padStart(2,'0')};}
export function convertTime(raw,now=new Date()){const time=parseTime(raw),server=parts(now,'America/Noronha');const instant=new Date(Date.UTC(Number(server.year),Number(server.month)-1,Number(server.day),time.h+2,time.m));return {serverDate:dateString(server),serverTime:time.text,locations:LOCATIONS.map(location=>{const p=parts(instant,location.zone),localUTC=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute));const offsetMinutes=(localUTC-instant.getTime())/60000;return {...location,time:p.hour+p.minute,date:dateString(p),dayShift:dayNumber(p)-dayNumber(server),offsetMinutes};})};}
export function announcement(data,selected){return [data.serverTime+' ST',...data.locations.filter(l=>selected.includes(l.id)).map(l=>l.time+' '+l.code+(l.dayShift?' ('+(l.dayShift>0?'+':'')+l.dayShift+' day)':''))].join(' | ');}
