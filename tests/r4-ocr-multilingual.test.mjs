import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {languagesForOcr,describeLanguagePacks,hasEastAsianScript} from '../assets/r4-ocr-languages.mjs';
import {matchRoster,validateConfirmedRows} from '../assets/r4-ocr-parser.mjs';
import {alignRankColumns,textLines} from '../assets/r4-ocr-columns.mjs';

const roster=[
 {id:'ko',display_name:'트로이Roy'},
 {id:'han',display_name:'国Mr EvoSan'},
 {id:'jp',display_name:'さくら'},
 {id:'kat',display_name:'ミカ'},
 {id:'tw',display_name:'繁體龍'},
 {id:'en',display_name:'TinyMayhem'}
];
const aliases=[{alias:'반코코Coco',alias_key:'반코코coco',member_id:'ko'}];
test('automatic OCR loads Korean, both Chinese scripts and Japanese for a mixed UTW roster',()=>{
 const codes=languagesForOcr('auto',roster,aliases);
 assert.deepEqual(codes,['eng','kor','chi_sim','chi_tra','jpn']);
 assert.match(describeLanguagePacks(codes),/Korean/);
 assert.match(describeLanguagePacks(codes),/Japanese/);
});
test('auto only downloads matching language packs for English and Korean, with all-language override',()=>{
 assert.deepEqual(languagesForOcr('auto',[{display_name:'TinyMayhem'}]),['eng']);
 assert.deepEqual(languagesForOcr('auto',[{display_name:'트로이Roy'}]),['eng','kor']);
 assert.deepEqual(languagesForOcr('all',[]),['eng','kor','chi_sim','chi_tra','jpn']);
 assert.deepEqual(languagesForOcr('zh',[]),['eng','chi_sim','chi_tra']);
 assert.deepEqual(languagesForOcr('ja',[]),['eng','jpn']);
 assert.deepEqual(languagesForOcr('ko',[]),['eng','kor']);
});
test('fullwidth Japanese, Korean, Chinese, Latin and mixed-script names resolve without changing their displayed spelling',()=>{
 for(const name of roster.map(r=>r.display_name)){
  const match=matchRoster(name,roster,aliases);
  assert.equal(match.type,'exact',name);
  assert.equal(match.name,name);
 }
 assert.equal(matchRoster('ＴｉｎｙＭａｙｈｅｍ',roster).name,'TinyMayhem');
 assert.equal(matchRoster('반코코Coco',roster,aliases).id,'ko');
 assert.equal(matchRoster('트로이Roy',roster,aliases).id,'ko');
 assert.equal(hasEastAsianScript('繁體龍'),true);
 assert.equal(hasEastAsianScript('さくら'),true);
 assert.equal(hasEastAsianScript('TinyMayhem'),false);
});
test('CJK row alignment preserves Unicode names and requires manual checkbox even after exact match',()=>{
 const names=['트로이Roy','国Mr EvoSan','さくら','ミカ','繁體龍'];
 const entries=names.map((text,i)=>({text,y:145+i*136,confidence:94}));
 const scores=names.map((_,i)=>({points:9000000-i*1000000,y:169+i*136,confidence:97,text:'9,000,000'}));
 const rows=alignRankColumns({names:entries,scores,height:1000,roster});
 assert.deepEqual(rows.map(r=>r.name),names);
 assert(rows.every(r=>r.confirmed===false));
 assert(rows.every(r=>r.points>0));
});
test('CJK data is saved only when explicitly checked, and repeated rows do not change real names',()=>{
 const row={name:'トロイRoy',points:5500000,confirmed:false};
 const photos=[{rows:[row]}];
 assert.throws(()=>validateConfirmedRows(photos),/Confirm the name/);
 row.confirmed=true;
 assert.deepEqual(validateConfirmedRows(photos),[{name:'トロイRoy',points:5500000}]);
 photos.push({rows:[{name:'トロイRoy',points:5500000,confirmed:true}]});
 assert.equal(validateConfirmedRows(photos).length,1);
});
test('OCR scanner offers mixed-language selection, and errors remain reviewable',()=>{
 const wizard=readFileSync('assets/r4-screenshot-wizard.mjs','utf8');
 const browser=readFileSync('assets/r4-ocr-browser.mjs','utf8');
 assert.match(wizard,/id="ocr-languages"/);
 assert.match(wizard,/languagesForOcr/);
 assert.match(wizard,/createWorker\(langs,1\)/);
 assert.match(browser,/scoreOnly\?'0123456789,\.'/);
 for(const p of ['assets/r4-ocr-languages.mjs','assets/r4-ocr-browser.mjs','assets/r4-screenshot-wizard.mjs']){
  const checked=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  assert.equal(checked.status,0,checked.stderr);
 }
});
