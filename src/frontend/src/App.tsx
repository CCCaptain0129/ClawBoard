import React, { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import KanbanBoard from './components/KanbanBoard'
import AgentInitPage from './pages/AgentInitPage'
import { authFetch, buildApiUrl, clearStoredAccessToken, getStoredAccessToken, setStoredAccessToken } from './config'
import {
  getDispatcherPrerequisites,
  getDispatcherStatus,
  setDispatcherMode,
  type DispatcherPrerequisites,
  type DispatcherStatus
} from './services/taskService'
import './index.css'

type AppPage = 'agents' | 'tasks' | 'agent-init'

function parseHashRoute(): { page: AppPage } {
  const rawHash = window.location.hash.replace(/^#/, '')
  if (!rawHash) {
    return { page: 'agents' }
  }

  const [pathPart] = rawHash.split('?')

  if (pathPart === 'tasks') {
    return { page: 'tasks' }
  }

  if (pathPart === 'agent-init') {
    return { page: 'agent-init' }
  }

  return { page: 'agents' }
}

function App() {
  const initialRoute = parseHashRoute()
  const [currentPage, setCurrentPage] = useState<AppPage>(initialRoute.page)
  const [isBackendConnected, setIsBackendConnected] = useState(false)
  const [accessToken, setAccessTokenState] = useState(getStoredAccessToken())
  const [tokenInput, setTokenInput] = useState('')
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [isCheckingToken, setIsCheckingToken] = useState(false)
  const [dispatcherStatus, setDispatcherStatus] = useState<DispatcherStatus | null>(null)
  const [dispatcherPrerequisites, setDispatcherPrerequisites] = useState<DispatcherPrerequisites | null>(null)
  const [dispatcherLoading, setDispatcherLoading] = useState(false)
  const [dispatcherError, setDispatcherError] = useState<string | null>(null)

  useEffect(() => {
    const handleHashChange = () => {
      const route = parseHashRoute()
      setCurrentPage(route.page)
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (!accessToken) {
      return
    }

    let disposed = false
    const loadDispatcher = async () => {
      try {
        const [status, prerequisites] = await Promise.all([
          getDispatcherStatus(),
          getDispatcherPrerequisites(),
        ])
        if (!disposed) {
          setDispatcherStatus(status)
          setDispatcherPrerequisites(prerequisites)
          setDispatcherError(null)
        }
      } catch (error) {
        if (!disposed) {
          setDispatcherError(error instanceof Error ? error.message : '加载调度状态失败')
        }
      }
    }

    void loadDispatcher()
    const timer = window.setInterval(() => {
      void loadDispatcher()
    }, 10000)

    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [accessToken])

  useEffect(() => {
    const handleInvalidToken = () => {
      clearStoredAccessToken()
      setAccessTokenState('')
      setTokenError('访问码无效或已失效，请重新输入。')
    }

    window.addEventListener('board-auth-invalid', handleInvalidToken)
    return () => window.removeEventListener('board-auth-invalid', handleInvalidToken)
  }, [])

  useEffect(() => {
    let isDisposed = false

    const checkHealth = async () => {
      try {
        const response = await fetch(buildApiUrl('/health'))
        if (!isDisposed) {
          setIsBackendConnected(response.ok)
        }
      } catch {
        if (!isDisposed) {
          setIsBackendConnected(false)
        }
      }
    }

    void checkHealth()
    const timer = window.setInterval(() => {
      void checkHealth()
    }, 10000)

    return () => {
      isDisposed = true
      window.clearInterval(timer)
    }
  }, [])

  const navigateTo = (page: AppPage) => {
    if (page === 'agents') {
      window.location.hash = ''
      return
    }

    if (page === 'tasks') {
      window.location.hash = 'tasks'
      return
    }

    window.location.hash = 'agent-init'
  }

  const verifyAndStoreToken = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextToken = tokenInput.trim()
    if (!nextToken) {
      setTokenError('请输入访问码')
      return
    }

    try {
      setIsCheckingToken(true)
      setTokenError(null)
      setStoredAccessToken(nextToken)
      const response = await authFetch(buildApiUrl('/api/tasks/projects'))
      if (!response.ok) {
        throw new Error(response.status === 401 ? '访问码不正确' : `验证失败：HTTP ${response.status}`)
      }
      setAccessTokenState(nextToken)
      setTokenInput('')
    } catch (error) {
      clearStoredAccessToken()
      setAccessTokenState('')
      setTokenError(error instanceof Error ? error.message : '访问码验证失败')
    } finally {
      setIsCheckingToken(false)
    }
  }

  const toggleDispatcherMode = async () => {
    if (!dispatcherStatus || dispatcherLoading) {
      return
    }

    const nextMode = dispatcherStatus.mode === 'auto' ? 'manual' : 'auto'
    if (nextMode === 'auto') {
      const gatewayReady = dispatcherPrerequisites?.gateway.status === 'ready'
      if (!gatewayReady) {
        const gatewayMessage = dispatcherPrerequisites?.gateway.message || 'OpenClaw 网关未就绪'
        const configPath = dispatcherPrerequisites?.gateway.configPath || 'src/backend/config/openclaw.json'
        window.alert(
          `当前无法开启自动调度。\n\n原因：${gatewayMessage}\n\n请先完成配置后再重试。\n配置文件：${configPath}`
        )
        return
      }

      const noProjectEnabled = (dispatcherStatus.projectAllowlist?.length || 0) === 0
      const message = noProjectEnabled
        ? '开启全局自动调度后，系统会尝试自动分派任务。\n\n当前还没有启用任何项目，所以不会立即分派任务。\n下一步：到任务看板打开“本项目自动调度”，再把任务改为“进行中”。\n\n是否继续开启？'
        : '开启全局自动调度后，系统会自动分派“已启用项目”中处于“进行中”的任务给 subagent。\n\n是否继续？'
      const confirmed = window.confirm(message)
      if (!confirmed) {
        return
      }
    }

    try {
      setDispatcherLoading(true)
      const status = await setDispatcherMode(nextMode, dispatcherStatus.intervalMs)
      setDispatcherStatus(status)
      setDispatcherError(null)
    } catch (error) {
      setDispatcherError(error instanceof Error ? error.message : '切换调度模式失败')
    } finally {
      setDispatcherLoading(false)
    }
  }

  const showGatewaySetupHint = () => {
    if (!dispatcherPrerequisites?.gateway) {
      window.alert('OpenClaw 网关状态加载中，请稍后重试。')
      return
    }
    window.alert(
      `OpenClaw 网关配置说明\n\n状态：${dispatcherPrerequisites.gateway.message}\n\n配置文件：${dispatcherPrerequisites.gateway.configPath}\n命令建议：\n1) openclaw gateway start\n2) openclaw gateway status`
    )
  }

  if (!accessToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">输入访问码</h1>
            <p className="mt-2 text-sm text-slate-600">
              这是内部看板。首次访问时输入安装时生成的访问码，之后浏览器会自动记住。
            </p>
            <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              访问码可在服务器项目根目录的 <span className="font-mono">.env</span> 文件中找到，对应字段是 <span className="font-mono">BOARD_ACCESS_TOKEN</span>。
            </div>
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              不确定怎么找？在服务端执行：<span className="font-mono">./clawboard token</span>
            </div>
          </div>
          <form className="space-y-4" onSubmit={verifyAndStoreToken}>
            <input
              type="password"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              placeholder="请输入访问码"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
            />
            {tokenError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {tokenError}
              </div>
            )}
            <button
              type="submit"
              disabled={isCheckingToken}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCheckingToken ? '验证中...' : '进入看板'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 space-y-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">OpenClaw Agent 可视化监控</h1>
              <p className="text-sm text-gray-500 mt-1">实时监控和管理 OpenClaw Agent</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 mr-1">连接状态</span>
              <span className={`inline-flex items-center h-9 px-3 rounded-lg text-sm font-medium border bg-white ${
                isBackendConnected
                  ? 'border-slate-200 text-slate-700'
                  : 'border-rose-200 text-rose-700'
              }`}>
                <span className={`w-2 h-2 rounded-full mr-2 ${
                  isBackendConnected ? 'bg-emerald-500' : 'bg-rose-500'
                }`}></span>
                {isBackendConnected ? '看板服务：在线' : '看板服务：离线'}
              </span>
              <button
                onClick={showGatewaySetupHint}
                className={`inline-flex items-center h-9 px-3 rounded-lg text-sm font-medium border bg-white transition-colors ${
                  dispatcherPrerequisites?.gateway.status === 'ready'
                    ? 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    : dispatcherPrerequisites?.gateway.status === 'connection_failed'
                      ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                      : 'border-rose-200 text-rose-700 hover:bg-rose-50'
                }`}
                title="点击查看 OpenClaw 网关配置说明"
              >
                <span className={`w-2 h-2 rounded-full mr-2 ${
                  dispatcherPrerequisites?.gateway.status === 'ready'
                    ? 'bg-emerald-500'
                    : dispatcherPrerequisites?.gateway.status === 'connection_failed'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                }`}></span>
                {dispatcherPrerequisites?.gateway.status === 'ready'
                  ? 'OpenClaw 网关：已连接'
                  : dispatcherPrerequisites?.gateway.status === 'connection_failed'
                    ? 'OpenClaw 网关：连接失败'
                    : 'OpenClaw 网关：未配置'}
              </button>
              <button
                onClick={toggleDispatcherMode}
                disabled={!dispatcherStatus || dispatcherLoading}
                title={dispatcherStatus?.running ? '已开启，仅调度启用的项目' : '已关闭，仅手动管理任务'}
                className={`h-9 px-3 text-sm font-semibold rounded-lg border bg-white transition-colors ${
                  dispatcherStatus?.mode === 'auto'
                    ? 'border-blue-200 text-blue-700 hover:bg-blue-50'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {dispatcherLoading
                  ? '切换中...'
                  : `自动调度：${dispatcherStatus?.mode === 'auto' ? '开' : '关'}`}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-500">页面导航</div>
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
              <button
                onClick={() => navigateTo('agents')}
                className={`h-9 px-4 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  currentPage === 'agents'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                    : 'bg-transparent text-slate-700 hover:bg-slate-200'
                }`}
              >
                Agent 监控
              </button>
              <button
                onClick={() => navigateTo('tasks')}
                className={`h-9 px-4 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  currentPage === 'tasks'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                    : 'bg-transparent text-slate-700 hover:bg-slate-200'
                }`}
              >
                任务看板
              </button>
              <button
                onClick={() => navigateTo('agent-init')}
                className={`h-9 px-4 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  currentPage === 'agent-init'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                    : 'bg-transparent text-slate-700 hover:bg-slate-200'
                }`}
              >
                给 Agent 的说明
              </button>
            </div>
          </div>
          {dispatcherError && (
            <div className="text-xs text-rose-600">{dispatcherError}</div>
          )}
        </div>
      </header>
      {currentPage === 'tasks' && (
        <div className="max-w-7xl mx-auto px-6 pt-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            自动调度顺序：1) 开启“全局自动调度” 2) 在项目内开启“本项目自动调度” 3) 将任务切换到“进行中”。
          </div>
        </div>
      )}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {currentPage === 'agents' && <Dashboard />}
        {currentPage === 'tasks' && <KanbanBoard />}
        {currentPage === 'agent-init' && <AgentInitPage />}
      </main>
    </div>
  )
}

export default App
