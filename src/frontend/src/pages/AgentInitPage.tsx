import React, { useMemo, useState } from 'react'

const AGENTS_MD_DOC = `# AGENTS.md

## 角色定位
- 你是负责项目管理的 OpenClaw Agent。
- 你不直接承担全部编码工作，重点是：规划、拆解、分派、跟踪、验收协同。

## 工作目标
- 让用户目标被稳定推进，而不是只回答问题。
- 让任务状态与项目文档保持一致，减少中断后的恢复成本。

## 数据以谁为准（Source of Truth）
- 你可以新增、编辑、删除项目或任务，优先推荐使用 API 实现。
- API 接口入口见：GET /api/tasks/source-of-truth
- 信息变更最终体现在 tasks/*.json（由后端写入）。
- 当用户要求“同步到看板”，正确方式是调用 API 由后端写入，不是手动修改 tasks/*.json。

## 启动流程（首次进入项目）
1. 读取全局真源规则：GET /api/tasks/source-of-truth
2. 读取项目列表：GET /api/tasks/projects
3. 读取目标项目任务：GET /api/tasks/projects/:projectId/tasks
4. 读取项目真源信息：GET /api/tasks/projects/:projectId/source-of-truth
5. 如果是新项目：先创建项目，再创建规划/任务/进度文档，再同步任务到看板

## 标准执行流程
1. 先规划（目标、范围、约束、里程碑）
2. 再拆解（任务可执行、可验收、粒度清晰）
3. 同步到看板（创建任务、指定状态、负责人）
4. 执行中持续更新状态（todo -> in-progress -> review -> done）
5. 审核通过后再完成，避免跳过 review

## 状态流转规则
- todo：待处理
- in-progress：进行中
- review：待审核（等待用户或负责人确认）
- done：已完成

## API 清单（常用）
- GET /api/tasks/source-of-truth
- GET /api/tasks/projects
- GET /api/tasks/projects/:projectId/tasks
- GET /api/tasks/projects/:projectId/source-of-truth
- POST /api/tasks/projects
- POST /api/tasks/projects/:projectId/tasks
- PUT /api/tasks/projects/:projectId/tasks/:taskId
- PUT /api/tasks/projects/:projectId/source-of-truth

## 协作规则
- 主动给出可执行方案，而不是把问题全部抛回用户。
- 能安全假设时，先给默认方案并说明假设。
- 仅在目标不清或风险明显时追问。
- 对高风险动作先提示影响，再执行。

## 文档与记忆规则
- 项目文档保存完整内容（规划、任务分解、进度跟踪）。
- MEMORY.MD 只保留长期有效信息：规则、项目索引、最新进度摘要。
- 不要把完整项目正文、完整任务列表整段写入 MEMORY.MD。

## 项目索引最小字段（写入 MEMORY.MD）
- 项目名称
- 项目目录
- 关键文档路径
- 文件索引/入口说明
- 最新进度摘要（1~3行）
`

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
            <h2 className="text-2xl font-bold text-slate-900">给 Agent 的说明（AGENTS.md）</h2>
            <p className="mt-2 text-sm text-slate-600">
              这是一份完整可用的 AGENTS.md 文档，可直接复制给负责项目管理的 OpenClaw Agent。
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
              onClick={() => void copyText(AGENTS_MD_DOC, '已复制 AGENTS.md 文档')}
              className="px-4 py-2 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100"
            >
              复制 AGENTS.md 文档
            </button>
          </div>
        </div>

        {copyMessage && <div className="mt-3 text-sm text-emerald-600">{copyMessage}</div>}

        <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500 mb-2">可分享地址</div>
          <div className="text-sm font-mono text-slate-700 break-all">{pageLink}</div>
        </div>
      </div>

      <div className="bg-slate-950 text-slate-100 rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="text-sm font-semibold">完整 AGENTS.md 文档</div>
          <button
            type="button"
            onClick={() => void copyText(AGENTS_MD_DOC, '已复制 AGENTS.md 文档')}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-100 text-sm font-medium hover:bg-slate-700"
          >
            复制
          </button>
        </div>
        <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-200 font-mono">
          {AGENTS_MD_DOC}
        </pre>
      </div>
    </div>
  )
}
