import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../tiny-left-unsupervised.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Inline game script exists');
const extract=(start,end)=>{
 const a=script.indexOf(start),b=script.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Missing source section '+start);
 return script.slice(a,b);
};
const randomnessSource=[
 extract('function mixDeck(', 'const dodgePrompts=['),
 extract('const dodgePrompts=[','function showDodgeLanes('),
 extract('const raccoonWaves=[','function startRaccoonWave('),
 extract('const trainHazards=[','function drawHeldTequila(')
].join('\n');
function generators(){
 const saved=new Map();let seed=7919;
 const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
 const math=Object.create(Math);math.random=random;
 const context={Math:math,fromStorage:(key,def)=>saved.has(key)?saved.get(key):def,toStorage:(key,value)=>{saved.set(key,value);return true}};
 return vm.runInNewContext(randomnessSource+'\n({buildDodgeSequence,buildRaccoonLayout,buildTrainSequence})',context);
}

test('Stage 2 changes hazard order while warnings stay correct',()=>{
 const gen=generators(),orders=[];
 for(let i=0;i<60;i++){
  const seq=gen.buildDodgeSequence();orders.push(seq.map(h=>h.name).join(','));
  assert.equal(seq.length,5);
  assert.equal(new Set(seq.map(h=>h.name)).size,5);
  assert.equal(seq.filter(h=>h.correct==='DUCK').length,2);
  for(const h of seq)assert.ok((h.from==='overhead'&&h.correct==='DUCK')||(h.from==='left'&&h.correct==='RIGHT')||(h.from==='right'&&h.correct==='LEFT'));
 }
 assert.ok(new Set(orders).size>20);
 for(let i=1;i<orders.length;i++)assert.notEqual(orders[i],orders[i-1]);
});

test('Stage 3 varies raccoon paths and decoys, retaining exactly one key clue',()=>{
 const gen=generators(),patterns=new Set();
 for(let i=0;i<60;i++){
  const waves=gen.buildRaccoonLayout();
  assert.equal(waves.length,3);
  for(const w of waves){assert.equal(w.length,5);assert.equal(w.filter(r=>r.decoy).length,1)}
  const items=waves.flat();assert.equal(items.filter(r=>!r.decoy).length,12);
  assert.equal(items.filter(r=>r.key).length,1);
  assert.ok(items.find(r=>r.key&&!r.decoy));
  assert.ok(items.every(r=>[0,1,2].includes(r.row)&&[-1,1].includes(r.dir)));
  patterns.add(items.map(r=>r.row+':'+r.dir+':'+(r.decoy?'H':r.key?'K':'R')).join('|'));
 }
 assert.ok(patterns.size>45);
});

test('Stage 4 changes hazards and tracks while preserving its difficulty ramp',()=>{
 const gen=generators(),orders=[];
 for(let i=0;i<60;i++){
  const seq=gen.buildTrainSequence();
  assert.equal(seq.length,9);
  assert.equal(new Set(seq.map(h=>h.name)).size,9);
  assert.equal(seq[0].blocked.length,1);
  assert.equal(seq[1].blocked.length,1);
  assert.equal(seq[3].duck,true);
  assert.equal(seq.filter(h=>h.duck).length,2);
  for(const h of seq){
   assert.ok(h.blocked.every(n=>[0,1,2].includes(n)));
   if(!h.duck){
    assert.ok(!h.blocked.includes(h.bonus));
    const lane=h.blocked.length===1?h.blocked[0]:h.bonus;
    assert.ok(h.text.includes(['LEFT','CENTRE','RIGHT'][lane]));
   }
  }
  orders.push(seq.map(h=>h.name+':'+h.blocked.join('')).join('|'));
 }
 assert.ok(new Set(orders).size>50);
 for(let i=1;i<orders.length;i++)assert.notEqual(orders[i],orders[i-1]);
});