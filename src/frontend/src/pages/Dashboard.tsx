import React, { useState, useEffect } from 'react'
import AgentCard from '../components/AgentCard'
import { useWebSocket } from '../hooks/useWebSocket'
import { authFetch, buildApiUrl } from '../config'

interface Agent {
  id: string
  name: string
  label?: string
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
  lastActiveRaw?: string
  lastRun?: string
  contextUsage?: {
    used: number
    max: number
    percentage: number
    risk: 'safe' | 'warning' | 'high' | 'overflow'
  }
  groupName?: string
}

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showStoppedSubagents, setShowStoppedSubagents] = useState(false)

  const visibleAgents = agents.filter((agent) => {
    const isSubagent = agent.id.includes(':subagent:')
    return !isSubagent || showStoppedSubagents || agent.status !== 'stopped'
  })

  // 按最近活跃时间降序排序（最近活跃的排在前面）
  // 无活跃时间（lastActiveRaw 为空或无效）的项排在末尾
  const sortedAgents = [...visibleAgents].sort((a, b) => {
    const timeA = a.lastActiveRaw ? new Date(a.lastActiveRaw).getTime() : 0
    const timeB = b.lastActiveRaw ? new Date(b.lastActiveRaw).getTime() : 0

    // 都有活跃时间，按降序排列（最近活跃的在前）
    if (timeA > 0 && timeB > 0) {
      return timeB - timeA
    }

    // 只有 A 有活跃时间，A 排在前面
    if (timeA > 0) {
      return -1
    }

    // 只有 B 有活跃时间，B 排在前面
    if (timeB > 0) {
      return 1
    }

    // 都没有活跃时间，保持原有顺序
    return 0
  })

  useWebSocket({
    onMessage: (message) => {
      if (message.type === 'AGENTS_UPDATE') {
        setAgents(message.data)
        setError(null)
        setIsLoading(false)
      }
    },
    onDisconnect: () => {
      setError('实时连接已断开，正在尝试重连...')
    },
  })

  useEffect(() => {
    authFetch(buildApiUrl('/api/agents'))
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        return res.json()
      })
      .then(data => {
        setAgents(data)
        setError(null)
        setIsLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setError('加载 Agent 数据失败，请稍后重试')
        setIsLoading(false)
      })
  }, [])

  const runningCount = visibleAgents.filter(a => a.status === 'running').length
  const highRiskCount = visibleAgents.filter((agent) =>
    agent.contextUsage?.risk === 'high' || agent.contextUsage?.risk === 'overflow'
  ).length

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
      {error && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}
      <div className="mb-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-gray-900">Agent 概览</h2>
          <button
            type="button"
            onClick={() => setShowStoppedSubagents((value) => !value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              showStoppedSubagents
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {showStoppedSubagents ? '隐藏已结束 Subagent' : '显示已结束 Subagent'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                <span className="text-lg">📊</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">总 Agent 数</p>
                <p className="text-2xl font-bold text-gray-900">{visibleAgents.length}</p>
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
                <span className="text-lg">🧠</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">高风险上下文</p>
                <p className="text-2xl font-bold text-gray-900">{highRiskCount}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Agent 列表</h2>
        <div className="grid grid-cols-2 gap-6">
          {sortedAgents.map(agent => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  )
}
