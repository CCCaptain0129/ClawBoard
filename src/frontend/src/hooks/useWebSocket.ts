import { useEffect, useRef } from 'react'
import { wsUrl } from '../config'

interface WebSocketHookOptions {
  onMessage?: (message: any) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

export function useWebSocket({ onMessage, onConnect, onDisconnect }: WebSocketHookOptions = {}) {
  const ws = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  const onConnectRef = useRef(onConnect)
  const onDisconnectRef = useRef(onDisconnect)

  useEffect(() => {
    onMessageRef.current = onMessage
    onConnectRef.current = onConnect
    onDisconnectRef.current = onDisconnect
  }, [onMessage, onConnect, onDisconnect])

  useEffect(() => {
    ws.current = new WebSocket(wsUrl)

    ws.current.onopen = () => {
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
      console.log('WebSocket disconnected')
      onDisconnectRef.current?.()
    }

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    return () => {
      if (ws.current) {
        ws.current.close()
      }
    }
  }, [])
}
