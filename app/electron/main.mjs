import { app, BrowserWindow, Menu, Tray, nativeImage, protocol, screen, ipcMain, powerMonitor } from 'electron';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCollector } from '../server/telemetry.mjs';
import { defaultPreferences, sanitizePreferences, mergePreferences } from '../shared/preferences.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
protocol.registerSchemesAsPrivileged([{scheme:'pulsedeck',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
if(process.env.PULSEDECK_PROFILE) app.setPath('userData',path.resolve(process.env.PULSEDECK_PROFILE));
app.setAppUserModelId('com.unorva.pulsedeck');
const ownsLock=app.requestSingleInstanceLock();
if(!ownsLock) app.quit();
let settingsWindow,displayWindow,wallpaperWindow,tray,collector,saveTimer,wallpaperHelper;
let preferences={...defaultPreferences},desktop={active:false,status:'window',error:null,suspended:false};
let quitting=false,transition=0,covered=false,onBattery=false;
const state=()=>({preferences,desktop,displays:screen.getAllDisplays().map((d,i)=>({id:String(d.id),label:d.label||`显示器 ${i+1}`,width:d.size.width,height:d.size.height})),version:app.getVersion(),native:true});
const windows=()=>[settingsWindow,displayWindow,wallpaperWindow].filter(w=>w&&!w.isDestroyed());
const settingsFile=()=>path.join(app.getPath('userData'),'preferences.json');
function broadcast(){for(const w of windows())w.webContents.send('pulsedeck:state-changed',state());updateTray();}
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>writeFile(settingsFile(),JSON.stringify(preferences,null,2),'utf8').catch(error=>console.error('Preference save failed:',error.message)),200);}
function refreshSuspension(){const suspended=(preferences.pauseOnFullscreen&&covered)||(preferences.pauseOnBattery&&onBattery);if(desktop.suspended!==suspended){desktop={...desktop,suspended};broadcast();}}
function guardNavigation(win){
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{try{const u=new URL(url);if(u.protocol!=='pulsedeck:'||u.hostname!=='app')event.preventDefault();}catch{event.preventDefault();}});
  win.webContents.session.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
}
function createWindow(options,view){
  const win=new BrowserWindow({...options,icon:path.join(here,'assets','icon.png'),webPreferences:{preload:path.join(here,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,spellcheck:false}});
  win.setMenu(null);guardNavigation(win);
  win.loadURL(`pulsedeck://app/index.html?view=${view}`).catch(error=>{if(!win.isDestroyed())reportError(new Error(`页面载入失败：${error.message}`));});
  win.on('page-title-updated',event=>{event.preventDefault();win.setTitle(options.title);});
  return win;
}
function openSettings(){
  if(!settingsWindow||settingsWindow.isDestroyed()){
    settingsWindow=createWindow({width:1200,height:850,minWidth:980,minHeight:720,title:'PulseDeck · 设置',backgroundColor:'#14161b',show:false},'settings');
    settingsWindow.once('ready-to-show',()=>settingsWindow.show());
    settingsWindow.on('close',event=>{if(!quitting){event.preventDefault();settingsWindow.hide();}});
    settingsWindow.on('closed',()=>{settingsWindow=null;});
  }else{if(settingsWindow.isMinimized())settingsWindow.restore();settingsWindow.show();settingsWindow.focus();}
}
function openDisplay(){
  if(!displayWindow||displayWindow.isDestroyed()){
    displayWindow=createWindow({width:1440,height:900,minWidth:640,minHeight:400,title:'PulseDeck · 展示',backgroundColor:'#050809',show:false},'display');
    displayWindow.once('ready-to-show',()=>displayWindow.show());
    displayWindow.on('closed',()=>{displayWindow=null;});
    displayWindow.webContents.on('context-menu',()=>Menu.buildFromTemplate([{label:'打开设置',click:openSettings},{label:'切换全屏',click:()=>displayWindow.setFullScreen(!displayWindow.isFullScreen())},{label:'应用到桌面',click:()=>startWallpaper().catch(reportError)},{type:'separator'},{label:'关闭展示窗口',click:()=>displayWindow.close()}]).popup({window:displayWindow}));
  }else{displayWindow.show();displayWindow.focus();}
}
function reportError(error){desktop={...desktop,error:error.message,status:'error'};broadcast();openSettings();}
function stopWallpaper(persist=true){
  transition++;wallpaperHelper?.dispose();wallpaperHelper=null;
  const old=wallpaperWindow;wallpaperWindow=null;if(old&&!old.isDestroyed())old.destroy();
  covered=false;desktop={active:false,status:'window',error:null,suspended:false};
  if(persist){preferences={...preferences,wallpaperEnabled:false};save();}broadcast();
}
async function startWallpaper(){
  if(process.platform!=='win32')throw new Error('动态桌面目前支持 Windows 10/11。');
  stopWallpaper(false);const token=++transition;
  const target=screen.getAllDisplays().find(d=>String(d.id)===preferences.selectedDisplay)||screen.getPrimaryDisplay();
  const bounds=target.bounds;
  const win=createWindow({...bounds,title:'PulseDeck Wallpaper',frame:false,skipTaskbar:true,focusable:false,resizable:false,movable:false,show:false,backgroundColor:'#050809',hasShadow:false},'display');
  wallpaperWindow=win;
  try {
    await new Promise((resolve,reject)=>{
      const contents=win.webContents;
      const timer=setTimeout(()=>finish(new Error('桌面展示页面载入超时，请重新应用壁纸。')),15000);
      const loaded=()=>finish();
      const failed=(_e,code,description,_url,isMainFrame)=>{if(isMainFrame)finish(new Error(`展示页面未能载入 (${code}): ${description}`));};
      const closed=()=>finish(new Error('桌面展示窗口已关闭。'));
      function finish(error){clearTimeout(timer);contents.removeListener('did-finish-load',loaded);contents.removeListener('did-fail-load',failed);win.removeListener('closed',closed);error?reject(error):resolve();}
      win.webContents.once('did-finish-load',loaded);win.webContents.on('did-fail-load',failed);win.once('closed',closed);
    });
  } catch(error){if(token===transition)stopWallpaper();throw error;}
  if(token!==transition||win.isDestroyed())return;
  const handle=win.getNativeWindowHandle();const hwnd=handle.length===8?handle.readBigUInt64LE().toString():String(handle.readUInt32LE());
  const physical=screen.dipToScreenRect?screen.dipToScreenRect(win,bounds):bounds;
  try {
    const {default:native}=await import('./wallpaper-native.cjs');
    if(token!==transition||win.isDestroyed())return;
    wallpaperHelper=native.attachToDesktop(Number(hwnd),physical,message=>{
      if(token!==transition||win.isDestroyed())return;
      win.webContents.send('pulsedeck:desktop-pointer',message);
      if(covered!==message.covered){covered=message.covered;refreshSuspension();}
    },()=>{if(token===transition&&!quitting){preferences={...preferences,wallpaperEnabled:false};desktop={...desktop,active:false,status:'disconnected',error:'桌面层已断开，可以重新应用壁纸。'};save();broadcast();}});
    // Show through Electron as well as Win32: native ShowWindow alone leaves
    // Chromium's child surface in its initially hidden state on some desktops.
    win.showInactive();
    win.webContents.invalidate();
    win.webContents.on('render-process-gone',(_event,details)=>{
      if(token!==transition||quitting)return;
      stopWallpaper();reportError(new Error(`桌面渲染已停止 (${details.reason})，请重新应用壁纸。`));
    });
    preferences={...preferences,wallpaperEnabled:true};desktop={active:true,status:'wallpaper',error:null,suspended:false};save();refreshSuspension();broadcast();
  } catch(error){if(token===transition){stopWallpaper();desktop.error=error.message;broadcast();}throw error;}
}
function updateTray(){
  if(!tray)return;
  tray.setToolTip(`PulseDeck · ${desktop.active?'动态桌面运行中':'系统观测台'}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'打开 PulseDeck 设置',click:openSettings},{label:'独立展示窗口',click:openDisplay},
    {label:desktop.active?'停止桌面壁纸':'应用到桌面',click:()=>desktop.active?stopWallpaper():startWallpaper().catch(reportError)},
    {label:preferences.paused?'继续动画':'暂停动画',click:()=>{preferences={...preferences,paused:!preferences.paused};save();broadcast();}},
    {type:'separator'},{label:'切换引擎',submenu:[['flow','环状流场'],['blackhole','黑洞'],['fusion','聚变'],['threebody','三体'],['neural','推理网络']].map(([mode,label])=>({label,type:'radio',checked:preferences.mode===mode,click:()=>{preferences={...preferences,mode};save();broadcast();}}))},
    {type:'separator'},{label:'退出 PulseDeck',click:()=>app.quit()},
  ]));
}
function assertSender(event){if(!windows().some(win=>win.webContents===event.sender))throw new Error('Unknown application window');}
async function boot(){
  await mkdir(app.getPath('userData'),{recursive:true});
  try{preferences=sanitizePreferences(JSON.parse(await readFile(settingsFile(),'utf8')));}catch{preferences=sanitizePreferences(defaultPreferences);}
  collector=createCollector();
  const root=path.resolve(here,'../dist/client');
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
  protocol.handle('pulsedeck',async request=>{
    const url=new URL(request.url);
    if(url.hostname!=='app'||request.method!=='GET')return new Response('Denied',{status:403});
    if(url.pathname==='/api/telemetry'){const sample=collector.sample();return new Response(JSON.stringify(sample||{error:'Warming up'}),{status:sample?200:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
    let relative;try{relative=decodeURIComponent(url.pathname);}catch{return new Response('Bad path',{status:400});}
    const file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));
    if(!file.startsWith(root+path.sep))return new Response('Denied',{status:403});
    try{return new Response(await readFile(file),{headers:{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; object-src 'none'; frame-src 'none'"}});}catch{return new Response('Not found',{status:404});}
  });
  ipcMain.handle('pulsedeck:state',event=>{assertSender(event);return state();});
  ipcMain.handle('pulsedeck:preferences',async(event,patch)=>{
    assertSender(event);if(event.sender!==settingsWindow?.webContents)throw new Error('Settings window required');
    const old=preferences;preferences=mergePreferences(preferences,patch);
    // Desktop lifecycle is controlled only by explicit start/stop actions.
    preferences.wallpaperEnabled=desktop.active;
    if(old.startAtLogin!==preferences.startAtLogin)app.setLoginItemSettings({openAtLogin:preferences.startAtLogin,args:['--background']});
    save();refreshSuspension();broadcast();
    if(old.selectedDisplay!==preferences.selectedDisplay&&desktop.active)startWallpaper().catch(reportError);
    return state();
  });
  ipcMain.handle('pulsedeck:action',async(event,name)=>{
    assertSender(event);
    if(name==='settings.open')openSettings();else if(name==='display.open')openDisplay();else if(name==='wallpaper.start')await startWallpaper();else if(name==='wallpaper.stop')stopWallpaper();else if(name==='app.quit')app.quit();else throw new Error('Unsupported action');
    return state();
  });
  const icon=nativeImage.createFromPath(path.join(here,'assets','icon.png')).resize({width:20,height:20});
  tray=new Tray(icon);tray.on('double-click',openSettings);tray.on('click',openSettings);updateTray();
  onBattery=powerMonitor.isOnBatteryPower();powerMonitor.on('on-battery',()=>{onBattery=true;refreshSuspension();});powerMonitor.on('on-ac',()=>{onBattery=false;refreshSuspension();});
  powerMonitor.on('suspend',()=>{desktop={...desktop,suspended:true};broadcast();});powerMonitor.on('resume',()=>{refreshSuspension();});
  screen.on('display-metrics-changed',()=>{if(desktop.active)startWallpaper().catch(reportError);else broadcast();});
  if(!process.argv.includes('--background'))openSettings();
  if(preferences.wallpaperEnabled)startWallpaper().catch(reportError);
}
if(ownsLock)app.whenReady().then(boot).catch(error=>{console.error(error);app.quit();});
app.on('second-instance',openSettings);app.on('activate',openSettings);app.on('window-all-closed',()=>{});
app.on('before-quit',()=>{quitting=true;clearTimeout(saveTimer);try{writeFileSync(settingsFile(),JSON.stringify(preferences,null,2),'utf8');}catch{}wallpaperHelper?.dispose();collector?.close();});
app.on('will-quit',()=>{tray?.destroy();});
