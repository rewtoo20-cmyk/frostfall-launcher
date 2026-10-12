const { contextBridge, ipcRenderer } = require('electron');
const inv = (c, ...a) => ipcRenderer.invoke(c, ...a);
contextBridge.exposeInMainWorld('api', {
  state: () => inv('state'), play: () => inv('play'), update: () => inv('update'), set: (k, v) => inv('set', String(k).slice(0, 20), !!v),
  min: () => inv('min'), close: () => inv('close'), restart: () => inv('restart'), onUpd: (cb) => ipcRenderer.on('upd', (e, s) => cb(s)),
});
