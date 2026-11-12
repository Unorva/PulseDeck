import { useEffect, useRef, useState } from 'react';
import { Atom, Pause, Play, ArrowsOut, ArrowsIn, SlidersHorizontal, X, Camera, ArrowDown, Lightning, ArrowCounterClockwise, Info } from '@phosphor-icons/react';
import { toPng } from 'html-to-image';
import { Observatory, modes, palettes } from './engine.js';
import { useTelemetry, formatRate, formatPercent, formatBytes } from './telemetry.js';

const defaults = { mode: 'threebody', palette: 'silver', speed: 1, particles: 12000, glow: 1, cadence: 1, neural: true, paused: false, thresholds: { cpu: 85, memory: 85, gpu: 90 } };
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('pulsedeck.settings.v1')) || {};
    const num = (name, min, max) => Number.isFinite(s[name]) ? Math.max(min, Math.min(max, s[name])) : defaults[name];
    return { ...defaults, mode: modes.some(m => m.id === s.mode) ? s.mode : defaults.mode, palette: palettes[s.palette] ? s.palette : 'silver', speed: num('speed', .2, 3), particles: Math.round(num('particles', 2000, 24000) / 1000) * 1000, glow: num('glow', 0, 2), cadence: num('cadence', .2, 3), neural: s.neural !== false, thresholds: { ...defaults.thresholds, ...Object.fromEntries(Object.entries(s.thresholds || {}).filter(([k, v]) => ['cpu', 'memory', 'gpu'].includes(k) && Number.isFinite(v) && v >= 10 && v <= 100)) } };
  } catch { return defaults; }
}
function Sparkline({ values, color, bars = false, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = width * dpr; canvas.height = height * dpr;
      const c = canvas.getContext('2d'); c.scale(dpr, dpr);
      c.strokeStyle = '#172125'; c.lineWidth = .5;
      for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(0, height * i / 4); c.lineTo(width, height * i / 4); c.stroke(); }
      const max = Math.max(...values.filter(Number.isFinite), 1) * 1.15;
      const step = width / 59, offset = 60 - values.length;
      c.strokeStyle = color; c.fillStyle = color + '55'; c.lineWidth = 1;
      c.beginPath(); let started = false;
      values.forEach((v, i) => {
        if (!Number.isFinite(v)) { started = false; return; }
        const x = (i + offset) * step, y = height - 3 - v / max * (height - 7);
        if (bars) c.fillRect(x, y, Math.max(1, step - 2), height - y);
        else { if (!started) c.moveTo(x, y); else c.lineTo(x, y); started = true; }
      });
      if (!bars) c.stroke();
    };
    const observer = new ResizeObserver(draw); observer.observe(canvas); draw();
    return () => observer.disconnect();
  }, [values, color, bars]);
  return <canvas ref={ref} className="sparkline" role="img" aria-label={label} />;
}
function Segments({ value, count = 40 }) {
  return <div className="segments" aria-label={Number.isFinite(value) ? `${value.toFixed(1)}%` : '不可用'}>{Array.from({ length: count }, (_, i) => <i key={i} style={{ opacity: Number.isFinite(value) && i / count * 100 < value ? .35 + i / count * .5 : .07 }} />)}</div>;
}
function Dialog({ children, title, onClose, className = '' }) {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; el.showModal(); return () => el.close(); }, []);
  return <dialog ref={ref} className={className} aria-label={title} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}>
    <div className="dialog-heading"><div><span className="eyebrow">PULSEDECK / OBSERVATORY</span><h2>{title}</h2></div><button onClick={onClose} className="icon-button" aria-label="关闭"><X size={18} /></button></div>{children}
  </dialog>;
}
const metricMeta = [
  { key: 'cpu', label: '处理器', en: 'PROCESSOR' },
  { key: 'memory', label: '内存', en: 'MEMORY' },
  { key: 'gpu', label: '显卡', en: 'GRAPHICS' },
  { key: 'download', label: '下载', en: 'DOWNLINK' },
  { key: 'upload', label: '上传', en: 'UPLINK' },
];
export function App({displayOnly=false,preferencesOverride=null}) {
  const [localConfig, setConfig] = useState(loadSettings);
  const config=preferencesOverride||localConfig;
  const [settings, setSettings] = useState(false), [detail, setDetail] = useState(null);
  const [immersive, setImmersive] = useState(false), [fullscreen, setFullscreen] = useState(false);
  const [fps, setFps] = useState(0), [toast, setToast] = useState(''), [exporting, setExporting] = useState(false);
  const [capture, setCapture] = useState(null);
  const canvas = useRef(null), particleCanvas = useRef(null), engine = useRef(null), root = useRef(null);
  const { data, history, state, age, events } = useTelemetry();
  const metric = data?.metrics || {}, hardware = data?.hardware || {};
  const palette = palettes[config.palette], mode = modes.find(m => m.id === config.mode);
  const connected = state === 'live';
  const update = (key, value) => setConfig(c => ({ ...c, [key]: value }));
  useEffect(() => { engine.current = new Observatory(canvas.current, setFps, particleCanvas.current); return () => engine.current.dispose(); }, []);
  useEffect(() => { engine.current?.setConfig({...config,clean:displayOnly&&!config.showLabels}); if(!preferencesOverride)localStorage.setItem('pulsedeck.settings.v1', JSON.stringify({ ...config, paused: false })); }, [config,displayOnly]);
  useEffect(() => { engine.current?.setMetrics({ ...metric, sequence: data?.sequence }); }, [data]);
  useEffect(()=>window.pulseDeck?.onPointer?.(point=>engine.current?.externalPointer(point)),[]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { const sync = () => setFullscreen(Boolean(document.fullscreenElement)); document.addEventListener('fullscreenchange', sync); return () => document.removeEventListener('fullscreenchange', sync); }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        if (!document.documentElement.requestFullscreen) throw new Error('Fullscreen unsupported');
        await Promise.race([document.documentElement.requestFullscreen(), new Promise((_, reject) => setTimeout(() => reject(new Error('Fullscreen unavailable')), 1500))]);
        if (!document.fullscreenElement) throw new Error('Fullscreen unavailable');
      }
    } catch { setImmersive(true); setToast('已切换沉浸显示；当前窗口不支持原生全屏。'); }
  };
  useEffect(() => {
    const onKey = e => {
      if (e.target.closest('input,select,textarea') || e.ctrlKey || e.metaKey || e.altKey || settings || detail || capture) return;
      if (e.code === 'Space' && e.target.closest('button')) return;
      if (e.code === 'Space') { e.preventDefault(); setConfig(c => ({ ...c, paused: !c.paused })); }
      if (/^[1-5]$/.test(e.key)) update('mode', modes[Number(e.key) - 1].id);
      if (e.key.toLowerCase() === 'h') setImmersive(s => !s);
      if (e.key.toLowerCase() === 'f') toggleFullscreen();
      if (e.key === 'Escape') setImmersive(false);
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [settings, detail, capture]);
  const snapshot = async () => {
    setExporting(true);
    try {
      const url = await toPng(root.current, { pixelRatio: 1.5, backgroundColor: '#050809', filter: node => !node.classList?.contains('no-export') });
      setCapture({ url, name: `PulseDeck-${config.mode}-${Date.now()}.png` });
    } catch { setToast('画面导出失败，请重试。'); } finally { setExporting(false); }
  };
  const display = key => key === 'download' || key === 'upload' ? formatRate(metric[key]) : formatPercent(metric[key]);
  const statusLabel = connected ? '本机实时连接' : state === 'connecting' ? '正在连接本机' : '遥测连接中断';
  const overload = metricMeta.filter(m => config.thresholds[m.key] && Number.isFinite(metric[m.key]) && metric[m.key] >= config.thresholds[m.key]);
  return <main ref={root} className={`observatory ${immersive ? 'immersive' : ''} ${displayOnly?'wallpaper-presentation':''}`} style={{ '--accent': palette.css }} data-mode={config.mode}>
    {!displayOnly&&<header className="topbar">
      <div className="brand"><Atom size={26} weight="thin" /><h1>PULSEDECK</h1><span className="brand-sub">SYSTEM<br />OBSERVATORY</span></div>
      <div className={`connection ${connected ? 'live' : 'offline'}`}><i />{statusLabel}<span>{data ? `${age.toFixed(1)}s AGO` : 'LOCAL ONLY'}</span></div>
      <nav className="toolbar" aria-label="观测控制">
        <button onClick={() => update('paused', !config.paused)} title="空格：暂停视觉运动" aria-label={config.paused ? '继续动效' : '暂停动效'}>{config.paused ? <Play size={13} /> : <Pause size={13} />}<span>{config.paused ? '继续' : '暂停'}</span></button>
        <button onClick={() => setImmersive(s => !s)} className={immersive ? 'active' : ''} title="H：切换沉浸模式"><Lightning size={13} /><span>{immersive ? '退出沉浸' : '沉浸'}</span></button>
        <button onClick={toggleFullscreen} aria-label={fullscreen ? '退出全屏' : '全屏'} title="F：全屏">{fullscreen ? <ArrowsIn size={14} /> : <ArrowsOut size={14} />}</button>
        <button onClick={snapshot} disabled={exporting} aria-label="导出画面" title="保存观测画面"><Camera size={14} /></button>
        <div className="palette-controls" aria-label="动效配色">{Object.entries(palettes).map(([key, p]) => <button key={key} aria-label={p.name} title={p.name} aria-pressed={config.palette === key} className={config.palette === key ? 'active' : ''} onClick={() => update('palette', key)}><i style={{ background: p.css }} /><span>{p.name}</span></button>)}</div>
        <button className={settings ? 'active' : ''} onClick={() => setSettings(true)}><SlidersHorizontal size={14} /><span>参数</span></button>
      </nav>
    </header>}
    <section className="stage" aria-label="实时动态可视化">
      <canvas ref={particleCanvas} className="particle-field" aria-hidden="true" />
      <canvas ref={canvas} className="universe" role="img" aria-label={`${mode.name}：由本机硬件数据驱动的神经网络与粒子流，可移动指针或点击扰动流场`} />
      {!displayOnly&&<div className="mode-tabs" role="group" aria-label="可视化模式">{modes.map((m, i) => <button key={m.id} aria-pressed={config.mode === m.id} className={config.mode === m.id ? 'active' : ''} onClick={() => update('mode', m.id)} title={`${i + 1}：${m.name}`}><span className="mode-number">0{i + 1}</span>{m.name}</button>)}</div>}
      {(!displayOnly||config.showMetrics)&&<div className="metric-rail">{metricMeta.map((m, i) => <button tabIndex={displayOnly?-1:0} className={`rail-item ${overload.some(o => o.key === m.key) ? 'overload' : ''}`} key={m.key} onClick={() => {if(!displayOnly)setDetail(m.key);}} aria-label={`查看${m.label}详情`}><span className="rail-top">{m.label}<em>0{i + 1}</em></span><strong><MetricValue text={display(m.key)} /></strong><span className="rail-bottom">{Number.isFinite(metric[m.key]) ? '实时采样 / 并行计算' : '等待可用数据'}</span></button>)}</div>}
      {!displayOnly&&<><div className="stage-corner"><span className="crosshair" /><span>LIVE FIELD / {mode.en}</span></div><button className="pulse-button" onClick={() =>engine.current.triggerImpulse(engine.current.cx,engine.current.cy)}><Lightning size={11} />注入脉冲</button></>}
      {!displayOnly&&config.paused && <div className="paused-indicator">视觉运动已暂停 · 遥测持续采样</div>}
      {!displayOnly&&!!overload.length && <div className="overload-indicator">{overload.map(m => m.label).join(' / ')}负载超过提示阈值</div>}
    </section>
    {(!displayOnly||config.showMonitors)&&<section className="monitor-grid" aria-label="系统实时监测">
      <article className="monitor-card cpu-card">
        <CardHeading number="01" sub="处理器监测" title="处理器" value={display('cpu')} onClick={() => setDetail('cpu')} />
        <div className="cpu-body"><div className="process-list">{data?.processes?.length ? data.processes.slice(0, 4).map((p, i) => <div key={p.pid + '-' + i}><span title={p.name}>{p.name}</span><i style={{ width: `${Math.max(1, Math.min(100, p.cpu))}%` }} /><b>{p.cpu.toFixed(1)}%</b></div>) : <p className="empty-label">{hardware.cpu || '正在读取处理器信息…'}</p>}</div><div className="core-grid">{(metric.cores || Array(16).fill(null)).slice(0, 32).map((v, i) => <div key={i} style={{ backgroundColor: `color-mix(in srgb, var(--accent) ${Number.isFinite(v) ? 8 + v * .55 : 4}%, transparent)` }}><span>C{i}</span><b>{Number.isFinite(v) ? Math.round(v) + '%' : '—'}</b></div>)}</div></div>
        <div className="card-foot"><span>{hardware.cpu || 'CPU / LOCAL'}</span><span>{metric.cores?.length || '—'} 线程 / 只读</span></div>
      </article>
      <article className="monitor-card">
        <CardHeading number="02" sub="内存监测" title="内存" value={display('memory')} onClick={() => setDetail('memory')} />
        <div className="memory-body"><div className="memory-stats"><span>已使用 <b>{formatBytes(metric.memoryUsed)}</b></span><span>可用 <b>{formatBytes(metric.memoryAvailable)}</b></span><span>物理内存 <b>{formatBytes(metric.memoryTotal)}</b></span></div><div className="memory-matrix">{Array.from({ length: 120 }, (_, i) => <i key={i} style={{ opacity: Number.isFinite(metric.memory) && i / 120 * 100 < metric.memory ? .5 + i % 4 * .11 : .055 }} />)}</div></div>
        <div className="card-foot"><span>物理内存分配 / 实时观测</span><span>{metric.memoryTotal ? (metric.memoryTotal / 2 ** 30).toFixed(1) + ' GiB' : '—'}</span></div>
      </article>
      <article className="monitor-card">
        <CardHeading number="03" sub="显卡监测" title="显卡" value={display('gpu')} onClick={() => setDetail('gpu')} />
        <div className="gpu-body">{[{ name: '图形负载', value: metric.gpu }, { name: '显存占用', value: metric.gpuMemory }, { name: '温度', value: metric.gpuTemperature, temp: true }].map(m => <div key={m.name}><span>{m.name}</span><Segments value={m.temp ? null : m.value} count={34} /><b>{Number.isFinite(m.value) ? m.value.toFixed(1) + (m.temp ? '°C' : '%') : 'N/A'}</b></div>)}</div>
        <div className="card-foot"><span>{hardware.gpu || '正在检测显卡…'}</span><span>{Number.isFinite(metric.gpu) ? 'GPU / 实时' : '驱动未提供利用率'}</span></div>
      </article>
      {['download', 'upload'].map((key, index) => <article className="monitor-card network-card" key={key}>
        <CardHeading number={'0' + (index + 4)} sub={index ? '网络发送' : '网络接收'} title={index ? '上传' : '下载'} value={display(key)} onClick={() => setDetail(key)} />
        <div className="network-chart"><Sparkline values={history[key]} color={palette.css} label={`最近60次${index ? '上传' : '下载'}速率`} /><Sparkline values={history[key].slice(-30)} color={palette.css} bars label="速率分布" /></div>
        <div className="card-foot"><span>{hardware.network || '等待网络接口'}</span><span>60 样本 / {Number.isFinite(metric[key]) ? '实时' : '不可用'}</span></div>
      </article>)}
      <article className="monitor-card sampling-card">
        <CardHeading number="06" sub="系统采样" title="采样记录" value={String(data?.sequence || 0).padStart(4, '0')} onClick={() => setDetail('sampling')} />
        <div className="sampling-body"><div className="event-list">{events.slice(0, 3).map(e => <p key={e.id}><time>{e.time}</time><span>{e.message}</span></p>)}{!events.length && <p>等待首个有效硬件样本…</p>}</div><div className="sample-bars">{history.cpu.slice(-24).map((v, i) => <i key={i} style={{ height: `${Number.isFinite(v) ? Math.max(8, v) : 5}%`, opacity: .2 + i / 36 }} />)}</div></div>
        <div className="card-foot"><span>1 Hz / {connected ? '本机只读采集' : '自动重连中'}</span><span>{data?.timestamp ? new Date(data.timestamp).toLocaleTimeString('en-GB') : '—'}</span></div>
      </article>
    </section>}
    {!displayOnly&&<footer className="statusbar"><span><i className={connected ? 'status-dot live' : 'status-dot'} />{connected ? 'LIVE' : 'OFFLINE'} / READ ONLY <b>{hardware.cpu || 'LOCAL TELEMETRY'}</b></span><span>{config.particles.toLocaleString()} PARTICLES / {mode.en} / {fps} FPS / {engine.current?.field.gl ? 'WEBGL' : 'CANVAS 2D'}</span><span className="keyboard-hint">1–5 切换 · SPACE 暂停 · H 沉浸</span></footer>}
    {settings && <Dialog title="调节流动" onClose={() => setSettings(false)} className="settings-dialog">
      <p className="settings-description">让计算变得可见。神经网络、计算圆环与粒子流随本机负载持续演化。</p>
      <div className="settings-section"><span className="eyebrow">VISUAL CONTROLS</span>
        {[{ key: 'speed', label: '动效倍率', min: .2, max: 3, step: .1, format: v => v.toFixed(1) + '×' }, { key: 'particles', label: '粒子上限', min: 2000, max: 24000, step: 1000, format: v => v.toLocaleString() }, { key: 'glow', label: '光感强度', min: 0, max: 2, step: .1, format: v => Math.round(v * 100) + '%' }, { key: 'cadence', label: '计算节拍', min: .2, max: 3, step: .1, format: v => v.toFixed(1) + '×' }].map(s => <label className="slider-label" key={s.key}><span>{s.label}<output>{s.format(config[s.key])}</output></span><input type="range" aria-label={s.label} min={s.min} max={s.max} step={s.step} value={config[s.key]} onChange={e => update(s.key, Number(e.target.value))} /></label>)}
        <label className="checkbox-label"><input type="checkbox" checked={config.neural} onChange={e => update('neural', e.target.checked)} />神经传导与环形计算光效</label>
      </div>
      <div className="settings-section"><span className="eyebrow">COLOR SPECTRUM</span><div className="color-options">{Object.entries(palettes).map(([key, p]) => <button key={key} aria-pressed={config.palette === key} className={config.palette === key ? 'active' : ''} onClick={() => update('palette', key)}><i style={{ background: p.css }} />{p.name}</button>)}</div></div>
      <div className="settings-section"><span className="eyebrow">LOAD THRESHOLDS</span><p className="muted">超过阈值时显示负载提示，持续采样。</p>{['cpu', 'memory', 'gpu'].map(key => <label className="threshold" key={key}><span>{metricMeta.find(m => m.key === key).label}</span><input type="number" aria-label={`${key}提示阈值`} min="10" max="100" value={config.thresholds[key]} onChange={e => update('thresholds', { ...config.thresholds, [key]: Math.max(10, Math.min(100, Number(e.target.value))) })} /><span>%</span></label>)}</div>
      <button className="reset-button" onClick={() => setConfig({ ...defaults })}><ArrowCounterClockwise size={13} />恢复默认参数</button>
      <p className="settings-note"><Info size={13} />所有数据来自本机只读采集，参数保存在此浏览器。</p>
    </Dialog>}
    {detail && <Dialog title={detail === 'sampling' ? '采样记录' : metricMeta.find(m => m.key === detail)?.label + ' · 实时详情'} onClose={() => setDetail(null)} className="detail-dialog">
      <div className="detail-value">{detail === 'sampling' ? `${data?.sequence || 0} SAMPLES` : display(detail)}<span>{connected ? '本机实时数据' : '连接中断 · 保留最后样本'}</span></div>
      {detail !== 'sampling' && <Sparkline values={history[detail]} color={palette.css} label="最近60个有效采样周期的变化" />}
      {detail === 'cpu' && <p>{hardware.cpu} · {metric.cores?.length || '—'} 逻辑线程</p>}
      {detail === 'memory' && <p>已用 {formatBytes(metric.memoryUsed)} / 总计 {formatBytes(metric.memoryTotal)}</p>}
      {detail === 'gpu' && <p>{hardware.gpu}<br />{data?.capabilities?.gpu || '显卡驱动未提供利用率计数器，因此显示 N/A，不以估算值替代。'}</p>}
      {(detail === 'download' || detail === 'upload') && <p>{hardware.network} · 活跃物理网络接口的字节速率总和</p>}
      {detail === 'sampling' && <div className="detail-events">{events.map(e => <p key={e.id}><time>{e.time}</time>{e.message}</p>)}</div>}
      <div className="detail-foot"><span>本机只读 / {detail === 'gpu' ? '显卡每5秒更新' : detail === 'download' || detail === 'upload' ? '网络每2秒更新' : '每秒更新'}</span><span>采样 {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString('en-GB') : '等待连接'}</span></div>
    </Dialog>}
    {capture && <Dialog title="保存观测画面" onClose={() => setCapture(null)} className="capture-dialog"><img src={capture.url} className="capture-image" alt="PulseDeck 观测截图" /><a className="download-button" href={capture.url} download={capture.name}><ArrowDown size={14} />下载 PNG</a></Dialog>}
    {toast && <div role="status" className="toast no-export">{toast}</div>}
  </main>;
}
function CardHeading({ number, sub, title, value, onClick }) {
  return <div className="card-heading"><div><span className="eyebrow">{number} / {sub}</span><h2>{title}</h2></div><strong><MetricValue text={value} /></strong><button onClick={onClick} aria-label={`查看${title}详情`}>详情</button></div>;
}
function MetricValue({ text }) {
  const match = String(text).match(/^([\d.]+)\s*(.*)$/);
  return match ? <>{match[1]}{match[2] && <small>{match[2]}</small>}</> : text;
}
