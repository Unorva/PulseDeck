import test from 'node:test';
import assert from 'node:assert/strict';
import {channelActivity, metricChannels} from '../src/metric-field.js';

test('each metric changes only its own particle channel', () => {
  const base = {cpu:10,memory:10,gpu:10,download:1024,upload:1024};
  const initial = channelActivity(base);
  metricChannels.forEach(({key}, index) => {
    const next = channelActivity({...base,[key]:key === 'download' || key === 'upload' ? 20 * 1024 ** 2 : 90});
    next.forEach((channel, i) => {
      if (i !== index) assert.deepEqual(channel, initial[i], `${key} must not drive ${metricChannels[i].key}`);
    });
    if (key !== 'memory') assert.ok(next[index].speed > initial[index].speed);
    if (key !== 'cpu') assert.ok(next[index].density > initial[index].density);
  });
});
test('zero, missing and extreme samples remain finite and clearly distinct', () => {
  const idle = channelActivity({cpu:0,memory:0,gpu:0,download:0,upload:0});
  assert.ok(idle.every(c=>c.available));
  for (const value of [null,undefined,NaN,Infinity,-1]) {
    const channels = channelActivity(Object.fromEntries(metricChannels.map(m=>[m.key,value])));
    assert.ok(channels.every(c=>!c.available && Number.isFinite(c.speed) && c.density > 0));
  }
  const full = channelActivity({cpu:1000,memory:1000,gpu:1000,download:Number.MAX_VALUE,upload:Number.MAX_VALUE});
  assert.ok(full.every(c=>c.level===1 && c.speed<=2.25 && c.density<=1));
  assert.ok(full[3].density > idle[3].density);
});
