import { useEffect, useRef } from 'react';
import { Observatory } from './engine.js';
import { useTelemetry,formatPercent,formatRate } from './telemetry.js';
import { useDesktopState } from './desktop-state.js';
export function Universe({preferences,metrics,onFrame,preview=false}) {
  const canvas=useRef(null),particles=useRef(null),engine=useRef(null);
  useEffect(()=>{engine.current=new Observatory(canvas.current,onFrame,particles.current);return()=>engine.current.dispose();},[]);
  useEffect(()=>{engine.current?.setConfig({...preferences,clean:!preferences.showLabels,fps:preview?30:preferences.fps,particles:preview?Math.min(preferences.particles,8000):preferences.particles});},[preferences,preview]);
  useEffect(()=>{engine.current?.setMetrics(metrics);},[metrics]);
  useEffect(()=>window.pulseDeck?.onPointer?.(point=>{
    const e=engine.current;if(!e||!point.active||!preferences.interactive){if(e)e.setPointer(-1000,-1000);return;}
    const x=point.x*e.w,y=point.y*e.h;e.setPointer(x,y);
    if(point.pressed)e.triggerImpulse(x,y);
    if(point.down&&point.dx){e.orbit.targetYaw+=point.dx*.006;e.orbit.targetPitch=Math.max(-.7,Math.min(.7,e.orbit.targetPitch+point.dy*.004));}
  }),[preferences.interactive]);
  return <div className="visual-surface"><canvas ref={particles} className="particle-field" aria-hidden="true"/><canvas ref={canvas} className="universe" role="img" aria-label="可交互的神经圆环与连续粒子流"/></div>;
}
export function DisplayApp(){
  const {state,preferences,action}=useDesktopState(),{data}=useTelemetry();
  const metrics={...data?.metrics,sequence:data?.sequence};
  useEffect(()=>{const key=e=>{if(e.key==='Escape')action('settings.open');};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  const effective={...preferences,paused:preferences.paused||state.desktop?.suspended};
  return <main className="desktop-display" style={{'--accent':'#bde3ea'}}><Universe preferences={effective} metrics={metrics}/>{preferences.showMetrics&&<div className="wallpaper-readings"><span>CPU <b>{formatPercent(metrics.cpu)}</b></span><span>RAM <b>{formatPercent(metrics.memory)}</b></span><span>GPU <b>{formatPercent(metrics.gpu)}</b></span><span>NET <b>{formatRate(metrics.download)}</b></span></div>}</main>;
}
