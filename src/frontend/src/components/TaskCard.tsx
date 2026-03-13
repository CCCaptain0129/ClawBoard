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
  dueDate?: string | null
  estimatedTime?: string | null
  comments?: any[]  // PMW-010: 执行日志
}

interface TaskCardProps {
  task: Task
  projectName?: string
  projectColor?: string
  projectIcon?: string
  onStatusChange?: (taskId: string, newStatus: 'todo' | 'in-progress' | 'done') => void
  onDelete?: (taskId: string) => void // JSON-first: 删除任务
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

/**
 * PMW-010: 计算执行耗时
 * 返回格式：X小时Y分钟 或 X分钟
 */
function calculateDuration(startTime: string | null | undefined, completeTime: string | null | undefined): string | null {
  if (!startTime) return null
  
  const start = new Date(startTime).getTime()
  const end = completeTime ? new Date(completeTime).getTime() : Date.now()
  const durationMs = end - start
  
  const hours = Math.floor(durationMs / 3600000)
  const minutes = Math.floor((durationMs % 3600000) / 60000)
  
  if (hours > 0) {
    return `${hours}小时${minutes > 0 ? `${minutes}分钟` : ''}`
  }
  if (minutes > 0) {
    return `${minutes}分钟`
  }
  return '1分钟内'
}

/**
 * PMW-010: 检测任务是否超时
 * 基于 estimatedTime 字段，格式为 "30分钟"、"1小时" 等
 */
function isTaskOverdue(task: Task): boolean {
  if (task.status !== 'in-progress' || !task.startTime || !task.estimatedTime) return false
  
  const startTime = new Date(task.startTime).getTime()
  const elapsedMs = Date.now() - startTime
  
  // 解析 estimatedTime
  const hourMatch = task.estimatedTime.match(/(\d+)小时/)
  const minMatch = task.estimatedTime.match(/(\d+)分钟/)
  
  let estimatedMs = 0
  if (hourMatch) estimatedMs += parseInt(hourMatch[1]) * 3600000
  if (minMatch) estimatedMs += parseInt(minMatch[1]) * 60000
  
  if (estimatedMs === 0) return false
  
  return elapsedMs > estimatedMs
}

/**
 * PMW-010: 格式化日志摘要
 * 从 comments 数组中提取最新的一条作为摘要
 */
function formatLogSummary(comments: any[] | undefined): string | null {
  if (!comments || comments.length === 0) return null
  
  const latestComment = comments[comments.length - 1]
  if (!latestComment) return null
  
  // 如果 comment 是字符串，直接返回前50字符
  if (typeof latestComment === 'string') {
    return latestComment.length > 50 ? latestComment.slice(0, 50) + '...' : latestComment
  }
  
  // 如果 comment 是对象，尝试提取 text 或 content
  const text = latestComment.text || latestComment.content || latestComment.message
  if (text) {
    return typeof text === 'string' && text.length > 50 ? text.slice(0, 50) + '...' : text
  }
  
  return null
}

export default function TaskCard({
  task,
  projectName,
  projectColor = '#3B82F6',
  projectIcon = '📊',
  onStatusChange,
  onDelete // JSON-first: 删除任务
}: TaskCardProps) {
  const mainLabel = task.labels.find(l =>
    !['todo', 'in-progress', 'done', 'P1', 'P2', 'P3'].includes(l)
  ) || '其他'

  const shortSubagentId = formatSubagentId(task.claimedBy)
  const startTimeDisplay = formatTime(task.startTime)
  const isInProgress = task.status === 'in-progress'
  const isDone = task.status === 'done'

  // PMW-010: 计算执行耗时
  const duration = calculateDuration(task.startTime, task.completeTime)
  const isOverdue = isTaskOverdue(task)

  // PMW-010: 日志摘要
  const logSummary = formatLogSummary(task.comments)
      
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
        <div className={`mb-3 p-2 rounded-lg border ${
          isOverdue
            ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-300'
            : 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shadow-sm ${
              isOverdue ? 'bg-gradient-to-br from-red-500 to-orange-500' : 'bg-gradient-to-br from-purple-500 to-indigo-500'
            }`}>
              <span className="text-xs">🤖</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-semibold ${isOverdue ? 'text-red-700' : 'text-purple-700'}`}>
                {isOverdue ? '⚠️ 执行超时' : '分配给 Subagent'}
              </div>
              <div className={`text-xs font-mono truncate ${isOverdue ? 'text-red-600' : 'text-purple-600'}`} title={task.claimedBy || ''}>
                {shortSubagentId}
              </div>
            </div>
          </div>

          {/* PMW-010: 执行时间信息 */}
          <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-purple-200/50">
            {/* 开始时间 */}
            {startTimeDisplay && (
              <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-purple-500'}`} title={`开始时间: ${task.startTime}`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{startTimeDisplay}</span>
              </div>
            )}

            {/* PMW-010: 执行耗时 */}
            {duration && (
              <div className={`flex items-center gap-1 ${
                isOverdue ? 'text-red-600 font-medium' : (isDone ? 'text-green-600' : 'text-purple-500')
              }`} title={isDone ? `完成时间: ${task.completeTime}` : '已执行时间'}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>{duration}</span>
              </div>
            )}
          </div>

          {/* PMW-010: 预计时间提示（进行中且未超时时） */}
          {isInProgress && !isOverdue && task.estimatedTime && (
            <div className="text-xs text-purple-400 mt-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>预计: {task.estimatedTime}</span>
            </div>
          )}
        </div>
      )}

      {/* PMW-010: 执行日志摘要 */}
      {(logSummary || (task.comments && task.comments.length > 0)) && (
        <div className="mb-3 p-2 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full flex items-center justify-center shadow-sm">
              <span className="text-xs">📝</span>
            </div>
            <div className="text-xs font-semibold text-amber-700">
              执行日志
              {task.comments && task.comments.length > 1 && (
                <span className="ml-1 text-amber-500 font-normal">({task.comments.length}条)</span>
              )}
            </div>
          </div>
          {logSummary && (
            <div className="text-xs text-amber-600 line-clamp-2" title="最新执行记录">
              {logSummary}
            </div>
          )}
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
        
        <div className="flex items-center gap-2">
          {/* JSON-first: 删除按钮 - 仅 todo 状态显示 */}
          {onDelete && task.status === 'todo' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (confirm(`确定要删除任务 "${task.title}" 吗？\n\n注意：只有 todo 状态的任务可以删除。`)) {
                  onDelete(task.id)
                }
              }}
              className="text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
              title="删除任务（仅 todo 状态）"
            >
              🗑️ 删除
            </button>
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
    </div>
  )
}