import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  appName: 'IELTS-mate',
  getBackendInfo: () => ipcRenderer.invoke('backend:get-info'),
  pingBackendRest: () => ipcRenderer.invoke('backend:ping-rest'),
  stopBackend: () => ipcRenderer.invoke('backend:stop')
})
