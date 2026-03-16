import React, { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import KanbanBoard from './components/KanbanBoard'
import AgentInitPage from './pages/AgentInitPage'
import { buildApiUrl } from './config'
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

  useEffect(() => {
    const handleHashChange = () => {
      const route = parseHashRoute()
      setCurrentPage(route.page)
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
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
