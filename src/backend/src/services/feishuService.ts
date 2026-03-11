import * as crypto from 'crypto';

export interface FeishuGroupInfo {
  name: string;
  chat_id: string;
  avatar: string;
  tenant_key: string;
}

export class FeishuService {
  private appId: string = 'cli_a9285709db78dbef';
  private appSecret: string = 'kSgiXCzM1gUXWcRYzw8TnDhNr4QSwlSoS';
  private baseUrl: string = 'https://open.feishu.cn/open-apis';
  
  private accessToken: string | null = null;
  private tokenExpireTime: number = 0;

  /**
   * 获取访问令牌
   */
  async getAccessToken(): Promise<string> {
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
    const hmac = crypto.createHmac('sha256', this.appSecret);
    return hmac.update(signString).digest('base64');
  }

  /**
   * 获取群组信息
   */
  async getGroupInfo(chatId: string): Promise<FeishuGroupInfo> {
    try {
      const token = await this.getAccessToken();

      const response = await fetch(`${this.baseUrl}/im/v1/chats/${chatId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
      });

      const data = await response.json();

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
    if (this.groupInfoCache.has(chatId)) {
      return this.groupInfoCache.get(chatId)!;
    }

    const groupInfo = await this.getGroupInfo(chatId);
    this.groupInfoCache.set(chatId, groupInfo);

    return groupInfo;
  }
}

export const feishuService = new FeishuService();