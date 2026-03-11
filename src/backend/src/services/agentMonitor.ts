import WebSocket from 'ws';
import * as http from 'http';
import { feishuService, FeishuGroupInfo } from './feishuService';

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
  updatedAt?: string;
  updatedAtRaw?: number;
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
  private messageTimestampCache: Map<string, number> = new Map();

  /**
   * 从 sessionFile 读取最后一条消息的时间戳
   */
  private async getLastMessageTimestamp(sessionFilePath: string): Promise<number> {
    // 检查缓存
    if (this.messageTimestampCache.has(sessionFilePath)) {
      const cached = this.messageTimestampCache.get(sessionFilePath)!;
      // 缓存有效期 1 分钟
      if (Date.now() - cached < 60000) {
        return cached;
      }
    }

    try {
      const fs = await import('fs');
      if (!fs.existsSync(sessionFilePath)) {
        return Date.now();
      }

      // 读取最后几行（最多 5 行）来找到最后的消息时间戳
      const fileContent = fs.readFileSync(sessionFilePath, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());

      if (lines.length === 0) {
        return Date.now();
      }

      // 从后往前找，找到第一条有效消息的时间戳
      for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
        try {
          const line = JSON.parse(lines[i]);
          if (line.timestamp) {
            const timestamp = new Date(line.timestamp).getTime();
            if (!isNaN(timestamp) && timestamp > 0) {
              // 缓存结果
              this.messageTimestampCache.set(sessionFilePath, timestamp);
              return timestamp;
            }
          }
        } catch (error) {
          // 跳过无效的 JSON 行
          continue;
        }
      }

      return Date.now();
    } catch (error) {
      console.error(`Error reading session file ${sessionFilePath}:`, error);
      return Date.now();
    }
  }

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

      ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // 处理响应
          if (message.type === 'res' && message.ok && message.payload) {
            clearTimeout(timeout);
            ws.close();
            
            // 解析 Gateway 返回的数据
            const agents = await this.parseGatewayPayload(message.payload);
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

  private async parseGatewayPayload(payload: any): Promise<AgentStatus[]> {
    const agents: AgentStatus[] = [];
    
    // 尝试从 payload 中提取 sessions
    const sessions = payload.sessions || payload;
    
    if (Array.isArray(sessions)) {
      for (const session of sessions) {
        const agent = await this.parseGatewaySession(session);
        agents.push(agent);
      }
    } else if (typeof sessions === 'object') {
      for (const [key, session] of Object.entries(sessions)) {
        const agent = await this.parseGatewaySession(session, key);
        agents.push(agent);
      }
    }
    
    return agents;
  }

  private async parseGatewaySession(session: any, sessionKey?: string): Promise<AgentStatus> {
    const key = sessionKey || session.key || session.id || '';

    // DEBUG: 打印所有飞书群组的 session 数据
    if (key.includes('feishu:group:') || key.includes('oc_')) {
      console.log(`DEBUG: Full session data for ${key}:`, JSON.stringify(session, null, 2));
    }

    // 优先从 sessionFile 读取真实的最后消息时间
    let lastMessageTimestamp = session.updatedAt || Date.now();
    if (session.sessionFile) {
      lastMessageTimestamp = await this.getLastMessageTimestamp(session.sessionFile);
    }

    const lastActive = new Date(lastMessageTimestamp).toISOString();
    const now = Date.now();
    const inactiveTime = now - lastMessageTimestamp;

    // 智能状态判断 - 基于连接状态和真实的消息活动时间
    let status: 'running' | 'idle' | 'stopped' = 'idle';

    // 检查是否有活跃连接
    const hasActiveConnection = session.lastChannel !== undefined ||
                             session.connectionState === 'connected' ||
                             session.status === 'active' ||
                             session.isAlive;

    // 检查是否有定时任务正在运行
    const hasActivePolling = session.polling;

    // 如果有活跃连接或正在轮询，或者1小时内有消息活动，则标记为 running
    if (hasActiveConnection || hasActivePolling || inactiveTime < 60 * 60 * 1000) {
      status = 'running';
    } else if (inactiveTime > 7 * 24 * 60 * 60 * 1000) {
      status = 'stopped';
    }
    
    // Token 使用统计
    const totalTokens = session.totalTokens || 0;
    const inputTokens = session.inputTokens || session.contextTokens || 0;
    const outputTokens = session.outputTokens || (totalTokens - inputTokens);

    // 获取群组名称（如果是飞书群组）
    let groupName = '';
    console.log(`DEBUG: key=${key}, session.to=${session.to}`);

    // 尝试从 key 中提取 chat_id
    let chatId = '';
    if (session.to && session.to.startsWith('chat:oc_')) {
      chatId = session.to;
    } else if (key.includes('feishu:group:oc_')) {
      const match = key.match(/feishu:group:(oc_[a-f0-9]+)/);
      if (match) {
        chatId = `chat:${match[1]}`;
      }
    }

    if (chatId) {
      try {
        const groupInfo = await feishuService.getCachedGroupInfo(chatId);
        groupName = groupInfo.name;
        console.log(`DEBUG: Fetched group info for ${chatId}:`, groupName);
      } catch (error) {
        console.warn(`Failed to fetch group info for ${chatId}:`, error);
      }
    }

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
      updatedAt: session.updatedAt ? this.formatTimeAgo(new Date(session.updatedAt).toISOString()) : undefined,
      updatedAtRaw: session.updatedAt,
      lastRun: session.lastRun ? this.formatTimeAgo(session.lastRun) : undefined,
      lastRunRaw: session.lastRun,
      type: session.chatType === 'direct' ? '直接对话' : '群组对话',
      channel: this.formatChannelName(session),
      groupName: groupName || undefined,
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

  private async getAgentStatusFromFile(): Promise<AgentStatus[]> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const sessionsPath = path.join(process.env.HOME || '', '.openclaw/agents/main/sessions/sessions.json');
      
      const sessionsData = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
      const agents: AgentStatus[] = [];
      
      for (const [key, session] of Object.entries(sessionsData)) {
        const agent = await this.parseFileSession(session as any, key);
        agents.push(agent);
      }
      
      return agents;
    } catch (error) {
      console.error('Error reading sessions from file:', error);
      return [];
    }
  }

  private async parseFileSession(session: any, key: string): Promise<AgentStatus> {
    // 优先从 sessionFile 读取真实的最后消息时间
    let lastMessageTimestamp = session.updatedAt || Date.now();
    if (session.sessionFile) {
      lastMessageTimestamp = await this.getLastMessageTimestamp(session.sessionFile);
    }

    const lastActive = new Date(lastMessageTimestamp).toISOString();
    const now = Date.now();
    const inactiveTime = now - lastMessageTimestamp;

    // 基于真实的消息活动时间判断状态
    let status: 'running' | 'idle' | 'stopped' = 'idle';

    // 1小时内有消息活动，标记为 running
    if (inactiveTime < 60 * 60 * 1000) {
      status = 'running';
    } else if (inactiveTime > 7 * 24 * 60 * 60 * 1000) {
      status = 'stopped';
    }
    
    const totalTokens = session.totalTokens || 0;
    const inputTokens = session.inputTokens || session.contextTokens || 0;
    const outputTokens = session.outputTokens || (totalTokens - inputTokens);

    // 获取群组名称
    let groupName = '';
    if (session.to && session.to.startsWith('chat:oc_')) {
      const chatId = session.to;
      try {
        const groupInfo = await feishuService.getCachedGroupInfo(chatId);
        groupName = groupInfo.name;
      } catch (error) {
        console.warn(`Failed to fetch group info for ${chatId}:`, error);
      }
    }

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
      updatedAt: session.updatedAt ? this.formatTimeAgo(new Date(session.updatedAt).toISOString()) : undefined,
      updatedAtRaw: session.updatedAt,
      lastRun: session.lastRun ? this.formatTimeAgo(session.lastRun) : undefined,
      lastRunRaw: session.lastRun,
      type: session.chatType === 'direct' ? '直接对话' : '群组对话',
      channel: this.formatChannelName(session),
      groupName: groupName || undefined,
    };
  }
}

export const agentMonitor = new OpenClawAgentMonitor();