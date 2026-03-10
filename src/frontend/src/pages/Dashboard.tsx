import React, { useState, useEffect } from 'react'
import AgentCard from '../components/AgentCard'
import { useWebSocket } from '../hooks/useWebSocket'

interface Agent {
  id: string
  name: string
  type: string
  channel: string
  status: 'running' | 'stopped' | 'idle'
  model: string
  tokenUsage: {
    input: number
    output: number
    total: number
  }
  lastActive: string
}

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useWebSocket({
    onMessage: (message) => {
      if (message.type === 'AGENTS_UPDATE') {
        setAgents(message.data)
        setIsLoading(false)
      }
    },
  })

  useEffect(() => {
    fetch('/api/agents')
      .then(res => res.json())
      .then(data => {
        setAgents(data)
        setIsLoading(false)
      })
      .catch(console.error)
  }, [])

  const runningCount = agents.filter(a => a.status === 'running').length
  const totalTokens = agents.reduce((sum, a) => sum + a.tokenUsage.total, 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Agent 概览</h2>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">总 Agent 数</p>
          <p className="text-2xl font-bold text-gray-900">{agents.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">运行中</p>
          <p className="text-2xl font-bold text-gray-900">{runningCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">总 Token 使用</p>
          <p className="text-2xl font-bold text-gray-900">{totalTokens.toLocaleString()}</p>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mb-6">Agent 列表</h2>
      <div className="grid grid-cols-2 gap-4">
        {agents.map(agent => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  )
}
