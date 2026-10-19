const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('recorder', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  selectSource: (id) => ipcRenderer.invoke('select-source', id),
  saveRecording: (buffer) => ipcRenderer.invoke('save-recording', buffer),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
})
