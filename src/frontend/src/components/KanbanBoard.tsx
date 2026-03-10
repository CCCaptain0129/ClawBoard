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
  { id: 'todo', title: '待处理', icon: '⏳', color: 'bg-gray-50' },
  { id: 'in-progress', title: '进行中', icon: '🔄', color: 'bg-blue-50' },
  { id: 'done', title: '已完成', icon: '✅', color: 'bg-green-50' },
]

export default function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    try {
      await fetch('http://localhost:3000/api/sync/to-markdown/openclaw-visualization', {
        method: 'POST',
      })
      alert('同步成功！TASKS.md 已更新')
    } catch (err) {
      console.error('Error syncing:', err)
      alert('同步失败，请重试')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">加载中...</p>
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

  return (
    <div className="space-y-6">
      {/* 统计信息 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{total}</div>
          <div className="text-sm text-gray-500">任务总数</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{todoCount}</div>
          <div className="text-sm text-gray-500">待处理</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 shadow-sm">
          <div className="text-2xl font-bold text-blue-600">{inProgressCount}</div>
          <div className="text-sm text-gray-500">进行中</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 shadow-sm">
          <div className="text-2xl font-bold text-green-600">{doneCount}</div>
          <div className="text-sm text-gray-500">已完成</div>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">任务看板</h2>
          <p className="text-sm text-gray-500">Trello 风格的任务管理</p>
        </div>
        <button
          onClick={handleSync}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          同步到 Markdown
        </button>
      </div>

      {/* 看板列 */}
      <div className="grid grid-cols-3 gap-4">
        {columns.map(column => {
          const columnTasks = tasks.filter(t => t.status === column.id)
          return (
            <div key={column.id} className={`${column.color} rounded-lg p-4`}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">{column.icon}</span>
                <h3 className="font-semibold text-gray-900">{column.title}</h3>
                <span className="px-2 py-0.5 bg-white text-gray-600 rounded-full text-xs">
                  {columnTasks.length}
                </span>
              </div>
              
              <div className="space-y-3">
                {columnTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}