import { authFetch, buildApiUrl } from '../config'

export interface Task {
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
  dueDate?: string | null
  estimatedTime?: string | null
  dependencies?: string[]
  contextSummary?: string
  acceptanceCriteria?: string[]
  deliverables?: string[]
  executionMode?: 'manual' | 'auto'
  agentType?: 'general' | 'dev' | 'test' | 'debug'
  blockingReason?: string | null
  projectId?: string
  activeExecutorId?: string | null
  activeExecutorLabel?: string | null
  activeExecutorLastUpdate?: string | null
  comments?: any[]
}

export interface CreateTaskInput {
  title: string
  description?: string
  priority?: 'P0' | 'P1' | 'P2' | 'P3'
  labels?: string[]
  assignee?: string | null
  estimatedTime?: string
  dependencies?: string[]
  contextSummary?: string
  acceptanceCriteria?: string[]
  deliverables?: string[]
  executionMode?: 'manual' | 'auto'
  agentType?: 'general' | 'dev' | 'test' | 'debug'
}

export interface Project {
  id: string
  name: string
  description: string
  status?: string
  leadAgent?: string | null
  color: string
  icon: string
  taskPrefix: string
  createdAt?: string
  updatedAt?: string
}

export interface CreateProjectInput {
  id: string
  name: string
  description?: string
  color?: string
  icon?: string
  taskPrefix?: string
  leadAgent?: string | null
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  status?: string
  color?: string
  icon?: string
  leadAgent?: string | null
}

export interface ExecutionGuide {
  projectId: string
  projectName: string
  docs: {
    planningDoc: string | null
    taskDoc: string | null
    progressDoc: string | null
  }
  startupChecklist: string[]
  subagentDispatchRules: string[]
  suggestedPrompt: string
}

export interface TaskExecutionContext {
  projectId: string
  taskId: string
  projectName: string
  packet: {
    projectId: string
    taskId: string
    taskTitle: string
    taskGoal: string
    projectSummary: string
    hardConstraints: string[]
    taskContextSummary: string
    sourceOfTruthDocs: string[]
    sourceOfTruthFiles: string[]
    fallbackInstructions: string[]
    constraints: string[]
    acceptanceCriteria: string[]
    expectedDeliverables: string[]
    outputLocation: string | null
    handoffNotes: string | null
  }
  prompt: string
  mainAgentChecklist: string[]
}

export interface DispatcherStatus {
  mode: 'manual' | 'auto'
  running: boolean
  pid: number | null
  intervalMs: number
  projectAllowlist: string[]
  pidFile: string
  logFile: string
  updatedAt: string
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const raw = await response.text()
    if (raw) {
      try {
        const error = JSON.parse(raw)
        const details = [error.error, error.details].filter(Boolean).join(': ')
        if (details) {
          throw new Error(details)
        }
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message !== raw) {
          throw parseError
        }

        throw new Error(raw || fallbackMessage)
      }

      throw new Error(fallbackMessage)
    }

    throw new Error(fallbackMessage)
  }

  return response.json() as Promise<T>
}

export async function getProjects() {
  const response = await authFetch(buildApiUrl('/api/tasks/projects'))
  return parseJsonResponse<Project[]>(response, 'Failed to fetch projects')
}

export async function createProject(input: CreateProjectInput) {
  const response = await authFetch(buildApiUrl('/api/tasks/projects'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJsonResponse<Project>(response, 'Failed to create project')
}

export async function updateProject(projectId: string, input: UpdateProjectInput) {
  const response = await authFetch(buildApiUrl(`/api/tasks/projects/${projectId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJsonResponse<Project>(response, 'Failed to update project')
}

export async function getTasks(projectId: string) {
  const response = await authFetch(buildApiUrl(`/api/tasks/projects/${projectId}/tasks`))
  const tasks = await parseJsonResponse<Task[]>(response, `Failed to fetch tasks for ${projectId}`)
  return tasks.map((task) => ({ ...task, projectId }))
}

export async function getTasksForProjects(projects: Project[]) {
  const taskGroups = await Promise.allSettled(projects.map((project) => getTasks(project.id)))
  const failedProjects: string[] = []
  const tasks: Task[] = []

  taskGroups.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      tasks.push(...result.value)
      return
    }

    failedProjects.push(projects[index].name)
  })

  if (failedProjects.length > 0) {
    const failedList = failedProjects.join('、')
    throw new Error(`以下项目加载失败：${failedList}`)
  }

  return tasks
}

export async function updateTask(projectId: string, taskId: string, updates: any) {
  const response = await authFetch(buildApiUrl(`/api/tasks/projects/${projectId}/tasks/${taskId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  const task = await parseJsonResponse<Task>(response, 'Failed to update task')
  return { ...task, projectId }
}

export async function createTask(projectId: string, input: CreateTaskInput) {
  const response = await authFetch(buildApiUrl(`/api/tasks/projects/${projectId}/tasks`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const task = await parseJsonResponse<Task>(response, 'Failed to create task')
  return { ...task, projectId }
}

export async function getExecutionGuide(projectId: string) {
  const response = await authFetch(buildApiUrl(`/api/execution/projects/${projectId}/guide`))
  return parseJsonResponse<ExecutionGuide>(response, `Failed to fetch execution guide for ${projectId}`)
}

export async function getTaskExecutionContext(projectId: string, taskId: string) {
  const response = await authFetch(buildApiUrl(`/api/execution/projects/${projectId}/tasks/${taskId}/context`))
  return parseJsonResponse<TaskExecutionContext>(response, `Failed to fetch execution context for ${taskId}`)
}

/**
 * JSON-first: 删除任务（仅 todo 状态）
 * 后端会校验状态，非 todo 任务会返回 400
 */
export async function deleteTask(projectId: string, taskId: string) {
  const response = await authFetch(buildApiUrl(`/api/tasks/projects/${projectId}/tasks/${taskId}`), {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete task')
  }
  return response.json()
}

/**
 * 生成 04-进度跟踪.md
 */
export async function generateProgressDoc(projectId: string) {
  const response = await authFetch(buildApiUrl(`/api/sync/progress-to-doc/${projectId}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to generate progress doc')
  }
  return response.json()
}

export async function getDispatcherStatus() {
  const response = await authFetch(buildApiUrl('/api/dispatcher/status'))
  return parseJsonResponse<DispatcherStatus>(response, 'Failed to fetch dispatcher status')
}

export async function setDispatcherMode(mode: 'manual' | 'auto', intervalMs?: number) {
  const response = await authFetch(buildApiUrl('/api/dispatcher/mode'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, intervalMs }),
  })
  const data = await parseJsonResponse<{ success: boolean; status: DispatcherStatus }>(
    response,
    'Failed to set dispatcher mode'
  )
  return data.status
}

export async function setProjectDispatcherEnabled(projectId: string, enabled: boolean) {
  const response = await authFetch(buildApiUrl(`/api/dispatcher/projects/${projectId}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
  const data = await parseJsonResponse<{ success: boolean; status: DispatcherStatus }>(
    response,
    'Failed to update project dispatcher status'
  )
  return data.status
}
