import { ParticleLayer } from './particles-gl.js';
import { transportPosition, waveEnergy,emissionPort } from './core-field.js';
import {sampleGravityStream,createThreeBodies,stepThreeBodies} from './gravity-field.js';
import { channelActivity, channelColor, metricChannels } from './metric-field.js';
import {traceMetricTransport,routeToTarget} from './metric-transport.js';
import {scenes} from '../shared/scenes.mjs';
import {sampleResponse,sampleNodeEnergy} from './sample-core.js';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const palettes = {
  silver: { name: '冷白银', rgb: [189, 227, 234], hot: [255, 205, 183], css: '#bde3ea' },
  gold: { name: '香槟金', rgb: [235, 208, 158], hot: [255, 247, 221], css: '#ebd09e' },
  cyan: { name: '深海蓝', rgb: [78, 195, 246], hot: [168, 244, 255], css: '#4ec3f6' },
  violet: { name: '星云紫', rgb: [180, 148, 245], hot: [248, 181, 239], css: '#b494f5' },
};
export const modes = scenes;
function randomFactory(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let a = Math.imul(seed ^ seed >>> 15, 1 | seed); a ^= a + Math.imul(a ^ a >>> 7, 61 | a); return ((a ^ a >>> 14) >>> 0) / 4294967296; };
}
export class Observatory {
  constructor(canvas, onFrame, particleCanvas) {
    this.canvas = canvas;
    this.field = new ParticleLayer(particleCanvas);
    this.ctx = canvas.getContext('2d', { alpha: Boolean(this.field.gl) });
    this.onFrame = onFrame;
    this.config = { mode: 'threebody', palette: 'silver', speed: 1, particles: 12000, glow: 1, cadence: 1, neural: true, paused: false };
    this.metrics = {};
    this.channels = channelActivity();
    this.channelTimes = Array(5).fill(10);
    this.metricAnchors = [];
    this.highlightedMetric = null;
    this.haloCache = new Map();
    this.t = 10; this.last = 0; this.frame = 0; this.fpsTime = 0; this.fpsFrames = 0;
    this.pointer = { x: -1000, y: -1000 }; this.impulse = 0;
    this.waves = []; this.pulseCount = 0; this.drag = null;
    this.sampleBursts=[];this.lastSampleSequence=null;
    this.sampleOrbit={yaw:0,pitch:0,roll:0,targetYaw:0,targetPitch:0,targetRoll:0};
    this.orbit = { yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0 };
    this.captureTimes=[-10,-10,-10];this.captureCounts=[0,0,0];this.wellOffsets=[null,null,null];this.dragWell=null;this.bodies=createThreeBodies();
    const random = randomFactory(27);
    this.particles = Array.from({ length: 24000 }, () => ({ u: random(), v: random(), w: random(), a: random() * TAU, band: Math.floor(random() * 5), x: null, y: null }));
    this.nodes = Array.from({ length: 290 }, (_, i) => {
      const y = random() * 2 - 1, r = Math.sqrt(1 - y * y), a = random() * TAU;
      const depth = .55 + Math.sqrt(random()) * .45;
      return { x: Math.cos(a) * r * depth, y: y * depth, z: Math.sin(a) * r * depth, phase: random() * TAU };
    });
    this.edges = [];
    for (let i = 0; i < this.nodes.length; i++) for (let j = i + 1; j < this.nodes.length; j++) {
      const a = this.nodes[i], b = this.nodes[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (distance < .30 || (i % 29 === 0 && j === i + 43)) this.edges.push([i, j]);
    }
    this.resize = () => {
      const box = canvas.getBoundingClientRect();
      this.w = box.width; this.h = box.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.round(this.w * dpr); canvas.height = Math.round(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.field.resize(this.w, this.h, dpr);
      this.particles.forEach(p => { p.x = null; });
    };
    this.contextRestored = () => this.resize();
    particleCanvas?.addEventListener('webglcontextrestored', this.contextRestored);
    this.observer = new ResizeObserver(this.resize); this.observer.observe(canvas);
    this.move = e => {
      if (this.config.interactive === false) return;
      const b = canvas.getBoundingClientRect(); this.setPointer(e.clientX - b.x, e.clientY - b.y);
      if (this.drag) {
        if(this.dragWell!==null&&this.gravityLayout){const f=this.gravityLayout;this.wellOffsets[this.dragWell]={x:(this.pointer.x-f.x)/f.scale,y:(this.pointer.y-f.y)/f.scale};}
        else{this.orbit.targetYaw += (e.clientX - this.drag.x) * .006;this.orbit.targetPitch = clamp(this.orbit.targetPitch + (e.clientY - this.drag.y) * .004, -.7, .7);}
        this.drag = { x: e.clientX, y: e.clientY };
      }
    };
    this.leave = () => { this.pointer.x = -1000; };
    this.down = e => { if (this.config.interactive === false) return; const b=canvas.getBoundingClientRect();this.setPointer(e.clientX-b.x,e.clientY-b.y);this.beginInteraction();this.drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture?.(e.pointerId); this.triggerImpulse(); };
    this.up = () => { this.drag = null;if(this.dragWell!==null)this.wellOffsets[this.dragWell]=null;this.dragWell=null; };
    this.click = () => {};
    canvas.addEventListener('pointermove', this.move); canvas.addEventListener('pointerleave', this.leave); canvas.addEventListener('click', this.click);
    canvas.addEventListener('pointerdown', this.down); canvas.addEventListener('pointerup', this.up); canvas.addEventListener('pointercancel', this.up);
    this.loop = now => {
      const elapsed = this.last ? (now - this.last) / 1000 : .016;
      this.last = now;
      if(this.config.paused&&this.lastDraw&&now-this.lastDraw<500){this.raf=requestAnimationFrame(this.loop);return;}
      if (this.config.fps && this.lastDraw && now - this.lastDraw < 1000 / this.config.fps - 1) { this.raf = requestAnimationFrame(this.loop); return; }
      const drawElapsed = this.lastDraw ? (now-this.lastDraw)/1000 : elapsed;
      const dt = Math.min(drawElapsed,.10);
      this.lastDraw = now;
      if (!document.hidden) {
        if (!this.config.paused) {
          this.t += dt * this.config.speed;
          const targets = channelActivity(this.metrics), blend = 1 - Math.exp(-dt * 3);
          this.channels.forEach((channel, i) => {
            channel.speed += (targets[i].speed - channel.speed) * blend;
            channel.density += (targets[i].density - channel.density) * blend;
            channel.level += (targets[i].level - channel.level) * blend;
            channel.available = targets[i].available;
            this.channelTimes[i] += dt * this.config.speed * channel.speed;
          });
          this.impulse *= Math.exp(-dt * 1.4);
          const turn=1-Math.exp(-dt*1.8);
          for(const [axis,target] of [['yaw','targetYaw'],['pitch','targetPitch'],['roll','targetRoll']])this.sampleOrbit[axis]+=(this.sampleOrbit[target]-this.sampleOrbit[axis])*turn;
        }
        this.orbit.yaw += (this.orbit.targetYaw - this.orbit.yaw) * .10;
        this.orbit.pitch += (this.orbit.targetPitch - this.orbit.pitch) * .10;
        this.waves = this.waves.filter(wave => this.t - wave.time < 3.5);
        this.sampleBursts=this.sampleBursts.filter(burst=>this.t-burst.time<3);
        this.draw(dt);
        this.fpsFrames++; this.fpsTime += drawElapsed;
        if (this.fpsTime > 1) { this.onFrame?.(Math.round(this.fpsFrames / this.fpsTime)); this.fpsTime = 0; this.fpsFrames = 0; }
      }
      this.raf = requestAnimationFrame(this.loop);
    };
    this.raf = requestAnimationFrame(this.loop);
  }
  setConfig(config) { if(this.config.mode!==config.mode){this.particles.forEach(p=>{p.gravity=null;p.x=null;});this.metricStreams=null;this.lastGravityTime=null;this.wellOffsets=[null,null,null];}if(this.config.gravityStrength!==config.gravityStrength)this.gravityTraceTime=null;this.config = config; }
  setMetrics(metrics) {
    if(Number.isFinite(metrics?.sequence)&&metrics.sequence!==this.lastSampleSequence){
      this.lastSampleSequence=metrics.sequence;
      if(!this.config.paused){
        const response=sampleResponse(metrics.sequence,metrics,this.nodes.length);
        this.sampleOrbit.targetYaw+=response.yaw;
        this.sampleOrbit.targetPitch=clamp(this.sampleOrbit.targetPitch+response.pitch,-.55,.55);
        this.sampleOrbit.targetRoll=clamp(this.sampleOrbit.targetRoll+response.roll,-.35,.35);
        for(const index of response.indices)this.sampleBursts.push({...this.nodes[index],time:this.t,strength:response.strength});
        this.sampleBursts=this.sampleBursts.slice(-24);
      }
    }
    this.metrics = metrics || {};
  }
  setPointer(x, y) { this.pointer = { x, y }; }
  setMetricAnchors(anchors) { this.metricAnchors = anchors; this.gravityTraceTime = null; }
  setHighlightedMetric(key) { this.highlightedMetric = key; }
  particleVisible(p) { return p.a / TAU < this.channels[p.band].density; }
  beginInteraction(){this.dragWell=null;if(this.config.mode!=='threebody'||!this.gravityLayout)return;const f=this.gravityLayout;for(let i=0;i<3;i++){const well=this.gravityWells[i];if(Math.hypot(this.pointer.x-f.x-well.x*f.scale,this.pointer.y-f.y-well.y*f.scale)<Math.max(22,f.scale*.10)){this.dragWell=i;break;}}}
  externalPointer(point){
    if(!point.active||this.config.interactive===false){this.setPointer(-1000,-1000);this.dragWell=null;return;}
    const b=this.canvas.getBoundingClientRect(),x=point.x*window.innerWidth-b.left,y=point.y*window.innerHeight-b.top;
    if(x<0||x>this.w||y<0||y>this.h){this.setPointer(-1000,-1000);return;}
    this.setPointer(x,y);if(point.pressed){this.beginInteraction();this.triggerImpulse(x,y);}
    if(point.down){if(this.dragWell!==null&&this.gravityLayout){const f=this.gravityLayout;this.wellOffsets[this.dragWell]={x:(x-f.x)/f.scale,y:(y-f.y)/f.scale};}else if(point.dx){this.orbit.targetYaw+=point.dx*.006;this.orbit.targetPitch=clamp(this.orbit.targetPitch+point.dy*.004,-.7,.7);}}
    else {if(this.dragWell!==null)this.wellOffsets[this.dragWell]=null;this.dragWell=null;}
  }
  triggerImpulse(x = this.pointer.x, y = this.pointer.y) {
    if (!(x >= 0)) { x = this.cx; y = this.cy; }
    this.impulse = 1; this.waves.push({ x, y, time: this.t }); this.waves = this.waves.slice(-9);
    this.canvas.dataset.pulses = String(++this.pulseCount);
  }
  dispose() { cancelAnimationFrame(this.raf); this.observer.disconnect(); this.field.canvas?.removeEventListener('webglcontextrestored',this.contextRestored); this.field.dispose(); for (const [event, handler] of [['pointermove',this.move],['pointerleave',this.leave],['click',this.click],['pointerdown',this.down],['pointerup',this.up],['pointercancel',this.up]]) this.canvas.removeEventListener(event,handler); }
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
    if(!this.haloRgb){this.haloRgb=[...pal.rgb];this.haloHotRgb=[...pal.hot];}
    else{const blend=1-Math.exp(-Math.max(dt,.016)*5);this.haloRgb=this.haloRgb.map((v,i)=>v+(pal.rgb[i]-v)*blend);this.haloHotRgb=this.haloHotRgb.map((v,i)=>v+(pal.hot[i]-v)*blend);}
    this.channelColors = metricChannels.map((_, i) => channelColor(i, this.rgb));
    c.globalCompositeOperation = 'source-over';
    if (this.field.gl) c.clearRect(0, 0, w, h);
    else { c.fillStyle = '#050809'; c.fillRect(0, 0, w, h); }
    const compact = w < 760;
    const r = Math.min(h * .414, w * (compact ? .27 : .232));
    const cx = compact ? w * .30 : w * .255, cy = h * .51;
    this.cx = cx; this.cy = cy; this.radius = r;
    // Sparse background observations anchor the depth without obscuring signals.
    for (let i = 0; i < 95; i++) {
      const x = ((i * 7919) % 997) / 997 * w, y = ((i * 3571) % 991) / 991 * h;
      c.fillStyle = this.color(.04 + .035 * Math.sin(t * .2 + i)); c.fillRect(x, y, .8, .8);
    }
    this.drawField(dt, compact);
    this.drawCore(cx, cy, r);
    this.frame++;
    if (this.config.clean) return;
    this.text(modes.find(m => m.id === this.config.mode)?.caption || '', 22, h - 17, 8, .44);
    this.text('计算 / 外逸动能耦合场 · ' + this.config.cadence.toFixed(1) + '× 节律', w * .49, h - 17, 7, .32);
  }
  drawCore(cx, cy, r) {
    const { ctx: c, t } = this;
    // Rotating, depth-projected Fibonacci network; edges preserve their 3D topology.
    const hover = this.pointer.x >= 0 ? clamp((this.pointer.x - cx) / r, -1, 1) * .10 : 0;
    const a = t * .035 * this.config.cadence + this.orbit.yaw + this.sampleOrbit.yaw + hover, co = Math.cos(a), si = Math.sin(a);
    const tilt = this.orbit.pitch + this.sampleOrbit.pitch + (this.pointer.x >= 0 ? clamp((this.pointer.y - cy) / r, -1, 1) * .08 : 0);
    const roll=this.sampleOrbit.roll,cr=Math.cos(roll),sr=Math.sin(roll);
    const projected = this.nodes.map(n => {
      const rx = n.x * co - n.z * si, rz = n.x * si + n.z * co;
      const ry = n.y * Math.cos(tilt) - rz * Math.sin(tilt);
      const x=rx*cr-ry*sr,y=rx*sr+ry*cr,z=n.y*Math.sin(tilt)+rz*Math.cos(tilt);
      const p = { x: cx + x * r * .86, y: cy + y * r * .86, z, phase: n.phase };
      p.energy = Math.max(waveEnergy(p, this.waves, t, r),sampleNodeEnergy(n,this.sampleBursts,t));
      const proximity = this.pointer.x >= 0 ? Math.exp(-Math.hypot(p.x - this.pointer.x, p.y - this.pointer.y) / 28) : 0;
      p.energy = Math.max(p.energy, proximity * .75);
      return p;
    });
    this.projected = projected;
    if (this.config.neural) {
      for (let depth = 0; depth < 4; depth++) {
        c.strokeStyle = this.color(.018 + depth * .014); c.lineWidth = .42; c.beginPath();
        for (const [i, j] of this.edges) {
          const a = projected[i], b = projected[j], z = (a.z + b.z + 2) / 4;
          if (Math.min(3, Math.floor(z * 4)) !== depth) continue;
          c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
        }
        c.stroke();
      }
      for (const [i, j] of this.edges) {
        const a = projected[i], b = projected[j], z = (a.z + b.z + 2) / 4;
        const pulse = (t * .15 * this.config.cadence + i * .173) % 1;
        const excitation = Math.max(a.energy, b.energy);
        if (excitation > .07) this.line(a.x,a.y,b.x,b.y,excitation * .42,.65);
        if (i % 5 === 0 || excitation > .3) {
          const x = a.x + (b.x - a.x) * pulse, y = a.y + (b.y - a.y) * pulse;
          const tail = Math.max(0, pulse - .075 - excitation * .06);
          this.line(a.x + (b.x-a.x)*tail,a.y + (b.y-a.y)*tail,x,y,(.22+excitation*.6)*z,.8);
          c.fillStyle = this.color((.55 + excitation * .4) * z); c.fillRect(x, y, 1.2, 1.2);
        }
      }
      for (const p of projected) {
        const pulse = Math.pow(Math.max(0, Math.sin(t * .8 + p.phase)), 14);
        const opacity = .055 + (p.z + 1) * .105 + pulse * .45 + p.energy * .65;
        if ((pulse > .4 || p.energy > .15) && this.config.glow > .1) {
          const spread=(4+p.energy*7)*this.config.glow;
          const glow = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, spread);
          glow.addColorStop(0, this.color(opacity * .5)); glow.addColorStop(1, this.color(0));
          c.fillStyle = glow; c.fillRect(p.x-spread,p.y-spread,spread*2,spread*2);
        }
        c.fillStyle = this.color(opacity); c.fillRect(p.x, p.y, pulse > .5 ? 1.7 : 1, pulse > .5 ? 1.7 : 1);
      }
    }
    const ringWidth=this.config.ringWidth||1.4;
    for (let j = 0; j < 12; j++) {
      const rr = r * (.87-(ringWidth-1)*.025 + j * .0125*ringWidth);
      this.arc(cx, cy, rr, 0, TAU, j % 3 === 0 ? .16 : .055, .5);
      const spin = t * (.012 + j * .003) * (j % 2 ? -1 : 1);
      for (const brightPass of [false, true]) {
        c.strokeStyle = this.color(brightPass ? .045 : .04); c.lineWidth = j % 3 === 0 ? .85 : .5; c.beginPath();
        for (let i = 0; i < 96; i++) {
          const ang = i / 96 * TAU + spin;
          const activity = ((i * 13 + j * 29) % 101) / 100;
          const sector = Math.atan2(Math.sin(ang),Math.cos(ang));
          const bright = activity < (.25 + (this.metrics.cpu || 0) / 160) && Math.abs(sector - Math.sin(t*.13)*.08) < .48;
          if (bright !== brightPass) continue;
          c.moveTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr); c.arc(cx, cy, rr, ang, ang + .035);
        }
        c.stroke();
      }
    }
    this.drawEmission(cx,cy,r);
    for (let i = 0; i < 180; i++) {
      const a = i / 180 * TAU, major = i % 15 === 0;
      this.line(cx + Math.cos(a) * r * 1.075, cy + Math.sin(a) * r * 1.075, cx + Math.cos(a) * r * (major ? 1.112 : 1.088), cy + Math.sin(a) * r * (major ? 1.112 : 1.088), major ? .48 : .17, .5);
    }
    for (let j = 0; j < 4; j++) {
      const start = t * .09 + j * TAU / 4;
      this.arc(cx, cy, r * .895, start, start + .13 + (this.metrics.memory || 20) / 450, .33, .7);
    }
    this.text('0 1 — 0 5', cx - r * .55, cy - r * .97, 7, .35);
    c.save(); c.translate(cx - r * 1.075, cy + 45); c.rotate(-Math.PI / 2); this.text('LOCAL / LIVE / READ ONLY', 0, 0, 6, .35); c.restore();
  }
  drawEmission(cx,cy,r){
    if(!this.metricStreams||!this.gravityLayout||this.config.glow<=0)return;
    const c=this.ctx,f=this.gravityLayout;
    c.save();c.globalCompositeOperation='lighter';c.lineCap='round';c.lineJoin='round';
    for(let band=0;band<5;band++){
      const rgb=this.channelColors[band],channel=this.channels[band];
      const selected=this.highlightedMetric===metricChannels[band].key;
      const strength=(channel.available ? .20+channel.level*.55 : .035)*this.config.glow*(selected ? 1.5 : this.highlightedMetric ? .25 : 1);
      for(let lane=0;lane<12;lane+=2){
        const stream=this.metricStreams[band][lane];
        const progress=(this.channelTimes[band]*.28+lane*.173+band*.137)%1;
        const head=.015+progress*.30,tail=Math.max(0,head-.075);
        const points=Array.from({length:9},(_,i)=>{const p=sampleGravityStream(stream,tail+(head-tail)*i/8);return {x:f.x+p.x*f.scale,y:f.y+p.y*f.scale};});
        const start=points[0],end=points[8],fade=Math.sin(progress*Math.PI)**.7*(1-progress*.65);
        const width=r*(.007+progress*progress*.045);
        const color=a=>`rgba(${rgb.join(',')},${a})`;
        for(const [spread,alpha] of [[3,.10],[1.5,.23],[.25,.6]]){
          const light=c.createLinearGradient(start.x,start.y,end.x,end.y);
          light.addColorStop(0,color(0));light.addColorStop(.5,color(strength*fade*alpha*.45));light.addColorStop(.82,color(strength*fade*alpha));light.addColorStop(1,color(0));
          c.strokeStyle=light;c.lineWidth=Math.max(.6,width*spread);
          c.shadowColor=color(strength*fade*.25);c.shadowBlur=width*spread*1.2;
          c.beginPath();points.forEach((p,i)=>{if(i)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);});c.stroke();
        }
      }
    }
    c.restore();
  }
  getPosition(p, t, fcx, cy, fw, scale) {
    const motionTime = this.channelTimes[p.band];
    if(this.metricStreams){
      const streams=this.metricStreams[p.band];
      const stream=streams[Math.min(streams.length-1,Math.floor(p.v*streams.length))];
      const elapsed=clamp(motionTime-(p.lastMotionTime??motionTime),0,.30);
      const phase=((p.routePhase??p.u)+elapsed*(.66+p.w*.12)/Math.max(1,stream.length))%1;
      p.lastMotionTime=motionTime;p.routePhase=phase;
      if(p.lastPhase!==undefined&&phase<p.lastPhase&&!this.config.paused){
        p.x=null;
        if(stream.captured>=0){this.captureCounts[stream.captured]++;this.captureTimes[stream.captured]=this.t;}
      }
      p.lastPhase=phase;
      const position=sampleGravityStream(stream,phase);
      return [fcx+position.x*scale,cy+position.y*scale];
    }
    return [fcx,cy];
  }
  drawField(dt, compact) {
    const c = this.ctx, { w, h, cy, t } = this;
    const fcx = w * (compact ? .70 : .675), fw = w * .46, scale = Math.min(h * .34, fw * .43);
    const count = this.config.particles;
    const glow = this.config.glow;
    this.gravityLayout={x:fcx,y:cy,scale};
    this.gravityDt=this.lastGravityTime==null ? .016 : clamp(t-this.lastGravityTime,0,.10);this.lastGravityTime=t;
    if(this.config.mode==='threebody'&&!this.config.paused){
      stepThreeBodies(this.bodies,this.gravityDt,this.config.gravityStrength||1,this.dragWell??-1,this.dragWell!==null?this.wellOffsets[this.dragWell]:null);
    }
    this.gravityWells=this.bodies.map(b=>({x:b.x,y:b.y,mass:b.mass,radius:.058}));
    if(!this.metricStreams||this.gravityTraceTime==null||Math.abs(t-this.gravityTraceTime)>.22||this.dragWell!==null){
      this.gravityTraceTime=t;
      const core={x:this.cx,y:this.cy,radius:this.radius},field={x:fcx,y:cy,width:fw,scale};
      const wells=this.gravityWells;
      this.metricStreams=metricChannels.map((_,band)=>Array.from({length:12},(_unused,lane)=>{
        const v=(lane+.5)/12,anchor=this.metricAnchors[band]||{x:w*.91,y:h*(.22+band*.135),height:36};
        const target={x:(anchor.x+4-fcx)/scale,y:(anchor.y+(v-.5)*(anchor.height||36)*.66-cy)/scale};
        if(this.config.mode==='threebody'){
          const port=emissionPort({v,band,a:lane*2.39996+band},t,core);
          const speed=.95+.15*Math.sin(lane*1.37),angle=port.angle;
          return traceMetricTransport({x:(port.x-fcx)/scale,y:(port.y-cy)/scale},{vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed},wells,target,this.config.gravityStrength||1,lane%wells.length,lane%2?1:-1,this.radius*.22/scale);
        }
        const p={v,band,w:.3,a:lane*2.39996};
        const points=Array.from({length:80},(_p,i)=>{const [x,y]=transportPosition(p,.16+i/79*.62,t,core,field,this.config.mode);return {x:(x-fcx)/scale,y:(y-cy)/scale};});
        return routeToTarget(points,target);
      }));
    }
    if (this.field.gl) {
      const vertices = this.field.vertices;
      let renderedCount = 0;
      for (let i = 0; i < count; i++) {
        const p = this.particles[i];
        if (!this.particleVisible(p)) { p.x = null; continue; }
        let [x, y] = this.getPosition(p, t, fcx, cy, fw, scale);
        if (this.pointer.x > 0) {
          const dx = x - this.pointer.x, dy = y - this.pointer.y, distance = Math.hypot(dx, dy);
          const strength = Math.max(0, 1 - distance / 120) * (14 + this.impulse * 50);
          x += dx / (distance || 1) * strength; y += dy / (distance || 1) * strength;
        }
        if (p.x === null) { p.x = x; p.y = y; }
        const oldX = p.x, oldY = p.y;
        if (!this.config.paused) { const blend = 1 - Math.exp(-dt * 12); p.x += (x - p.x) * blend; p.y += (y - p.y) * blend; }
        if (!this.config.paused) { p.vx = p.x - oldX; p.vy = p.y - oldY; }
        const vx = p.vx || 0, vy = p.vy || 0;
        const norm = Math.hypot(vx, vy) || 1;
        const length = clamp(2.5 + p.w * 3 + norm * 1.15, 2.5, 15);
        const rgb = this.channelColors[p.band];
        const selected = this.highlightedMetric === metricChannels[p.band].key;
        const alpha = (.10 + p.w * .30) * (.7 + glow * .25) * (selected ? 1.7 : this.highlightedMetric ? .32 : 1);
        const offset = renderedCount++ * 12;
        vertices[offset] = p.x; vertices[offset + 1] = p.y;
        vertices[offset + 6] = p.x - vx / norm * length - .35; vertices[offset + 7] = p.y - vy / norm * length;
        vertices[offset + 2] = vertices[offset + 8] = rgb[0] / 255;
        vertices[offset + 3] = vertices[offset + 9] = rgb[1] / 255;
        vertices[offset + 4] = vertices[offset + 10] = rgb[2] / 255;
        vertices[offset + 5] = vertices[offset + 11] = alpha;
      }
      this.field.draw(renderedCount, w, h, this.cx, cy, this.radius, glow,this.config.particleWidth||1.6);
    } else {
    c.globalCompositeOperation = 'lighter';
    // Draw in opacity/color batches to keep 24k moving particles fluid.
    for (let batch = 0; batch < 5; batch++) {
      const selected = this.highlightedMetric === metricChannels[batch].key;
      c.strokeStyle = `rgba(${this.channelColors[batch].join(',')},${.28 * (.65 + glow * .40) * (selected ? 1.7 : this.highlightedMetric ? .32 : 1)})`;
      c.lineWidth = this.config.particleWidth || 1.6; c.beginPath();
      for (let i = 0; i < count; i++) {
        const p = this.particles[i];
        if (p.band !== batch) continue;
        if (!this.particleVisible(p)) { p.x = null; continue; }
        let [x, y] = this.getPosition(p, t, fcx, cy, fw, scale);
        if (this.pointer.x > 0) {
          const dx = x - this.pointer.x, dy = y - this.pointer.y, distance = Math.hypot(dx, dy);
          const strength = Math.max(0, 1 - distance / 120) * (14 + this.impulse * 50);
          x += dx / (distance || 1) * strength; y += dy / (distance || 1) * strength;
        }
        if (p.x === null) { p.x = x; p.y = y; }
        const oldX = p.x, oldY = p.y;
        if (!this.config.paused) { const blend = 1 - Math.exp(-dt * 12); p.x += (x - p.x) * blend; p.y += (y - p.y) * blend; }
        if (!this.config.paused) { p.vx = p.x - oldX; p.vy = p.y - oldY; }
        const vx = p.vx || 0, vy = p.vy || 0;
        const length = clamp(1.3 + p.w * 2 + Math.hypot(vx, vy) * .8, 1.3, 8);
        const norm = Math.hypot(vx, vy) || 1;
        c.moveTo(p.x, p.y); c.lineTo(p.x - vx / norm * length - .4, p.y - vy / norm * length);
      }
      c.stroke();
    }
    }
    c.globalCompositeOperation = 'source-over';
    if (this.config.mode === 'fusion') {
      const gradient = c.createRadialGradient(fcx, cy, 0, fcx, cy, scale * .72 * Math.max(glow, .1));
      gradient.addColorStop(0, this.color(.5, true)); gradient.addColorStop(.18, this.color(.12, true)); gradient.addColorStop(1, this.color(0));
      c.fillStyle = gradient; c.fillRect(fcx - scale, cy - scale, scale * 2, scale * 2);
      this.arc(fcx, cy, 13 + Math.sin(t * 2) * 2, 0, TAU, .9, .8, true);
    }
    if (this.config.mode === 'threebody') for (let j = 0; j < 3; j++) {
      const well=this.gravityWells[j],x=fcx+well.x*scale,y=cy+well.y*scale;
      const captureGlow=Math.exp(-(t-this.captureTimes[j])*5);
      this.drawBlackHole(x,y,Math.max(9,scale*.070),glow+captureGlow*.25,j===1);
    }
    if(this.config.mode==='threebody')this.canvas.dataset.captures=this.captureCounts.join(',');
    if (this.config.mode === 'neural') for (let layer = 0; layer < 6; layer++) {
      const x = fcx - fw * .47 + layer / 5 * fw * .92;
      if (layer < 5) {
        c.strokeStyle = this.color(.055); c.lineWidth = .4; c.beginPath();
        for (let a = 0; a < 7; a++) for (let b = 0; b < 7; b++) {
          c.moveTo(x, cy + (a / 6 - .5) * scale * 1.8);
          c.lineTo(x + fw * .92 / 5, cy + (b / 6 - .5) * scale * 1.8);
        }
        c.stroke();
      }
      for (let j = 0; j < 7; j++) {
        const y = cy + (j / 6 - .5) * scale * 1.8;
        this.arc(x, y, 3, 0, TAU, .52, .6); this.arc(x, y, 6, 0, TAU, .13, .5);
      }
      this.text('L' + String(layer + 1).padStart(2, '0'), x, cy + scale * 1.06, 7, .3, 'center');
    }
    if (this.config.clean) return;
    this.text(modes.find(m => m.id === this.config.mode)?.en || '', fcx, cy + scale * 1.24, 7, .45, 'center');
  }
  drawBlackHole(x,y,radius,glow,hot){
    const rgb=((hot?this.haloHotRgb:this.haloRgb)||this.rgb).map(v=>Math.min(255,Math.round(v/4)*4));
    const tint=(alpha,white=0)=>`rgba(${rgb.map(v=>Math.round(v+(255-v)*white)).join(',')},${alpha})`;
    const r=Math.round(radius*2)/2,g=Math.round(clamp(glow,0,2.5)*10)/10,key=`${r}:${g}:${hot}:${rgb.join(',')}`;
    let sprite=this.haloCache.get(key);
    if(!sprite){
      sprite=document.createElement('canvas');sprite.width=sprite.height=Math.ceil(r*7*2);
      const c=sprite.getContext('2d'),extent=sprite.width/4;
      c.setTransform(2,0,0,2,sprite.width/2,sprite.height/2);
      const bloom=c.createRadialGradient(0,0,r*.96,0,0,r*3.1);
      bloom.addColorStop(0,tint(.72,.22));
      bloom.addColorStop(.045,tint(Math.min(.98,.65+g*.22),.30));
      bloom.addColorStop(.12,tint(.48*g,.10));
      bloom.addColorStop(.27,tint(.20*g));
      bloom.addColorStop(.5,tint(.065*g));
      bloom.addColorStop(.76,tint(.012*g));
      bloom.addColorStop(1,tint(0));
      c.fillStyle=bloom;c.fillRect(-extent,-extent,extent*2,extent*2);
      // The supplied reference is a clear circular shadow surrounded by a
      // continuous soft halo, without crescents, orbit bands or separate rings.
      c.globalCompositeOperation='source-over';c.fillStyle='#010203';
      c.beginPath();c.arc(0,0,r,0,TAU);c.fill();
      if(this.haloCache.size>=32)this.haloCache.delete(this.haloCache.keys().next().value);
      this.haloCache.set(key,sprite);
    }
    this.ctx.drawImage(sprite,x-sprite.width/4,y-sprite.height/4,sprite.width/2,sprite.height/2);
  }
}
