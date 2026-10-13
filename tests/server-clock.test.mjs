import test from 'node:test';
import assert from 'node:assert/strict';
import {serverClockState} from '../assets/server-clock-core.js';
test('server clock uses UTC-2 through daylight saving seasons',()=>{
 for(const day of ['2026-01-01','2026-07-01']) assert.equal(serverClockState(Date.parse(day+'T14:00:00Z')).label,'12:00:00 ST');
});
test('hour and minute hands include elapsed minutes and seconds',()=>{
 const x=serverClockState(Date.parse('2026-10-13T08:30:30Z'));
 assert.equal(x.hour,195.25);assert.equal(x.minute,183);assert.equal(x.second,180);
});
test('Tiny slides most at six and least at twelve',()=>{
 assert.equal(serverClockState(Date.parse('2026-10-13T20:00:00Z')).danger,1);
 assert.equal(serverClockState(Date.parse('2026-10-13T14:00:00Z')).danger,0);
});
test('server clock rolls across midnight independently of UTC date',()=>{
 assert.equal(serverClockState(Date.parse('2026-10-13T01:59:59Z')).label,'23:59:59 ST');
 assert.equal(serverClockState(Date.parse('2026-10-13T02:00:00Z')).label,'00:00:00 ST');
});
