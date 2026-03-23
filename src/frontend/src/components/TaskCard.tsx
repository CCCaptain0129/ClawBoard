import React, { useState } from 'react'
import { getExecutionGuide, getTaskExecutionContext } from '../services/taskService'

interface Task {
  id: string
  title: string
  description: string
  status: 'todo' | 'in-progress' | 'review' | 'done'
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  labels: string[]
  assignee: string | null
  claimedBy: string | null
  startTime?: string | null
  completeTime?: string | null
  projectId?: string
  dueDate?: string | null
  estimatedTime?: string | null
  dependencies?: string[]
  contextSummary?: string
  acceptanceCriteria?: string[]
  deliverables?: string[]
  executionMode?: 'manual' | 'auto'
  agentType?: 'general' | 'dev' | 'test' | 'debug'
  blockingReason?: string | null
  activeExecutorId?: string | null
  activeExecutorLabel?: string | null
  activeExecutorLastUpdate?: string | null
  comments?: any[]  // PMW-010: 执行日志
}

interface TaskCardProps {
  task: Task
  projectId?: string
  projectName?: string
  projectColor?: string
  projectIcon?: string
  onStatusChange?: (taskId: string, newStatus: 'todo' | 'in-progress' | 'review' | 'done') => void
  onAssigneeChange?: (taskId: string, assignee: string | null) => Promise<void> | void
  onDelete?: (taskId: string, taskTitle: string) => void // JSON-first: 删除任务
}

const priorityColors = {
  P0: 'bg-purple-100 text-purple-700 border-purple-200',
  P1: 'bg-red-100 text-red-700 border-red-200',
  P2: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  P3: 'bg-gray-100 text-gray-700 border-gray-200',
}

