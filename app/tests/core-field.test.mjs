import test from 'node:test';
import assert from 'node:assert/strict';
import { bezier, portPosition, transportPosition, waveEnergy,emissionPort,emissionEnvelope } from '../src/core-field.js';
const core = { x: 300, y: 300, radius: 220 };
const field = { x: 900, y: 300, width: 600, scale: 200 };
const particle = { band: 2, v: .5, w: .3, a: 1.2 };
test('Bezier transport preserves both endpoints', () => {
  assert.deepEqual(bezier([1, 2], [3, 9], [7, 8], [10, 12], 0), [1, 2]);
  assert.deepEqual(bezier([1, 2], [3, 9], [7, 8], [10, 12], 1), [10, 12]);
});
test('core-to-field transport crosses the ring without a discontinuity in every mode', () => {
  for (const mode of ['signal', 'fusion', 'threebody', 'neural']) {
    const before = transportPosition(particle, .16 - 1e-7, 4, core, field, mode);
    const after = transportPosition(particle, .16 + 1e-7, 4, core, field, mode);
    assert.ok(Math.hypot(before[0] - after[0], before[1] - after[1]) < .01, mode);
    assert.ok(Math.hypot(after[0] - core.x, after[1] - core.y) > core.radius * .95, mode);
  }
});
test('all five outlets lie on the same computation ring', () => {
  for (let band = 0; band < 5; band++) {
    const [x, y] = portPosition(band, 8, core);
    assert.ok(Math.abs(Math.hypot(x - core.x, y - core.y) - core.radius * 1.025) < 1e-6);
  }
});
test('neural impulse propagates outward and decays rather than lighting everything at once', () => {
  const wave = [{ x: 0, y: 0, time: 1 }];
  assert.ok(waveEnergy({ x: 0, y: 0 }, wave, 1, 100) > .9);
  assert.ok(waveEnergy({ x: 170, y: 0 }, wave, 2, 100) > .4);
  assert.ok(waveEnergy({ x: 0, y: 0 }, wave, 2, 100) < .01);
  assert.equal(waveEnergy({ x: 170, y: 0 }, wave, 6, 100), 0);
});
test('emission fades toward both sector edges and its source moves gradually around the ring',()=>{
 assert.ok(emissionEnvelope(0)<1e-10&&emissionEnvelope(1)<1e-10);assert.equal(emissionEnvelope(.5),1);
 assert.ok(emissionEnvelope(.1)<emissionEnvelope(.25)&&emissionEnvelope(.25)<emissionEnvelope(.5));
 const a=emissionPort(particle,0,core),b=emissionPort(particle,12,core);
 assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>10);
 for(const port of [a,b])assert.ok(Math.abs(Math.hypot(port.x-core.x,port.y-core.y)-core.radius*1.025)<1e-6);
});
