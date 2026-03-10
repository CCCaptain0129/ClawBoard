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
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-gray-500">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Agent 概览</h2>
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                <span className="text-lg">📊</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">总 Agent 数</p>
                <p className="text-2xl font-bold text-gray-900">{agents.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white">
                <span className="text-lg">🟢</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">运行中</p>
                <p className="text-2xl font-bold text-gray-900">{runningCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white">
                <span className="text-lg">⚡</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">总 Token 使用</p>
                <p className="text-2xl font-bold text-gray-900">{totalTokens.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Agent 列表</h2>
        <div className="grid grid-cols-2 gap-6">
          {agents.map(agent => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  )
}
