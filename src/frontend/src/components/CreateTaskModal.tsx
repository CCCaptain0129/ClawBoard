/**
 * CreateTaskModal - 新增任务弹窗组件
 * 
 * 功能：
 * 1. 输入任务标题、描述、优先级、类别
 * 2. 调用 POST /api/task-doc/:projectId/tasks
 * 3. 成功后回调刷新任务列表
 */

import React, { useState } from 'react'

interface CreateTaskModalProps {
  projectId: string
  projectName: string
  taskPrefix: string
  onClose: () => void
  onSuccess: (taskId: string) => void
}

export default function CreateTaskModal({
  projectId,
  projectName,
  taskPrefix,
  onClose,
  onSuccess
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'P0' | 'P1' | 'P2' | 'P3'>('P2')
  const [category, setCategory] = useState<'main' | 'temp'>('temp')
  const [estimatedTime, setEstimatedTime] = useState('')
  const [dependencies, setDependencies] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      setError('请输入任务标题')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('http://localhost:3000/api/task-doc/' + projectId + '/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          category,
          estimatedTime: estimatedTime.trim() || undefined,
          dependencies: dependencies.trim() ? dependencies.split(',').map(d => d.trim()) : undefined,
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      // 成功
      console.log(`✅ Task created: ${data.taskId}`)
      onSuccess(data.taskId)
      onClose()

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(`创建失败: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const priorityColors = {
    P0: 'bg-red-100 text-red-700 border-red-300',
    P1: 'bg-orange-100 text-orange-700 border-orange-300',
    P2: 'bg-blue-100 text-blue-700 border-blue-300',
    P3: 'bg-gray-100 text-gray-700 border-gray-300',
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✨</span>
              <div>
                <h2 className="text-xl font-bold text-white">新增任务</h2>
                <p className="text-sm text-white/80">
                  {projectName} · {taskPrefix}-XXX
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 任务标题 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              任务标题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入任务标题..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              autoFocus
            />
          </div>

          {/* 任务描述 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              任务描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入任务描述（可选）..."
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
            />
          </div>

          {/* 优先级 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              优先级
            </label>
            <div className="flex gap-2">
              {(['P0', 'P1', 'P2', 'P3'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 font-semibold transition-all ${
                    priority === p
                      ? priorityColors[p]
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              P0=紧急 · P1=重要 · P2=普通 · P3=低优先级
            </p>
          </div>

          {/* 任务类别 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              任务类别
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCategory('temp')}
                className={`flex-1 py-2.5 px-4 rounded-lg border-2 font-medium transition-all flex items-center justify-center gap-2 ${
                  category === 'temp'
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                <span>📌</span>
                <span>临时任务</span>
              </button>
              <button
                type="button"
                onClick={() => setCategory('main')}
                className={`flex-1 py-2.5 px-4 rounded-lg border-2 font-medium transition-all flex items-center justify-center gap-2 ${
                  category === 'main'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                <span>🎯</span>
                <span>主线任务</span>
              </button>
            </div>
          </div>

          {/* 预计时间 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              预计时间
            </label>
            <input
              type="text"
              value={estimatedTime}
              onChange={(e) => setEstimatedTime(e.target.value)}
              placeholder="例如：2小时、1天..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          {/* 依赖任务 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              依赖任务
            </label>
            <input
              type="text"
              value={dependencies}
              onChange={(e) => setDependencies(e.target.value)}
              placeholder={`${taskPrefix}-001, ${taskPrefix}-002（用逗号分隔）`}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-700">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* 提示信息 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2 text-blue-700">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm">
                <p className="font-medium">任务将写入 03-任务分解.md</p>
                <p className="text-blue-600 mt-0.5">看板会在 1-3 秒内自动同步显示</p>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  创建中...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  创建任务
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}