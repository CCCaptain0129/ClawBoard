import React, { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import KanbanBoard from './components/KanbanBoard'
import AgentInitPage from './pages/AgentInitPage'
import { authFetch, buildApiUrl, clearStoredAccessToken, getStoredAccessToken, setStoredAccessToken } from './config'
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

  useEffect(() => {
    const handleHashChange = () => {
      const route = parseHashRoute()
      setCurrentPage(route.page)
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

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
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">OpenClaw Agent 可视化监控</h1>
              <p className="text-sm text-gray-500 mt-1">实时监控和管理 OpenClaw Agent</p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                isBackendConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                <span className={`w-2 h-2 rounded-full mr-2 ${
                  isBackendConnected ? 'bg-green-500' : 'bg-red-500'
                }`}></span>
                {isBackendConnected ? '服务在线' : '服务离线'}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => navigateTo('agents')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    currentPage === 'agents' 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Agent 监控
                </button>
                <button
                  onClick={() => navigateTo('tasks')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    currentPage === 'tasks' 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  任务看板
                </button>
                <button
                  onClick={() => navigateTo('agent-init')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    currentPage === 'agent-init'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  主 Agent 初始化
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {currentPage === 'agents' && <Dashboard />}
        {currentPage === 'tasks' && <KanbanBoard />}
        {currentPage === 'agent-init' && <AgentInitPage />}
      </main>
    </div>
  )
}

export default App
