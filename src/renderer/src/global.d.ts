type BackendInfo = {
  status: 'idle' | 'starting' | 'ready' | 'error' | 'stopped'
  port: number | null
  baseUrl: string | null
}

interface Window {
  electronAPI: {
    appName: string
    getBackendInfo: () => Promise<BackendInfo>
    pingBackendRest: () => Promise<{ ok: boolean; error?: string }>
    stopBackend: () => Promise<{ ok: boolean }>
  }
}
