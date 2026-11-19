import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../tiny-left-unsupervised.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
function source(a,b){const start=script.indexOf(a),end=script.indexOf(b,start+a.length);assert.ok(start>=0&&end>start,'Missing '+a+' to '+b);return script.slice(start,end)}

test('Stage 5 move deck is varied, keeps beginner cues, two combos and final move',()=>{
 const saved=new Map();let seed=16497;
 const math=Object.create(Math);math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
 const code=source('function mixDeck(', 'const dodgePrompts=[')+'\n'+source('const fightMoves=[','const fightResponses=');
 const ctx={Math:math,fromStorage:(k,d)=>saved.get(k)??d,toStorage:(k,v)=>{saved.set(k,v);return true}};
 const gen=vm.runInNewContext(code+'\n({buildFightDeck})',ctx);const orders=[];
 for(let i=0;i<65;i++){
  const deck=gen.buildFightDeck();orders.push(deck.map(m=>m.title).join('|'));
  assert.equal(deck.length,10);
  assert.equal(new Set(deck.map(m=>m.title)).size,10);
  assert.ok(deck.slice(0,4).every(m=>['punch','dodge','sass'].includes(m.type)));
  assert.equal(deck.filter(m=>m.type==='combo').length,2);
  assert.equal(deck[9].type,'finish');
 }
 assert.ok(new Set(orders).size>25);
 for(let i=1;i<orders.length;i++)assert.notEqual(orders[i],orders[i-1]);
});

test('Stage 6 is a scattered throne-hall hidden-object search and tactile finger scrub',()=>{
 assert.match(html,/id="cleanupBoard"/);
 assert.match(html,/\.coverup-active \.bubble\{display:none!important\}/);
 assert.match(html,/\.throne-clue/);
 assert.match(html,/\.throne-stain/);
 assert.match(html,/\.throne-stain\.foamy/);
 assert.match(html,/\.throne-search-prop/);
 assert.match(html,/\.coverup-active \.cleanup-board\{/);
 assert.match(script,/function buildCleanupRoom\(\)/);
 assert.match(script,/function startCleanup\(plan\)/);
 assert.match(script,/function tapCleanupStain\(item,run\)/);
 assert.match(script,/function scrubCleanupStain\(item,run,amount\)/);
 assert.match(script,/function setCleanupTool\(mode\)/);
 assert.match(script,/function hideCoverItem\(item,run,assisted=false\)/);
 assert.match(script,/function cleanupVerdict\(run\)/);
 assert.match(script,/btn\.addEventListener\('pointermove'/);
 assert.match(script,/Math\.hypot\(e\.clientX-item\.lastX,e\.clientY-item\.lastY\)/);
 assert.match(script,/item\.progress=Math\.min\(100,item\.progress\+amount\)/);
 assert.match(script,/run\.until\+=shift/);
 assert.match(script,/phase!=='cleanup'\|\|cleanupRun!==run/);
 assert.match(script,/item\.kind==='decoy'/);
 assert.match(script,/item\.kind==='stain'/);
 assert.match(script,/game\.coverupMissed=remaining\.length/);
 assert.match(script,/clue\('sealed-order'\)/);
 assert.match(script,/if\(phase!=='raccoons'&&phase!=='train'&&phase!=='fight'&&phase!=='cleanup'\)/);
});

test('Four scattered evidence items vary positions while the three throne stains stay scrub-ready',()=>{
 const code=source('const coverEvidence=[','const coverDialogue=[');
 const shuffle=source('function mixDeck(', 'const dodgePrompts=[');
 const gen=vm.runInNewContext(shuffle+'\n'+code+'\n'+source('function buildCleanupRoom(){','function startCleanup(plan){')+'\n({buildCleanupRoom})',{Math});
 const arrangements=new Set();
 for(let i=0;i<70;i++){
  const room=gen.buildCleanupRoom();
  assert.equal(room.length,8);
  assert.equal(room.filter(x=>x.kind==='evidence').length,4);
  assert.equal(room.filter(x=>x.kind==='stain').length,3);
  assert.equal(room.filter(x=>x.kind==='decoy').length,1);
  assert.equal(room.filter(x=>x.clue).length,1);
  assert.ok(room.every(x=>x.x>=0&&x.x<=95&&x.y>=0&&x.y<=95));
  assert.ok(room.filter(x=>x.kind==='stain').every(x=>x.progress===0));
  arrangements.add(room.filter(x=>x.kind==='evidence').map(x=>x.id+':'+x.x+','+x.y).join('|'));
 }
 assert.ok(arrangements.size>20);
});

test('Noosh interrogation branches through three questions and five possible endings',()=>{
 assert.match(script,/function askQuestion\(index\)/);
 assert.match(script,/function answerQuestion\(index,j\)/);
 assert.match(script,/function finalDefense\(\)/);
 assert.match(script,/function chooseEnding\(defense\)/);
 assert.match(script,/function resolveEnding\(defense\)/);
 assert.match(script,/function finishPrototype\(\)/);
 assert.match(script,/game\.completed,6/);
 assert.match(script,/archive\.endings\.push\(id\)/);
 assert.match(script,/stage:6,phase:'storyComplete'/);
 assert.match(script,/if\(game\.completed\?\.includes\(6\)\)/);
 assert.match(script,/id==='classified'/);
 assert.match(html,/TINY:.*LEFT UNSUPERVISED/s);
});

function choose(game,archive){
 const context={game,archive};
 const code=source('function chooseEnding(defense){','const endingText=');
 return vm.runInNewContext(code+'\nchooseEnding',context);
}
test('Four regular endings respond to choice, prior score, allies and trust',()=>{
 const archive={clues:[]},game={score:6000,coverupHidden:7,coverupTrust:3,raccoonsEscaped:1,influence:{baba:6},choices:{coverupAnswers:[],raccoonPlan:'cat',coverupFileFound:false}};
 const get=choose(game,archive);
 assert.equal(get('crown'),'queen');
 assert.equal(get('baba'),'baba');
 assert.equal(get('puppy'),'noosh');
 assert.equal(get('raccoons'),'raccoons');
});

test('Secret ending requires archived clues AND the final stage classified letter',()=>{
 const game={score:6000,coverupHidden:7,coverupTrust:3,raccoonsEscaped:1,influence:{baba:6},choices:{coverupAnswers:[],raccoonPlan:'cat',coverupFileFound:true}};
 const archive={clues:['royal-crest','raccoon-key','glasses']};
 assert.equal(choose(game,archive)('classified'),'classified');
 game.choices.coverupFileFound=false;
 assert.notEqual(choose(game,archive)('classified'),'classified');
});
