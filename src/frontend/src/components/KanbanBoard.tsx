import React, { useState, useEffect } from 'react'
import TaskCard from './TaskCard'

interface Task {
  id: string
  title: string
  description: string
  status: 'todo' | 'in-progress' | 'done'
  priority: 'P1' | 'P2' | 'P3'
  labels: string[]
  assignee: string | null
}

const columns = [
  { 
    id: 'todo', 
    title: '待处理', 
    icon: '⏳', 
    color: 'bg-gradient-to-br from-slate-50 to-slate-100',
    borderColor: 'border-slate-200',
    iconColor: 'text-slate-500'
  },
  { 
    id: 'in-progress', 
    title: '进行中', 
    icon: '🔄', 
    color: 'bg-gradient-to-br from-blue-50 to-blue-100',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-500'
  },
  { 
    id: 'done', 
    title: '已完成', 
    icon: '✅', 
    color: 'bg-gradient-to-br from-green-50 to-green-100',
    borderColor: 'border-green-200',
    iconColor: 'text-green-500'
  },
]

export default function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/tasks/projects/openclaw-visualization/tasks')
      if (!response.ok) throw new Error('Failed to fetch tasks')
      const data = await response.json()
      setTasks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: 'todo' | 'in-progress' | 'done') => {
    try {
      const response = await fetch(
        `http://localhost:3000/api/tasks/projects/openclaw-visualization/tasks/${taskId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }
      )
      
      if (!response.ok) throw new Error('Failed to update task')
      
      const updatedTask = await response.json()
      setTasks(tasks.map(t => t.id === taskId ? updatedTask : t))
    } catch (err) {
      console.error('Error updating task:', err)
      alert('更新失败，请重试')
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await fetch('http://localhost:3000/api/sync/to-markdown/openclaw-visualization', {
        method: 'POST',
      })
      alert('✅ 同步成功！TASKS.md 已更新')
    } catch (err) {
      console.error('Error syncing:', err)
      alert('❌ 同步失败，请重试')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">加载中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">加载失败</h2>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  const todoCount = tasks.filter(t => t.status === 'todo').length
  const inProgressCount = tasks.filter(t => t.status === 'in-progress').length
  const doneCount = tasks.filter(t => t.status === 'done').length
  const total = tasks.length
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <div className="text-3xl font-bold text-gray-900 mb-1">{total}</div>
          <div className="text-sm text-gray-500 font-medium">任务总数</div>
        </div>
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 shadow-sm border border-slate-200">
          <div className="text-3xl font-bold text-gray-900 mb-1">{todoCount}</div>
          <div className="text-sm text-gray-500 font-medium">待处理</div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 shadow-sm border border-blue-200">
          <div className="text-3xl font-bold text-blue-600 mb-1">{inProgressCount}</div>
          <div className="text-sm text-gray-500 font-medium">进行中</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 shadow-sm border border-green-200">
          <div className="text-3xl font-bold text-green-600 mb-1">{doneCount}</div>
          <div className="text-sm text-gray-500 font-medium">已完成</div>
        </div>
      </div>

      {/* 进度条 */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">总体进度</span>
          <span className="text-sm font-bold text-blue-600">{progress}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">任务看板</h2>
          <p className="text-sm text-gray-500 mt-1">Trello 风格的任务管理</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {syncing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              同步中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              同步到 Markdown
            </>
          )}
        </button>
      </div>

      {/* 看板列 */}
      <div className="grid grid-cols-3 gap-5">
        {columns.map(column => {
          const columnTasks = tasks.filter(t => t.status === column.id)
          return (
            <div key={column.id} className={`${column.color} rounded-xl p-4 border ${column.borderColor}`}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">{column.icon}</span>
                <h3 className="font-bold text-gray-900 text-lg">{column.title}</h3>
                <span className={`px-2 py-0.5 bg-white rounded-full text-xs font-semibold ${column.iconColor}`}>
                  {columnTasks.length}
                </span>
              </div>
              
              <div className="space-y-3 min-h-[200px]">
                {columnTasks.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    暂无任务
                  </div>
                ) : (
                  columnTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}