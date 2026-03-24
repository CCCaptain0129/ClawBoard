import React, { useState, useEffect } from 'react'
import TaskCard from './TaskCard'
import CreateTaskModal from './CreateTaskModal'
import CreateProjectModal from './CreateProjectModal'
import { archiveCompletedTasks, deleteTask, dispatchProjectOnce, generateProgressDoc, getDispatcherStatus, getProjects, getTasks, getTasksForProjects, setProjectDispatcherEnabled, updateProject, updateTask, type DispatcherStatus, type Project, type Task } from '../services/taskService'
import { useWebSocket } from '../hooks/useWebSocket'

const columns = [
  { 
    id: 'todo', 
    title: '待处理', 
    icon: '待', 
    panelClass: 'bg-white border-slate-200',
    dotClass: 'bg-slate-400'
  },
  { 
    id: 'in-progress', 
    title: '进行中', 
    icon: '进', 
    panelClass: 'bg-white border-blue-200',
    dotClass: 'bg-blue-500'
  },
  {
    id: 'review',
    title: '待审核',
    icon: '审',
    panelClass: 'bg-white border-violet-200',
    dotClass: 'bg-violet-500'
  },
  { 
    id: 'done', 
    title: '已完成', 
    icon: '完', 
    panelClass: 'bg-white border-emerald-200',
    dotClass: 'bg-emerald-500'
  },
]

