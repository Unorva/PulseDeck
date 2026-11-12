export const defaultPreferences = Object.freeze({
  mode: 'threebody', palette: 'silver', speed: 1, particles: 16000, glow: 1,
  cadence: 1, neural: true, paused: false, fps: 60, interactive: true,
  showMetrics: false, showLabels: false, showMonitors: false,
  wallpaperEnabled: false, selectedDisplay: 'primary', pauseOnFullscreen: true,
  pauseOnBattery: false, startAtLogin: false,
  thresholds: { cpu: 85, memory: 85, gpu: 90 },
});
const booleanKeys = ['neural','paused','interactive','showMetrics','showLabels','showMonitors','wallpaperEnabled','pauseOnFullscreen','pauseOnBattery','startAtLogin'];
export function sanitizePreferences(input = {}) {
  const result = { ...defaultPreferences, thresholds: { ...defaultPreferences.thresholds } };
  for (const key of booleanKeys) if (typeof input[key] === 'boolean') result[key] = input[key];
  for (const [key,min,max] of [['speed',.2,3],['particles',2000,24000],['glow',0,2],['cadence',.2,3]]) if (Number.isFinite(input[key])) result[key] = Math.max(min,Math.min(max,input[key]));
  result.particles = Math.round(result.particles/1000)*1000;
  if (['flow','blackhole','fusion','threebody','neural'].includes(input.mode)) result.mode=input.mode;
  if (['silver','gold','cyan','violet'].includes(input.palette)) result.palette=input.palette;
  if ([24,30,60,90,120].includes(input.fps)) result.fps=input.fps;
  if (input.selectedDisplay === 'primary' || /^\d{1,12}$/.test(String(input.selectedDisplay))) result.selectedDisplay=String(input.selectedDisplay);
  for (const key of ['cpu','memory','gpu']) if (Number.isFinite(input.thresholds?.[key])) result.thresholds[key]=Math.max(10,Math.min(100,input.thresholds[key]));
  return result;
}
export function mergePreferences(current, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Invalid preferences');
  return sanitizePreferences({ ...current, ...patch, thresholds: { ...current.thresholds, ...(patch.thresholds || {}) } });
}
