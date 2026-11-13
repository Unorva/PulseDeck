const TAU = Math.PI * 2;
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export function bezier(a, b, c, d, t) {
  const s = 1 - t;
  return [s ** 3 * a[0] + 3 * s * s * t * b[0] + 3 * s * t * t * c[0] + t ** 3 * d[0], s ** 3 * a[1] + 3 * s * s * t * b[1] + 3 * s * t * t * c[1] + t ** 3 * d[1]];
}
export function wellPosition(index, time, x, y, scale) {
  const angle = time * .15 + index * TAU / 3;
  const radius=.39+Math.sin(time*.17+index)*.045;
  return [x + Math.cos(angle) * scale * radius, y + Math.sin(angle) * scale * radius*.78 +Math.sin(time*.27+index)*scale*.035];
}
export function emissionEnvelope(v){return Math.max(0,Math.cos((clamp(v,0,1)-.5)*Math.PI))**1.7;}
export function emissionPort(p,time,core){
  const center=Math.sin(time*.09)*.16+Math.sin(time*.045+.9)*.08;
  const spread=.82+Math.sin(time*.07)*.12;
  const angle=center+(p.v-.5)*2*spread+Math.sin(p.a+time*.18+p.band*.4)*.022;
  return {x:core.x+Math.cos(angle)*core.radius*1.025,y:core.y+Math.sin(angle)*core.radius*1.025,angle,opacity:emissionEnvelope(p.v)};
}
export function portPosition(band, time, core) {
  const angle = (band - 2) * .22 + Math.sin(time * .13 + band) * .055;
  return [core.x + Math.cos(angle) * core.radius * 1.025, core.y + Math.sin(angle) * core.radius * 1.025];
}
// Every transport particle begins inside the neural core, crosses an actual
// ring outlet, and continues along the selected engine's path. Both renderers
// consume this same curve, so there is no visual seam at the circle boundary.
export function transportPosition(p, phase, time, core, field, mode) {
  const source = emissionPort(p, time, core);
  let port = [source.x, source.y];
  const noise = (p.v - .5) * 15 + Math.sin(p.a + time * .4) * 1.5;
  port[1] += noise * .18;
  if (phase < .16) {
    const u = phase / .16;
    const start = [core.x + Math.cos(p.a) * core.radius * (.18 + p.v * .48), core.y + Math.sin(p.a) * core.radius * (.18 + p.v * .48)];
    return bezier(start, [start[0] + core.radius * .22, start[1]], [port[0] - core.radius * .15, port[1]], port, u);
  }
  const transit = (phase - .16) / .84;
  const length=Math.hypot(port[0]-core.x,port[1]-core.y);
  const normal=[(port[0]-core.x)/length,(port[1]-core.y)/length];
  const launch=core.radius*.22;
  if(transit<.14)return [port[0]+normal[0]*launch*transit/.14,port[1]+normal[1]*launch*transit/.14];
  port=[port[0]+normal[0]*launch,port[1]+normal[1]*launch];
  const u=(transit-.14)/.86;
  const { x, y, width, scale } = field;
  const reach = x - port[0];
  if (mode === 'threebody' || mode === 'fusion') {
    const well = mode === 'threebody' ? wellPosition(p.band % 3, time, x, y, scale) : [x, y];
    if (u < .60) {
      const q = u / .60;
      return bezier(port, [port[0] + normal[0]*reach*.32, port[1] + normal[1]*reach*.32+noise*.2], [well[0] - reach * .22, well[1] + (p.band - 2) * 11 + noise * .35], [well[0], well[1] + noise * .12], q);
    }
    const q = (u - .60) / .40;
    const exit = [x + width * .69, y + Math.sin(p.band * 1.25 + time * .14) * scale * 1.16 + noise];
    return bezier([well[0], well[1] + noise * .12], [well[0] + scale * .45, well[1] - Math.sin(p.band + time * .2) * scale * .4], [exit[0] - width * .12, exit[1]], exit, q);
  }
  if (mode === 'neural') {
    const start = [x - width * .47, y + (Math.floor(p.v * 7) / 6 - .5) * scale * 1.8];
    if (u < .22) return bezier(port, [port[0] + reach * .2, port[1]], [start[0] - 25, start[1]], start, u / .22);
    const q = (u - .22) / .78, layer = Math.min(4, Math.floor(q * 5)), progress = q * 5 - layer;
    const a = Math.floor(((p.v + layer * .173) % 1) * 7), b = Math.floor(((p.v + (layer + 1) * .173) % 1) * 7);
    return [start[0] + (layer + progress) / 5 * width * .92, y + ((a + (b - a) * progress) / 6 - .5) * scale * 1.8];
  }
  const end = [x + width * .32, y + (p.band - 2) * scale * .20 + noise];
  return bezier(port, [port[0] + normal[0]*reach*.40, port[1] + normal[1]*reach*.40],
    [x + width*.02, y + (p.band-2)*scale*.16 + noise*.4], end, u);
}
export function waveEnergy(point, waves, time, radius) {
  let energy = 0;
  for (const wave of waves) {
    const age = time - wave.time;
    if (age < 0 || age > 3.5) continue;
    const distance = Math.hypot(point.x - wave.x, point.y - wave.y);
    const front = age * radius * 1.7;
    energy += Math.exp(-(((distance - front) / (radius * .075 + 3)) ** 2)) * Math.exp(-age * .65) * (wave.automatic ? .22 : 1);
  }
  return Math.min(1.5, energy);
}
