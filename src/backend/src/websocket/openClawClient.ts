import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';

export class OpenClawWebSocket {
  private ws: WebSocket | null = null;
  private agents: Map<string, any> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;

  constructor(
    private gatewayUrl: string = 'ws://127.0.0.1:18789',
    private token: string = '57d11dfee3fa0b04fae66be5a74559513c1d5f521ba196f2',
    private onAgentsUpdate?: (agents: any[]) => void
  ) {}

  connect(): void {
    const url = `${this.gatewayUrl}?token=${this.token}`;
    
    try {
      this.ws = new WebSocket(url);
      
      this.ws.on('open', () => {
        console.log('✅ Connected to OpenClaw WebSocket');
        this.reconnectAttempts = 0;
      });
      
      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
      
      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
      
      this.ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
        this.handleReconnect();
      });
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.handleReconnect();
    }
  }

  private handleMessage(message: any): void {
    // 处理不同类型的消息
    switch (message.type) {
      case 'session_update':
      case 'session_list':
      case 'agent_status':
        this.updateAgents(message);
        break;
      case 'message':
      case 'system':
        // 忽略消息类型
        break;
      default:
        // 记录未知消息类型
        if (process.env.NODE_ENV === 'development') {
          console.log('Unknown message type:', message.type);
        }
    }
  }

  private updateAgents(message: any): void {
    // 从消息中提取 Agent 信息
    if (message.sessions) {
      this.agents.clear();
      for (const [key, session] of Object.entries(message.sessions)) {
        this.agents.set(key, session);
      }
      this.notifyUpdate();
    }
  }

  private notifyUpdate(): void {
    if (this.onAgentsUpdate) {
      const agentsArray = Array.from(this.agents.values());
      this.onAgentsUpdate(agentsArray);
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  getAgents(): any[] {
    return Array.from(this.agents.values());
  }
}