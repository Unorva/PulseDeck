import { useEffect, useState } from 'react';
const keys = ['cpu', 'memory', 'gpu', 'download', 'upload'];
export function formatPercent(n) { return Number.isFinite(n) ? n.toFixed(1) + '%' : 'N/A'; }
export function formatRate(n) {
  if (!Number.isFinite(n)) return 'N/A';
  if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MiB/s';
  return (n / 1024).toFixed(1) + ' KiB/s';
}
export function formatBytes(n) { return Number.isFinite(n) ? (n / 1073741824).toFixed(1) + ' GiB' : '—'; }
export function useTelemetry() {
  const [data, setData] = useState(null), [state, setState] = useState('connecting'), [age, setAge] = useState(0);
  const [history, setHistory] = useState(() => Object.fromEntries(keys.map(k => [k, []])));
  const [events, setEvents] = useState([]);
  useEffect(() => {
    let stopped = false, timer, controller, lastSequence = -1, lastTimestamp = 0, wasLive = false, failures = 0;
    const event = message => setEvents(es => [{ id: Date.now() + '-' + message, time: new Date().toLocaleTimeString('en-GB'), message }, ...es].slice(0, 40));
    const poll = async () => {
      controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 4500);
      try {
        const res = await fetch('/api/telemetry', { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error('Telemetry unavailable');
        const sample = await res.json();
        if (stopped) return;
        if (!sample.metrics || !Number.isFinite(sample.timestamp) || Date.now() - sample.timestamp > 12000) throw new Error('Stale telemetry');
        lastTimestamp = sample.timestamp; failures = 0; setState('live');
        if (!wasLive) { event('本机遥测连接已建立'); wasLive = true; }
        if (sample.sequence !== lastSequence) {
          lastSequence = sample.sequence; setData(sample);
          setHistory(h => Object.fromEntries(keys.map(k => [k, [...h[k], Number.isFinite(sample.metrics[k]) ? sample.metrics[k] : null].slice(-60)])));
          if (sample.sequence % 10 === 0) event(`采样 #${sample.sequence} · CPU ${formatPercent(sample.metrics.cpu)}`);
        }
      } catch {
        if (!stopped) { failures++; if (failures >= 2) { setState('offline'); if (wasLive) { event('遥测连接中断，正在重连'); wasLive = false; } } }
      } finally { clearTimeout(timeout); if (!stopped) timer = setTimeout(poll, 1000); }
    };
    poll(); const clock = setInterval(() => { if (lastTimestamp) setAge(Math.max(0, (Date.now() - lastTimestamp) / 1000)); }, 200);
    return () => { stopped = true; clearTimeout(timer); clearInterval(clock); controller?.abort(); };
  }, []);
  return { data, history, state, age, events };
}
