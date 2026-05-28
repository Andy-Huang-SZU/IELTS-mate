import { useCallback, useEffect, useRef, useState } from 'react'
import type { WSClientMessage, WSServerMessage } from '@renderer/services/speaking'

/* ---------- Types ---------- */

export type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface UseWebSocketOptions {
  /** WebSocket URL (pass null/undefined to defer connection) */
  url: string | null | undefined
  /** Callback for incoming server messages */
  onMessage?: (msg: WSServerMessage) => void
  /** Callback when connection opens */
  onOpen?: () => void
  /** Callback when connection closes */
  onClose?: (event: CloseEvent) => void
  /** Callback on error */
  onError?: (event: Event) => void
  /** Max reconnect attempts (default 3) */
  maxReconnectAttempts?: number
  /** Base delay for exponential backoff in ms (default 1000) */
  reconnectBaseDelay?: number
  /** Heartbeat interval in ms (default 30000) */
  heartbeatInterval?: number
  /** Auto-connect on mount (default true) */
  autoConnect?: boolean
}

export interface UseWebSocketReturn {
  status: WSStatus
  send: (msg: WSClientMessage) => void
  connect: () => void
  disconnect: () => void
}

/* ---------- Hook ---------- */

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    url,
    onMessage,
    onOpen,
    onClose,
    onError,
    maxReconnectAttempts = 3,
    reconnectBaseDelay = 1000,
    heartbeatInterval = 30000,
    autoConnect = true,
  } = options

  const [status, setStatus] = useState<WSStatus>('disconnected')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectCountRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const intentionalCloseRef = useRef(false)

  // Keep latest callbacks in refs to avoid stale closures
  const onMessageRef = useRef(onMessage)
  const onOpenRef = useRef(onOpen)
  const onCloseRef = useRef(onClose)
  const onErrorRef = useRef(onError)
  onMessageRef.current = onMessage
  onOpenRef.current = onOpen
  onCloseRef.current = onClose
  onErrorRef.current = onError

  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
    }
  }, [])

  const startHeartbeat = useCallback(
    (ws: WebSocket) => {
      clearHeartbeat()
      heartbeatTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', payload: {} }))
        }
      }, heartbeatInterval)
    },
    [heartbeatInterval, clearHeartbeat]
  )

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  const doConnect = useCallback(() => {
    if (!url) return

    // Close existing connection
    if (wsRef.current) {
      intentionalCloseRef.current = true
      wsRef.current.close()
      wsRef.current = null
    }

    setStatus('connecting')
    intentionalCloseRef.current = false

    const ws = new WebSocket(url)

    ws.onopen = () => {
      setStatus('connected')
      reconnectCountRef.current = 0
      startHeartbeat(ws)
      onOpenRef.current?.()
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSServerMessage
        // Ignore pong silently
        if (msg.type === 'pong') return
        onMessageRef.current?.(msg)
      } catch (e) {
        console.error('[useWebSocket] Failed to parse message:', e)
      }
    }

    ws.onerror = (event) => {
      console.error('[useWebSocket] WebSocket error:', event)
      setStatus('error')
      onErrorRef.current?.(event)
    }

    ws.onclose = (event) => {
      clearHeartbeat()
      wsRef.current = null

      if (intentionalCloseRef.current) {
        setStatus('disconnected')
        onCloseRef.current?.(event)
        return
      }

      // Attempt reconnect
      if (reconnectCountRef.current < maxReconnectAttempts) {
        const delay = reconnectBaseDelay * Math.pow(2, reconnectCountRef.current)
        reconnectCountRef.current += 1
        console.log(
          `[useWebSocket] Reconnecting in ${delay}ms (attempt ${reconnectCountRef.current}/${maxReconnectAttempts})`
        )
        setStatus('connecting')
        reconnectTimerRef.current = setTimeout(() => {
          doConnect()
        }, delay)
      } else {
        setStatus('disconnected')
        onCloseRef.current?.(event)
      }
    }

    wsRef.current = ws
  }, [url, maxReconnectAttempts, reconnectBaseDelay, startHeartbeat, clearHeartbeat])

  const disconnect = useCallback(() => {
    clearReconnectTimer()
    clearHeartbeat()
    intentionalCloseRef.current = true
    reconnectCountRef.current = 0
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setStatus('disconnected')
  }, [clearReconnectTimer, clearHeartbeat])

  const send = useCallback((msg: WSClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    } else {
      console.error('[useWebSocket] Cannot send, WebSocket not open')
    }
  }, [])

  // Auto-connect on mount / url change
  useEffect(() => {
    if (autoConnect && url) {
      doConnect()
    }
    return () => {
      disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, autoConnect])

  return {
    status,
    send,
    connect: doConnect,
    disconnect,
  }
}
