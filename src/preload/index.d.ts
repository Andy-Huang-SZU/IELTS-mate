export interface ElectronAPI {
  appName: string
  getBackendInfo: () => Promise<{
    status: 'idle' | 'starting' | 'ready' | 'error' | 'stopped'
    port: number | null
    baseUrl: string | null
  }>
  pingBackendRest: () => Promise<{ ok: boolean; error?: string }>
  stopBackend: () => Promise<{ ok: boolean }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
