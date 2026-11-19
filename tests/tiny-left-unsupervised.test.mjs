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

test('first four story stages with Stage 5 held for later',()=>{
  assert.match(script,/function opening\(/);
  assert.match(script,/function sneakRound\(/);
  assert.match(script,/function startLick\(/);
  assert.match(script,/function panicChoice\(/);
  assert.match(script,/function startDodge\(/);
  assert.match(script,/function stage2End\(/);
  assert.match(script,/Release the Raccoons/);
  assert.match(script,/function startStage3\(/);
  assert.match(script,/function startRaccoonWave\(/);
  assert.match(script,/function stage3End\(/);
  assert.match(script,/function startStage4\(/);
  assert.match(script,/function startTrainHazard\(/);
  assert.match(script,/function trainPanic\(/);
  assert.match(script,/function stage4End\(/);
  assert.doesNotMatch(script,/function startStage5\(/);
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

test('Stage 3 raccoons are visible targets with tappable collision tracking',()=>{
  assert.match(html,/id="raccoonBoard"/);
  assert.match(html,/id="raccoonField"/);
  assert.match(html,/\.raccoon-runner/);
  assert.match(script,/function raccoonArt\(/);
  assert.match(script,/function raccoonSweep\(/);
  assert.match(script,/el\.addEventListener\('click'/);
  assert.match(script,/if\(\(o\.dir===1&&o\.x>112\)\|\|\(o\.dir===-1&&o\.x< -12\)\)/);
  assert.match(script,/raccoonWaveEnd\(wave,run\)/);
});

test('Stage 3 failure produces Mo’s consequence rather than game over',()=>{
  assert.match(script,/function raccoonVerdict\(/);
  assert.match(script,/SINCERE APOLOGY/);
  assert.match(script,/CAT, MAKE A DISTRACTION/);
  assert.match(script,/function stage3End\(/);
  assert.match(script,/raccoonsCaught>=7/);
  assert.match(script,/raccoon-key/);
  assert.match(script,/Certified Raccoon Wrangler/);
  assert.match(script,/game\.completed=\[\.\.\.new Set\(\[\.\.\.game\.completed,3\]\)\]/);
});

test('Stage 3 supports pause and saves between stages without altering arcade API',()=>{
  assert.match(script,/run\.until\+=delay;run\.spawnAt\+=delay/);
  assert.match(script,/if\(phase!=='raccoons'&&phase!=='train'\)hideChallenge\(\)/);
  assert.match(script,/toStorage\(CHECKPOINT,\{\.\.\.game,stage:3,phase:'raccoonIntro'\}\)/);
  assert.match(script,/toStorage\(CHECKPOINT,\{\.\.\.game,stage:4,phase:'trainTeaser'\}\)/);
  assert.doesNotMatch(script,/fetch\(['"]\/api\/arcade/);
});

test('Stage 4 uses visible three-track obstacles and clear directional controls',()=>{
  assert.match(html,/id="trainBoard"/);
  assert.match(html,/id="trainBrake"/);
  assert.match(html,/\.train-track\.danger/);
  assert.match(html,/\.train-track\.safe/);
  assert.match(script,/function showTrainBoard\(run,hazard\)/);
  assert.match(script,/function startTrainHazard\(index\)/);
  assert.match(script,/function chooseTrainLane\(i\)/);
  assert.match(script,/function duckTrain\(\)/);
  assert.match(script,/function trainBrake\(down\)/);
  assert.match(script,/braking\?\.37:1/);
  assert.match(script,/hazard\.duck\?performance\.now\(\)<=run\.duckUntil/);
});

test('Stage 4 features Tiny and Devi, tequila props and consequences not game over',()=>{
  assert.match(script,/function drawHeldTequila\(\)/);
  assert.match(script,/Closed tequila bottle/);
  assert.match(script,/Empty shot glass/);
  assert.match(script,/trainProp='shot'/);
  assert.match(script,/Devi:.*tequila/);
  assert.match(script,/trainHits\+\+/);
  assert.match(script,/function trainPanicResult\(/);
  assert.match(script,/function stage4Verdict\(/);
  assert.match(script,/function stage4End\(/);
  assert.match(script,/game\.completed,4/);
  assert.match(script,/stage:5,phase:'babaTeaser'/);
});

test('Stage 4 remains a local game, saving its checkpoint without sharing U-Dodge scores',()=>{
  assert.match(script,/saved\.completed\?\.includes\(3\)\)\{startStage4\(\)/);
  assert.match(script,/phase==='train'\|\|phase==='trainPanic'/);
  assert.doesNotMatch(script,/fetch\(['"]\/api\/arcade/);
});
