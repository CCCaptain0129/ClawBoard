import { Agent } from '../types/agents';
import * as fs from 'fs';
import * as path from 'path';

export class AgentService {
  private sessionsPath = path.join(process.env.HOME || '', '.openclaw/agents/main/sessions/sessions.json');

  async getAllAgents(): Promise<Agent[]> {
    try {
      const sessionsData = JSON.parse(fs.readFileSync(this.sessionsPath, 'utf-8'));
      const agents: Agent[] = [];
      
      for (const [sessionKey, sessionData] of Object.entries(sessionsData)) {
        const session = sessionData as any;
        agents.push(this.transformToAgent(sessionKey, session));
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

  private transformToAgent(sessionKey: string, session: any): Agent {
    // 计算运行状态
    let status = 'stopped';
    const lastActive = session.updatedAt ? new Date(session.updatedAt).toISOString() : new Date().toISOString();
    const now = Date.now();
    const lastActiveTime = session.updatedAt || now;
    const inactiveTime = now - lastActiveTime;
    
    // 如果在最近 5 分钟内有活动，认为是活跃的
    if (inactiveTime < 5 * 60 * 1000) {
      status = 'running';
    } else if (inactiveTime < 30 * 60 * 1000) {
      status = 'idle';
    }

    return {
      id: sessionKey,
      name: this.getAgentName(sessionKey, session),
      type: session.chatType === 'direct' ? '直接对话' : '群组对话',
      channel: this.getAgentChannel(sessionKey, session),
      status: status as 'running' | 'idle' | 'stopped',
      model: session.model || 'glm-4.7',
      tokenUsage: {
        input: session.inputTokens || 0,
        output: session.outputTokens || 0,
        total: session.totalTokens || 0,
      },
      lastActive: lastActive,
      createdAt: session.createdAt ? new Date(session.createdAt).toISOString() : undefined,
    };
  }

  private getAgentName(sessionKey: string, session: any): string {
    if (session.chatType === 'direct') {
      return '主 Agent';
    }
    
    // 从 sessionKey 中提取群组信息
    if (sessionKey.includes('feishu:group')) {
      const parts = sessionKey.split(':');
      const groupId = parts.pop() || '';
      return `飞书群组 ${groupId.slice(-8)}`;
    }
    
    return '未知 Agent';
  }

  private getAgentChannel(sessionKey: string, session: any): string {
    if (session.deliveryContext?.channel) {
      const channelMap: { [key: string]: string } = {
        'webchat': '网页对话',
        'feishu': '飞书',
        'telegram': 'Telegram',
        'discord': 'Discord',
        'whatsapp': 'WhatsApp',
      };
      return channelMap[session.deliveryContext.channel] || session.deliveryContext.channel;
    }
    
    if (sessionKey.includes('feishu')) {
      return '飞书';
    }
    
    return '网页对话';
  }
}