const statusColors = {
  todo: 'border-l-4 border-gray-400',
  'in-progress': 'border-l-4 border-blue-500',
  review: 'border-l-4 border-violet-500',
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

function formatActiveExecutor(task: Task): string | null {
  if (task.activeExecutorLabel?.trim()) {
    return task.activeExecutorLabel.trim()
  }

  if (task.activeExecutorId) {
    return formatSubagentId(task.activeExecutorId)
  }

  return formatSubagentId(task.claimedBy)
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

function getAgentTypeLabel(agentType: Task['agentType']): string {
  if (agentType === 'dev') return '开发'
  if (agentType === 'test') return '测试'
  if (agentType === 'debug') return '排障'
  return '通用'
}

export default function TaskCard({
  task,
  projectId,
  projectName,
  projectColor = '#3B82F6',
  projectIcon = '📊',
  onStatusChange,
  onAssigneeChange,
  onDelete // JSON-first: 删除任务
}: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const [assigneeDraft, setAssigneeDraft] = useState(task.assignee ?? '')
  const [isSavingAssignee, setIsSavingAssignee] = useState(false)
  const [assigneeMessage, setAssigneeMessage] = useState<string | null>(null)
  const normalizedAssignee = task.assignee ?? ''
  const hasAssigneeChanges = assigneeDraft.trim() !== normalizedAssignee.trim()

  const activeExecutorLabel = formatActiveExecutor(task)
  const startTimeDisplay = formatTime(task.startTime)
  const isInProgress = task.status === 'in-progress'
  const isReview = task.status === 'review'
  const isDone = task.status === 'done'
  const statusBadge = {
    todo: null,
    'in-progress': { text: '🔄 执行中', className: 'bg-blue-500 text-white animate-pulse' },
    review: { text: '🟣 待审核', className: 'bg-violet-500 text-white' },
    done: { text: '✅ 已完成', className: 'bg-green-500 text-white' },
  }[task.status]

  // PMW-010: 计算执行耗时
  const duration = calculateDuration(task.startTime, task.completeTime)
  const isOverdue = isTaskOverdue(task)
  const timelineText = isDone
    ? (task.completeTime ? `完成于 ${formatTime(task.completeTime)}` : '已完成')
    : isReview
      ? (task.completeTime ? `提交于 ${formatTime(task.completeTime)}` : '待审核')
      : isInProgress
        ? (task.startTime ? `开始于 ${formatTime(task.startTime)}` : '进行中')
        : null

  // PMW-010: 日志摘要
  const logSummary = formatLogSummary(task.comments)

  React.useEffect(() => {
    setAssigneeDraft(task.assignee ?? '')
    setAssigneeMessage(null)
  }, [task.assignee])

  // 格式化完整时间显示
  function formatFullTime(isoString: string | null | undefined): string {
    if (!isoString) return '-'
    try {
      const date = new Date(isoString)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch {
      return '-'
    }
  }

  async function copyMainAgentGuide(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    if (!projectId) {
      setCopyState('error')
      setCopyMessage('缺少项目 ID，无法复制项目管理 Agent 指引')
      return
    }

    try {
      setCopyState('copying')
      const guide = await getExecutionGuide(projectId)
      await navigator.clipboard.writeText(guide.suggestedPrompt)
      setCopyState('copied')
      setCopyMessage('已复制项目管理 Agent 指引')
    } catch (error) {
      setCopyState('error')
      setCopyMessage(error instanceof Error ? error.message : '复制项目管理 Agent 指引失败')
    }
  }

  async function copySubagentPrompt(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    if (!projectId) {
      setCopyState('error')
      setCopyMessage('缺少项目 ID，无法复制任务执行包')
      return
    }

    try {
      setCopyState('copying')
      const context = await getTaskExecutionContext(projectId, task.id)
      await navigator.clipboard.writeText(context.prompt)
      setCopyState('copied')
      setCopyMessage('已复制 Subagent 执行包')
    } catch (error) {
      setCopyState('error')
      setCopyMessage(error instanceof Error ? error.message : '复制任务执行包失败')
    }
  }

  async function saveAssignee(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    if (!onAssigneeChange) return

    const nextAssignee = assigneeDraft.trim() || null
    if ((task.assignee ?? null) === nextAssignee) {
      setAssigneeMessage(null)
      return
    }

    try {
      setIsSavingAssignee(true)
      setAssigneeMessage(null)
      await onAssigneeChange(task.id, nextAssignee)
      setAssigneeMessage(nextAssignee ? '负责人已更新' : '负责人已清空')
    } catch (error) {
      setAssigneeMessage(error instanceof Error ? error.message : '负责人更新失败')
    } finally {
      setIsSavingAssignee(false)
    }
  }

  return (
    <div
      className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${statusColors[task.status]} group relative ${
        isExpanded ? 'ring-2 ring-blue-400 ring-offset-1' : ''
      }`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* 进行中状态 - 顶部高亮条 */}
      {isInProgress && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 rounded-t-lg animate-pulse" />
      )}

      {/* 展开指示器 */}
      <div className="absolute top-4 right-2 z-10">
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      <div className={isExpanded ? 'p-4' : 'p-3'}>
        {/* 项目标签（多项目时显示） */}
        {projectName && (
          <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-medium" style={{ color: projectColor }}>
            <span>{projectIcon}</span>
            <span>{projectName}</span>
          </div>
        )}

        <div className="flex items-start justify-between mb-1.5 pr-6">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-[11px] font-medium rounded border ${priorityColors[task.priority]}`}>
              {task.priority}
            </span>
            {statusBadge && (
              <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${statusBadge.className}`}>
                {statusBadge.text}
              </span>
            )}
          </div>
          <span className="text-[11px] text-gray-400 font-mono">{task.id}</span>
        </div>

        <h3 className={`font-semibold text-gray-900 group-hover:text-blue-600 transition-colors ${isExpanded ? 'mb-2 line-clamp-2' : 'mb-1.5 text-[15px] line-clamp-2'}`}>
          {task.title}
        </h3>

        <div className={`${isExpanded ? 'mb-3 flex flex-wrap gap-2' : 'mb-2 flex flex-wrap gap-1.5'}`}>
          {task.assignee && (
            <span className={`${isExpanded ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'} inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700`}>
              <span>👤</span>
              <span className="font-medium">{task.assignee}</span>
            </span>
          )}
          <span className={`${isExpanded ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'} inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 text-violet-700`}>
            <span>🧩</span>
            <span>{getAgentTypeLabel(task.agentType)}</span>
          </span>
          {task.estimatedTime && (
            <span className={`${isExpanded ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'} inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600`}>
              <span>⏱</span>
              <span>{task.estimatedTime}</span>
            </span>
          )}
        </div>

        {!isExpanded && timelineText && (
          <div className="mb-2 text-[11px] text-slate-500">
            {timelineText}
            {duration && (isInProgress || isReview || isDone) ? ` · ${duration}` : ''}
          </div>
        )}

        {/* 展开时显示详细信息 */}
        {isExpanded ? (
          <div className="space-y-3">
            {onAssigneeChange && (
              <div
                className="bg-white rounded-lg p-3 border border-slate-200"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-xs font-semibold text-slate-700">负责人</div>
                  {assigneeMessage && (
                    <span className={`text-xs ${assigneeMessage.includes('失败') ? 'text-red-600' : 'text-emerald-600'}`}>
                      {assigneeMessage}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={assigneeDraft}
                    onChange={(event) => {
                      setAssigneeDraft(event.target.value)
                      if (assigneeMessage) {
                        setAssigneeMessage(null)
                      }
                    }}
                    placeholder="手动填写负责人"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                  <button
                    type="button"
                    onClick={saveAssignee}
                    disabled={isSavingAssignee || !hasAssigneeChanges}
                    className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingAssignee ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-xs font-semibold text-slate-500 mb-1">状态摘要</div>
                <div className="text-sm text-slate-700">
                  {timelineText || '未开始'}
                  {duration && (isInProgress || isReview || isDone) ? ` · ${duration}` : ''}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-xs font-semibold text-slate-500 mb-1">时间信息</div>
                <div className="text-sm text-slate-700">
                  {task.dueDate ? `截止 ${formatTime(task.dueDate)}` : (task.estimatedTime || '未设定')}
                </div>
              </div>
            </div>

            {/* 任务描述 */}
            {task.description && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <div className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  任务描述
                </div>
                <div className="text-sm text-gray-700 leading-relaxed">
                  {task.description}
                </div>
              </div>
            )}

            {task.contextSummary && (
              <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                <div className="text-xs font-semibold text-indigo-700 mb-1">任务上下文</div>
                <div className="text-sm text-gray-700 leading-relaxed">{task.contextSummary}</div>
              </div>
            )}

            {task.deliverables && task.deliverables.length > 0 && (
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                <div className="text-xs font-semibold text-amber-700 mb-2">交付物</div>
                <ul className="space-y-1 text-sm text-gray-700">
                  {task.deliverables.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-amber-500">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
              <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                <div className="text-xs font-semibold text-green-700 mb-2">验收标准</div>
                <ul className="space-y-1 text-sm text-gray-700">
                  {task.acceptanceCriteria.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-green-500">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {projectId && (
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-xs font-semibold text-slate-700">执行指引</div>
                  {copyMessage && (
                    <span className={`text-xs ${
                      copyState === 'error' ? 'text-red-600' : copyState === 'copied' ? 'text-emerald-600' : 'text-slate-500'
                    }`}>
                      {copyMessage}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={copyMainAgentGuide}
                    className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-100 transition-colors"
                  >
                    复制项目管理 Agent 指引
                  </button>
                  <button
                    type="button"
                    onClick={copySubagentPrompt}
                    className="px-3 py-2 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 transition-colors"
                  >
                    复制任务执行包
                  </button>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  先给项目管理 Agent 项目级指引，再给具体任务的 Subagent 执行包。
                </div>
              </div>
            )}

            {task.dependencies && task.dependencies.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="text-xs font-semibold text-slate-700 mb-2">依赖任务</div>
                <div className="flex flex-wrap gap-2">
                  {task.dependencies.map((dependency) => (
                    <span key={dependency} className="px-2 py-1 text-xs bg-white rounded border border-slate-200 text-slate-600 font-mono">
                      {dependency}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {task.blockingReason && (
              <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                <div className="text-xs font-semibold text-red-700 mb-1">阻塞原因</div>
                <div className="text-sm text-gray-700 leading-relaxed">{task.blockingReason}</div>
              </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
              {task.startTime && <div>开始时间：{formatFullTime(task.startTime)}</div>}
              {task.completeTime && <div>完成时间：{formatFullTime(task.completeTime)}</div>}
              {task.dueDate && <div>截止时间：{formatFullTime(task.dueDate)}</div>}
            </div>
          </div>
        ) : (
          /* 收起时显示简化信息 */
          <>
            {task.description && (
              <p className="text-xs leading-5 text-gray-600 mb-2 line-clamp-2">{task.description}</p>
            )}
          </>
        )}

        {task.labels.length > 0 && !isExpanded && (
          <div className="flex flex-wrap gap-1 mb-2">
            {task.labels.slice(0, 2).map((label) => {
              if (['todo', 'in-progress', 'review', 'done', 'P0', 'P1', 'P2', 'P3'].includes(label)) return null
              return (
                <span key={label} className="px-2 py-0.5 text-[11px] bg-slate-100 text-slate-600 rounded-full font-medium">
                  {label}
                </span>
              )
            }).filter(Boolean)}
            {task.labels.filter((l) =>
              !['todo', 'in-progress', 'review', 'done', 'P0', 'P1', 'P2', 'P3'].includes(l)
            ).length > 2 && (
              <span className="px-2 py-0.5 text-[11px] bg-slate-50 text-slate-400 rounded-full">
                +{task.labels.filter((l) =>
                  !['todo', 'in-progress', 'review', 'done', 'P0', 'P1', 'P2', 'P3'].includes(l)
                ).length - 2}
              </span>
            )}
          </div>
        )}

        {/* Subagent 分配信息 - 优先显示 */}
        {activeExecutorLabel && (
          <div className={`mb-2 p-2 rounded-lg border ${
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
                <div
                  className={`text-xs truncate ${isOverdue ? 'text-red-600' : 'text-purple-600'} ${
                    task.activeExecutorLabel ? 'font-medium' : 'font-mono'
                  }`}
                  title={task.activeExecutorLabel || task.activeExecutorId || task.claimedBy || ''}
                >
                  {activeExecutorLabel}
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
                isOverdue ? 'text-red-600 font-medium' : (isDone ? 'text-green-600' : isReview ? 'text-violet-600' : 'text-purple-500')
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
        {(logSummary || (task.comments && task.comments.length > 0)) && !isExpanded && (
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
          ) : !activeExecutorLabel ? (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-xs text-gray-400">?</span>
              </div>
              <span className="text-xs text-gray-400">未分配</span>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {/* JSON-first: 删除按钮 - 仅 todo 状态显示 */}
            {onDelete && task.status === 'todo' && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDelete(task.id, task.title)
                }}
                className="text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                title="删除任务（仅 todo 状态）"
              >
                🗑️ 删除
              </button>
            )}

            {onStatusChange && task.status === 'review' && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onStatusChange(task.id, 'todo')
                  }}
                  className="text-xs font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-2 py-1 rounded transition-colors"
                >
                  驳回 ↺
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onStatusChange(task.id, 'in-progress')
                  }}
                  className="text-xs font-medium text-violet-600 hover:text-violet-700 hover:bg-violet-50 px-2 py-1 rounded transition-colors"
                >
                  重新执行 →
                </button>
              </>
            )}

            {onStatusChange && task.status !== 'done' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const nextStatus =
                    task.status === 'todo'
                      ? 'in-progress'
                      : task.status === 'in-progress'
                        ? 'review'
                        : 'done'
                  onStatusChange(task.id, nextStatus)
                }}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
              >
                {task.status === 'todo' ? '开始 →' : task.status === 'in-progress' ? '提交审核 →' : '审核通过 ✓'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
