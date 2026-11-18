import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../chaos-express.html',import.meta.url),'utf8');
const dataset=name=>{
 const match=html.match(new RegExp('var '+name+'=(\\[[^\\n]+\\]);'));
 assert.ok(match,'Missing '+name+' data block');
 return JSON.parse(match[1]);
};
const levels=dataset('levels'),people=dataset('people');
const validIds=new Set(people.map(p=>p.id));

// A known valid seating plan for every handcrafted level, grouped by cart from the locomotive backward.
const knownLayouts=[
 [['tiny','mo'],['baba','ganoosh']],
 [['tiny','mo'],['baba','ganoosh']],
 [['baba','mo'],['tiny','ganoosh']],
 [['hippie','noosh'],['chibi','ube'],['rylis','spuddy']],
 [['ghostlyy','mo'],['savvy','ganoosh'],['wakka','sorree']],
 [['spuddy','rylis'],['hippie','savvy'],['baba','ube']],
 [['sorree','chibi'],['wakka','noosh'],['hippie','ghostlyy'],['rylis','spuddy']],
 [['spuddy','baba'],['ghostlyy','ube'],['savvy','mo'],['sorree','hippie']],
 [['tiny','noosh'],['spuddy','wakka'],['savvy','ghostlyy'],['rylis','hippie']],
 [['savvy','wakka'],['sorree','chibi'],['spuddy','rylis'],['hippie','noosh'],['ube','ghostlyy']],
 [['tiny','mo'],['baba','ganoosh'],['rylis','savvy'],['sorree','chibi'],['ube','wakka']],
 [['ghostlyy','ube'],['tiny','chibi'],['savvy','sorree'],['spuddy','rylis'],['noosh','hippie']],
 [["circuit","baba"],["tiny","mo"],["noosh","hippie"],["chibi","ube"],["ghostlyy","spuddy"],["wakka","rylis"]],
 [["circuit","noosh"],["baba","spuddy"],["tiny","chibi"],["savvy","ghostlyy"],["sorree","wakka"],["ube","rylis"]],
 [["circuit","ghostlyy"],["tiny","mo"],["baba","noosh"],["hippie","savvy"],["spuddy","rylis"],["sorree","chibi"]]
];

function satisfies(rule,layout){
 const cartOf=id=>layout.findIndex(cart=>cart.includes(id));
 const cart=cartOf(rule.person);
 if(cart<0)return false;
 if(rule.type==='front')return cart===0;
 if(rule.type==='back')return cart===layout.length-1;
 if(rule.type==='cart')return cart===rule.cart;
 const other=cartOf(rule.target);
 if(other<0)return false;
 if(rule.type==='with')return cart===other;
 if(rule.type==='not')return cart!==other;
 if(rule.type==='ahead')return cart<other;
 if(rule.type==='behind')return cart>other;
 return false;
}

test('chaos express grows from 2 carts to 6 and keeps exactly two seats each',()=>{
 assert.equal(levels.length,15);
 assert.equal(people.length,15);
 for(let i=0;i<levels.length;i++){
  const count=4+2*Math.floor(i/3);
  assert.equal(levels[i].riders.length,count,'Level '+(i+1)+' passenger count');
  assert.equal(knownLayouts[i].length,count/2,'Level '+(i+1)+' cart count');
  assert.equal(levels[i].seconds>=50,true,'A fair timer for level '+(i+1));
 }
});

test('each person on a level has exactly one short, grounded rule',()=>{
 for(const [i,level] of levels.entries()){
  const ids=new Set(level.riders);
  assert.equal(ids.size,level.riders.length,'Duplicate passenger on level '+(i+1));
  assert.ok([...ids].every(id=>validIds.has(id)),'Unknown passenger on level '+(i+1));
  assert.deepEqual([...level.rules.map(rule=>rule.person)].sort(),[...ids].sort(),'Rule coverage level '+(i+1));
  assert.equal(level.hints.length,2,'Two hints level '+(i+1));
  for(const rule of level.rules){
   assert.ok(rule.say.length<=82,'Too-long rule at level '+(i+1)+': '+rule.person);
   if(rule.target)assert.ok(ids.has(rule.target),'Unknown rule target '+rule.target);
   if(rule.type==='cart')assert.ok(Number.isInteger(rule.cart)&&rule.cart>=0&&rule.cart<ids.size/2);
  }
 }
 assert.ok(!levels.some(level=>level.riders.includes('tabby')),'Do not add Tabby as a game passenger');
});

test('every level has at least one verified all-rules-satisfied arrangement',()=>{
 for(let i=0;i<levels.length;i++){
  const level=levels[i],layout=knownLayouts[i];
  const flattened=layout.flat();
  assert.equal(flattened.length,level.riders.length,'Level '+(i+1)+' capacity');
  assert.deepEqual(flattened.slice().sort(),level.riders.slice().sort(),'Level '+(i+1)+' riders');
  assert.ok(layout.every(cart=>cart.length===2),'Two seats each at level '+(i+1));
  for(const rule of level.rules)assert.ok(satisfies(rule,layout),'Unsolvable rule for '+rule.person+' at level '+(i+1));
 }
});

test('Circuit is aviation-focused and forensic, while Baba rejects McDonald’s',()=>{
 const circuit=people.find(p=>p.id==='circuit'),baba=people.find(p=>p.id==='baba');
 assert.ok(circuit&&baba);
 assert.ok(circuit.quotes.some(q=>/aircraft|aviation|flight|flew|manifest/i.test(q)));
 assert.ok(circuit.quotes.some(q=>/reconstruct|manifest|generations/i.test(q)));
 assert.ok(baba.quotes.every(q=>/McDonald|arches/i.test(q)));
 assert.ok(levels.slice(12).every(l=>l.riders.includes('circuit')));
});

test('board rendering and result counts scale with current level',()=>{
 assert.ok(html.includes('for(var c=0;c<cartCount();c++)'));
 assert.ok(html.includes('Array(level().riders.length).fill(null)'));
 assert.ok(html.includes("stats.filled+'/'+level().riders.length+' boarded"));
 assert.ok(html.includes('grid-template-columns:repeat(2,minmax(0,1fr))')); 
 assert.ok(!html.includes('scroll-snap-type:x proximity'),'Passenger roster should be stacked, not sideways swipeable');
});
