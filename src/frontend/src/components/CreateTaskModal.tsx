/**
 * CreateTaskModal - 新增任务弹窗组件
 * 
 * 功能：
 * 1. 输入任务标题、描述、优先级、类别
 * 2. 调用 POST /api/task-doc/:projectId/tasks
 * 3. 成功后回调刷新任务列表
 */

import React, { useState } from 'react'
import { createTask, type Task } from '../services/taskService'

interface CreateTaskModalProps {
  projectId: string
  projectName: string
  taskPrefix: string
  onClose: () => void
  onSuccess: (task: Task) => void
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
  const [assignee, setAssignee] = useState('')
  const [priority, setPriority] = useState<'P0' | 'P1' | 'P2' | 'P3'>('P2')
  const [category, setCategory] = useState<'main' | 'temp'>('temp')
  const [estimatedTime, setEstimatedTime] = useState('')
  const [dependencies, setDependencies] = useState('')
  const [executionMode, setExecutionMode] = useState<'manual' | 'auto'>('auto')
  const [agentType, setAgentType] = useState<'general' | 'dev' | 'test' | 'debug'>('general')
  const [deliverables, setDeliverables] = useState('')
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('')
  const [contextSummary, setContextSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      setError('请输入任务标题')
      return
    }

    if (!deliverables.trim()) {
      setError('请至少填写一项交付物')
      return
    }

    if (!acceptanceCriteria.trim()) {
      setError('请至少填写一项验收标准')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const task = await createTask(projectId, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        labels: [category === 'main' ? '主线任务' : '临时任务'],
        assignee: assignee.trim() || null,
        estimatedTime: estimatedTime.trim() || undefined,
        dependencies: dependencies.trim() ? dependencies.split(',').map((d) => d.trim()).filter(Boolean) : undefined,
        contextSummary: contextSummary.trim() || undefined,
        deliverables: deliverables.split('\n').map((item) => item.trim()).filter(Boolean),
        acceptanceCriteria: acceptanceCriteria.split('\n').map((item) => item.trim()).filter(Boolean),
        executionMode,
        agentType,
      })

      // 成功
      console.log(`✅ Task created: ${task.id}`)
      onSuccess(task)
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
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto px-4 py-6 sm:items-center">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[calc(100vh-3rem)] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-4 sticky top-0 z-10">
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
        <form onSubmit={handleSubmit} className="max-h-[calc(100vh-8.5rem)] overflow-y-auto">
          <div className="p-6 space-y-5">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              负责人
            </label>
            <input
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="例如：Alice、产品负责人、@zhangsan"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              可填写姓名、角色或团队标识
            </p>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                执行模式
              </label>
              <div className="flex gap-2">
                {([
                  { id: 'auto', label: '可自动派发' },
                  { id: 'manual', label: '人工确认' },
                ] as const).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setExecutionMode(mode.id)}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                      executionMode === mode.id
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agent 类型
              </label>
              <select
                value={agentType}
                onChange={(e) => setAgentType(e.target.value as 'general' | 'dev' | 'test' | 'debug')}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white"
              >
                <option value="general">通用</option>
                <option value="dev">开发</option>
                <option value="test">测试</option>
                <option value="debug">排障</option>
              </select>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              任务上下文摘要
            </label>
            <textarea
              value={contextSummary}
              onChange={(e) => setContextSummary(e.target.value)}
              placeholder="只写完成这项任务必须知道的背景，不要写太长..."
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              交付物 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={deliverables}
              onChange={(e) => setDeliverables(e.target.value)}
              placeholder={'每行一项，例如：\n更新后的组件代码\n接口联调说明'}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              验收标准 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={acceptanceCriteria}
              onChange={(e) => setAcceptanceCriteria(e.target.value)}
              placeholder={'每行一项，例如：\n页面可正常创建任务\n创建后看板立即刷新'}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
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

          {/* Buttons */}
          </div>

          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4">
            <div className="flex gap-3">
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
          </div>
        </form>
      </div>
    </div>
  )
}
