import React, { useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import './index.css'

function App() {
  const [currentPage, setCurrentPage] = useState<'agents' | 'tasks'>('agents')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">OpenClaw Agent 可视化监控</h1>
          <div className="mt-2">
            <span className="text-green-500 text-sm">已连接</span>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setCurrentPage('agents')}
              className={`px-4 py-2 rounded ${
                currentPage === 'agents' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Agent 监控
            </button>
            <button
              onClick={() => setCurrentPage('tasks')}
              className={`px-4 py-2 rounded ${
                currentPage === 'tasks' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              任务看板
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {currentPage === 'agents' ? <Dashboard /> : <div>任务看板开发中...</div>}
      </main>
    </div>
  )
}

export default App
