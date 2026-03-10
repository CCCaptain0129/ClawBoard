import React, { useState } from 'react'
import Dashboard from './pages/Dashboard'
import KanbanBoard from './components/KanbanBoard'
import './index.css'

function App() {
  const [currentPage, setCurrentPage] = useState<'agents' | 'tasks'>('agents')

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
              <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                已连接
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage('agents')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    currentPage === 'agents' 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Agent 监控
                </button>
                <button
                  onClick={() => setCurrentPage('tasks')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    currentPage === 'tasks' 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  任务看板
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {currentPage === 'agents' ? <Dashboard /> : <KanbanBoard />}
      </main>
    </div>
  )
}

export default App
