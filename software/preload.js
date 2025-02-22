const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  ping: () => ipcRenderer.invoke('ping')
  // we can also expose variables, not just functions
})

contextBridge.exposeInMainWorld('electronAPI', {
    handleFileOpen: () => ipcRenderer.invoke('dialog:openFile'),
    saveState: (state) => ipcRenderer.invoke('state:save', state),
    loadState: () => ipcRenderer.invoke('state:load')
})