import WebSocket from 'ws';
import * as http from 'http';

export interface AgentStatus {
  id: string;
  name: string;
  status: 'running' | 'idle' | 'stopped';
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
  type: string;
  channel: string;
  groupName?: string;
}

export class OpenClawAgentMonitor {
  private ws: WebSocket | null = null;
  private gatewayUrl: string = 'ws://127.0.0.1:18789';
  private token: string = '57d11dfee3fa0b04fae66be5a74559513c1d5f521ba196f2';
  private isConnected: boolean = false;
  private requestId: number = 1;
  
  // 群组名称映射
  private groupNames: Map<string, string> = new Map([
    ['oc_0754a493527ed8a4b28bd0dffdf802de', 'OpenClaw 集成讨论组'],
    ['oc_2647837964c3cc31f6beb38fc43058d4', '测试群组 A'],
    ['oc_49db5e0b3f3ab28b88d251cd1f59a807', '测试群组 B'],
  ]);

  // 时间格式化
  private formatTimeAgo(timestamp: string): string {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = now - time;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) {
      return '刚刚';
    } else if (minutes < 60) {
      return `${minutes}分钟前`;
    } else if (hours < 24) {
      return `${hours}小时前`;
    } else {
      return `${days}天前`;
    }
  }

  async getAgentStatus(): Promise<AgentStatus[]> {
    // 优先尝试通过 WebSocket 获取实时状态
    const realtimeAgents = await this.getRealtimeAgentStatus();
    if (realtimeAgents.length > 0) {
      return realtimeAgents;
    }

    // 回退到 sessions.json
    return this.getAgentStatusFromFile();
  }

  private async getRealtimeAgentStatus(): Promise<AgentStatus[]> {
    return new Promise((resolve) => {
      const ws = new WebSocket(`${this.gatewayUrl}?token=${this.token}`);
      
      const timeout = setTimeout(() => {
        ws.close();
        resolve([]);
      }, 5000);

      ws.on('open', () => {
        // 发送 sessions.list 请求
        const request = {
          type: 'req',
          id: this.requestId++,
          method: 'sessions.list',
          params: {}
        };
        
        ws.send(JSON.stringify(request));
      });

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // 处理响应
          if (message.type === 'res' && message.ok && message.payload) {
            clearTimeout(timeout);
            ws.close();
            
            // 解析 sessions 数据
            const agents = this.parseSessionsData(message.payload);
            resolve(agents);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        ws.close();
        resolve([]);
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        resolve([]);
      });
    });
  }

  private parseSessionsData(payload: any): AgentStatus[] {
    const agents: AgentStatus[] = [];
    
    // payload 可能包含 sessions 数组
    if (payload.sessions && Array.isArray(payload.sessions)) {
      for (const session of payload.sessions) {
        agents.push(this.parseAgentSession(session, 'main'));
      }
    }
    
    return agents;
  }

  private parseAgentSession(session: any, agentId: string): AgentStatus {
    const lastActiveTimestamp = session.updatedAt || session.lastActive || Date.now();
    const lastActive = new Date(lastActiveTimestamp).toISOString();
    
    // 智能状态判断
    let status: 'running' | 'idle' | 'stopped' = 'idle';
    const now = Date.now();
    const inactiveTime = now - lastActiveTimestamp;
    
    // 如果有 lastRun（最后一次运行时间），使用它来判断
    if (session.lastRun) {
      const lastRunTimestamp = new Date(session.lastRun).getTime();
      const runInactiveTime = now - lastRunTimestamp;
      
      // lastRun 在 2 分钟内，认为是 running（正在运行）
      if (runInactiveTime < 2 * 60 * 1000) {
        status = 'running';
      } else if (runInactiveTime > 1 * 60 * 60 * 1000) {
        status = 'stopped';
      }
    } else {
      // 没有 lastRun，根据 updatedAt 判断
      // 如果 session 有任何活动记录，默认为 idle 而不是 stopped
      // 停止状态只在长期无活动（超过 7 天）时设置
      if (inactiveTime > 7 * 24 * 60 * 60 * 1000) {
        status = 'stopped';
      } else {
        status = 'idle';
      }
    }

    // Token 使用统计
    const totalTokens = session.totalTokens || 0;
    const inputTokens = session.inputTokens || session.contextTokens || 0;
    const outputTokens = session.outputTokens || (totalTokens - inputTokens);

    return {
      id: session.key || session.id || agentId,
      name: this.getAgentName(session),
      status: status,
      model: session.model || 'glm-4.7',
      tokenUsage: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens,
      },
      lastActive: this.formatTimeAgo(lastActive),
      lastActiveRaw: lastActive,
      lastRun: session.lastRun ? this.formatTimeAgo(session.lastRun) : undefined,
      lastRunRaw: session.lastRun,
      type: session.chatType === 'direct' ? '直接对话' : '群组对话',
      channel: this.getAgentChannel(session),
      groupName: this.getGroupFriendlyName(session) || undefined,
    };
  }

  private getAgentName(session: any): string {
    // 优先使用友好的群组名称
    const friendlyName = this.getGroupFriendlyName(session);
    if (friendlyName) {
      return friendlyName;
    }
    
    if (session.chatType === 'direct') {
      return '主 Agent';
    }
    
    const displayName = session.displayName || session.origin?.label || '';
    if (displayName && displayName !== session.key?.split(':').pop()) {
      return displayName;
    }
    
    if (session.key?.includes('feishu:group')) {
      const parts = session.key.split(':');
      const id = parts.pop() || '';
      return `飞书群组 ${id.slice(-8)}`;
    }
    
    return '未知 Agent';
  }

  // 新增：获取友好的群组名称
  private getGroupFriendlyName(session: any): string {
    if (session.chatType === 'direct') {
      return '';
    }
    
    const groupId = session.key?.split(':').pop() || '';
    if (this.groupNames.has(groupId)) {
      return this.groupNames.get(groupId)!;
    }
    
    // 尝试从 displayName 或 origin.label 获取
    const displayName = session.displayName || session.origin?.label || '';
    if (displayName && displayName !== groupId) {
      // 如果显示名称看起来像群组名称（不是 ID），就使用它
      if (!displayName.startsWith('oc_')) {
        return displayName;
      }
    }
    
    return '';
  }

  private getAgentChannel(session: any): string {
    const channelMap: { [key: string]: string } = {
      'webchat': '网页对话',
      'feishu': '飞书',
      'telegram': 'Telegram',
      'discord': 'Discord',
      'whatsapp': 'WhatsApp',
    };
    
    const channel = session.lastChannel || session.channel || session.deliveryContext?.channel;
    return channelMap[channel] || channel || '网页对话';
  }

  private async getAgentStatusFromFile(): Promise<AgentStatus[]> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const sessionsPath = path.join(process.env.HOME || '', '.openclaw/agents/main/sessions/sessions.json');
      
      const sessionsData = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
      const agents: AgentStatus[] = [];
      
      for (const [key, session] of Object.entries(sessionsData)) {
        agents.push(this.parseAgentSession(session as any, key));
      }
      
      return agents;
    } catch (error) {
      console.error('Error reading sessions from file:', error);
      return [];
    }
  }
}

export const agentMonitor = new OpenClawAgentMonitor();