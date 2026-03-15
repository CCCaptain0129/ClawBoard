import React, { useState } from 'react'

interface AgentCardProps {
  agent: {
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
}

function isTechnicalIdentifier(value?: string | null) {
  if (!value) return true
  return value.startsWith('chat:oc_')
    || value.startsWith('oc_')
    || value.startsWith('feishu:g-oc_')
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
  const friendlyGroupName = !isTechnicalIdentifier(agent.groupName) ? agent.groupName : undefined
  const displayName = friendlyGroupName || agent.name || agent.label || '未知 Agent'
  const contextConfig = getContextConfig(agent.contextUsage?.risk)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:shadow-blue-100 transition-all duration-300">
      {/* 标题栏 */}
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0 flex-1 pr-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="shrink-0 text-2xl">📊</span>
            <h3 className="truncate text-lg font-bold text-gray-900">{displayName}</h3>
          </div>
          {friendlyGroupName && friendlyGroupName !== agent.name && (
            <p className="truncate text-xs text-gray-400 mt-0.5">{agent.name}</p>
          )}
        </div>
        <span className={`shrink-0 inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${config.bg} ${config.text} ${config.border} shadow-sm`}>
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

      {/* 上下文风险 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">上下文风险</span>
        </div>
        <div className={`rounded-md border border-gray-100 p-2.5 ${contextConfig.card}`}>
          {agent.contextUsage ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900">
                    {agent.contextUsage.percentage}%
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {formatUsage(agent.contextUsage.used)} / {formatUsage(agent.contextUsage.max)}
                  </div>
                </div>
                <div className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${contextConfig.badge}`}>
                  {contextConfig.label}
                </div>
              </div>
              <div>
                <div className="h-1.5 rounded-full bg-white/70">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${contextConfig.bar}`}
                    style={{ width: `${Math.min(agent.contextUsage.percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500">当前会话没有可用的上下文额度数据</div>
          )}
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
            {agent.contextUsage && (
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-500">上下文占用</span>
                <span className="font-medium text-gray-700">
                  {agent.contextUsage.percentage}% ({formatUsage(agent.contextUsage.used)} / {formatUsage(agent.contextUsage.max)})
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-500">Token 快照</span>
              <span className="font-medium text-gray-700">
                {formatUsage(agent.tokenUsage.total)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function formatUsage(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

function getContextConfig(risk: 'safe' | 'warning' | 'high' | 'overflow' | undefined) {
  switch (risk) {
    case 'overflow':
      return {
        card: 'bg-gradient-to-br from-red-50 to-rose-100',
        badge: 'bg-red-100 text-red-700',
        bar: 'bg-red-500',
        label: '已超上限',
      }
    case 'high':
      return {
        card: 'bg-gradient-to-br from-orange-50 to-amber-100',
        badge: 'bg-orange-100 text-orange-700',
        bar: 'bg-orange-500',
        label: '高风险',
      }
    case 'warning':
      return {
        card: 'bg-gradient-to-br from-yellow-50 to-amber-50',
        badge: 'bg-yellow-100 text-yellow-700',
        bar: 'bg-yellow-500',
        label: '接近上限',
      }
    default:
      return {
        card: 'bg-gradient-to-br from-emerald-50 to-green-100',
        badge: 'bg-emerald-100 text-emerald-700',
        bar: 'bg-emerald-500',
        label: '安全',
      }
  }
}
