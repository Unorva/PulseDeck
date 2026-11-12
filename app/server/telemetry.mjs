import os from 'node:os';
import si from 'systeminformation';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
const percentage = value => Number.isFinite(value) && value >= 0 ? Math.min(100, value) : null;
export function cpuDelta(previous, current) {
  const cores = current.map((core, i) => {
    const before = previous[i]?.times;
    if (!before) return null;
    const total = Object.keys(core.times).reduce((sum, key) => sum + core.times[key] - (before[key] || 0), 0);
    const idle = core.times.idle - before.idle;
    return total > 0 ? percentage((1 - idle / total) * 100) : null;
  });
  const valid = cores.filter(Number.isFinite);
  return { cores, cpu: valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null };
}
export function aggregateNetwork(interfaces, metadata = []) {
  const virtualName = /loopback|isatap|teredo|vethernet|pseudo|docker|tunnel|vpn|mihomo|wireguard|\btap\b|\btun\b/i;
  const physical = new Set(metadata.filter(i => !i.internal && !i.virtual && i.operstate === 'up' && !virtualName.test(i.iface + ' ' + i.ifaceName)).map(i => i.iface));
  const unique = [...new Map(interfaces.map(i => [i.iface, i])).values()];
  const valid = unique.filter(i => i.operstate === 'up' && !virtualName.test(i.iface) && (!metadata.length || physical.has(i.iface)) && Number.isFinite(i.rx_sec) && i.rx_sec >= 0 && Number.isFinite(i.tx_sec) && i.tx_sec >= 0);
  return { download: valid.length ? valid.reduce((sum, i) => sum + i.rx_sec, 0) : null, upload: valid.length ? valid.reduce((sum, i) => sum + i.tx_sec, 0) : null, network: valid.map(i => i.iface).join(' + ') || '无活跃网络接口' };
}
export function selectGraphics(controllers) {
  const ordered = [...controllers].sort((a, b) => (percentage(b.utilizationGpu) ?? -1) - (percentage(a.utilizationGpu) ?? -1));
  const gpu = ordered[0];
  return { gpu: percentage(gpu?.utilizationGpu), gpuMemory: gpu?.memoryTotal > 0 && Number.isFinite(gpu?.memoryUsed) ? percentage(gpu.memoryUsed / gpu.memoryTotal * 100) : null, gpuTemperature: gpu?.temperatureGpu >= 0 ? gpu.temperatureGpu : null, name: controllers.map(c => c.model).filter(Boolean).join(' / ') || '未检测到显卡' };
}
export function createCollector() {
  let previous = os.cpus(), sequence = 0, stopped = false, timer;
  let last = null, network = { download: null, upload: null, network: '正在检测网络…' }, graphics = { gpu: null, gpuMemory: null, gpuTemperature: null, name: '正在检测显卡…' }, processes = [];
  let networkAt = 0, graphicsAt = 0, processesAt = 0;
  const busy = new Set();
  const tasks = new Set();
  const run = (key, fn) => {
    if (busy.has(key) || stopped) return;
    busy.add(key);
    const task = Promise.resolve().then(fn).catch(() => {}).finally(() => { busy.delete(key); tasks.delete(task); });
    tasks.add(task);
  };
  const getNetwork = async () => {
    const [stats, metadata] = await Promise.all([si.networkStats('*'), si.networkInterfaces()]);
    if (stopped) return;
    network = aggregateNetwork(stats, metadata); networkAt = Date.now();
  };
  const getGraphics = async () => {
    const response = await si.graphics();
    if (stopped) return;
    const nextGraphics = selectGraphics(response.controllers || []);
    // Windows exposes usage via performance counters even when a vendor API does not.
    if (nextGraphics.gpu === null && process.platform === 'win32') {
      try {
        const script = "$ErrorActionPreference='Stop'; $g=Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine; $v=$g | Group-Object { ($_.Name -split 'engtype_')[-1] } | ForEach-Object { ($_.Group | Measure-Object -Property UtilizationPercentage -Sum).Sum }; if($v.Count -gt 0){ ($v | Measure-Object -Maximum).Maximum }";
        const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 4500, maxBuffer: 65536 });
        const text = stdout.trim(); if (text && Number.isFinite(Number(text))) nextGraphics.gpu = percentage(Number(text));
      } catch { /* Unsupported counters remain explicitly unavailable. */ }
    }
    if (!stopped) { graphics = nextGraphics; graphicsAt = Date.now(); }
  };
  const getProcesses = async () => {
    const result = await si.processes();
    if (stopped) return;
    processes = (result.list || []).filter(p => Number.isFinite(p.cpu) && p.pid > 0 && !/system idle/i.test(p.name)).sort((a, b) => b.cpu - a.cpu).slice(0, 4).map(p => ({ pid: p.pid, name: String(p.name).slice(0, 80), cpu: Math.min(100, Math.max(0, p.cpu)) }));
    processesAt = Date.now();
  };
  const tick = () => {
    if (stopped) return;
    const now = Date.now(), current = os.cpus(), total = os.totalmem(), available = os.freemem();
    const cpu = cpuDelta(previous, current); previous = current;
    last = {
      application: 'PulseDeck', timestamp: now, sequence: ++sequence,
      metrics: { ...cpu, memory: percentage((total - available) / total * 100), memoryTotal: total, memoryUsed: total - available, memoryAvailable: available, gpu: now - graphicsAt < 15000 ? graphics.gpu : null, gpuMemory: now - graphicsAt < 15000 ? graphics.gpuMemory : null, gpuTemperature: now - graphicsAt < 15000 ? graphics.gpuTemperature : null, download: now - networkAt < 10000 ? network.download : null, upload: now - networkAt < 10000 ? network.upload : null },
      hardware: { cpu: current[0]?.model.trim() || os.arch(), gpu: graphics.name, network: network.network, platform: process.platform },
      processes: now - processesAt < 25000 ? processes : [],
      capabilities: { gpu: Number.isFinite(graphics.gpu) ? '显卡实时利用率来自本机 GPU 性能计数器或显卡驱动。' : '显卡驱动未提供利用率计数器，显示 N/A。', sampleInterval: 1000, graphicsInterval: 5000, networkInterval: 2000, processInterval: 10000 },
    };
    if (sequence % 2 === 1) run('network', getNetwork);
    if (sequence % 5 === 1) run('graphics', getGraphics);
    if (sequence % 10 === 1) run('processes', getProcesses);
    timer = setTimeout(tick, 1000); timer.unref?.();
  };
  // Establish a meaningful CPU delta before the first sample is advertised as live.
  timer = setTimeout(tick, 500); timer.unref?.();
  return { sample: () => last, close: () => { stopped = true; clearTimeout(timer); } };
}
export function telemetryMiddleware(collector) {
  return (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/telemetry') return next();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    const host = req.headers.host || '';
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)) { res.statusCode = 403; return res.end('{"error":"Local access only"}'); }
    if (req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== host) { res.statusCode = 403; return res.end('{"error":"Cross-origin access denied"}'); } }
      catch { res.statusCode = 403; return res.end('{"error":"Invalid origin"}'); }
    }
    if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); return res.end('{"error":"Read only"}'); }
    const sample = collector.sample();
    if (!sample) { res.statusCode = 503; return res.end('{"error":"Warming up"}'); }
    res.end(JSON.stringify(sample));
  };
}
export function telemetryPlugin() {
  return { name: 'pulsedeck-local-telemetry', configureServer(server) { const collector = createCollector(); server.middlewares.use(telemetryMiddleware(collector)); server.httpServer?.once('close', () => collector.close()); } };
}
