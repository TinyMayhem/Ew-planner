import {test} from 'node:test';import assert from 'node:assert/strict';
import {convertTime,parseTime,announcement} from '../assets/time-converter-core.js';
test('24-hour inputs accept compact and colon forms and reject invalid times',()=>{for(const [input,expected] of [['1200','1200'],['12:00','1200'],['700','0700'],['7','0700'],['0','0000'],['23:59','2359']])assert.equal(parseTime(input).text,expected);for(const input of ['2400','1260','25:00','abc','','12:5'])assert.throws(()=>parseTime(input));});
test('seasonal clock rules differ while Korea and Saskatchewan remain fixed',()=>{const winter=convertTime('1200',new Date('2025-01-13T18:00:00Z')),summer=convertTime('1200',new Date('2025-07-13T18:00:00Z'));const clock=(data,id)=>data.locations.find(l=>l.id===id).time;assert.equal(clock(winter,'toronto'),'0900');assert.equal(clock(summer,'toronto'),'1000');assert.equal(clock(winter,'vancouver'),'0600');assert.equal(clock(summer,'vancouver'),'0700');for(const data of [winter,summer]){assert.equal(clock(data,'seoul'),'2300');assert.equal(clock(data,'regina'),'0800');}assert.equal(clock(winter,'santiago'),'1100');assert.equal(clock(summer,'santiago'),'1000');assert.equal(clock(winter,'stjohns'),'1030');assert.equal(clock(winter,'kolkata'),'1930');});
test('server midnight and late hours mark calendar rollover in copied text',()=>{const now=new Date('2026-10-13T18:00:00Z');let result=convertTime('0000',now);assert.equal(result.locations.find(l=>l.id==='vancouver').dayShift,-1);assert.match(announcement(result,['vancouver']),/1900 PCT \(-1 day\)/);result=convertTime('2359',now);assert.equal(result.locations.find(l=>l.id==='seoul').dayShift,1);assert.match(announcement(result,['seoul']),/1059 KST \(\+1 day\)/);assert.equal(announcement(result,[]),'2359 ST');});
test('today means the Noronha server day even when UTC is already tomorrow',()=>{const result=convertTime('1200',new Date('2026-10-14T01:00:00Z'));assert.equal(result.serverDate,'2026-10-13');assert.equal(result.locations.find(l=>l.id==='seoul').date,'2026-10-13');assert.equal(new Set(result.locations.map(l=>l.id)).size,result.locations.length);});

test('Vancouver stays on permanent UTC-7 while US and Alberta change on November 1, 2026',()=>{
 const dates=['2026-10-31T18:00:00Z','2026-11-01T18:00:00Z','2026-11-19T18:00:00Z','2027-01-15T18:00:00Z','2027-07-15T18:00:00Z'];
 const time=(d,id)=>convertTime('1200',new Date(d)).locations.find(l=>l.id===id);
 for(const date of dates){const v=time(date,'vancouver');assert.equal(v.time,'0700');assert.equal(v.offsetMinutes,-420);assert.equal(v.code,'PCT');}
 assert.equal(time(dates[0],'losangeles').time,'0700');
 assert.equal(time(dates[1],'losangeles').time,'0600');
 assert.equal(time(dates[2],'edmonton').time,'0700');
 assert.equal(time(dates[2],'toronto').time,'0900');
 assert.equal(time(dates[2],'london').time,'1400');
 assert.equal(time(dates[2],'berlin').time,'1500');
 assert.equal(time(dates[2],'santiago').time,'1100');
 assert.equal(time(dates[2],'seoul').time,'2300');
 assert.equal(time(dates[2],'jakarta').time,'2100');
 assert.match(announcement(convertTime('1200',new Date(dates[2])),['vancouver']),/0700 PCT/);
});
test('Vancouver retains historical PST and begins permanent Pacific Time at its March 2026 transition',()=>{
 const before=convertTime('1200',new Date('2026-03-07T14:00:00Z')).locations.find(l=>l.id==='vancouver');
 const after=convertTime('1200',new Date('2026-03-08T14:00:00Z')).locations.find(l=>l.id==='vancouver');
 assert.equal(before.time,'0600');assert.equal(before.offsetMinutes,-480);
 assert.equal(after.time,'0700');assert.equal(after.offsetMinutes,-420);
});

test('2026 European and North American fall clock changes use their respective dates',()=>{
 const byCity=(day,id)=>convertTime('1200',new Date(day+'T18:00:00Z')).locations.find(l=>l.id===id).time;
 assert.equal(byCity('2026-10-24','london'),'1500');
 assert.equal(byCity('2026-10-25','london'),'1400');
 assert.equal(byCity('2026-10-24','berlin'),'1600');
 assert.equal(byCity('2026-10-25','berlin'),'1500');
 assert.equal(byCity('2026-10-25','losangeles'),'0700');
 assert.equal(byCity('2026-11-01','losangeles'),'0600');
 assert.equal(byCity('2026-11-01','vancouver'),'0700');
});
test('the March 2026 Vancouver change happens at exactly 10:00 UTC',()=>{
 const now=new Date('2026-03-08T18:00:00Z');
 const before=convertTime('0759',now).locations.find(l=>l.id==='vancouver');
 const after=convertTime('0800',now).locations.find(l=>l.id==='vancouver');
 assert.equal(before.time,'0159');assert.equal(before.offsetMinutes,-480);
 assert.equal(after.time,'0300');assert.equal(after.offsetMinutes,-420);
});
