import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {calculate,funding,localRate} from '../assets/store-calculator-core.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../assets/store-data.json',import.meta.url)));
test('base local price excludes double bonus',()=>{assert.equal(localRate(68,5000),.0136);assert.equal(localRate('',5000),null);});
test('funding finds the cheapest checkout within daily limits',()=>{assert.equal(funding(60,1).bricks,500);assert.equal(funding(900,1).bricks,1000);assert.equal(funding(900,2).bricks,1000);assert.equal(funding(4000,1),null);});
test('earned currencies remain unconverted',()=>{const r=calculate(data,'Universal Exclusive Weapon Shard',5).find(x=>x.store==='Campaign Store');assert.equal(r.total,null);assert.equal(r.native,1500);});
test('purchase caps prevent partial routes winning',()=>{const r=calculate(data,'Universal Exclusive Weapon Shard',100).find(x=>x.store==='Campaign Store');assert.equal(r.qty,10);assert.equal(r.short,90);});
test('whole weekly pack and excess are included',()=>{const r=calculate(data,'Drone Parts',100).find(x=>x.name==='(S1) Drone Parts Weekly Pass');assert.equal(r.total,500);assert.equal(r.extra,5);});
test('existing cash reduces new spend without negative costs',()=>{const r=calculate(data,'Hero Exclusive Weapon Shard Choice Chest',1,{owned:100,days:1,periods:1}).find(x=>x.store==='Black Market Store'&&x.offer==='Discounted');assert.equal(r.total,0);assert.equal(r.leftover,40);});
