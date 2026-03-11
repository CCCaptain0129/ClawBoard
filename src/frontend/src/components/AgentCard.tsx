import React, { useState } from 'react'

interface AgentCardProps {
  agent: {
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
    lastActiveRaw?: string
    lastRun?: string
    groupName?: string
  }
}

export default function AgentCard({ agent }: AgentCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  
  const statusConfig = {
    running: {
      bg: 'bg-gradient-to-r from-emerald-50 to-green-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      icon: '🟢',
      label: '运行中'
    },
    stopped: {
      bg: 'bg-gradient-to-r from-slate-100 to-gray-100',
      text: 'text-slate-600',
      border: 'border-slate-200',
      icon: '🔴',
      label: '已停止'
    },
    idle: {
      bg: 'bg-gradient-to-r from-amber-50 to-yellow-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      icon: '🟡',
      label: '空闲'
    }
  }

  const config = statusConfig[agent.status]
  const displayName = agent.groupName || agent.name

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:shadow-blue-100 transition-all duration-300">
      {/* 标题栏 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">📊</span>
            <h3 className="text-lg font-bold text-gray-900">{displayName}</h3>
          </div>
          {agent.groupName && agent.groupName !== agent.name && (
            <p className="text-xs text-gray-400 mt-0.5">{agent.name}</p>
          )}
        </div>
        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${config.bg} ${config.text} ${config.border} shadow-sm`}>
          <span className="mr-1.5 text-sm">{config.icon}</span>
          {config.label}
        </span>
      </div>

      {/* 最近活动 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium text-gray-700">💬 最近活动</span>
        </div>
        <div className="space-y-2 pl-2 border-l-2 border-gray-200">
          <div className="text-sm text-gray-600">
            <span className="text-gray-400 mr-2">{agent.lastActive}</span>
            <span>最后活动</span>
          </div>
          {agent.lastRun && (
            <div className="text-sm text-gray-600">
              <span className="text-gray-400 mr-2">{agent.lastRun}</span>
              <span>最后运行</span>
            </div>
          )}
        </div>
      </div>

      {/* 今日统计 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium text-gray-700">📊 今日统计</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">消息</div>
            <div className="text-lg font-bold text-gray-900">
              {(agent.tokenUsage.total / 100).toFixed(0)}
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Token</div>
            <div className="text-lg font-bold text-gray-900">
              {formatNumber(agent.tokenUsage.total)}
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">效率</div>
            <div className="text-lg font-bold text-gray-900">
              {agent.tokenUsage.total > 0 
                ? ((agent.tokenUsage.output / agent.tokenUsage.total) * 100).toFixed(0) + '%'
                : '0%'
              }
            </div>
          </div>
        </div>
      </div>

      {/* 可折叠的详细信息 */}
      <div className="border-t border-gray-100 pt-4">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          <span>⚙️ 详细信息</span>
          <span className="text-xs text-gray-400">
            {showDetails ? '▼' : '▶'}
          </span>
        </button>
        
        {showDetails && (
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">模型</span>
              <span className="font-medium text-gray-700">{agent.model}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">类型</span>
              <span className="font-medium text-gray-700">{agent.type}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">渠道</span>
              <span className="font-medium text-gray-700">{agent.channel}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">会话 ID</span>
              <span className="font-medium text-gray-700 font-mono text-xs">
                {agent.id.split(':').pop()?.slice(-8)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-500">Token 详情</span>
              <span className="font-medium text-gray-700">
                {formatNumber(agent.tokenUsage.input)} / {formatNumber(agent.tokenUsage.output)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}