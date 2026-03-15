export interface Agent {
  id: string;
  name: string;
  label?: string;
  type: string;
  channel: string;
  status: 'running' | 'stopped' | 'idle';
  model: string;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  lastActive: string;
  lastActiveRaw?: string;
  lastRun?: string;
  lastRunRaw?: string;
  contextUsage?: {
    used: number;
    max: number;
    percentage: number;
    risk: 'safe' | 'warning' | 'high' | 'overflow';
  };
  groupName?: string;  // 新增：友好的群组名称
}
