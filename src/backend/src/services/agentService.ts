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
    // 获取最后活动时间（毫秒时间戳）
    const lastActiveTimestamp = session.updatedAt || Date.now();
    const lastActive = new Date(lastActiveTimestamp).toISOString();
    
    // 计算运行状态
    // 注意：sessions.json 的 updatedAt 是会话配置的最后更新时间
    // 不等于 Agent 的实时运行状态
    // 我们基于最近活动时间的合理性来判断
    let status: 'running' | 'idle' | 'stopped' = 'idle';
    const now = Date.now();
    const inactiveTime = now - lastActiveTimestamp;
    
    // 状态判断规则（更宽松的阈值）：
    // - idle: 默认状态（会话存在，表示曾经活跃过）
    // - running: 非常近期有活动（最近 5 分钟内，表示可能正在处理）
    // - stopped: 长期无活动（超过 24 小时）
    if (inactiveTime < 5 * 60 * 1000) {
      status = 'running';
    } else if (inactiveTime > 24 * 60 * 60 * 1000) {
      status = 'stopped';
    }

    // Token 使用统计
    const totalTokens = session.totalTokens || 0;
    const inputTokens = session.inputTokens || 0;
    const outputTokens = session.outputTokens || totalTokens - inputTokens;

    return {
      id: sessionKey,
      name: this.getAgentName(sessionKey, session),
      type: session.chatType === 'direct' ? '直接对话' : '群组对话',
      channel: this.getAgentChannel(sessionKey, session),
      status: status,
      model: session.model || 'glm-4.7',
      tokenUsage: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens,
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
    // 优先从 deliveryContext 获取
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
    
    // 优先从 lastChannel 获取
    if (session.lastChannel) {
      const channelMap: { [key: string]: string } = {
        'webchat': '网页对话',
        'feishu': '飞书',
        'telegram': 'Telegram',
        'discord': 'Discord',
        'whatsapp': 'WhatsApp',
      };
      return channelMap[session.lastChannel] || session.lastChannel;
    }
    
    // 从 sessionKey 推断
    if (sessionKey.includes('feishu')) {
      return '飞书';
    }
    
    return '网页对话';
  }
}