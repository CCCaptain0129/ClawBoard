import React from 'react'

interface Task {
  id: string
  title: string
  description: string
  status: 'todo' | 'in-progress' | 'done'
  priority: 'P1' | 'P2' | 'P3'
  labels: string[]
  assignee: string | null
  claimedBy: string | null
  startTime?: string | null
  completeTime?: string | null
  projectId?: string
}

interface TaskCardProps {
  task: Task
  projectName?: string
  projectColor?: string
  projectIcon?: string
  onStatusChange?: (taskId: string, newStatus: 'todo' | 'in-progress' | 'done') => void
}

const priorityColors = {
  P1: 'bg-red-100 text-red-700 border-red-200',
  P2: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  P3: 'bg-gray-100 text-gray-700 border-gray-200',
}

const statusColors = {
  todo: 'border-l-4 border-gray-400',
  'in-progress': 'border-l-4 border-blue-500',
  done: 'border-l-4 border-green-500',
}

/**
 * 短化显示 subagent ID
 * 输入: "agent:main:subagent:0c3d3c53-a948-4dd7-80c6-9b7374c29e93"
 * 输出: "subagent:9b7374c29e93" (后12位)
 */
function formatSubagentId(claimedBy: string | null): string | null {
  if (!claimedBy) return null
  
  // 提取 subagent 后的 UUID 或数字
  const match = claimedBy.match(/subagent:([a-f0-9-]+|\d+)/i)
  if (match) {
    const id = match[1]
    // 如果是 UUID，取后12位
    if (id.includes('-')) {
      return 'subagent:' + id.slice(-12)
    }
    // 如果是数字，取后8位
    return 'subagent:' + id.slice(-8)
  }
  
  // 通用处理：取后12位
  return claimedBy.slice(-12)
}

/**
 * 格式化时间显示
 */
function formatTime(isoString: string | null | undefined): string | null {
  if (!isoString) return null
  
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`
    
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  } catch {
    return null
  }
}

export default function TaskCard({ 
  task, 
  projectName, 
  projectColor = '#3B82F6', 
  projectIcon = '📊',
  onStatusChange 
}: TaskCardProps) {
  const mainLabel = task.labels.find(l => 
    !['todo', 'in-progress', 'done', 'P1', 'P2', 'P3'].includes(l)
  ) || '其他'
  
  const shortSubagentId = formatSubagentId(task.claimedBy)
  const startTimeDisplay = formatTime(task.startTime)
  const isInProgress = task.status === 'in-progress'
  
  return (
    <div className={`bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${statusColors[task.status]} group relative`}>
      {/* 进行中状态 - 顶部高亮条 */}
      {isInProgress && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 rounded-t-lg animate-pulse" />
      )}
      
      {/* 项目标签（多项目时显示） */}
      {projectName && (
        <div className="flex items-center gap-1.5 mb-2 text-xs font-medium" style={{ color: projectColor }}>
          <span>{projectIcon}</span>
          <span>{projectName}</span>
        </div>
      )}
      
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs font-medium rounded border ${priorityColors[task.priority]}`}>
            {task.priority}
          </span>
          {/* 进行中状态标签 */}
          {isInProgress && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-500 text-white animate-pulse">
              🔄 执行中
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 font-mono">{task.id}</span>
      </div>
      
      <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
        {task.title}
      </h3>
      
      {task.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
      )}
      
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {task.labels.slice(0, 2).map(label => {
            if (['todo', 'in-progress', 'done', 'P1', 'P2', 'P3'].includes(label)) return null
            return (
              <span key={label} className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-medium">
                {label}
              </span>
            )
          }).filter(Boolean)}
          {task.labels.filter(l => 
            !['todo', 'in-progress', 'done', 'P1', 'P2', 'P3'].includes(l)
          ).length > 2 && (
            <span className="px-2 py-0.5 text-xs bg-slate-50 text-slate-400 rounded-full">
              +{task.labels.filter(l => 
                !['todo', 'in-progress', 'done', 'P1', 'P2', 'P3'].includes(l)
              ).length - 2}
            </span>
          )}
        </div>
      )}
      
      {/* Subagent 分配信息 - 优先显示 */}
      {shortSubagentId && (
        <div className="mb-3 p-2 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center shadow-sm">
              <span className="text-xs">🤖</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-purple-700">分配给 Subagent</div>
              <div className="text-xs text-purple-600 font-mono truncate" title={task.claimedBy || ''}>
                {shortSubagentId}
              </div>
            </div>
            {startTimeDisplay && (
              <div className="text-xs text-purple-500 flex items-center gap-1" title={`开始时间: ${task.startTime}`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {startTimeDisplay}
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        {/* Assignee 显示 */}
        {task.assignee ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
              <span className="text-xs text-white font-semibold">
                {task.assignee.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-xs font-medium text-gray-700">{task.assignee}</span>
          </div>
        ) : !shortSubagentId ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-xs text-gray-400">?</span>
            </div>
            <span className="text-xs text-gray-400">未分配</span>
          </div>
        ) : (
          <div /> // 占位，当有 subagent 但无 assignee 时
        )}
        
        {onStatusChange && task.status !== 'done' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              const nextStatus = task.status === 'todo' ? 'in-progress' : 'done'
              onStatusChange(task.id, nextStatus)
            }}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
          >
            {task.status === 'todo' ? '开始 →' : '完成 ✓'}
          </button>
        )}
      </div>
    </div>
  )
}