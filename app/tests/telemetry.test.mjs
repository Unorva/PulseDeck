import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpuDelta, aggregateNetwork, selectGraphics, telemetryMiddleware } from '../server/telemetry.mjs';
const core = (idle, user) => ({ times: { idle, user, sys: 0, nice: 0, irq: 0 } });
test('CPU is computed from elapsed counters, not lifetime average', () => {
  const result = cpuDelta([core(9000, 1000), core(9000, 1000)], [core(9025, 1075), core(9075, 1025)]);
  assert.deepEqual(result.cores, [75, 25]); assert.equal(result.cpu, 50);
});
test('unchanged CPU counters and newly attached cores remain unavailable', () => {
  const result = cpuDelta([core(10, 10)], [core(10, 10), core(10, 10)]);
  assert.equal(result.cpu, null); assert.deepEqual(result.cores, [null, null]);
});
const net = (iface, rx_sec, tx_sec, operstate = 'up') => ({ iface, rx_sec, tx_sec, operstate });
test('network excludes virtual interfaces, warming counters and duplicate aliases', () => {
  const result = aggregateNetwork([net('Ethernet', 1000, 200), net('Ethernet', 1000, 200), net('Mihomo', 1000, 200), net('vEthernet', 3000, 500), net('WiFi', -1, -1)]);
  assert.equal(result.download, 1000); assert.equal(result.upload, 200); assert.equal(result.network, 'Ethernet');
});
test('interface metadata filters tunnel adapters that claim to be physical', () => {
  const result = aggregateNetwork([net('Cable', 100, 10), net('Custom', 400, 40)], [{ iface: 'Cable', ifaceName: 'Realtek Ethernet', operstate: 'up', virtual: false }, { iface: 'Custom', ifaceName: 'Meta Tunnel', operstate: 'up', virtual: false }]);
  assert.equal(result.download, 100); assert.equal(result.network, 'Cable');
});
test('idle network is a real zero, absent network is unavailable', () => {
  assert.equal(aggregateNetwork([net('Ethernet', 0, 0)]).download, 0);
  assert.equal(aggregateNetwork([net('Ethernet', 0, 0, 'down')]).download, null);
});
test('unsupported GPU metrics are null, supported zero is preserved', () => {
  assert.equal(selectGraphics([{ model: 'AMD' }]).gpu, null);
  const result = selectGraphics([{ model: 'NVIDIA', utilizationGpu: 0, memoryUsed: 0, memoryTotal: 8192, temperatureGpu: -1 }]);
  assert.equal(result.gpu, 0); assert.equal(result.gpuMemory, 0); assert.equal(result.gpuTemperature, null);
});
test('most active supported GPU is selected and percentages are bounded', () => {
  assert.equal(selectGraphics([{ utilizationGpu: -1 }, { utilizationGpu: 35 }, { utilizationGpu: 124 }]).gpu, 100);
});
function request(headers = {}, method = 'GET', sample = { sequence: 1 }) {
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = body; } };
  telemetryMiddleware({ sample: () => sample })({ url: '/api/telemetry', method, headers: { host: '127.0.0.1:4180', ...headers } }, res, () => assert.fail('API request should be handled'));
  return res;
}
test('telemetry is read-only, same-origin and local-only', () => {
  assert.equal(request({ origin: 'http://127.0.0.1:4180' }).statusCode, 200);
  assert.equal(request({ origin: 'https://example.com' }).statusCode, 403);
  assert.equal(request({ host: 'example.com' }).statusCode, 403);
  assert.equal(request({}, 'POST').statusCode, 405);
});
test('warmup returns 503 and successful responses cannot be cached', () => {
  assert.equal(request({}, 'GET', null).statusCode, 503);
  assert.equal(request().headers['Cache-Control'], 'no-store');
});
