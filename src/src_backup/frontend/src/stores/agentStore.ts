import { create } from 'zustand'

interface Agent {
  id: string
  name: string
  type: string
  channel: string
  status: 'running' | 'stopped' | 'idle'
  model: string
  tokenUsage: {
    input: number
    output: number
    total: number
  }
  lastActive: string
}

interface AgentStore {
  agents: Agent[]
  selectedAgent: Agent | null
  setAgents: (agents: Agent[]) => void
  selectAgent: (agent: Agent | null) => void
  updateAgent: (id: string, updates: Partial<Agent>) => void
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  selectedAgent: null,
  setAgents: (agents) => set({ agents }),
  selectAgent: (agent) => set({ selectedAgent: agent }),
  updateAgent: (id, updates) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),
}))
