import { useEffect, useRef } from 'react'
import { buildWsUrl } from '../config'

interface WebSocketHookOptions {
  onMessage?: (message: any) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

export type WebSocketConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export function useWebSocket({ onMessage, onConnect, onDisconnect }: WebSocketHookOptions = {}) {
  const ws = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  const onConnectRef = useRef(onConnect)
  const onDisconnectRef = useRef(onDisconnect)
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const statusRef = useRef<WebSocketConnectionStatus>('connecting')

  useEffect(() => {
    onMessageRef.current = onMessage
    onConnectRef.current = onConnect
    onDisconnectRef.current = onDisconnect
  }, [onMessage, onConnect, onDisconnect])

  useEffect(() => {
    let isDisposed = false

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const connect = () => {
      clearReconnectTimer()
      statusRef.current = 'connecting'
      ws.current = new WebSocket(buildWsUrl())

      ws.current.onopen = () => {
        reconnectAttemptsRef.current = 0
        statusRef.current = 'connected'
        console.log('Connected to WebSocket')
        onConnectRef.current?.()
      }

      ws.current.onmessage = (event) => {
        const message = JSON.parse(event.data)
        if (message.type === 'PING') {
          ws.current?.send(JSON.stringify({ type: 'PONG' }))
        }
        onMessageRef.current?.(message)
      }

      ws.current.onclose = () => {
        ws.current = null
        statusRef.current = 'disconnected'
        console.log('WebSocket disconnected')
        onDisconnectRef.current?.()

        if (isDisposed) {
          return
        }

        const retryDelay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 10000)
        reconnectAttemptsRef.current += 1
        reconnectTimerRef.current = window.setTimeout(connect, retryDelay)
      }

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    }

    connect()

    return () => {
      isDisposed = true
      clearReconnectTimer()
      if (ws.current) {
        ws.current.close()
        ws.current = null
      }
    }
  }, [])

  return {
    getStatus: () => statusRef.current,
  }
}
