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

interface Project {
  id: string
  name: string
  description: string
  color: string
  icon: string
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
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<string>('all')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  // 加载项目列表
  useEffect(() => {
    fetchProjects()
  }, [])

  // 当切换项目时，加载对应任务
  useEffect(() => {
    if (currentProject) {
      fetchTasks()
    }
  }, [currentProject])

  const fetchProjects = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/tasks/projects')
      if (!response.ok) throw new Error('Failed to fetch projects')
      const data = await response.json()
      setProjects(data)
    } catch (err) {
      console.error('Error fetching projects:', err)
    }
  }

  const fetchTasks = async () => {
    setError(null)
    try {
      setLoading(true)
      let url = 'http://localhost:3000/api/tasks/projects/openclaw-visualization/tasks'
      
      if (currentProject !== 'all' && currentProject !== 'openclaw-visualization') {
        url = `http://localhost:3000/api/tasks/projects/${currentProject}/tasks`
      }
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // 检查 API 返回的错误信息
      if (data.error) {
        setError(data.error)
        setTasks([])
        return
      }
      
      // 检查数据格式
      if (!Array.isArray(data)) {
        setError('API 返回的数据格式不正确，期望的是数组')
        setTasks([])
        return
      }
      
      setTasks(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`加载任务失败：${errorMessage}`)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: 'todo' | 'in-progress' | 'done') => {
    try {
      const projectId = currentProject === 'all' ? 'openclaw-visualization' : currentProject
      const response = await fetch(
        `http://localhost:3000/api/tasks/projects/${projectId}/tasks/${taskId}`,
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
      const projectId = currentProject === 'all' ? 'openclaw-visualization' : currentProject
      await fetch(`http://localhost:3000/api/sync/to-markdown/${projectId}`, {
        method: 'POST',
      })
      alert(`✅ 同步成功！${projectId}-TASKS.md 已更新`)
    } catch (err) {
      console.error('Error syncing:', err)
      alert('❌ 同步失败，请重试')
    } finally {
      setSyncing(false)
    }
  }

  const getCurrentProjectInfo = () => {
    if (currentProject === 'all') {
      return { name: '全部项目', color: '#6366F1', icon: '📁' }
    }
    return projects.find(p => p.id === currentProject) || { name: '未知项目', color: '#6366F1', icon: '📁' }
  }

  // 错误提示组件
  const ErrorAlert = ({ message, suggestion }: { message: string; suggestion?: string }) => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">加载失败</h3>
          <div className="mt-2 text-sm text-red-700">{message}</div>
          {suggestion && (
            <div className="mt-2 text-sm text-red-600">
              💡 建议：{suggestion}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // 空状态组件
  const EmptyState = () => (
    <div className="text-center py-12">
      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
      <h3 className="mt-2 text-sm font-medium text-gray-900">没有任务</h3>
      <p className="mt-1 text-sm text-gray-500">
        {currentProject === 'all' ? '所有项目都没有任务' : '该项目没有任务'}
      </p>
    </div>
  )

  // 加载状态组件
  const LoadingState = () => (
    <div className="text-center py-12">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      <p className="mt-4 text-sm text-gray-500">加载任务中...</p>
    </div>
  )

  // TASKS.md 按钮组件
  const TASKSButton = ({ projectId }: { projectId: string }) => (
    <button
      onClick={() => window.open(`/tasks/${projectId}-TASKS.md`, '_blank')}
      className="ml-2 px-3 py-1 text-sm bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition-colors"
      title="查看任务列表文档"
    >
      📄 TASKS.md
    </button>
  )

  const todoCount = tasks.filter(t => t.status === 'todo').length
  const inProgressCount = tasks.filter(t => t.status === 'in-progress').length
  const doneCount = tasks.filter(t => t.status === 'done').length
  const total = tasks.length
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0

  const projectInfo = getCurrentProjectInfo()

  return (
    <div className="space-y-6">
      {/* 项目切换 Tab */}
      <div className="bg-white rounded-xl p-2 shadow-sm border border-slate-200">
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setCurrentProject('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              currentProject === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-700 hover:bg-slate-100'
            }`}
          >
            📁 全部项目
          </button>
          
          {projects.map(project => (
            <button
              key={project.id}
              onClick={() => setCurrentProject(project.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                currentProject === project.id
                  ? 'bg-white text-gray-900 shadow-sm border-2'
                  : 'text-gray-700 hover:bg-slate-100'
              }`}
              style={currentProject === project.id ? { borderColor: project.color } : {}}
            >
              <span>{project.icon}</span>
              <span>{project.name}</span>
              <span 
                className="px-1.5 py-0.5 text-xs rounded-full"
                style={{ backgroundColor: `${project.color}20`, color: project.color }}
              >
                {project.id === 'openclaw-visualization' ? 13 : 3}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 项目标题和进度 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
            style={{ backgroundColor: `${projectInfo.color}20` }}
          >
            {projectInfo.icon}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{projectInfo.name}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {currentProject === 'all' ? '查看所有项目的任务' : projectInfo.description}
            </p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing || currentProject === 'all'}
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

      {/* 错误提示、加载状态和空状态 */}
      {error && <ErrorAlert message={error} suggestion="请检查网络连接或刷新页面重试" />}
      
      {loading && <LoadingState />}
      
      {!loading && !error && tasks.length === 0 && <EmptyState />}

      {/* 看板列 */}
      {!loading && !error && tasks.length > 0 && (
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
                      projectName={currentProject === 'all' ? projects.find(p => task.id.startsWith('TASK-') && (
                        (task.id.startsWith('TASK-0') && p.id === 'openclaw-visualization') ||
                        (task.id.startsWith('TASK-1') && p.id === 'example-project-1') ||
                        (task.id.startsWith('TASK-2') && p.id === 'example-project-2')
                      ))?.name : undefined}
                      projectColor={currentProject === 'all' ? projects.find(p => task.id.startsWith('TASK-') && (
                        (task.id.startsWith('TASK-0') && p.id === 'openclaw-visualization') ||
                        (task.id.startsWith('TASK-1') && p.id === 'example-project-1') ||
                        (task.id.startsWith('TASK-2') && p.id === 'example-project-2')
                      ))?.color : undefined}
                      projectIcon={currentProject === 'all' ? projects.find(p => task.id.startsWith('TASK-') && (
                        (task.id.startsWith('TASK-0') && p.id === 'openclaw-visualization') ||
                        (task.id.startsWith('TASK-1') && p.id === 'example-project-1') ||
                        (task.id.startsWith('TASK-2') && p.id === 'example-project-2')
                      ))?.icon : undefined}
                      onStatusChange={handleStatusChange}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}