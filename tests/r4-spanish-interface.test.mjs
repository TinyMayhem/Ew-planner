import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {translateR4Text,ES} from '../assets/r4-es-core.mjs';
import {ES_CHECKLIST} from '../assets/r4-es-checklists.mjs';

test('Spanish switch translates R4 controls without altering player names or stored scores',()=>{
 for(const [english,spanish] of [
  ['Train Desk','Gestión de trenes'],
  ['R4 Command Centre','Centro de mando R4'],
  ['Weekly VS total (previous completed week)','Total VS semanal (semana anterior completada)'],
  ['Selected conductor','Conductor seleccionado'],
  ['Selected VIP','VIP seleccionado'],
  ['Nickname Manager','Gestor de apodos'],
  ['Member Performance Reports','Informes de rendimiento de miembros'],
  ['Stage 16','Etapa 16'],
  ['Week 5','Semana 5']
 ])assert.equal(translateR4Text(english),spanish,english);
 for(const name of ['TinyMayhem','Sus','Fkn Up Your Couch','트로이Roy','秋犬大哥','JMotty','35,750,000']){
  assert.equal(translateR4Text(name),name);
 }
 assert.equal(translateR4Text('Selected conductor','en'),'Selected conductor');
});
test('all 75 fixed Season 6 checklist duties and headings have Spanish translations',()=>{
 const file=readFileSync('api/r4-planner.mjs','utf8');
 const match=file.match(/export const weeks=(\[[\s\S]*?\]);\n/);
 assert(match,'Season 6 roadmap must exist');
 const weeks=JSON.parse(match[1]);
 assert.equal(weeks.length,10);
 let tasks=0;
 for(const week of weeks){
  const headings=[week.name,week.focus,...week.groups.flatMap(g=>[g.name,...g.items])];
  for(const heading of headings){
   assert(ES_CHECKLIST[heading]||ES[heading]||/^Week \d+$/.test(heading),
    'Spanish translation missing for: '+heading);
  }
  tasks+=week.groups.reduce((sum,g)=>sum+g.items.length,0);
 }
 assert.equal(tasks,75);
});
test('all ten R4 departments and role explanation examples are included in translations',()=>{
 const source=readFileSync('assets/r4-roles.js','utf8');
 const departmentLabels=[
  'Faction Diplomacy & Server Relations','Land & War Strategy','Trade Post Operations',
  'Alliance Communications & War Operations','Season Research & Progression',
  'Member Management','Alliance Events & Member Engagement','Data, Statistics & Rewards',
  'Operations & Accountability','War Merit & Daily Targets'
 ];
 for(const title of departmentLabels){
  assert(source.includes(title),'Missing original department '+title);
  assert(ES[title], 'Missing translated department '+title);
 }
 for(const duty of [
  'Coordinate UTW and VON diplomacy, decisions, and faction agreements.',
  'Take full ownership of Trade Post planning, separate from land management.',
  "Monitor members' War Merit progress against the daily targets set by leadership.",
  'Encourage participation, teamwork, and alliance morale.'
 ])assert(ES_CHECKLIST[duty],'Missing Spanish responsibility: '+duty);
});
test('all private R4 screens include the same persistent English Spanish switch',()=>{
 const files=['api/r4-planner.mjs','lib/r4-stats-page.mjs','lib/r4-reports-page.mjs','lib/r4-nicknames-page.mjs'];
 for(const file of files)assert.match(readFileSync(file,'utf8'),/assets\/r4-es\.js\?locale=[^"']+/,file);
 const js=readFileSync('assets/r4-es.js','utf8');
 assert.match(js,/localStorage\.setItem\(STORAGE_KEY,lang\)/);
 assert.match(js,/data-r4-lang-control|dataset\.r4LangControl/);
 assert.match(js,/MutationObserver/);
 assert.match(js,/originals=new WeakMap/);
 assert.match(js,/document\.documentElement\.lang=lang/);
});
test('translator and weekly VS source are parseable by Node before deployment',()=>{
 for(const file of ['assets/r4-es-core.mjs','assets/r4-es-checklists.mjs','assets/r4-es.js',
  'api/r4-stats.mjs','lib/train-advice.mjs','api/r4-planner.mjs']){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  assert.equal(result.status,0,file+': '+result.stderr);
 }
 const api=readFileSync('api/r4-stats.mjs','utf8');
 assert.match(api,/mode==='vs'\?'vs_weekly':'donations_weekly'/);
 assert.match(api,/period:'eq\.'\+reportWeek/);
 assert.match(api,/saturdayVs\?monday:dateAdd\(monday,-7\)/);
 assert.doesNotMatch(api,/mode==='vs'\?'vs_daily':'donations_weekly'/);
});