export default function TaskBoard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<string>('all')
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  
  // PMW-036: 新增任务弹窗状态
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null)
  const [pendingDeleteTask, setPendingDeleteTask] = useState<{ id: string; title: string } | null>(null)
  const [dispatcherStatus, setDispatcherStatus] = useState<DispatcherStatus | null>(null)
  const [projectDispatchLoading, setProjectDispatchLoading] = useState(false)
  const [redispatchingTaskId, setRedispatchingTaskId] = useState<string | null>(null)
  
  // JSON-first: 生成04进度跟踪状态
  const [generatingProgress, setGeneratingProgress] = useState(false)
  const [archivingCompleted, setArchivingCompleted] = useState(false)
  const visibleProjects = projects.filter((project) => project.status !== 'archived')

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

        void refreshProjectCounts(visibleProjects)
        return
      }

      if (message.type === 'TASK_CREATED_VIA_DOC' || message.type === 'SAFE_SYNC_COMPLETED') {
        if (currentProject === 'all' || currentProject === message.projectId) {
          void fetchTasks()
        }
        void refreshProjectCounts(visibleProjects)
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
  }, [currentProject, visibleProjects.length])

  useEffect(() => {
    if (!currentProject || projects.length === 0) {
      return
    }

    const intervalId = window.setInterval(() => {
      void fetchTasks({ silent: true })
    }, 10000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [currentProject, projects.length])

  useEffect(() => {
    let disposed = false
    const loadDispatcher = async () => {
      try {
        const status = await getDispatcherStatus()
        if (!disposed) {
          setDispatcherStatus(status)
        }
      } catch {
        if (!disposed) {
          setDispatcherStatus(null)
        }
      }
    }

    void loadDispatcher()
    const timer = window.setInterval(() => {
      void loadDispatcher()
    }, 10000)

    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [])

  const fetchProjects = async () => {
    try {
      const data = await getProjects()
      setProjects(data)
      setError(null)
      await refreshProjectCounts(data.filter((project) => project.status !== 'archived'))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('Error fetching projects:', err)
      setError(`加载项目失败：${errorMessage}`)
      setProjects([])
      setTaskCounts({})
    }
  }

  const refreshProjectCounts = async (projectList: Project[]) => {
    if (projectList.length === 0) {
      setTaskCounts({})
      return
    }

    try {
      const activeProjects = projectList.filter((project) => project.status !== 'archived')
      const allTasks = await getTasksForProjects(activeProjects)
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

  const fetchTasks = async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true
    setError(null)
    try {
      if (!silent) {
        setLoading(true)
      }
      if (currentProject === 'all') {
        setTasks(await getTasksForProjects(visibleProjects))
        return
      }

      setTasks(await getTasks(currentProject))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`加载任务失败：${errorMessage}`)
      setTasks([])
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: 'todo' | 'in-progress' | 'review' | 'done') => {
    try {
      const taskProjectId = getTaskProjectId(taskId)
      if (!taskProjectId) {
        throw new Error(`无法确定任务 ${taskId} 所属项目`)
      }

      const currentTask = tasks.find((task) => task.id === taskId)
      const updates: Record<string, unknown> = { status: newStatus }

      if (newStatus === 'todo') {
        updates.claimedBy = null
        updates.blockingReason = null
        updates.startTime = null
        updates.completeTime = null
      } else if (newStatus === 'in-progress') {
        updates.completeTime = null
        updates.blockingReason = null
        if (!currentTask?.startTime) {
          updates.startTime = new Date().toISOString()
        }
      } else if (newStatus === 'review') {
        updates.completeTime = new Date().toISOString()
      } else if (newStatus === 'done') {
        updates.claimedBy = null
        updates.blockingReason = null
        if (!currentTask?.completeTime) {
          updates.completeTime = new Date().toISOString()
        }
      }

      const updatedTask = await updateTask(taskProjectId, taskId, updates)
      setTasks((currentTasks) => currentTasks.map((t) => t.id === taskId ? updatedTask : t))
      setNotice({ type: 'success', message: `任务 ${taskId} 已更新为 ${newStatus}` })
    } catch (err) {
      console.error('Error updating task:', err)
      setNotice({ type: 'error', message: err instanceof Error ? err.message : '更新失败，请重试' })
    }
  }

  const handleAssigneeChange = async (taskId: string, assignee: string | null) => {
    const taskProjectId = getTaskProjectId(taskId)
    if (!taskProjectId) {
      throw new Error(`无法确定任务 ${taskId} 所属项目`)
    }

    const updatedTask = await updateTask(taskProjectId, taskId, { assignee })
    setTasks((currentTasks) => currentTasks.map((task) => (
      task.id === taskId ? updatedTask : task
    )))
    setNotice({
      type: 'success',
      message: assignee ? `任务 ${taskId} 已分配给 ${assignee}` : `任务 ${taskId} 的负责人已清空`,
    })
  }

  const handleRedispatchTask = async (taskId: string) => {
    if (redispatchingTaskId) {
      return
    }

    try {
      setRedispatchingTaskId(taskId)
      const taskProjectId = getTaskProjectId(taskId)
      if (!taskProjectId) {
        throw new Error(`无法确定任务 ${taskId} 所属项目`)
      }

      const currentTask = tasks.find((task) => task.id === taskId)
      if (!currentTask) {
        throw new Error(`任务 ${taskId} 不存在`)
      }

      if (currentTask.status === 'done' || currentTask.status === 'review') {
        throw new Error('仅进行中任务支持重新派发')
      }

      if (currentTask.claimedBy) {
        const releasedTask = await updateTask(taskProjectId, taskId, { claimedBy: null })
        setTasks((currentTasks) => currentTasks.map((task) => (
          task.id === taskId ? releasedTask : task
        )))
      }

      const dispatchResult = await dispatchProjectOnce(taskProjectId, true)
      if (!dispatchResult.dispatched) {
        throw new Error(dispatchResult.reason || '未找到可派发任务')
      }

      if (dispatchResult.taskId !== taskId) {
        setNotice({
          type: 'error',
          message: `任务 ${taskId} 已清理占用，但本次派发命中 ${dispatchResult.taskId}（${dispatchResult.reason}）`,
        })
      } else {
        const subagentHint = dispatchResult.subagentId ? `，subagent: ${dispatchResult.subagentId}` : ''
        setNotice({ type: 'success', message: `任务 ${taskId} 已重新派发${subagentHint}` })
      }
    } catch (err) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : '重新派发失败' })
    } finally {
      setRedispatchingTaskId(null)
    }
  }


  // PMW-036: 处理新增任务成功
  const handleCreateTaskSuccess = async (task: Task) => {
    console.log(`✅ Task created: ${task.id}`)

    setHighlightedTaskId(task.id)
    
    // 3秒后取消高亮
    window.setTimeout(() => {
      setHighlightedTaskId(null)
    }, 3000)

    if (currentProject === 'all' || currentProject === task.projectId) {
      setTasks((currentTasks) => [task, ...currentTasks])
    }

    if (task.projectId) {
      setTaskCounts((currentCounts) => ({
        ...currentCounts,
        [task.projectId!]: (currentCounts[task.projectId!] || 0) + 1,
      }))
    }
  }

  const handleCreateProjectSuccess = async (project: Project) => {
    setProjects((currentProjects) => [...currentProjects, project])
    setTaskCounts((currentCounts) => ({ ...currentCounts, [project.id]: 0 }))
    setCurrentProject(project.id)
    setTasks([])
    setError(null)
    setNotice({ type: 'success', message: `项目 ${project.name} 已创建` })
  }

  const handleArchiveProject = async () => {
    if (currentProject === 'all') return

    const project = projects.find((item) => item.id === currentProject)
    if (!project) return

    if (!window.confirm(`确认归档项目“${project.name}”吗？归档后它会从活跃看板中隐藏，但数据会保留。`)) {
      return
    }

    try {
      const updatedProject = await updateProject(project.id, { status: 'archived' })
      setProjects((currentProjects) => currentProjects.map((item) => (
        item.id === updatedProject.id ? updatedProject : item
      )))
      setCurrentProject('all')
      setTasks([])
      setTaskCounts((currentCounts) => {
        const nextCounts = { ...currentCounts }
        delete nextCounts[updatedProject.id]
        return nextCounts
      })
      setNotice({ type: 'success', message: `项目 ${updatedProject.name} 已归档` })
    } catch (err) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : '归档项目失败' })
    }
  }

  const handleArchiveCompletedTasks = async () => {
    if (currentProject === 'all') return

    const project = projects.find((item) => item.id === currentProject)
    if (!project) return

    if (!window.confirm(`确认归档项目“${project.name}”中所有已完成任务吗？其他任务会保留并继续运行。`)) {
      return
    }

    try {
      setArchivingCompleted(true)
      const result = await archiveCompletedTasks(project.id)

      if (result.archivedCount > 0) {
        setTasks((currentTasks) => currentTasks.filter((task) => task.status !== 'done'))
      }

      setNotice({
        type: 'success',
        message: result.archivedCount > 0
          ? `已归档 ${result.archivedCount} 个已完成任务`
          : '没有可归档的已完成任务',
      })
      await refreshProjectCounts(visibleProjects)
    } catch (err) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : '归档已完成任务失败' })
    } finally {
      setArchivingCompleted(false)
    }
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
        setNotice({ type: 'success', message: `任务 ${taskId} 已删除` })
        setTaskCounts((currentCounts) => ({
          ...currentCounts,
          [taskProjectId]: Math.max(0, (currentCounts[taskProjectId] || 0) - 1),
        }))
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setNotice({ type: 'error', message: `删除失败：${errorMessage}` })
    }
  }

  const requestDeleteTask = (taskId: string, taskTitle: string) => {
    setPendingDeleteTask({ id: taskId, title: taskTitle })
  }

  const confirmDeleteTask = async () => {
    if (!pendingDeleteTask) return
    const { id } = pendingDeleteTask
    setPendingDeleteTask(null)
    await handleDeleteTask(id)
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
        setNotice({
          type: 'success',
          message: `进度文档已生成：${projectId}/docs/04-进度跟踪.md${result.updatedSections?.length ? ` · ${result.updatedSections.join('、')}` : ''}`,
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setNotice({ type: 'error', message: `生成失败：${errorMessage}` })
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

  const currentProjectAutoEnabled = currentProject !== 'all'
    && Boolean(dispatcherStatus?.projectAllowlist?.includes(currentProject))
  const globalAutoEnabled = Boolean(dispatcherStatus?.running && dispatcherStatus?.mode === 'auto')

  const handleToggleProjectDispatch = async () => {
    if (currentProject === 'all' || projectDispatchLoading) return
    try {
      setProjectDispatchLoading(true)
      const nextEnabled = !currentProjectAutoEnabled
      const status = await setProjectDispatcherEnabled(currentProject, nextEnabled)
      setDispatcherStatus(status)
      setNotice({
        type: 'success',
        message: nextEnabled
          ? (globalAutoEnabled
            ? `项目 ${projectInfo.name} 已加入自动调度`
            : `项目 ${projectInfo.name} 已开启 Agent 自动调度。当前全局自动调度未开启，开启后将自动生效。`)
          : `项目 ${projectInfo.name} 已移出自动调度`,
      })
    } catch (err) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : '更新项目自动调度失败' })
    } finally {
      setProjectDispatchLoading(false)
    }
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
      {currentProject !== 'all' && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            创建首个任务
          </button>
          <button
            onClick={handleGenerateProgress}
            disabled={generatingProgress}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generatingProgress ? '生成中...' : '生成进度文档'}
          </button>
        </div>
      )}
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
  const reviewCount = tasks.filter(t => t.status === 'review').length
  const doneCount = tasks.filter(t => t.status === 'done').length
  const total = tasks.length
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0
  const totalTaskCount = Object.values(taskCounts).reduce((sum, count) => sum + count, 0)

  const projectInfo = getCurrentProjectInfo()

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 3000)
    return () => window.clearTimeout(timer)
  }, [notice])

  return (
    <div className="space-y-5">
      {notice && (
        <div className={`rounded-xl border px-4 py-3 text-sm shadow-sm ${
          notice.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          {notice.message}
        </div>
      )}

      {/* 项目切换 Tab */}
      <div className="bg-white rounded-2xl p-2.5 shadow-sm border border-slate-200">
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setCurrentProject('all')}
            className={`h-9 px-4 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              currentProject === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <span>📁 全部项目</span>
              <span className={`px-1.5 py-0.5 text-xs rounded-full ${currentProject === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {totalTaskCount}
              </span>
            </span>
          </button>
          
          {visibleProjects.map(project => (
            <button
              key={project.id}
              onClick={() => setCurrentProject(project.id)}
              className={`h-9 px-4 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                currentProject === project.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: project.color }}
              ></span>
              <span>{project.name}</span>
              <span 
                className={`px-1.5 py-0.5 text-xs rounded-full ${
                  currentProject === project.id
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {taskCounts[project.id] || 0}
              </span>
            </button>
          ))}
          <button
            onClick={() => setShowCreateProjectModal(true)}
            className="h-9 px-4 rounded-lg text-sm font-medium transition-all whitespace-nowrap text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200"
          >
            + 新增项目
          </button>
        </div>
      </div>

      {/* 项目概览与操作 */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ backgroundColor: `${projectInfo.color}20` }}
              >
                {projectInfo.icon}
              </div>
              <div className="min-w-0">
                <h2 className="text-2xl font-bold text-slate-900 truncate">{projectInfo.name}</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {currentProject === 'all' ? '查看所有项目的任务' : projectInfo.description}
                </p>
              </div>
            </div>

            {currentProject !== 'all' && (
              <div className="mt-3">
                <div className="inline-flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleToggleProjectDispatch}
                    disabled={projectDispatchLoading}
                    className="h-8 px-3 rounded-lg text-xs font-semibold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={dispatcherStatus?.running
                      ? '切换当前项目是否自动调度'
                      : '当前全局自动调度关闭，开启后将在全局开启时生效'}
                  >
                    {projectDispatchLoading ? '更新中...' : 'Agent 自动调度'}
                  </button>
                  <span
                    className={`inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold ${
                      currentProjectAutoEnabled
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-slate-100 text-slate-600'
                    }`}
                  >
                    {currentProjectAutoEnabled ? '已开启' : '已关闭'}
                  </span>
                  <span className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-xs text-amber-800">
                    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.72-1.36 3.485 0l5.58 9.918c.75 1.334-.213 2.983-1.742 2.983H4.419c-1.53 0-2.492-1.649-1.742-2.983l5.58-9.918zM11 7a1 1 0 10-2 0v3a1 1 0 102 0V7zm-1 7a1.25 1.25 0 100-2.5A1.25 1.25 0 0010 14z"
                      clipRule="evenodd"
                    />
                    </svg>
                    <span>风险预警：开启后会自动执行符合条件任务，请先确认任务范围与验收标准</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {currentProject !== 'all' && (
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <button
                onClick={() => setShowCreateModal(true)}
                className="h-10 px-4 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors text-sm font-semibold flex items-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                新增任务
              </button>

              <button
                onClick={handleGenerateProgress}
                disabled={generatingProgress}
                className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title="生成 04-进度跟踪.md 文档"
              >
                {generatingProgress ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent"></div>
                    生成中...
                  </>
                ) : (
                  <>
                    <span>📊</span>
                    生成进度文档
                  </>
                )}
              </button>

              <button
                onClick={handleArchiveCompletedTasks}
                disabled={archivingCompleted}
                className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                title="仅归档已完成任务，其他任务保留"
              >
                {archivingCompleted ? '归档中...' : '归档已完成'}
              </button>

              <button
                onClick={handleArchiveProject}
                className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors text-sm font-semibold"
              >
                归档项目
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs font-medium text-slate-500 mb-1">任务总数</div>
            <div className="text-2xl font-bold text-slate-900">{total}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs font-medium text-slate-500 mb-1">待处理</div>
            <div className="text-2xl font-bold text-slate-800">{todoCount}</div>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 px-4 py-3">
            <div className="text-xs font-medium text-slate-500 mb-1">进行中</div>
            <div className="text-2xl font-bold text-blue-700">{inProgressCount}</div>
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50/50 px-4 py-3">
            <div className="text-xs font-medium text-slate-500 mb-1">待审核</div>
            <div className="text-2xl font-bold text-violet-700">{reviewCount}</div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3">
            <div className="text-xs font-medium text-slate-500 mb-1">已完成</div>
            <div className="text-2xl font-bold text-emerald-700">{doneCount}</div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">总体进度</span>
            <span className="text-sm font-bold text-slate-900">{progress}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5">
            <div
              className="bg-slate-900 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* 错误提示、加载状态和空状态 */}
      {error && <ErrorAlert message={error} suggestion="请检查网络连接或刷新页面重试" />}
      
      {loading && <LoadingState />}
      
      {!loading && !error && tasks.length === 0 && <EmptyState />}

      {/* 看板列 */}
      {!loading && !error && tasks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map(column => {
          const columnTasks = tasks.filter(t => t.status === column.id)
          return (
            <div key={column.id} className={`rounded-xl p-4 border ${column.panelClass}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white ${column.dotClass}`}>
                  {column.icon}
                </span>
                <h3 className="font-semibold text-slate-800 text-sm tracking-wide">{column.title}</h3>
                <span className="px-2 py-0.5 bg-slate-100 rounded-full text-xs font-semibold text-slate-600">
                  {columnTasks.length}
                </span>
              </div>
              
              <div className="space-y-2.5 min-h-[140px]">
                {columnTasks.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm">
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
                          projectId={getTaskProjectId(task.id)}
                          projectName={project?.name}
                          projectColor={project?.color}
                          projectIcon={project?.icon}
                          onStatusChange={handleStatusChange}
                          onAssigneeChange={handleAssigneeChange}
                          onRedispatchTask={handleRedispatchTask}
                          isRedispatching={redispatchingTaskId === task.id}
                          onDelete={requestDeleteTask}
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

      {showCreateProjectModal && (
        <CreateProjectModal
          onClose={() => setShowCreateProjectModal(false)}
          onSuccess={handleCreateProjectSuccess}
        />
      )}

      {pendingDeleteTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900">确认删除任务</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                任务“{pendingDeleteTask.title}”将从看板中移除。只有 `todo` 状态任务允许删除。
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDeleteTask(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteTask()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
