import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AWAKENING_HEROES, STAR_MILESTONES, awakeningStars, awakeningLabel, shardsSpent, awakeningCost, awakeningBudget, nextAwakeningTarget} from '../assets/awakening-core.mjs';

test('Season 6 only lists the confirmed awakening heroes', () => {
  assert.deepEqual(AWAKENING_HEROES.map(h => [h.id,h.week]), [['kim',1],['dva',3],['tesla',5]]);
});
test('awakening milestones match verified stage costs', () => {
  assert.deepEqual(STAR_MILESTONES,[0,4,9,14,19,24]);
  assert.deepEqual([-1,0,4,9,14,19,24].map(shardsSpent),[0,50,130,330,680,1080,1580]);
  assert.deepEqual([0,4,9,14,19,24].map(awakeningStars),[0,1,2,3,4,5]);
  assert.equal(awakeningLabel(-1),'Not awakened');
  assert.equal(nextAwakeningTarget(24),24);
});
test('partial tiers and tier prices work across star boundaries', () => {
  assert.equal(shardsSpent(1),70);
  assert.equal(shardsSpent(2),90);
  assert.equal(shardsSpent(5),170);
  assert.deepEqual(awakeningCost(-1,0),{unlockNamed:50,tierShards:0,total:50});
  assert.deepEqual(awakeningCost(-1,4),{unlockNamed:50,tierShards:80,total:130});
  assert.deepEqual(awakeningCost(0,4),{unlockNamed:0,tierShards:80,total:80});
  assert.deepEqual(awakeningCost(4,9),{unlockNamed:0,tierShards:200,total:200});
  assert.deepEqual(awakeningCost(-1,24),{unlockNamed:50,tierShards:1530,total:1580});
});
test('universal awakening shards never satisfy initial named unlock requirement', () => {
  const locked=awakeningBudget(-1,0,30,10000);
  assert.equal(locked.unlockGap,20);
  assert.equal(locked.readyMaterials,false);
  const ready=awakeningBudget(-1,4,50,80);
  assert.equal(ready.readyMaterials,true);
  assert.equal(ready.tierGap,0);
  const split=awakeningBudget(-1,4,70,30);
  assert.equal(split.tierGap,30);
  const unlocked=awakeningBudget(0,4,20,60);
  assert.equal(unlocked.readyMaterials,true);
});
test('existing EW page retains original storage and adds coherent progression links', () => {
  const html=readFileSync(new URL('../ew-planner.html',import.meta.url),'utf8');
  for (const key of ['utw-ew-planner-v1','id="progress-squad"','id="progress-ew"','id="progress-awakening"','id="progress-advisor"','hero-progression.mjs','awakened', 'awakeningUniversal']) {
    assert.ok(html.includes(key),key+' missing');
  }
  assert.ok(html.includes("6:[]"),'No fictitious Season 6 EWs should be introduced');
});
