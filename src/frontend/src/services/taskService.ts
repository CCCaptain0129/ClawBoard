import { buildApiUrl } from '../config'

export interface Task {
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
  dueDate?: string | null
  estimatedTime?: string | null
  projectId?: string
  comments?: any[]
}

export interface Project {
  id: string
  name: string
  description: string
  color: string
  icon: string
  taskPrefix: string
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(fallbackMessage)
  }

  return response.json() as Promise<T>
}

export async function getProjects() {
  const response = await fetch(buildApiUrl('/api/tasks/projects'))
  return parseJsonResponse<Project[]>(response, 'Failed to fetch projects')
}

export async function getTasks(projectId: string) {
  const response = await fetch(buildApiUrl(`/api/tasks/projects/${projectId}/tasks`))
  const tasks = await parseJsonResponse<Task[]>(response, `Failed to fetch tasks for ${projectId}`)
  return tasks.map((task) => ({ ...task, projectId }))
}

export async function getTasksForProjects(projects: Project[]) {
  const taskGroups = await Promise.all(projects.map((project) => getTasks(project.id)))
  return taskGroups.flat()
}

export async function updateTask(projectId: string, taskId: string, updates: any) {
  const response = await fetch(buildApiUrl(`/api/tasks/projects/${projectId}/tasks/${taskId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  const task = await parseJsonResponse<Task>(response, 'Failed to update task')
  return { ...task, projectId }
}

/**
 * JSON-first: 删除任务（仅 todo 状态）
 * 后端会校验状态，非 todo 任务会返回 400
 */
export async function deleteTask(projectId: string, taskId: string) {
  const response = await fetch(buildApiUrl(`/api/tasks/projects/${projectId}/tasks/${taskId}`), {
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
  const response = await fetch(buildApiUrl(`/api/sync/progress-to-doc/${projectId}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to generate progress doc')
  }
  return response.json()
}
