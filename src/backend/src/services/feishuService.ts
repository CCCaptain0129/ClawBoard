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
  private accessToken: string | null = null;
  private tokenExpireTime: number = 0;
  private groupInfoCache: Map<string, FeishuGroupInfo> = new Map();
  // 群组名称映射表：ID -> 友好名称
  private groupNameMap: Map<string, string> = new Map();

  constructor() {
    const config = getConfig();
    if (config.feishu?.appId && config.feishu?.appSecret) {
      this.appId = config.feishu.appId;
      this.appSecret = config.feishu.appSecret;
      this.enabled = true;
    } else {
      this.enabled = false;
    }
    // 初始化群组名称映射
    this.loadGroupNameMap();

    if (this.enabled) {
      console.log(`✅ Feishu service enabled with app: ${this.appId}`);
    } else {
      console.log(`⚠️  Feishu service disabled: missing app credentials, will use name mapping`);
    }
  }

  /**
   * 加载群组名称映射表
   * 可以从配置文件读取
   */
  private loadGroupNameMap() {
    try {
      const config = getConfig();
      if (config.feishu?.groupNameMap) {
        Object.entries(config.feishu.groupNameMap).forEach(([id, name]) => {
          this.groupNameMap.set(id, String(name));
        });
        console.log(`✅ Loaded ${this.groupNameMap.size} group name mappings`);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to load group name map:`, error);
    }
  }

  /**
   * 添加或更新群组名称映射
   */
  public setGroupNameMapping(chatId: string, groupName: string): void {
    const normalizedId = chatId.startsWith('chat:') ? chatId.slice(5) : chatId;
    this.groupNameMap.set(normalizedId, groupName);
    console.log(`✅ Set group name mapping: ${normalizedId} -> ${groupName}`);
  }

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
   * 优先使用本地映射表，如果未配置飞书应用则使用映射表
   */
  async getGroupInfo(chatId: string): Promise<FeishuGroupInfo> {
    // 转换 chatId 格式：chat:oc_xxx -> oc_xxx
    const normalizedChatId = chatId.startsWith('chat:') ? chatId.slice(5) : chatId;

    console.log(`\n========== getGroupInfo ==========`);
    console.log(`Fetching group info for: ${chatId}`);
    console.log(`Normalized chat_id: ${normalizedChatId}`);

    // 优先检查本地映射表
    if (this.groupNameMap.has(normalizedChatId)) {
      const groupName = this.groupNameMap.get(normalizedChatId)!;
      console.log(`✅ Found in local mapping: ${groupName}`);
      return {
        name: groupName,
        chat_id: normalizedChatId,
        avatar: '',
        tenant_key: '',
      };
    }

    // 如果未配置飞书应用，返回默认值
    if (!this.enabled || !this.appId || !this.appSecret) {
      console.log(`⚠️  Feishu service not configured. Returning chatId as fallback.`);
      return {
        name: chatId,
        chat_id: normalizedChatId,
        avatar: '',
        tenant_key: '',
      };
    }

    // 调用飞书 API
    try {
      const token = await this.getAccessToken();
      console.log(`Access token: ${token ? 'OK' : 'NULL'}`);

      const url = `${this.baseUrl}/im/v1/chats/${normalizedChatId}`;
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
        console.warn(`⚠️  Feishu API warning: ${data.code} - ${data.msg}`);
        // 如果 API 调用失败，也尝试使用本地映射或返回 chatId
        return {
          name: chatId,
          chat_id: normalizedChatId,
          avatar: '',
          tenant_key: '',
        };
      }

      const groupName = data.data.name || '';
      console.log(`✅ Successfully fetched group name: ${groupName}`);

      // 缓存到本地映射表
      this.groupNameMap.set(normalizedChatId, groupName);

      return {
        name: groupName,
        chat_id: data.data.chat_id || normalizedChatId,
        avatar: data.data.avatar || '',
        tenant_key: data.data.tenant_key || '',
      };
    } catch (error) {
      console.error('❌ Failed to get Feishu group info:', error);
      // 如果出错，返回 chatId
      return {
        name: chatId,
        chat_id: normalizedChatId,
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

  async getCachedGroupInfo(chatId: string): Promise<FeishuGroupInfo> {
    console.log(`\n========== getCachedGroupInfo ==========`);
    console.log(`Chat ID: ${chatId}`);
    console.log(`Cache keys: ${Array.from(this.groupInfoCache.keys()).join(', ')}`);

    if (this.groupInfoCache.has(chatId)) {
      const cached = this.groupInfoCache.get(chatId)!;
      console.log(`✅ Cache HIT: "${cached.name}"`);
      return cached;
    }

    console.log(`🔄 Cache MISS, calling API...`);
    const groupInfo = await this.getGroupInfo(chatId);
    this.groupInfoCache.set(chatId, groupInfo);
    console.log(`📦 Cached result: "${groupInfo.name}"`);
    return groupInfo;
  }
}

export const feishuService = new FeishuService();