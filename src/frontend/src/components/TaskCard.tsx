import React from 'react'

interface Task {
  id: string
  title: string
  description: string
  status: 'todo' | 'in-progress' | 'done'
  priority: 'P1' | 'P2' | 'P3'
  labels: string[]
  assignee: string | null
}

interface TaskCardProps {
  task: Task
  onStatusChange?: (taskId: string, newStatus: 'todo' | 'in-progress' | 'done') => void
}

const priorityColors = {
  P1: 'bg-red-100 text-red-700',
  P2: 'bg-yellow-100 text-yellow-700',
  P3: 'bg-gray-100 text-gray-700',
}

const statusColors = {
  todo: 'border-l-4 border-gray-300',
  'in-progress': 'border-l-4 border-blue-500',
  done: 'border-l-4 border-green-500',
}

export default function TaskCard({ task, onStatusChange }: TaskCardProps) {
  return (
    <div className={`bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow ${statusColors[task.status]}`}>
      <div className="flex items-start justify-between mb-2">
        <span className={`px-2 py-1 text-xs font-medium rounded ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
        <span className="text-xs text-gray-400">{task.id}</span>
      </div>
      
      <h3 className="font-medium text-gray-900 mb-2">{task.title}</h3>
      
      {task.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
      )}
      
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.labels.slice(0, 3).map(label => (
            <span key={label} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
              {label}
            </span>
          ))}
          {task.labels.length > 3 && (
            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
              +{task.labels.length - 3}
            </span>
          )}
        </div>
      )}
      
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        {task.assignee ? (
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-xs text-white font-medium">
                {task.assignee.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-xs text-gray-600">{task.assignee}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-400">未分配</span>
        )}
        
        {onStatusChange && task.status !== 'done' && (
          <button
            onClick={() => {
              const nextStatus = task.status === 'todo' ? 'in-progress' : 'done'
              onStatusChange(task.id, nextStatus)
            }}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            {task.status === 'todo' ? '开始 →' : '完成 ✓'}
          </button>
        )}
      </div>
    </div>
  )
}