export async function getTasks(projectId: string) {
  const response = await fetch(`/api/tasks/projects/${projectId}/tasks`)
  if (!response.ok) throw new Error('Failed to fetch tasks')
  return response.json()
}

export async function updateTask(projectId: string, taskId: string, updates: any) {
  const response = await fetch(`/api/tasks/projects/${projectId}/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!response.ok) throw new Error('Failed to update task')
  return response.json()
}

/**
 * JSON-first: 删除任务（仅 todo 状态）
 * 后端会校验状态，非 todo 任务会返回 400
 */
export async function deleteTask(projectId: string, taskId: string) {
  const response = await fetch(`/api/tasks/projects/${projectId}/tasks/${taskId}`, {
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
  const response = await fetch(`/api/sync/progress-to-doc/${projectId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to generate progress doc')
  }
  return response.json()
}
