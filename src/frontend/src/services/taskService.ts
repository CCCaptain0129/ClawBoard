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
