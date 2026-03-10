import { useEffect, useRef } from 'react'

interface WebSocketHookOptions {
  onMessage?: (message: any) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

export function useWebSocket({ onMessage, onConnect, onDisconnect }: WebSocketHookOptions = {}) {
  const ws = useRef<WebSocket | null>(null)

  useEffect(() => {
    const wsUrl = 'ws://localhost:3001'
    ws.current = new WebSocket(wsUrl)

    ws.current.onopen = () => {
      console.log('Connected to WebSocket')
      onConnect?.()
    }

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type === 'PING') {
        ws.current?.send(JSON.stringify({ type: 'PONG' }))
      }
      onMessage?.(message)
    }

    ws.current.onclose = () => {
      console.log('WebSocket disconnected')
      onDisconnect?.()
    }

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    return () => {
      if (ws.current) {
        ws.current.close()
      }
    }
  }, [onMessage, onConnect, onDisconnect])
}
