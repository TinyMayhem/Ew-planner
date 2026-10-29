import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCsv,guessColumn,isRealDate,weekStart,detectedFileDate,defaultsForFile,validTarget,rowsFromCsv} from '../assets/r4-csv-utils.mjs';

test('multiple CSV formats parse with quotes, commas, tabs and new lines',()=>{
 const parsed=parseCsv('\uFEFFCommander,VS points\n"Tiny, Mayhem","1,250"\n"Catalyst",500\n');
 assert.deepEqual(parsed.head,['Commander','VS points']);
 assert.deepEqual(rowsFromCsv(parsed.matrix,0,1),[{name:'Tiny, Mayhem',points:1250},{name:'Catalyst',points:500}]);
 const tab=parseCsv('Player\tScore\nTiny\t123\n');
 assert.deepEqual(rowsFromCsv(tab.matrix,0,1),[{name:'Tiny',points:123}]);
 const semi=parseCsv('Member;Donations\nTiny;540\n');
 assert.equal(semi.matrix[0][1],'540');
 const multiline=parseCsv('Name,Points\n"Tiny\nMayhem",100\n');
 assert.equal(multiline.matrix[0][0],'Tiny\nMayhem');
});
test('CSV validation rejects duplicate names, invalid dates, negative and nonnumeric points',()=>{
 const parsed=parseCsv('Name,Points\nTiny,12\n tiny ,14\n');
 assert.throws(()=>rowsFromCsv(parsed.matrix,0,1),/Duplicate name/);
 assert.throws(()=>rowsFromCsv([['Tiny','-1']],0,1),/Invalid member/);
 assert.throws(()=>rowsFromCsv([['Tiny','banana']],0,1),/Invalid member/);
 assert.throws(()=>rowsFromCsv([['Tiny','12']],0,0),/different name/);
 assert.equal(isRealDate('2026-02-30'),false);
 assert.equal(isRealDate('2026-10-28'),true);
 assert.equal(validTarget('vs_daily','2026-10-28'),true);
 assert.equal(validTarget('donations_weekly','2026-10-28'),false);
 assert.equal(validTarget('donations_weekly','2026-10-26'),true);
 assert.equal(weekStart('2026-11-01'),'2026-10-26');
 assert.throws(()=>parseCsv('name,points\nTiny,10\n'.repeat(501)),/500 members/);
});
test('per-file dates and metrics can be detected without treating filenames as mandatory',()=>{
 assert.equal(detectedFileDate('vs_daily_20261028.csv'),'2026-10-28');
 assert.equal(detectedFileDate('points-2026_10_28.csv'),'2026-10-28');
 assert.equal(detectedFileDate('points-2026-02-30.csv'),'');
 assert.deepEqual(defaultsForFile('vs_daily_2026-10-28.csv','vs_daily','2026-10-26'),{metric:'vs_daily',period:'2026-10-28'});
 assert.deepEqual(defaultsForFile('weekly_vs_20261028.csv','vs_daily','2026-10-28'),{metric:'vs_weekly',period:'2026-10-26'});
 assert.deepEqual(defaultsForFile('donations.csv','vs_daily','2026-10-28'),{metric:'donations_weekly',period:'2026-10-26'});
 assert.deepEqual(defaultsForFile('points.csv','vs_daily','2026-10-28'),{metric:'vs_daily',period:'2026-10-28'});
 assert.equal(guessColumn(['Member Name','Contribution Total'],/contribut|total/,1),1);
});
test('bulk importer keeps file-level mapping and uses existing authorized import route',()=>{
 const html=readFileSync(new URL('../lib/r4-stats-page.mjs',import.meta.url),'utf8');
 const app=readFileSync(new URL('../assets/r4-stats.js',import.meta.url),'utf8');
 assert.match(html,/id="csv-file"[^>]+multiple/);
 assert.match(html,/type="module" src="\/assets\/r4-stats.js"/);
 assert.match(html,/id="csv-batch"/);
 assert.match(app,/item\.metric/);
 assert.match(app,/item\.period/);
 assert.match(app,/item\.nameCol/);
 assert.match(app,/item\.pointsCol/);
 assert.match(app,/for\(const item of valid\)/);
 assert.match(app,/await post\(\{action:'import',season_id:season/);
});
