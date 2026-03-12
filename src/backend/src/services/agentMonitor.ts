import WebSocket from 'ws';
import * as http from 'http';
import { feishuService, FeishuGroupInfo } from './feishuService';
import { getConfig } from '../config/config';

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
  private gatewayUrl: string;
  private token: string;
  private requestId: number = 1;
  private messageTimestampCache: Map<string, number> = new Map();

  constructor() {
    const config = getConfig();
    this.gatewayUrl = config.gateway.url;
    this.token = config.gateway.token;
  }

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

    // DEBUG: 打印所有飞书群组的完整 session 数据
    if (key.includes('feishu') || key.includes('oc_')) {
      console.log(`\n========== DEBUG: Feishu Session ==========`);
      console.log(`Session Key: ${key}`);
      console.log(`Full session data:`, JSON.stringify(session, null, 2));
      console.log(`\nKey fields:`);
      console.log(`  - session.to: ${session.to}`);
      console.log(`  - session.key: ${session.key}`);
      console.log(`  - session.id: ${session.id}`);
      console.log(`  - session.chatId: ${session.chatId}`);
      console.log(`  - session.chat_id: ${session.chat_id}`);
      console.log(`  - session.origin?.id: ${session.origin?.id}`);
      console.log(`  - session.origin?.key: ${session.origin?.key}`);
      console.log(`  - session.deliveryContext?.chat_id: ${session.deliveryContext?.chat_id}`);
      console.log(`============================================\n`);
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
    let chatId = '';

    // 尝试从多个字段中提取 chat_id
    const extractChatId = () => {
      // 1. 直接检查 session.to
      if (session.to && session.to.startsWith('chat:oc_')) {
        console.log(`  → Found chat_id in session.to: ${session.to}`);
        return session.to;
      }

      // 2. 检查 key 格式：agent:main:feishu:group:oc_xxx
      if (key.includes('feishu:group:oc_')) {
        const match = key.match(/feishu:group:(oc_[a-f0-9]+)/);
        if (match) {
          const extracted = `chat:${match[1]}`;
          console.log(`  → Extracted chat_id from key: ${extracted}`);
          return extracted;
        }
      }

      // 3. 检查 session.chatId
      if (session.chatId && session.chatId.startsWith('chat:oc_')) {
        console.log(`  → Found chat_id in session.chatId: ${session.chatId}`);
        return session.chatId;
      }

      // 4. 检查 session.chat_id
      if (session.chat_id && session.chat_id.startsWith('chat:oc_')) {
        console.log(`  → Found chat_id in session.chat_id: ${session.chat_id}`);
        return session.chat_id;
      }

      // 5. 检查 session.chat_id（不带 chat: 前缀的情况）
      if (session.chat_id && session.chat_id.startsWith('oc_')) {
        const extracted = `chat:${session.chat_id}`;
        console.log(`  → Extracted chat_id from session.chat_id: ${extracted}`);
        return extracted;
      }

      // 6. 检查 origin.id 或 origin.key
      if (session.origin?.id && session.origin.id.startsWith('oc_')) {
        const extracted = `chat:${session.origin.id}`;
        console.log(`  → Extracted chat_id from origin.id: ${extracted}`);
        return extracted;
      }
      if (session.origin?.key && session.origin.key.startsWith('chat:oc_')) {
        console.log(`  → Found chat_id in origin.key: ${session.origin.key}`);
        return session.origin.key;
      }

      // 7. 检查 deliveryContext.chat_id
      if (session.deliveryContext?.chat_id && session.deliveryContext.chat_id.startsWith('oc_')) {
        const extracted = `chat:${session.deliveryContext.chat_id}`;
        console.log(`  → Extracted chat_id from deliveryContext.chat_id: ${extracted}`);
        return extracted;
      }

      console.log(`  → No chat_id found in session`);
      return null;
    };

    chatId = extractChatId();

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

    // 获取群组名称 - 使用相同的提取逻辑
    let groupName = '';
    let chatId = '';

    // 尝试从多个字段中提取 chat_id
    const extractChatId = () => {
      if (session.to && session.to.startsWith('chat:oc_')) {
        return session.to;
      }
      if (key.includes('feishu:group:oc_')) {
        const match = key.match(/feishu:group:(oc_[a-f0-9]+)/);
        if (match) return `chat:${match[1]}`;
      }
      if (session.chatId && session.chatId.startsWith('chat:oc_')) {
        return session.chatId;
      }
      if (session.chat_id && session.chat_id.startsWith('oc_')) {
        return `chat:${session.chat_id}`;
      }
      if (session.origin?.id && session.origin.id.startsWith('oc_')) {
        return `chat:${session.origin.id}`;
      }
      if (session.origin?.key && session.origin.key.startsWith('chat:oc_')) {
        return session.origin.key;
      }
      return null;
    };

    chatId = extractChatId();

    console.log(`\n========== fetchGroupName ==========`);
    console.log(`Session Key: ${key}`);
    console.log(`Extracted chatId: ${chatId}`);

    if (chatId) {
      console.log(`Calling feishuService.getCachedGroupInfo...`);
      try {
        const groupInfo = await feishuService.getCachedGroupInfo(chatId);
        groupName = groupInfo.name;
        console.log(`Result: groupName = "${groupName}"`);
      } catch (error) {
        console.warn(`Failed to fetch group info for ${chatId}:`, error);
      }
    } else {
      console.log(`No chatId available, skipping group name fetch`);
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