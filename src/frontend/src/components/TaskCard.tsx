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
  P1: 'bg-red-100 text-red-700 border-red-200',
  P2: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  P3: 'bg-gray-100 text-gray-700 border-gray-200',
}

const statusColors = {
  todo: 'border-l-4 border-gray-400',
  'in-progress': 'border-l-4 border-blue-500',
  done: 'border-l-4 border-green-500',
}

const priorityOrder = { P1: 3, P2: 2, P3: 1 }

export default function TaskCard({ task, onStatusChange }: TaskCardProps) {
  const mainLabel = task.labels.find(l => 
    !['todo', 'in-progress', 'done', 'P1', 'P2', 'P3'].includes(l)
  ) || '其他'
  
  return (
    <div className={`bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${statusColors[task.status]} group`}>
      <div className="flex items-start justify-between mb-2">
        <span className={`px-2 py-0.5 text-xs font-medium rounded border ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
        <span className="text-xs text-gray-400 font-mono">{task.id}</span>
      </div>
      
      <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
        {task.title}
      </h3>
      
      {task.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
      )}
      
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {task.labels.slice(0, 2).map(label => {
            if (['todo', 'in-progress', 'done', 'P1', 'P2', 'P3'].includes(label)) return null
            return (
              <span key={label} className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-medium">
                {label}
              </span>
            )
          }).filter(Boolean)}
          {task.labels.filter(l => 
            !['todo', 'in-progress', 'done', 'P1', 'P2', 'P3'].includes(l)
          ).length > 2 && (
            <span className="px-2 py-0.5 text-xs bg-slate-50 text-slate-400 rounded-full">
              +{task.labels.filter(l => 
                !['todo', 'in-progress', 'done', 'P1', 'P2', 'P3'].includes(l)
              ).length - 2}
            </span>
          )}
        </div>
      )}
      
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        {task.assignee ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
              <span className="text-xs text-white font-semibold">
                {task.assignee.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-xs font-medium text-gray-700">{task.assignee}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-xs text-gray-400">?</span>
            </div>
            <span className="text-xs text-gray-400">未分配</span>
          </div>
        )}
        
        {onStatusChange && task.status !== 'done' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              const nextStatus = task.status === 'todo' ? 'in-progress' : 'done'
              onStatusChange(task.id, nextStatus)
            }}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
          >
            {task.status === 'todo' ? '开始 →' : '完成 ✓'}
          </button>
        )}
      </div>
    </div>
  )
}