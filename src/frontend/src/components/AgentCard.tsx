import React from 'react'

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
  }
  onSelect?: () => void
}

export default function AgentCard({ agent, onSelect }: AgentCardProps) {
  const statusConfig = {
    running: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      icon: '●',
      label: '运行中'
    },
    stopped: {
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      border: 'border-slate-200',
      icon: '○',
      label: '已停止'
    },
    idle: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      icon: '◐',
      label: '空闲'
    }
  }

  const config = statusConfig[agent.status]

  return (
    <div
      onClick={onSelect}
      className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:shadow-blue-100 transition-all duration-300 cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900">{agent.name}</h3>
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} ${config.border}`}>
          <span className="mr-1.5">{config.icon}</span>
          {config.label}
        </span>
      </div>

      <div className="text-xs text-gray-400 mb-4 font-medium">
        {new Date(agent.lastActive).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })}
      </div>

      <div className="space-y-3">
        <div className="flex items-center text-sm">
          <span className="text-gray-400 w-16 shrink-0">模型</span>
          <span className="font-medium text-gray-700">{agent.model}</span>
        </div>
        <div className="flex items-center text-sm">
          <span className="text-gray-400 w-16 shrink-0">类型</span>
          <span className="font-medium text-gray-700">{agent.type}</span>
        </div>
        <div className="flex items-center text-sm">
          <span className="text-gray-400 w-16 shrink-0">渠道</span>
          <span className="font-medium text-gray-700">{agent.channel}</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
          <span className="font-medium">Token 使用</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-full h-2">
            <div 
              className="h-2 bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((agent.tokenUsage.total / 500000) * 100, 100)}%` }}
            ></div>
          </div>
          <span className="text-xs font-medium text-gray-600">
            {agent.tokenUsage.input.toLocaleString()} / {agent.tokenUsage.output.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
          <span>总计</span>
          <span className="font-medium text-gray-700">{agent.tokenUsage.total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}
