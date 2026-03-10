import { Agent } from '../types/agents';
import * as fs from 'fs';
import * as path from 'path';

export class AgentService {
  private sessionsPath = path.join(process.env.HOME || '', '.openclaw/agents/main/sessions/sessions.json');

  async getAllAgents(): Promise<Agent[]> {
    try {
      const sessionsData = JSON.parse(fs.readFileSync(this.sessionsPath, 'utf-8'));
      const agents: Agent[] = [];
      
      for (const [key, value] of Object.entries(sessionsData)) {
        agents.push(this.transformToAgent(key, value as any));
      }
      
      return agents;
    } catch (error) {
      console.error('Error reading sessions:', error);
      return [];
    }
  }

  async getAgentById(id: string): Promise<Agent | null> {
    const agents = await this.getAllAgents();
    return agents.find(a => a.id === id) || null;
  }

  private transformToAgent(key: string, session: any): Agent {
    return {
      id: key,
      name: this.getAgentName(key),
      type: this.getAgentType(key),
      channel: this.getAgentChannel(key),
      status: session.status === 'running' ? 'running' : session.lastActive ? 'idle' : 'stopped',
      model: session.model || 'glm-4.7',
      tokenUsage: {
        input: session.inputTokens || 0,
        output: session.outputTokens || 0,
        total: (session.inputTokens || 0) + (session.outputTokens || 0),
      },
      lastActive: session.lastActive || new Date().toISOString(),
    };
  }

  private getAgentName(key: string): string {
    if (key.includes('feishu')) {
      return '飞书群组 ' + key.split(':').pop()?.slice(-8);
    }
    return '主 Agent';
  }

  private getAgentType(key: string): string {
    return key.includes('feishu') ? '群组对话' : '直接对话';
  }

  private getAgentChannel(key: string): string {
    return key.includes('feishu') ? '飞书' : '网页对话';
  }
}
