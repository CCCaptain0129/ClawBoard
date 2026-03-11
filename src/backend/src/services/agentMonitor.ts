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
  private requestId: number = 1;
  
  // 群组名称映射（临时方案，后续从飞书 API 获取）
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
        console.log('⏱️ WebSocket 超时，回退到文件读取');
        resolve([]);
      }, 10000);

      ws.on('open', () => {
        console.log('✅ Connected to OpenClaw Gateway WebSocket');
        
        // 发送 sessions.list 请求获取所有会话
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
            
            // 解析 Gateway 返回的数据
            const agents = this.parseGatewayPayload(message.payload);
            console.log(`✅ 从 Gateway 获取到 ${agents.length} 个 Agent`);
            resolve(agents);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        console.error('WebSocket error:', error);
        ws.close();
        resolve([]);
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        resolve([]);
      });
    });
  }

  private parseGatewayPayload(payload: any): AgentStatus[] {
    const agents: AgentStatus[] = [];
    
    // 尝试从 payload 中提取 sessions
    const sessions = payload.sessions || payload;
    
    if (Array.isArray(sessions)) {
      for (const session of sessions) {
        agents.push(this.parseGatewaySession(session));
      }
    } else if (typeof sessions === 'object') {
      for (const [key, session] of Object.entries(sessions)) {
        agents.push(this.parseGatewaySession(session, key));
      }
    }
    
    return agents;
  }

  private parseGatewaySession(session: any, sessionKey?: string): AgentStatus {
    const key = sessionKey || session.key || session.id || '';
    
    // 尝试从不同字段获取时间戳
    const lastActiveTimestamp = session.updatedAt || session.lastActive || session.lastMessageTime || Date.now();
    const lastActive = new Date(lastActiveTimestamp).toISOString();
    const now = Date.now();
    const inactiveTime = now - lastActiveTimestamp;
    
    // 智能状态判断 - 基于连接状态和活动时间
    let status: 'running' | 'idle' | 'stopped' = 'idle';
    
    // 检查是否有活跃连接
    const hasActiveConnection = session.lastChannel !== undefined || 
                             session.connectionState === 'connected' ||
                             session.status === 'active' ||
                             session.isAlive;
    
    // 检查是否有定时任务正在运行
    const hasActivePolling = session.polling;
    
    if (hasActiveConnection || hasActivePolling) {
      status = 'running';
    } else if (inactiveTime > 7 * 24 * 60 * 60 * 1000) {
      status = 'stopped';
    }
    
    // Token 使用统计
    const totalTokens = session.totalTokens || 0;
    const inputTokens = session.inputTokens || session.contextTokens || 0;
    const outputTokens = session.outputTokens || (totalTokens - inputTokens);

    return {
      id: key,
      name: this.formatDisplayName(session),
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
      channel: this.formatChannelName(session),
      groupName: this.extractGroupName(session),
    };
  }

  private formatDisplayName(session: any): string {
    const displayName = session.displayName || session.name || session.origin?.label || '';
    
    // 如果 displayName 是自动生成的（如 feishu:g-xxx），使用更友好的名称
    if (displayName.startsWith('feishu:g-oc_')) {
      return displayName.replace('feishu:g-', '飞书群组 ');
    }
    if (displayName.startsWith('webchat:direct')) {
      return '网页对话';
    }
    
    return displayName;
  }

  private formatChannelName(session: any): string {
    const channel = session.lastChannel || session.channel || session.deliveryContext?.channel || session.origin?.provider;
    const channelMap: { [key: string]: string } = {
      'webchat': '网页对话',
      'feishu': '飞书',
      'telegram': 'Telegram',
      'discord': 'Discord',
      'whatsapp': 'WhatsApp',
    };
    return channelMap[channel] || channel || '未知渠道';
  }

  private extractGroupName(session: any): string {
    // 尝试从不同字段获取群组名称
    const displayName = session.displayName || session.name || session.origin?.label || '';
    
    // 优先：如果有 groupName 字段
    if (session.groupName) {
      return session.groupName;
    }
    
    // 其次：从 displayName 提取（如果不是自动生成的）
    if (displayName && !displayName.startsWith('feishu:g-oc_')) {
      return displayName;
    }
    
    // 尝试从 origin.label 或 subject 获取
    if (session.origin?.label && !session.origin.label.startsWith('oc_')) {
      return session.origin.label;
    }
    
    if (session.subject && !session.subject.startsWith('oc_')) {
      return session.subject;
    }
    
    return '';
  }

  private async getAgentStatusFromFile(): Promise<AgentStatus[]> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const sessionsPath = path.join(process.env.HOME || '', '.openclaw/agents/main/sessions/sessions.json');
      
      const sessionsData = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
      const agents: AgentStatus[] = [];
      
      for (const [key, session] of Object.entries(sessionsData)) {
        agents.push(this.parseFileSession(session as any, key));
      }
      
      return agents;
    } catch (error) {
      console.error('Error reading sessions from file:', error);
      return [];
    }
  }

  private parseFileSession(session: any, key: string): AgentStatus {
    const lastActiveTimestamp = session.updatedAt || session.lastActive || Date.now();
    const lastActive = new Date(lastActiveTimestamp).toISOString();
    const now = Date.now();
    const inactiveTime = now - lastActiveTimestamp;
    
    // 默认为 idle，只有在长期无活动时才设为 stopped
    let status: 'running' | 'idle' | 'stopped' = 'idle';
    
    if (inactiveTime > 7 * 24 * 60 * 60 * 1000) {
      status = 'stopped';
    }
    
    const totalTokens = session.totalTokens || 0;
    const inputTokens = session.inputTokens || session.contextTokens || 0;
    const outputTokens = session.outputTokens || (totalTokens - inputTokens);

    return {
      id: key,
      name: this.formatDisplayName(session),
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
      channel: this.formatChannelName(session),
      groupName: this.extractGroupName(session) || undefined,
    };
  }
}

export const agentMonitor = new OpenClawAgentMonitor();