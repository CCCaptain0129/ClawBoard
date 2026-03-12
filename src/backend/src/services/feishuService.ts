import * as crypto from 'crypto';
import { getConfig, hasFeishuConfig } from '../config/config';

export interface FeishuGroupInfo {
  name: string;
  chat_id: string;
  avatar: string;
  tenant_key: string;
}

export class FeishuService {
  private appId: string | undefined;
  private appSecret: string | undefined;
  private baseUrl: string = 'https://open.feishu.cn/open-apis';
  private enabled: boolean;

  constructor() {
    const config = getConfig();
    if (config.feishu?.appId && config.feishu?.appSecret) {
      this.appId = config.feishu.appId;
      this.appSecret = config.feishu.appSecret;
      this.enabled = true;
    } else {
      this.enabled = false;
    }
  }
  
  private accessToken: string | null = null;
  private tokenExpireTime: number = 0;

  /**
   * 获取访问令牌
   */
  async getAccessToken(): Promise<string> {
    // 如果未配置飞书应用，抛出错误
    if (!this.enabled || !this.appId || !this.appSecret) {
      throw new Error('Feishu service is not configured. Please set appId and appSecret in config.');
    }
    // 如果 token 还有有效期，直接返回
    if (this.accessToken && Date.now() < this.tokenExpireTime) {
      return this.accessToken;
    }

    try {
      const timestamp = Date.now();
      const signature = this.generateSignature(timestamp);

      const response = await fetch(`${this.baseUrl}/auth/v3/tenant_access_token/internal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          app_id: this.appId,
          app_secret: this.appSecret,
          signature: signature,
          timestamp: timestamp,
          grant_type: 'client_credentials',
        }),
      });

      const text = await response.text();
      console.log(`DEBUG: Feishu token response (${response.status}):`, text.substring(0, 200));

      // 尝试解析 JSON
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error(`Failed to parse JSON response:`, text);
        throw new Error(`Feishu API returned invalid JSON: ${text.substring(0, 100)}`);
      }

      if (data.code !== 0) {
        throw new Error(`Feishu API error: ${data.code} - ${data.msg}`);
      }

      if (!data.tenant_access_token) {
        throw new Error('Feishu API returned no access token');
      }

      this.accessToken = data.tenant_access_token;
      this.tokenExpireTime = Date.now() + (data.expire_in * 1000) - 300000; // 提前 5 分钟刷新

      return this.accessToken!;
    } catch (error) {
      console.error('Failed to get Feishu access token:', error);
      throw error;
    }
  }

  /**
   * 生成签名
   */
  private generateSignature(timestamp: number): string {
    const signString = `${timestamp}\n${this.appSecret}`;
    const hmac = crypto.createHmac('sha256', this.appSecret!);
    return hmac.update(signString).digest('base64');
  }

  /**
   * 获取群组信息
   */
  async getGroupInfo(chatId: string): Promise<FeishuGroupInfo> {
    // 如果未配置飞书应用，返回默认值
    if (!this.enabled || !this.appId || !this.appSecret) {
      return {
        name: chatId,
        chat_id: chatId,
        avatar: '',
        tenant_key: '',
      };
    }

    try {
      console.log(`\n========== Feishu API Call ==========`);
      console.log(`Fetching group info for: ${chatId}`);
      const token = await this.getAccessToken();
      console.log(`Access token: ${token ? 'OK' : 'NULL'}`);

      const url = `${this.baseUrl}/im/v1/chats/${chatId}`;
      console.log(`Request URL: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
      });

      console.log(`Response status: ${response.status}`);

      const text = await response.text();
      console.log(`Response body:`, text);

      const data = JSON.parse(text);

      if (data.code !== 0) {
        console.warn(`Feishu API warning: ${data.code} - ${data.msg}`);
        return {
          name: chatId,
          chat_id: chatId,
          avatar: '',
          tenant_key: '',
        };
      }

      return {
        name: data.data.name || '',
        chat_id: data.data.chat_id || chatId,
        avatar: data.data.avatar || '',
        tenant_key: data.data.tenant_key || '',
      };
    } catch (error) {
      console.error('Failed to get Feishu group info:', error);
      return {
        name: chatId,
        chat_id: chatId,
        avatar: '',
        tenant_key: '',
      };
    }
  }

  /**
   * 从群组 ID 中提取 chat_id
   */
  extractChatId(sessionKey: string): string | null {
    // sessionKey 格式: agent:main:feishu:group:oc_xxx
    if (sessionKey.includes('feishu:group:')) {
      const parts = sessionKey.split(':');
      const groupId = parts.pop() || '';
      return `chat:${groupId}`;
    }
    return null;
  }

  /**
   * 缓存群组信息
   */
  private groupInfoCache: Map<string, FeishuGroupInfo> = new Map();

  async getCachedGroupInfo(chatId: string): Promise<FeishuGroupInfo> {
    console.log(`\n========== getCachedGroupInfo ==========`);
    console.log(`Chat ID: ${chatId}`);
    console.log(`Cache keys: ${Array.from(this.groupInfoCache.keys()).join(', ')}`);

    if (this.groupInfoCache.has(chatId)) {
      const cached = this.groupInfoCache.get(chatId)!;
      console.log(`Cache HIT: ${cached.name}`);
      return cached;
    }

    console.log(`Cache MISS, calling API...`);
    const groupInfo = await this.getGroupInfo(chatId);
    this.groupInfoCache.set(chatId, groupInfo);
    console.log(`API returned: ${groupInfo.name}`);
    return groupInfo;
  }
}

export const feishuService = new FeishuService();