import React, { useState, useEffect } from 'react'
import TaskCard from './TaskCard'
import CreateTaskModal from './CreateTaskModal'
import { deleteTask, generateProgressDoc, getProjects, getTasks, getTasksForProjects, updateTask, type Project, type Task } from '../services/taskService'
import { useWebSocket } from '../hooks/useWebSocket'

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
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // PMW-036: 新增任务弹窗状态
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null)
  
  // JSON-first: 生成04进度跟踪状态
  const [generatingProgress, setGeneratingProgress] = useState(false)

  useWebSocket({
    onMessage: (message) => {
      if (message.type === 'TASK_UPDATE') {
        const task = message.task as Task & { deleted?: boolean }
        const nextTask = { ...task, projectId: message.projectId }

        setTasks((currentTasks) => {
          if (task.deleted) {
            return currentTasks.filter((item) => item.id !== task.id)
          }

          const existingIndex = currentTasks.findIndex((item) => item.id === task.id)
          if (existingIndex === -1) {
            if (currentProject !== 'all' && currentProject !== message.projectId) {
              return currentTasks
            }
            return [nextTask, ...currentTasks]
          }

          return currentTasks.map((item) => item.id === task.id ? nextTask : item)
        })

        void refreshProjectCounts(projects)
        return
      }

      if (message.type === 'TASK_CREATED_VIA_DOC' || message.type === 'SAFE_SYNC_COMPLETED') {
        if (currentProject === 'all' || currentProject === message.projectId) {
          void fetchTasks()
        }
        void refreshProjectCounts(projects)
      }
    },
  })

  // 加载项目列表
  useEffect(() => {
    fetchProjects()
  }, [])

  // 当切换项目时，加载对应任务
  useEffect(() => {
    if (currentProject && (currentProject !== 'all' || projects.length > 0)) {
      void fetchTasks()
    }
  }, [currentProject, projects.length])

  const fetchProjects = async () => {
    try {
      const data = await getProjects()
      setProjects(data)
      await refreshProjectCounts(data)
    } catch (err) {
      console.error('Error fetching projects:', err)
    }
  }

  const refreshProjectCounts = async (projectList: Project[]) => {
    if (projectList.length === 0) {
      setTaskCounts({})
      return
    }

    try {
      const allTasks = await getTasksForProjects(projectList)
      const counts = allTasks.reduce<Record<string, number>>((accumulator, task) => {
        if (task.projectId) {
          accumulator[task.projectId] = (accumulator[task.projectId] || 0) + 1
        }
        return accumulator
      }, {})

      setTaskCounts(counts)
    } catch (err) {
      console.error('Error refreshing project counts:', err)
    }
  }

  const fetchTasks = async () => {
    setError(null)
    try {
      setLoading(true)
      if (currentProject === 'all') {
        setTasks(await getTasksForProjects(projects))
        return
      }

      setTasks(await getTasks(currentProject))
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
      const taskProjectId = getTaskProjectId(taskId)
      if (!taskProjectId) {
        throw new Error(`无法确定任务 ${taskId} 所属项目`)
      }

      const updatedTask = await updateTask(taskProjectId, taskId, { status: newStatus })
      setTasks((currentTasks) => currentTasks.map((t) => t.id === taskId ? updatedTask : t))
    } catch (err) {
      console.error('Error updating task:', err)
      alert('更新失败，请重试')
    }
  }


  // PMW-036: 处理新增任务成功
  const handleCreateTaskSuccess = async (taskId: string) => {
    console.log(`✅ Task created via doc: ${taskId}`)
    
    // 设置高亮任务ID
    setHighlightedTaskId(taskId)
    
    // 3秒后取消高亮
    window.setTimeout(() => {
      setHighlightedTaskId(null)
    }, 3000)
    
    // 刷新任务列表（延迟1秒，等待 watcher 触发同步）
    window.setTimeout(() => {
      void fetchTasks()
    }, 1000)
  }

  // ========================================
  // JSON-first: 删除任务（仅 todo 状态）
  // ========================================
  const handleDeleteTask = async (taskId: string) => {
    try {
      const taskProjectId = getTaskProjectId(taskId)
      if (!taskProjectId) {
        throw new Error(`无法确定任务 ${taskId} 所属项目`)
      }

      const result = await deleteTask(taskProjectId, taskId)
      
      if (result.success) {
        // 从本地状态移除任务
        setTasks((currentTasks) => currentTasks.filter(t => t.id !== taskId))
        alert(`✅ 任务 ${taskId} 已删除`)
        setTaskCounts((currentCounts) => ({
          ...currentCounts,
          [taskProjectId]: Math.max(0, (currentCounts[taskProjectId] || 0) - 1),
        }))
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      alert(`❌ 删除失败：${errorMessage}`)
    }
  }

  // ========================================
  // JSON-first: 生成 04-进度跟踪.md
  // ========================================
  const handleGenerateProgress = async () => {
    setGeneratingProgress(true)
    try {
      if (currentProject === 'all') {
        throw new Error('请先选择具体项目，再生成进度文档')
      }

      const projectId = currentProject
      const result = await generateProgressDoc(projectId)
      
      if (result.success) {
        alert(`✅ 进度跟踪文档已生成！\n\n路径: ${projectId}/docs/04-进度跟踪.md\n\n更新内容:\n- ${result.updatedSections?.join('\n- ') || '进度统计已更新'}`)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      alert(`❌ 生成失败：${errorMessage}`)
    } finally {
      setGeneratingProgress(false)
    }
  }

  // 获取当前项目信息（包含 taskPrefix）
  const getCurrentProjectData = () => {
    if (currentProject === 'all') return null
    return projects.find(p => p.id === currentProject)
  }

  const getTaskProjectId = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (task?.projectId) return task.projectId
    return findProjectByTaskPrefix(taskId)?.id
  }

  const getCurrentProjectInfo = () => {
    if (currentProject === 'all') {
      return { name: '全部项目', color: '#6366F1', icon: '📁' }
    }
    return projects.find(p => p.id === currentProject) || { name: '未知项目', color: '#6366F1', icon: '📁' }
  }

  // 根据任务 ID 前缀查找对应的项目
  const findProjectByTaskPrefix = (taskId: string) => {
    return projects.find(p => taskId.startsWith(p.taskPrefix))
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
                {taskCounts[project.id] || 0}
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
        <div className="flex items-center gap-3">
          {/* PMW-036: 新增任务按钮 */}
          {currentProject !== 'all' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all text-sm font-semibold shadow-sm hover:shadow flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              新增任务
            </button>
          )}
          
          {/* JSON-first: 生成04进度跟踪按钮 */}
          {currentProject !== 'all' && (
            <button
              onClick={handleGenerateProgress}
              disabled={generatingProgress}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all text-sm font-semibold shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="生成 04-进度跟踪.md 文档"
            >
              {generatingProgress ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  生成中...
                </>
              ) : (
                <>
                  <span>📊</span>
                  生成进度文档
                </>
              )}
            </button>
          )}

        </div>
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
                  columnTasks.map(task => {
                    const project = currentProject === 'all' ? findProjectByTaskPrefix(task.id) : undefined
                    const isHighlighted = highlightedTaskId === task.id
                    return (
                      <div
                        key={task.id}
                        className={`transition-all duration-500 ${isHighlighted ? 'ring-2 ring-indigo-500 ring-offset-2 rounded-lg' : ''}`}
                      >
                        <TaskCard
                          task={task}
                          projectName={project?.name}
                          projectColor={project?.color}
                          projectIcon={project?.icon}
                          onStatusChange={handleStatusChange}
                          onDelete={handleDeleteTask}
                        />
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
      )}

      {/* PMW-036: 新增任务弹窗 */}
      {showCreateModal && currentProject !== 'all' && (() => {
        const projectData = getCurrentProjectData()
        return projectData ? (
          <CreateTaskModal
            projectId={currentProject}
            projectName={projectData.name}
            taskPrefix={projectData.taskPrefix}
            onClose={() => setShowCreateModal(false)}
            onSuccess={handleCreateTaskSuccess}
          />
        ) : null
      })()}
    </div>
  )
}
