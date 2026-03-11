import { Agent } from '../types/agents';
import { agentMonitor, AgentStatus } from './agentMonitor';

export class AgentService {
  async getAllAgents(): Promise<Agent[]> {
    try {
      const agentStatuses = await agentMonitor.getAgentStatus();
      
      const agents = agentStatuses.map(status => {
        console.log(`DEBUG: Mapping agent ${status.id}: groupName = "${status.groupName}"`);
        return {
          id: status.id,
          name: status.name,
          type: status.type as 'direct' | 'group',
          channel: status.channel,
          status: status.status,
          model: status.model,
          tokenUsage: status.tokenUsage,
          lastActive: status.lastActive,  // 使用格式化后的"多久前"
          lastActiveRaw: status.lastActiveRaw,
          lastRun: status.lastRun,
          lastRunRaw: status.lastRunRaw,
          groupName: status.groupName || undefined,  // 将 null 转换为 undefined
        };
      });

      console.log(`DEBUG: Final agents array:`, JSON.stringify(agents.filter(a => a.id.includes('feishu:group')), null, 2));

      return agents;
    } catch (error) {
      console.error('Error fetching agents:', error);
      return [];
    }
  }

  async getAgentById(id: string): Promise<Agent | null> {
    const agents = await this.getAllAgents();
    return agents.find(a => a.id === id) || null;
  }
}