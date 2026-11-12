import { useEffect, useRef } from 'react';
import { Observatory } from './engine.js';
import { useTelemetry,formatPercent,formatRate } from './telemetry.js';
import { useDesktopState } from './desktop-state.js';
import {App} from './App.jsx';
export function Universe({preferences,metrics,onFrame,preview=false}) {
  const canvas=useRef(null),particles=useRef(null),engine=useRef(null);
  useEffect(()=>{engine.current=new Observatory(canvas.current,onFrame,particles.current);return()=>engine.current.dispose();},[]);
  useEffect(()=>{engine.current?.setConfig({...preferences,clean:!preferences.showLabels,fps:preview?30:preferences.fps,particles:preview?Math.min(preferences.particles,8000):preferences.particles});},[preferences,preview]);
  useEffect(()=>{engine.current?.setMetrics(metrics);},[metrics]);
  useEffect(()=>window.pulseDeck?.onPointer?.(point=>{
    engine.current?.externalPointer(point);
  }),[preferences.interactive]);
  return <div className="visual-surface"><canvas ref={particles} className="particle-field" aria-hidden="true"/><canvas ref={canvas} className="universe" role="img" aria-label="可交互的神经圆环与连续粒子流"/></div>;
}
export function DisplayApp(){
  const {state,preferences,action}=useDesktopState();
  useEffect(()=>{const key=e=>{if(e.key==='Escape')action('settings.open');};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  const effective={...preferences,paused:preferences.paused||state.desktop?.suspended};
  return <App displayOnly preferencesOverride={effective}/>;
}
