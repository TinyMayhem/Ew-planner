import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../tiny-left-unsupervised.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('Tiny prototype is a self-contained public browser game',()=>{
  assert.match(html,/<!doctype html>/i);
  assert.match(html,/<title>Tiny: Left Unsupervised/);
  assert.ok(script?.length>10000);
  assert.doesNotThrow(()=>new vm.Script(script));
  assert.doesNotMatch(html,/fetch\(['"]\/api\/arcade/);
});

test('first two story stages and no accidental stage 3 launch',()=>{
  assert.match(script,/function opening\(/);
  assert.match(script,/function sneakRound\(/);
  assert.match(script,/function startLick\(/);
  assert.match(script,/function panicChoice\(/);
  assert.match(script,/function startDodge\(/);
  assert.match(script,/function stage2End\(/);
  assert.match(script,/Release the Raccoons/);
  assert.doesNotMatch(script,/function startStage3\(/);
});

test('energy powers and local checkpoints are represented',()=>{
  assert.match(script,/puppy:30,raccoon:60,nuggie:100/);
  assert.match(script,/utw:tiny-unsupervised:prototype-checkpoint:v1/);
  assert.match(script,/utw:tiny-unsupervised:prototype-archive:v1/);
  assert.match(script,/toStorage\(CHECKPOINT/);
  assert.match(script,/function resume\(/);
});

test('story failure never ends the run and arcade access stays isolated',()=>{
  assert.match(script,/function resolveDodge\(/);
  assert.match(script,/game\.misses\+\+/);
  assert.match(script,/setTimeout\(\(\)=>startDodge\(next\)/);
  assert.doesNotMatch(html,/SUPABASE_SECRET_KEY|UTW_SESSION_SECRET|\/api\/buddies/);
});