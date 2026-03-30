const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  log: (payload) => ipcRenderer.send('renderer-log', payload),
  getLogPaths: () => ipcRenderer.invoke('get-log-paths')
});
