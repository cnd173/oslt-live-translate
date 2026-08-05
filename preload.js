const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  setTargetLang: (lang) => ipcRenderer.send('app:set-target-lang', lang),
  setOcrLang: (lang) => ipcRenderer.send('app:set-ocr-lang', lang),
  togglePause: () => ipcRenderer.send('app:toggle-pause'),
  refresh: () => ipcRenderer.send('app:refresh'),
  quit: () => ipcRenderer.send('app:quit'),
  getState: () => ipcRenderer.invoke('app:get-state'),
  onStatus: (cb) => {
    const listener = (event, status) => cb(status);
    ipcRenderer.on('overlay:status', listener);
    return () => ipcRenderer.removeListener('overlay:status', listener);
  },
  onTranslation: (cb) => {
    const listener = (event, payload) => cb(payload);
    ipcRenderer.on('translation:update', listener);
    return () => ipcRenderer.removeListener('translation:update', listener);
  },
});
