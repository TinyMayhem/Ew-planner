import test from 'node:test';
import assert from 'node:assert/strict';
import {matchRoster,autoVerifyRosterRow} from '../assets/r4-ocr-parser.mjs';
const roster=[{id:'tiny',display_name:'TinyMayhem'},{id:'spud',display_name:'BabaSpuddy'},{id:'ghost',display_name:'Ghøstlyy'}];
const aliases=[{alias:'Spuddy',member_id:'spud'},{alias:'Ghostlyy',member_id:'ghost'}];
test('unique 90% OCR name with readable score pre-checks VS review',()=>{
 const row=autoVerifyRosterRow({name:'TinyMayheh',ocrGuess:'TinyMayheh',points:7200000},roster,aliases);
 assert.equal(row.confirmed,true);assert.equal(row.autoMatched,true);
 assert.equal(row.name,'TinyMayhem');assert.equal(row.matchSimilarity,0.9);
});
test('less than 90% remains unchecked',()=>{
 const row=autoVerifyRosterRow({name:'TinyMayh',ocrGuess:'TinyMayh',points:7200000},roster,aliases);
 assert.equal(row.confirmed,false);
});
test('original OCR guess, not suggested canonical name, sets confidence',()=>{
 const row=autoVerifyRosterRow({name:'TinyMayhem',ocrGuess:'TinyMayh',points:7200000,matchType:'suggested'},roster,aliases);
 assert.equal(row.confirmed,false);
});
test('clear score or strong name is never enough when score needs review',()=>{
 assert.equal(autoVerifyRosterRow({name:'TinyMayhem',points:7,needsScoreCheck:true},roster,aliases).confirmed,false);
 assert.equal(autoVerifyRosterRow({name:'TinyMayhem',points:null},roster,aliases).confirmed,false);
 assert.equal(autoVerifyRosterRow({name:'TinyMayhem',points:'invalid'},roster,aliases).confirmed,false);
});
test('saved aliases and ø/o spelling normalize safely',()=>{
 assert.equal(matchRoster('Ghostlyy',roster,aliases).id,'ghost');
 assert.equal(autoVerifyRosterRow({name:'Ghostlyy',points:0},roster,aliases).confirmed,true);
 assert.equal(matchRoster('Spuddy',roster,aliases).id,'spud');
});
test('two equally plausible people are never auto-checked',()=>{
 const pair=[{id:'a',display_name:'TinyMayhemA'},{id:'b',display_name:'TinyMayhemB'}];
 assert.equal(autoVerifyRosterRow({name:'TinyMayhemC',points:3000000},pair,[]).confirmed,false);
});
