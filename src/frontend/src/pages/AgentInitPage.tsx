import React, { useMemo, useState } from 'react'

const AGENT_QUICKSTART_PROMPT = `你正在第一次使用 OpenClaw Agent 可视化监控。

先把自己当成这个系统的普通使用者，而不是系统本身的一部分。

你的目标：
- 理解用户正在推进的项目
- 使用看板管理项目和任务
- 在需要时通过 API 创建、更新和审核任务
- 保持项目文档与看板状态尽量一致

第一次进入时，请按这个顺序工作：
1. 先读取项目列表，确认当前有哪些项目
2. 进入目标项目，读取任务列表和当前状态
3. 如用户正在开启新项目，先建立项目规划、任务分解、进度跟踪三类文档
4. 将拆解后的任务同步到看板
5. 在执行过程中，用 API 更新任务状态，而不是把前端页面当真源

状态规则：
- todo：待处理
- in-progress：进行中
- review：待审核
- done：已完成

真源规则：
- 任务运行态真源是 tasks/*.json
- 前端只是可视化入口
- 项目详细内容保留在项目文件夹和文档中
- MEMORY.MD 只保存长期规则、项目索引和最新进度摘要

推荐 API：
- GET /api/tasks/projects
- GET /api/tasks/projects/:projectId/tasks
- POST /api/tasks/projects
- POST /api/tasks/projects/:projectId/tasks
- PUT /api/tasks/projects/:projectId/tasks/:taskId

协作原则：
- 主动提出更好的方案，而不是把所有问题都抛回给用户
- 能安全假设时，先给出默认方案并说明
- 只有在目标不明或存在明显风险时再追问用户

如果你代表用户管理项目：
- 先规划，再拆解，再同步看板，再跟踪进度
- 不要把项目正文整段复制到 MEMORY.MD
- 如果需要长期记忆，只记录项目名称、项目目录、关键文档路径、文件索引和最新进度摘要`

const QUICK_START_STEPS = [
  '先读取项目列表，确认当前有哪些项目。',
  '进入目标项目，查看任务状态、负责人和当前进度。',
  '如果是新项目，先创建项目，再建立项目规划、任务分解和进度跟踪文档。',
  '把拆解后的任务正式添加到看板，而不是只写在文档里。',
  '在执行过程中通过 API 更新任务状态和负责人。',
]

const BOARD_RULES = [
  'todo：待处理',
  'in-progress：进行中',
  'review：待审核，先验收再完成',
  'done：已完成',
]

const API_GUIDE = [
  '读取项目列表：GET /api/tasks/projects',
  '读取项目任务：GET /api/tasks/projects/:projectId/tasks',
  '创建项目：POST /api/tasks/projects',
  '创建任务：POST /api/tasks/projects/:projectId/tasks',
  '更新任务：PUT /api/tasks/projects/:projectId/tasks/:taskId',
]

const SOURCE_RULES = [
  '前端页面不是状态真源，只是可视化入口。',
  'tasks/*.json 是任务运行态真源。',
  '项目规划、任务分解、进度跟踪保存在项目文档里。',
  '任务状态变化后，应尽量保持文档与看板一致。',
]

const MEMORY_RULES = [
  'MEMORY.MD 只保存长期有效的规则、项目索引和最新进度摘要。',
  '不要把项目正文、完整任务清单或整段进度文档复制进去。',
  '每个项目至少记录：项目名称、项目目录、关键文档路径、文件索引或入口说明、最新进度摘要。',
  '最新进度只写一两行，帮助重启后快速恢复。',
]

const COLLABORATION_RULES = [
  '主动给出最合理的方案和下一步，而不是持续把问题抛给用户。',
  '能安全假设时，先用默认方案推进，并明确说明假设。',
  '只有在目标不清、风险明显或缺少关键资源时再追问用户。',
]

export default function AgentInitPage() {
  const [copyMessage, setCopyMessage] = useState<string | null>(null)

  const pageLink = useMemo(
    () => `${window.location.origin}${window.location.pathname}#agent-init`,
    []
  )

  async function copyText(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopyMessage(message)
      window.setTimeout(() => setCopyMessage(null), 2000)
    } catch {
      setCopyMessage('复制失败，请手动复制页面内容')
      window.setTimeout(() => setCopyMessage(null), 2500)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Agent 使用说明</h2>
            <p className="mt-2 text-sm text-slate-600">
              提供给第一次使用这个看板系统的 Agent，帮助它快速理解软件用途、真源规则和推荐操作方式。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyText(pageLink, '已复制页面地址')}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
            >
              复制页面地址
            </button>
            <button
              type="button"
              onClick={() => void copyText(AGENT_QUICKSTART_PROMPT, '已复制 Agent 使用提示')}
              className="px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100"
            >
              复制使用提示
            </button>
          </div>
        </div>
        {copyMessage && <div className="mt-3 text-sm text-emerald-600">{copyMessage}</div>}
        <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500 mb-2">可分享地址</div>
          <div className="text-sm font-mono text-slate-700 break-all">{pageLink}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="text-sm font-semibold text-slate-900 mb-3">第一次使用时怎么做</div>
          <ul className="space-y-2 text-sm text-slate-700">
            {QUICK_START_STEPS.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-amber-500">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="text-sm font-semibold text-slate-900 mb-3">看板状态说明</div>
          <ul className="space-y-2 text-sm text-slate-700">
            {BOARD_RULES.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-violet-500">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="text-sm font-semibold text-slate-900 mb-3">推荐 API</div>
          <ul className="space-y-2 text-sm text-slate-700">
            {API_GUIDE.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-sky-500">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="text-sm font-semibold text-slate-900 mb-3">真源与文档</div>
          <ul className="space-y-2 text-sm text-slate-700">
            {SOURCE_RULES.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-emerald-500">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="text-sm font-semibold text-slate-900 mb-3">MEMORY.MD 规则</div>
          <ul className="space-y-2 text-sm text-slate-700">
            {MEMORY_RULES.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-indigo-500">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="text-sm font-semibold text-slate-900 mb-3">协作风格</div>
          <ul className="space-y-2 text-sm text-slate-700">
            {COLLABORATION_RULES.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-rose-500">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-slate-950 text-slate-100 rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="text-sm font-semibold">可直接发送给 Agent 的使用提示</div>
          <button
            type="button"
            onClick={() => void copyText(AGENT_QUICKSTART_PROMPT, '已复制 Agent 使用提示')}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-100 text-sm font-medium hover:bg-slate-700"
          >
            复制
          </button>
        </div>
        <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-200 font-mono">
          {AGENT_QUICKSTART_PROMPT}
        </pre>
      </div>
    </div>
  )
}
