import test from 'node:test';
import assert from 'node:assert/strict';
import {THEMES,buildPrompt,cleanFavourites,choice,imageKind} from '../lib/pfp-studio.mjs';
import {GET,POST} from '../lib/pfp-studio-handler.mjs';

test('three beta themes have distinct identities',()=>{
 assert.deepEqual(THEMES.map(t=>t.id),['squad','starter','royalty']);
});
test('original art style and original clothes are preserved by default',()=>{
 const result=buildPrompt({theme:'squad',squad:'aircraft',pose:'riding'});
 assert.match(result,/preserve their recognizable appearance/i);
 assert.match(result,/match the source image visual medium/i);
 assert.match(result,/Keep their current clothes/i);
 assert.match(result,/aircraft/i);
 assert.doesNotMatch(result,/Convert into cute expressive chibi/i);
});
test('members may explicitly select a new style and an outfit',()=>{
 const result=buildPrompt({theme:'squad',squad:'tank',style:'chibi',outfit:'theme'});
 assert.match(result,/Convert into cute expressive chibi/i);
 assert.match(result,/Change the outfit/i);
});
test('starter pack requires interests, royalty does not',()=>{
 assert.throws(()=>buildPrompt({theme:'starter'}),/favourite/i);
 assert.match(buildPrompt({theme:'starter',favourites:'sushi, dogs'}),/sushi, dogs/);
 assert.match(buildPrompt({theme:'royalty',role:'jester'}),/jester/);
});
test('free text is short and choices are whitelisted',()=>{
 assert.equal(cleanFavourites('x'.repeat(500)).length,160);
 assert.equal(choice('squad','invent-my-own','tank'),'tank');
 assert.throws(()=>buildPrompt({theme:'malicious'}),/Unknown/);
});
test('image bytes must be a recognized image signature',()=>{
 assert.equal(imageKind(Uint8Array.from([137,80,78,71,13,10,26,10])),'image/png');
 assert.equal(imageKind(Uint8Array.from([255,216,255,10])),'image/jpeg');
 assert.equal(imageKind(Uint8Array.from([0,0,0,0])),'');
});
test('preview API returns status, not credentials or photo data',async()=>{
 const response=await GET();
 const data=await response.json();
 assert.equal(response.headers.get('Cache-Control'),'private, no-store, max-age=0');
 assert.deepEqual(data.themes.map(x=>x.id),['squad','starter','royalty']);
 assert.equal(data.ready,false);
 assert.equal(Object.hasOwn(data,'apiKey'),false);
});
test('image generation fails closed without explicit enablement',async()=>{
 const request=new Request('https://example.com/api/pfp-studio',{method:'POST'});
 const result=await POST(request);
 assert.equal(result.status,503);
 assert.equal((await result.json()).error.includes('not enabled'),true);
});

test('preview never presents a canvas mock-up as an AI-generated image',async()=>{
 const {readFile}=await import('node:fs/promises');
 const browser=await readFile(new URL('../assets/pfp-studio.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../members.html',import.meta.url),'utf8');
 assert.equal(browser.includes('demoComposite'),false);
 assert.equal(browser.includes('offerDownload(result.blob'),false);
 assert.match(browser,/async function pngSymbolReference/);
 assert.match(html,/AI generation not connected/);
 assert.match(html,/Copy instructions for ChatGPT/);
 assert.match(browser,/elements.button.disabled=!config.ready/);
});

test('squad variants refer to source-faithful flat icons instead of realistic vehicles',()=>{
 const tank=buildPrompt({theme:'squad',squad:'tank',style:'original'});
 const air=buildPrompt({theme:'squad',squad:'aircraft',style:'original'});
 const missile=buildPrompt({theme:'squad',squad:'missile',style:'original'});
 assert.match(tank,/lower body containing three circular openings/i);
 assert.match(air,/diagonal Aircraft symbol/i);
 assert.match(missile,/Missile launcher truck symbol/i);
 assert.doesNotMatch(tank,/rugged green armored tank/i);
 assert.match(missile,/preserve.*recognizable appearance/i);
});
test('client has illustrative source-symbol previews and includes secondary reference input',async()=>{
 const {readFile}=await import('node:fs/promises');
 const icons=await readFile(new URL('../assets/pfp-symbols.js',import.meta.url),'utf8');
 const browser=await readFile(new URL('../assets/pfp-studio.js',import.meta.url),'utf8');
 const handler=await readFile(new URL('../lib/pfp-studio-handler.mjs',import.meta.url),'utf8');
 for(const symbol of ['tank','aircraft','missile'])assert.match(icons,new RegExp(symbol+':'));
 assert.match(browser,/form\.set\('icon'/);
 assert.match(handler,/input\.append\('image\[\]'/);
});
