import React, { useState } from 'react'
import { createProject, type Project } from '../services/taskService'

interface CreateProjectModalProps {
  onClose: () => void
  onSuccess: (project: Project) => void
}

const colorOptions = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#14B8A6']
const iconOptions = ['📁', '📊', '🚀', '🧩', '🛠️', '🎯', '💡', '🧪']

export default function CreateProjectModal({ onClose, onSuccess }: CreateProjectModalProps) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [taskPrefix, setTaskPrefix] = useState('')
  const [color, setColor] = useState('#3B82F6')
  const [icon, setIcon] = useState('📁')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const normalizeId = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')

  const normalizePrefix = (value: string) =>
    value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 4)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const normalizedId = normalizeId(id)
    const normalizedPrefix = taskPrefix ? normalizePrefix(taskPrefix) : undefined

    if (!normalizedId) {
      setError('请输入有效的项目 ID')
      return
    }

    if (!name.trim()) {
      setError('请输入项目名称')
      return
    }

    if (normalizedPrefix !== undefined && normalizedPrefix.length < 2) {
      setError('任务前缀至少需要 2 位字母或数字')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const project = await createProject({
        id: normalizedId,
        name: name.trim(),
        description: description.trim() || undefined,
        taskPrefix: normalizedPrefix,
        color,
        icon,
      })
      onSuccess(project)
      onClose()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '创建项目失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-sky-500 to-cyan-500 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">新增项目</h2>
              <p className="text-sm text-white/80 mt-1">创建项目并自动生成空任务文件</p>
            </div>
            <button type="button" onClick={onClose} className="text-white/80 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <div className="text-sm font-medium text-gray-700 mb-1.5">项目名称</div>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                placeholder="例如：市场活动看板"
                autoFocus
              />
            </label>
            <label className="block">
              <div className="text-sm font-medium text-gray-700 mb-1.5">项目 ID</div>
              <input
                value={id}
                onChange={(event) => setId(event.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg font-mono"
                placeholder="例如：marketing-board"
              />
            </label>
          </div>

          <label className="block">
            <div className="text-sm font-medium text-gray-700 mb-1.5">项目描述</div>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg resize-none"
              rows={3}
              placeholder="简短描述这个项目的用途"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <div className="text-sm font-medium text-gray-700 mb-1.5">任务前缀</div>
              <input
                value={taskPrefix}
                onChange={(event) => setTaskPrefix(event.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg font-mono"
                placeholder="例如：MKT"
              />
            </label>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1.5">项目图标</div>
              <div className="grid grid-cols-4 gap-2">
                {iconOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setIcon(option)}
                    className={`rounded-lg border px-3 py-2 text-lg ${
                      icon === option ? 'border-sky-400 bg-sky-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700 mb-1.5">项目颜色</div>
            <div className="flex gap-2">
              {colorOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setColor(option)}
                  className={`w-10 h-10 rounded-full border-4 ${
                    color === option ? 'border-gray-900' : 'border-white'
                  }`}
                  style={{ backgroundColor: option }}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-50"
            >
              {loading ? '创建中...' : '创建项目'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
