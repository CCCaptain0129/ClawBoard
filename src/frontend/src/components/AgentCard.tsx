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
  const statusColors = {
    running: 'bg-green-100 text-green-800',
    stopped: 'bg-gray-100 text-gray-800',
    idle: 'bg-yellow-100 text-yellow-800',
  }

  const statusText = {
    running: '运行中',
    stopped: '已停止',
    idle: '空闲',
  }

  return (
    <div
      onClick={onSelect}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{agent.name}</h3>
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[agent.status]}`}>
          {statusText[agent.status]}
        </span>
      </div>
      <div className="text-sm text-gray-500 mb-1">
        {new Date(agent.lastActive).toLocaleDateString('zh-CN')}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-gray-500">模型</span>
          <div className="font-medium">{agent.model}</div>
        </div>
        <div>
          <span className="text-gray-500">类型</span>
          <div className="font-medium">{agent.type}</div>
        </div>
        <div>
          <span className="text-gray-500">渠道</span>
          <div className="font-medium">{agent.channel}</div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="text-sm text-gray-500 mb-1">Token 使用</div>
        <div className="flex gap-2">
          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
            {agent.tokenUsage.input.toLocaleString()} / {agent.tokenUsage.output.toLocaleString()}
          </span>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          上下文: 202,752 / 总计: {agent.tokenUsage.total.toLocaleString()}
        </div>
      </div>
    </div>
  )
}
