import { useEffect, useState } from 'react'

type BackendInfo = {
  status: 'idle' | 'starting' | 'ready' | 'error' | 'stopped'
  port: number | null
  baseUrl: string | null
}

export const HomePage = (): JSX.Element => {
  const [backendInfo, setBackendInfo] = useState<BackendInfo | null>(null)
  const [restStatus, setRestStatus] = useState<'idle' | 'ok' | 'failed'>('idle')
  const [wsStatus, setWsStatus] = useState<'idle' | 'connected' | 'failed'>('idle')
  const [stopping, setStopping] = useState(false)

  const refreshBackendState = async (): Promise<void> => {
    const info = await window.electronAPI.getBackendInfo()
    setBackendInfo(info)
  }

  useEffect(() => {
    let cancelled = false
    let ws: WebSocket | null = null

    const init = async (): Promise<void> => {
      const info = await window.electronAPI.getBackendInfo()
      if (cancelled) return
      setBackendInfo(info)

      const restResult = await window.electronAPI.pingBackendRest()
      if (cancelled) return
      setRestStatus(restResult.ok ? 'ok' : 'failed')

      if (!info.port) {
        setWsStatus('failed')
        return
      }

      const wsUrl = `ws://127.0.0.1:${info.port}/api/speaking/ws`
      ws = new WebSocket(wsUrl)
      ws.onopen = () => ws?.send(JSON.stringify({ type: 'ping' }))
      ws.onmessage = (event) => {
        const payload = JSON.parse(String(event.data)) as { type?: string }
        if (payload.type === 'connected' || payload.type === 'pong') {
          setWsStatus('connected')
        }
      }
      ws.onerror = () => setWsStatus('failed')
    }

    void init()
    return () => {
      cancelled = true
      ws?.close()
    }
  }, [])

  const stopBackend = async (): Promise<void> => {
    setStopping(true)
    await window.electronAPI.stopBackend()
    await refreshBackendState()
    setRestStatus('failed')
    setWsStatus('failed')
    setStopping(false)
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm">
      <h2 className="text-base font-semibold">系统联调状态</h2>
      <div>
        <span className="text-slate-400">Backend 状态：</span> {backendInfo?.status ?? 'loading'}
      </div>
      <div>
        <span className="text-slate-400">Backend 端口：</span> {backendInfo?.port ?? '-'}
      </div>
      <div>
        <span className="text-slate-400">REST Ping：</span> {restStatus}
      </div>
      <div>
        <span className="text-slate-400">WebSocket 握手：</span> {wsStatus}
      </div>
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={() => void refreshBackendState()}
          className="rounded border border-slate-600 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
        >
          刷新状态
        </button>
        <button
          type="button"
          disabled={stopping}
          onClick={() => void stopBackend()}
          className="rounded border border-rose-700 px-3 py-1.5 text-rose-200 hover:bg-rose-900 disabled:opacity-50"
        >
          {stopping ? '停止中...' : '测试停止后端'}
        </button>
      </div>
    </section>
  )
}
