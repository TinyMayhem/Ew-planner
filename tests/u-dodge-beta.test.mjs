import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const html=readFileSync(new URL('../u-dodge.html',import.meta.url),'utf8');
const js=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
test('Baba U-Dodge inline script parses in JavaScript',()=>{
 assert.ok(js,'expected inline game script');
 assert.doesNotThrow(()=>new Script(js));
});
test('original art, fictional U-Bites identity, and nuggets are preserved',()=>{
 assert.match(html,/BABA'S U-DODGE/);
 assert.ok((html.match(/data:image\/webp;base64,/g)||[]).length>=2,'original embedded sprites present');
 assert.match(html,/function drawNugget\(\)/);
 assert.ok(!html.includes('🍗'),'no chicken drumsticks');
});
test('top-only food and frequent power-up drops remain',()=>{
 assert.match(js,/o\.vx=0;o\.vy=rnd\(/);
 assert.match(js,/nextBox:15/);
 assert.match(js,/state\.nextBox\+=15/);
 assert.ok(!js.includes('sideChance'));
});
test('power-up scoring is explicitly bounded',()=>{
 assert.match(js,/state\.hearts\+\+;state\.score\+=50/);
 assert.match(js,/state\.shield=true;state\.score\+=50/);
 assert.match(js,/const cleared=state\.food\.length,bonus=25\+cleared\*5/);
 assert.match(js,/state\.food=\[\];state\.slashed=1;state\.score\+=bonus/);
 assert.match(js,/FULL HEALTH, NO BONUS/);
 assert.match(js,/ALREADY ACTIVE, NO BONUS/);
 assert.match(js,/function gotDodge\(\)/);
});
test('visible MO katana and fullscreen fallback exist',()=>{
 assert.match(js,/function drawKatanaSlash\(\)/);
 assert.match(js,/fillText\('MO',0,-93\)/);
 assert.match(html,/id="fullscreenBtn"/);
 assert.match(html,/#game\.screen-fill\{position:fixed/);
 assert.match(js,/requestFullscreen/);
 assert.match(js,/function resizeArena\(\)/);
 assert.match(js,/window\.addEventListener\('blur'/);
});
