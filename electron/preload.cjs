const { contextBridge, ipcRenderer } = require('electron')

const subscribe = (channel) => (cb) => {
  const handler = (_e, payload) => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

contextBridge.exposeInMainWorld('recorder', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  selectSource: (id) => ipcRenderer.invoke('select-source', id),
  saveRecording: (buffer) => ipcRenderer.invoke('save-recording', buffer),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),

  // floating widget
  showWidget: () => ipcRenderer.invoke('show-widget'),
  hideWidget: () => ipcRenderer.invoke('hide-widget'),
  setWidgetState: (state) => ipcRenderer.send('widget-update', state),
  widgetAction: (action) => ipcRenderer.send('widget-action', action),
  onWidgetState: subscribe('widget-state'),
  onWidgetAction: subscribe('widget-action'),
})