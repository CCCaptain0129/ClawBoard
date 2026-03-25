import React, { useMemo, useState } from 'react'

const INSTALL_CMD = 'clawhub install task-dispatch'
const ENV_BLOCK = `export TASKBOARD_API_URL=http://127.0.0.1:3000
export TASKBOARD_ACCESS_TOKEN=<BOARD_ACCESS_TOKEN>`
const CRON_PROMPT = '设置每5分钟自动检查任务看板并派发可执行任务'
const MANUAL_PROMPT = '检查任务看板，派发所有待执行任务'
const AGENTS_DOC_URL = '/AGENTS.md'

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

  async function copyAgentsDoc() {
    try {
      const response = await fetch(AGENTS_DOC_URL)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const content = await response.text()
      await copyText(content, '已复制 AGENTS.md 文档')
    } catch {
      setCopyMessage('复制失败，请下载 AGENTS.md 或手动复制')
      window.setTimeout(() => setCopyMessage(null), 2500)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Agent自动调度</h2>
            <p className="mt-2 text-sm text-slate-600">
              按下面步骤配置后，Agent 将自动检查待办任务、创建 SubAgent 执行，并在完成后推进到 <span className="font-mono">review</span> 状态。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void copyText(pageLink, '已复制页面地址')}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
          >
            复制本页地址
          </button>
          <a
            href={AGENTS_DOC_URL}
            download
            className="px-4 py-2 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100"
          >
            下载 AGENTS.md
          </a>
          <button
            type="button"
            onClick={() => void copyAgentsDoc()}
            className="px-4 py-2 rounded-lg border border-indigo-300 bg-white text-indigo-700 text-sm font-medium hover:bg-indigo-50"
          >
            复制 AGENTS.md
          </button>
        </div>

        {copyMessage && <div className="mt-3 text-sm text-emerald-600">{copyMessage}</div>}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900">1) 前置条件</h3>
        <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-1">
          <li>ClawBoard 服务可用（默认：<span className="font-mono">http://127.0.0.1:3000</span>）</li>
          <li>你可以获取访问令牌 <span className="font-mono">BOARD_ACCESS_TOKEN</span>（来自项目根目录 <span className="font-mono">.env</span>）</li>
          <li>任务需设置为可自动派发：<span className="font-mono">executionMode=auto</span></li>
        </ul>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">2) 安装并配置 task-dispatch</h3>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-800">安装命令</div>
            <button
              type="button"
              onClick={() => void copyText(INSTALL_CMD, '已复制安装命令')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-100"
            >
              复制
            </button>
          </div>
          <pre className="mt-2 text-xs font-mono text-slate-800 overflow-x-auto">{INSTALL_CMD}</pre>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-800">环境变量（在 Agent workspace 中设置）</div>
            <button
              type="button"
              onClick={() => void copyText(ENV_BLOCK, '已复制环境变量配置')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-100"
            >
              复制
            </button>
          </div>
          <pre className="mt-2 text-xs font-mono text-slate-800 overflow-x-auto whitespace-pre-wrap">{ENV_BLOCK}</pre>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">3) 启用自动调度</h3>
        <p className="text-sm text-slate-700">
          给 Agent 下达定时调度指令（推荐每 5 分钟一轮），并可随时手动触发一轮。
        </p>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-800">定时触发指令示例</div>
            <button
              type="button"
              onClick={() => void copyText(CRON_PROMPT, '已复制定时调度指令')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-100"
            >
              复制
            </button>
          </div>
          <pre className="mt-2 text-xs font-mono text-slate-800 overflow-x-auto whitespace-pre-wrap">{CRON_PROMPT}</pre>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-800">手动触发指令示例</div>
            <button
              type="button"
              onClick={() => void copyText(MANUAL_PROMPT, '已复制手动触发指令')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-100"
            >
              复制
            </button>
          </div>
          <pre className="mt-2 text-xs font-mono text-slate-800 overflow-x-auto whitespace-pre-wrap">{MANUAL_PROMPT}</pre>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900">4) 执行与验收流程</h3>
        <ol className="mt-3 list-decimal pl-5 text-sm text-slate-700 space-y-1">
          <li>Agent 筛选可派发任务（通常是 <span className="font-mono">status=todo</span> 且 <span className="font-mono">executionMode=auto</span>）</li>
          <li>创建 SubAgent 执行任务，并更新任务到 <span className="font-mono">in-progress</span></li>
          <li>SubAgent 返回结果后，任务进入 <span className="font-mono">review</span></li>
          <li>用户或 Agent 验收后，将任务更新为 <span className="font-mono">done</span></li>
        </ol>
      </div>

      <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-amber-900">注意事项</h3>
        <ul className="mt-3 list-disc pl-5 text-sm text-amber-900 space-y-1">
          <li><span className="font-mono">executionMode=manual</span> 的任务不会自动派发</li>
          <li>有 <span className="font-mono">assignee</span> 的任务默认不会自动派发</li>
          <li>依赖未完成的任务不会被派发</li>
          <li>完成后先进入 <span className="font-mono">review</span>，通过验收后再 <span className="font-mono">done</span></li>
        </ul>
      </div>
    </div>
  )
}
