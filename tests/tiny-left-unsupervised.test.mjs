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
  assert.match(script,/setTimeout\(\(\)=>\{if\(!paused&&phase==='dodge'\)startDodge\(next\)/);
  assert.doesNotMatch(html,/SUPABASE_SECRET_KEY|UTW_SESSION_SECRET|\/api\/buddies/);
});

test('throne licking requires timing around Noosh’s unpredictable peeks',()=>{
  assert.match(html,/id="nooshPeek"/);
  assert.match(script,/function changeLook\(next/);
  assert.match(script,/Math\.random\(\)/);
  assert.match(script,/lastLickedWindow!==windowId/);
  assert.match(script,/look==='away'/);
  assert.match(script,/NOOSH IS COMING BACK/);
  assert.match(script,/NOOSH IS WATCHING/);
  assert.match(script,/function finishLick\(win\)/);
});

test('Stage 2 shows actual obstacle positions and safe lanes before dodge input',()=>{
  assert.match(html,/id="dodgeBoard"/);
  assert.match(html,/\.dodge-lane\.danger/);
  assert.match(html,/\.dodge-lane\.safe/);
  assert.match(script,/function showDodgeLanes\(hazard\)/);
  assert.match(script,/hazard\.from==='left'/);
  assert.match(script,/hazard\.correct==='DUCK'/);
  assert.match(script,/style\.top=\(34\+progress\*40\)/);
  assert.match(script,/\['center','right'\]/);
  assert.match(script,/\['left','center'\]/);
  assert.match(script,/duration\+=1\.5;deadline\+=1500/);
  assert.match(script,/result\.textContent=hit\?/);
});
