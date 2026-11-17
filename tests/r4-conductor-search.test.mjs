import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {matchConductors,normalizeConductorName} from '../assets/r4-conductor-search.mjs';

const choices=[
 {id:'1',name:'CallMeBaba'},
 {id:'2',name:'A Tribe Called SuS'},
 {id:'3',name:'Crüm'},
 {id:'4',name:'Savvy'}
];
const aliases=[
 {member_id:'1',alias:'Baba'},
 {member_id:'2',alias:'Fkn Up Your Couch'},
 {member_id:'2',alias:'Sus'},
 {member_id:'3',alias:'Crum'}
];
test('conductor search matches current names, accents and old nicknames',()=>{
 assert.equal(normalizeConductorName('Crüm!'),'crum');
 assert.deepEqual(matchConductors(choices,aliases,'ba').map(x=>x.id),['1']);
 assert.equal(matchConductors(choices,aliases,'fkn')[0].name,'A Tribe Called SuS');
 assert.equal(matchConductors(choices,aliases,'fkn')[0].aliasMatch,'Fkn Up Your Couch');
 assert.equal(matchConductors(choices,aliases,'crum')[0].id,'3');
 assert.equal(matchConductors(choices,aliases,'not here').length,0);
});
test('current name prefix ranks ahead of former alias matches and limits results',()=>{
 const rows=matchConductors([{id:'a',name:'Tiny'}, {id:'b',name:'A Big Person'}],
  [{member_id:'b',alias:'Tiny Baby'}],'tiny');
 assert.deepEqual(rows.map(x=>x.id),['a','b']);
 assert.equal(matchConductors(choices,aliases,'',2).length,2);
});
test('Train Desk conductor is a searchable combobox backed by the original member ID',()=>{
 const html=readFileSync('lib/r4-stats-page.mjs','utf8');
 const js=readFileSync('assets/r4-stats.js','utf8');
 assert.match(html,/id="train-member-search"[^>]*role="combobox"/);
 assert.match(html,/id="train-member-suggestions"[^>]*role="listbox"/);
 assert.match(html,/id="train-member" hidden/);
 assert.match(js,/initConductorSearch/);
 assert.match(js,/setConductorSelection\(v\.id\)/);
 assert.match(js,/conductorSearch\?\.sync\(\)/);
});
