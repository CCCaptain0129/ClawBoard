export interface Agent {
  id: string;
  name: string;
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
  groupName?: string;  // 新增：友好的群组名称
}
