const { contextBridge, ipcRenderer } = require('electron');
const subscribe = (channel, callback) => {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};
contextBridge.exposeInMainWorld('pulseDeck', Object.freeze({
  getState: () => ipcRenderer.invoke('pulsedeck:state'),
  setPreferences: patch => ipcRenderer.invoke('pulsedeck:preferences', patch),
  action: name => ipcRenderer.invoke('pulsedeck:action', name),
  onState: callback => subscribe('pulsedeck:state-changed', callback),
  onPointer: callback => subscribe('pulsedeck:desktop-pointer', callback),
}));
