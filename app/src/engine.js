const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const palettes = {
  silver: { name: '冷白银', rgb: [189, 227, 234], hot: [255, 205, 183], css: '#bde3ea' },
  gold: { name: '香槟金', rgb: [235, 208, 158], hot: [255, 247, 221], css: '#ebd09e' },
  cyan: { name: '深海蓝', rgb: [78, 195, 246], hot: [168, 244, 255], css: '#4ec3f6' },
  violet: { name: '星云紫', rgb: [180, 148, 245], hot: [248, 181, 239], css: '#b494f5' },
};
export const modes = [
  { id: 'flow', name: '环状流场', en: 'ANNULAR FLOW', caption: '有序涌动 / 信息在轨道之间流淌' },
  { id: 'blackhole', name: '黑洞引擎', en: 'EVENT HORIZON', caption: '引力透镜 / 秩序坠入事件视界' },
  { id: 'fusion', name: '聚变引擎', en: 'STELLAR FUSION', caption: '约束与释放 / 从计算中点燃恒星' },
  { id: 'threebody', name: '三体引擎', en: 'THREE BODY / CHAOS', caption: '三核捕获 / 混沌交会 / 引力弹射' },
  { id: 'neural', name: '推理引擎', en: 'LAYERED INFERENCE', caption: '多层推理 / 信号在神经元之间传播' },
];
function randomFactory(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let a = Math.imul(seed ^ seed >>> 15, 1 | seed); a ^= a + Math.imul(a ^ a >>> 7, 61 | a); return ((a ^ a >>> 14) >>> 0) / 4294967296; };
}
export class Observatory {
  constructor(canvas, onFrame) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.onFrame = onFrame;
    this.config = { mode: 'threebody', palette: 'silver', speed: 1, particles: 12000, glow: 1, cadence: 1, neural: true, paused: false };
    this.metrics = {};
    this.t = 10; this.last = 0; this.frame = 0; this.fpsTime = 0; this.fpsFrames = 0;
    this.pointer = { x: -1000, y: -1000 }; this.impulse = 0;
    const random = randomFactory(27);
    this.particles = Array.from({ length: 24000 }, () => ({ u: random(), v: random(), w: random(), a: random() * TAU, band: Math.floor(random() * 5), x: null, y: null }));
    this.nodes = Array.from({ length: 210 }, (_, i) => {
      const y = 1 - i / 209 * 2, r = Math.sqrt(1 - y * y), a = i * 2.399963;
      return { x: Math.cos(a) * r, y, z: Math.sin(a) * r, phase: random() * TAU };
    });
    this.edges = [];
    for (let i = 0; i < this.nodes.length; i++) for (let j = i + 1; j < this.nodes.length; j++) {
      const a = this.nodes[i], b = this.nodes[j];
      if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < .44) this.edges.push([i, j]);
    }
    this.resize = () => {
      const box = canvas.getBoundingClientRect();
      this.w = box.width; this.h = box.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.round(this.w * dpr); canvas.height = Math.round(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.particles.forEach(p => { p.x = null; });
    };
    this.observer = new ResizeObserver(this.resize); this.observer.observe(canvas);
    this.move = e => { const b = canvas.getBoundingClientRect(); this.pointer = { x: e.clientX - b.x, y: e.clientY - b.y }; };
    this.leave = () => { this.pointer.x = -1000; };
    this.click = () => { this.impulse = 1; };
    canvas.addEventListener('pointermove', this.move); canvas.addEventListener('pointerleave', this.leave); canvas.addEventListener('click', this.click);
    this.loop = now => {
      const dt = this.last ? Math.min((now - this.last) / 1000, .05) : .016;
      this.last = now;
      if (!document.hidden) {
        if (!this.config.paused) { this.t += dt * this.config.speed * (.7 + (this.metrics.cpu || 0) / 180); this.impulse *= Math.exp(-dt * 1.4); }
        this.draw(dt);
        this.fpsFrames++; this.fpsTime += dt;
        if (this.fpsTime > 1) { this.onFrame?.(Math.round(this.fpsFrames / this.fpsTime)); this.fpsTime = 0; this.fpsFrames = 0; }
      }
      this.raf = requestAnimationFrame(this.loop);
    };
    this.raf = requestAnimationFrame(this.loop);
  }
  setConfig(config) { this.config = config; }
  setMetrics(metrics) { this.metrics = metrics || {}; }
  dispose() { cancelAnimationFrame(this.raf); this.observer.disconnect(); this.canvas.removeEventListener('pointermove', this.move); this.canvas.removeEventListener('pointerleave', this.leave); this.canvas.removeEventListener('click', this.click); }
  color(alpha, hot = false) { return `rgba(${(hot ? this.hot : this.rgb).join(',')},${clamp(alpha, 0, 1)})`; }
  line(x1, y1, x2, y2, alpha = .2, width = .5, hot = false) {
    const c = this.ctx; c.strokeStyle = this.color(alpha, hot); c.lineWidth = width; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  }
  arc(x, y, r, start, end, alpha = .2, width = .5, hot = false) {
    const c = this.ctx; c.strokeStyle = this.color(alpha, hot); c.lineWidth = width; c.beginPath(); c.arc(x, y, Math.max(r, .1), start, end); c.stroke();
  }
  text(text, x, y, size = 8, alpha = .4, align = 'left') {
    const c = this.ctx; c.font = `${size}px "Consolas", monospace`; c.textAlign = align; c.fillStyle = this.color(alpha); c.fillText(text, x, y);
  }
  draw(dt) {
    if (!this.w || !this.h) return;
    const c = this.ctx, { w, h, t } = this;
    const pal = palettes[this.config.palette] || palettes.silver; this.rgb = pal.rgb; this.hot = pal.hot;
    c.globalCompositeOperation = 'source-over'; c.fillStyle = '#050809'; c.fillRect(0, 0, w, h);
    const compact = w < 760;
    const r = Math.min(h * .414, w * (compact ? .27 : .232));
    const cx = compact ? w * .30 : w * .255, cy = h * .51;
    this.cx = cx; this.cy = cy; this.radius = r;
    // Sparse background observations anchor the depth without obscuring signals.
    for (let i = 0; i < 95; i++) {
      const x = ((i * 7919) % 997) / 997 * w, y = ((i * 3571) % 991) / 991 * h;
      c.fillStyle = this.color(.04 + .035 * Math.sin(t * .2 + i)); c.fillRect(x, y, .8, .8);
    }
    c.save(); c.beginPath(); c.rect(cx + r * .56, 36, w - cx - r * .56 - 20, h - 66); c.clip();
    this.drawField(dt, compact); c.restore();
    this.drawCore(cx, cy, r);
    this.text('N E U R A L   O B S E R V A T O R Y', 22, 25, 7, .42);
    this.text('环状运算中枢', 22, 44, 12, .78);
    this.text(modes.find(m => m.id === this.config.mode)?.caption || '', 22, h - 17, 8, .44);
    this.text('计算 / 外逸动能耦合场 · ' + this.config.cadence.toFixed(1) + '× 节律', w * .49, h - 17, 7, .32);
    this.frame++;
  }
  drawCore(cx, cy, r) {
    const { ctx: c, t } = this;
    // Rotating, depth-projected Fibonacci network; edges preserve their 3D topology.
    const a = t * .045 * this.config.cadence, co = Math.cos(a), si = Math.sin(a);
    const projected = this.nodes.map(n => {
      const x = n.x * co - n.z * si, z = n.x * si + n.z * co;
      return { x: cx + x * r * .86, y: cy + (n.y * .98 + z * .12) * r * .86, z, phase: n.phase };
    });
    if (this.config.neural) {
      for (const [i, j] of this.edges) {
        const a = projected[i], b = projected[j], z = (a.z + b.z + 2) / 4;
        this.line(a.x, a.y, b.x, b.y, .027 + z * .11, .45);
        const pulse = (t * .15 * this.config.cadence + i * .173) % 1;
        if (i % 7 === 0) {
          const x = a.x + (b.x - a.x) * pulse, y = a.y + (b.y - a.y) * pulse;
          c.fillStyle = this.color(.45 * z); c.fillRect(x, y, 1.3, 1.3);
        }
      }
      for (const p of projected) {
        const pulse = Math.pow(Math.max(0, Math.sin(t * .8 + p.phase)), 14);
        const opacity = .13 + (p.z + 1) * .15 + pulse * .5;
        if (pulse > .3 && this.config.glow > .1) {
          const glow = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 6 * this.config.glow);
          glow.addColorStop(0, this.color(opacity * .55)); glow.addColorStop(1, this.color(0));
          c.fillStyle = glow; c.fillRect(p.x - 10, p.y - 10, 20, 20);
        }
        c.fillStyle = this.color(opacity); c.fillRect(p.x, p.y, pulse > .5 ? 1.7 : 1, pulse > .5 ? 1.7 : 1);
      }
    }
    for (let j = 0; j < 8; j++) {
      const rr = r * (.91 + j * .014);
      this.arc(cx, cy, rr, 0, TAU, j % 3 === 0 ? .23 : .08, .5);
      const spin = t * (.012 + j * .003) * (j % 2 ? -1 : 1);
      for (let i = 0; i < 96; i++) {
        const ang = i / 96 * TAU + spin;
        const activity = ((i * 13 + j * 29) % 101) / 100;
        const bright = activity < (this.metrics.cpu || 15) / 100 && Math.sin(ang * 2 + t * .3) > .25;
        this.arc(cx, cy, rr, ang, ang + .035, bright ? .55 : .06 + activity * .07, j % 3 === 0 ? 2.6 : .9, bright && j === 4);
      }
    }
    for (let i = 0; i < 180; i++) {
      const a = i / 180 * TAU, major = i % 15 === 0;
      this.line(cx + Math.cos(a) * r * 1.027, cy + Math.sin(a) * r * 1.027, cx + Math.cos(a) * r * (major ? 1.064 : 1.04), cy + Math.sin(a) * r * (major ? 1.064 : 1.04), major ? .48 : .17, .5);
    }
    for (let j = 0; j < 4; j++) {
      const start = t * .09 + j * TAU / 4;
      this.arc(cx, cy, r * .895, start, start + .13 + (this.metrics.memory || 20) / 450, .33, .7);
    }
    this.text('0 1 — 0 5', cx - r * .55, cy - r * .97, 7, .35);
    c.save(); c.translate(cx - r * 1.075, cy + 45); c.rotate(-Math.PI / 2); this.text('LOCAL / LIVE / READ ONLY', 0, 0, 6, .35); c.restore();
    const bw = r * .36, bh = r * .45;
    c.fillStyle = 'rgba(5,8,9,.92)'; c.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
    this.line(cx - bw / 2, cy - bh / 2, cx - bw / 2, cy + bh / 2, .13);
    this.line(cx + bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2, .13);
    this.text('L O C A L  /  C O R E', cx, cy - 25, Math.max(5, r * .025), .55, 'center');
    this.text('PD', cx - 6, cy + 11, r * .16, .96, 'center');
    this.text('01', cx + r * .12, cy + 11, r * .044, .65, 'center');
    this.text('采样 ' + String(this.metrics.sequence || 0).padStart(4, '0'), cx, cy + 35, Math.max(6, r * .03), .45, 'center');
    this.line(cx - 21, cy + 48, cx + 21, cy + 48, .35);
  }
  getPosition(p, t, fcx, cy, fw, scale) {
    const mode = this.config.mode, a = p.a, u = (p.u + t * (.025 + p.w * .012)) % 1;
    const thickness = (p.v - .5) * (8 + 9 * p.w), k = p.band;
    if (mode === 'blackhole') {
      const theta = u * TAU, rr = 46 + Math.pow(p.v, .78) * scale * 1.34;
      const warp = Math.exp(-Math.pow(Math.cos(theta) * rr / 92, 2));
      let x = Math.cos(theta) * rr, y = Math.sin(theta) * rr * .24;
      if (Math.sin(theta) < 0) y -= warp * (scale * .65) * Math.pow(1 - p.v * .65, 1.4);
      return [fcx + x, cy + y + Math.sin(theta * 3 + a) * 2];
    }
    if (mode === 'fusion') {
      const theta = u * TAU, rr = scale * (.38 + p.v * .65);
      const x = Math.cos(theta) * rr, y = Math.sin(theta) * rr;
      const rot = k / 5 * Math.PI + Math.sin(t * .13) * .3;
      return [fcx + x * Math.cos(rot) - y * .25 * Math.sin(rot), cy + x * Math.sin(rot) + y * .25 * Math.cos(rot)];
    }
    if (mode === 'neural') {
      const layer = Math.floor(u * 6), progress = (u * 6) % 1;
      const nodeA = Math.floor(p.v * (k + 4)), nodeB = Math.floor(p.w * (k + 5));
      const ya = (nodeA / (k + 3) - .5) * scale * 1.8;
      const yb = (nodeB / (k + 4) - .5) * scale * 1.8;
      return [fcx - fw * .47 + (layer + progress) / 6 * fw * .92, cy + ya * (1 - progress) + yb * progress + thickness * .08];
    }
    if (mode === 'flow') {
      const theta = u * TAU, rr = scale * (.64 + p.v * .30);
      const x = Math.cos(theta) * rr * 1.48;
      return [fcx + x, cy + Math.sin(theta) * rr * .56 + Math.cos(theta * 2 + t * .3) * scale * .13 + thickness * .5];
    }
    // Bundles follow three moving gravity wells, then fan out in a chaotic slingshot.
    const x = (u - .5) * fw * 1.28;
    const envelope = Math.pow(Math.abs(u - .5) * 2, .82);
    const wave = Math.sin(u * Math.PI * (1.2 + k * .16) + t * .16 + k * 1.3);
    const y = wave * scale * .95 * envelope + Math.sin(u * 13 + k + t * .18) * 14 + thickness * (.3 + envelope);
    return [fcx + x, cy + y];
  }
  drawField(dt, compact) {
    const c = this.ctx, { w, h, cy, t } = this;
    const fcx = w * (compact ? .76 : .715), fw = w * .46, scale = Math.min(h * .34, fw * .43);
    const count = this.config.particles;
    const glow = this.config.glow;
    c.globalCompositeOperation = 'lighter';
    // Draw in opacity/color batches to keep 24k moving particles fluid.
    for (let batch = 0; batch < 8; batch++) {
      const hot = batch === 6 || batch === 7;
      c.strokeStyle = this.color((.12 + batch % 4 * .09) * (.65 + glow * .40), hot);
      c.lineWidth = batch > 5 ? .72 : .5; c.beginPath();
      for (let i = batch; i < count; i += 8) {
        const p = this.particles[i];
        let [x, y] = this.getPosition(p, t, fcx, cy, fw, scale);
        if (this.pointer.x > 0) {
          const dx = x - this.pointer.x, dy = y - this.pointer.y, distance = Math.hypot(dx, dy);
          const strength = Math.max(0, 1 - distance / 120) * (14 + this.impulse * 50);
          x += dx / (distance || 1) * strength; y += dy / (distance || 1) * strength;
        }
        if (p.x === null) { p.x = x; p.y = y; }
        const oldX = p.x, oldY = p.y;
        if (!this.config.paused) { const blend = 1 - Math.exp(-dt * 12); p.x += (x - p.x) * blend; p.y += (y - p.y) * blend; }
        const vx = p.x - oldX, vy = p.y - oldY;
        const length = clamp(1.3 + p.w * 2 + Math.hypot(vx, vy) * .8, 1.3, 8);
        const norm = Math.hypot(vx, vy) || 1;
        c.moveTo(p.x, p.y); c.lineTo(p.x - vx / norm * length - .4, p.y - vy / norm * length);
      }
      c.stroke();
    }
    c.globalCompositeOperation = 'source-over';
    if (this.config.mode === 'blackhole') {
      const radius = scale * .215;
      c.fillStyle = '#020304'; c.beginPath(); c.arc(fcx, cy - 3, radius, 0, TAU); c.fill();
      for (let j = 0; j < 5; j++) this.arc(fcx, cy - 3, radius + j * 1.6, Math.PI, TAU, .85 / (j + 1), j ? 1 : 1.8, true);
      this.arc(fcx, cy - 3, radius + 1, 0, Math.PI, .23, .7);
    }
    if (this.config.mode === 'fusion') {
      const gradient = c.createRadialGradient(fcx, cy, 0, fcx, cy, scale * .72 * Math.max(glow, .1));
      gradient.addColorStop(0, this.color(.5, true)); gradient.addColorStop(.18, this.color(.12, true)); gradient.addColorStop(1, this.color(0));
      c.fillStyle = gradient; c.fillRect(fcx - scale, cy - scale, scale * 2, scale * 2);
      this.arc(fcx, cy, 13 + Math.sin(t * 2) * 2, 0, TAU, .9, .8, true);
    }
    if (this.config.mode === 'threebody') for (let j = 0; j < 3; j++) {
      const a = t * .23 + j * TAU / 3;
      const x = fcx + Math.cos(a) * scale * .29, y = cy + Math.sin(a * 1.3 + j) * scale * .22;
      if (glow > 0) {
        const gradient = c.createRadialGradient(x, y, 0, x, y, 30 * glow);
        gradient.addColorStop(0, this.color(.27, j === 1)); gradient.addColorStop(1, this.color(0));
        c.fillStyle = gradient; c.fillRect(x - 60, y - 60, 120, 120);
      }
      c.fillStyle = '#050809'; c.beginPath(); c.arc(x, y, 6, 0, TAU); c.fill();
      this.arc(x, y, 7, 0, TAU, .86, 1.2, j === 1);
      this.arc(x, y, 11 + j * 1.6, t + j, t + j + 5.5, .45, .5, j === 1);
      this.arc(x, y, 17, t * .5, t * .5 + 3, .17, .5);
    }
    if (this.config.mode === 'neural') for (let layer = 0; layer < 6; layer++) {
      const x = fcx - fw * .47 + layer / 5 * fw * .77;
      for (let j = 0; j < 7; j++) {
        const y = cy + (j / 6 - .5) * scale * 1.8;
        this.arc(x, y, 3, 0, TAU, .52, .6); this.arc(x, y, 6, 0, TAU, .13, .5);
      }
      this.text('L' + String(layer + 1).padStart(2, '0'), x, cy + scale * 1.06, 7, .3, 'center');
    }
    this.text(modes.find(m => m.id === this.config.mode)?.en || '', fcx, cy + scale * 1.24, 7, .45, 'center');
    // Fine datum lines link the field to the actual metric rail.
    for (let i = 0; i < 5; i++) {
      const y = h * (.22 + i * .135);
      this.line(w * .84, y, w * .88, y, .12, .5);
      c.strokeStyle = this.color(.35); c.strokeRect(w * .88 - 2, y - 2, 4, 4);
    }
  }
}
