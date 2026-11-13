import { useEffect, useState } from 'react';
import { defaultPreferences, mergePreferences, sanitizePreferences } from '../shared/preferences.mjs';
const native = typeof window !== 'undefined' ? window.pulseDeck : null;
function browserState() {
  let preferences=defaultPreferences;
  try { preferences=sanitizePreferences(JSON.parse(localStorage.getItem('pulsedeck.desktop.v2')) || {}); } catch {}
  return { preferences, desktop: { active:false, status:'window', error:null }, displays:[{id:'primary',label:'主显示器',width:1920,height:1080}], version:'0.4.6', native:false };
}
export function useDesktopState() {
  const [state,setState]=useState(browserState);
  useEffect(()=>{
    if (native) { let alive=true; native.getState().then(value=>{if(alive)setState(value);}); const off=native.onState(setState); return()=>{alive=false;off();}; }
    const channel=new BroadcastChannel('pulsedeck.desktop'); channel.onmessage=e=>setState(e.data);
    return()=>channel.close();
  },[]);
  const update=async patch=>{
    if(native) return native.setPreferences(patch);
    const next={...state,preferences:mergePreferences(state.preferences,patch)};
    localStorage.setItem('pulsedeck.desktop.v2',JSON.stringify(next.preferences)); setState(next);
    const channel=new BroadcastChannel('pulsedeck.desktop');channel.postMessage(next);channel.close();return next;
  };
  const action=async name=>{
    if(native) return native.action(name);
    if(name==='display.open') window.open('?view=display','pulsedeck-display');
    else if(name==='settings.open') window.location.search='?view=settings';
    else if(name==='wallpaper.start') setState(s=>({...s,desktop:{...s.desktop,error:'动态桌面需要 Windows 应用。此处可预览独立展示窗口。'}}));
  };
  return { state,preferences:state.preferences,update,action,native:Boolean(native) };
}
