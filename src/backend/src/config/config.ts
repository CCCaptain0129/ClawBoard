import * as fs from 'fs';
import * as path from 'path';

/**
 * OpenClaw 配置接口
 */
export interface OpenClawConfig {
  gateway: {
    url: string;
    token: string;
  };
  feishu?: {
    appId: string;
    appSecret: string;
  };
}

/**
 * 配置加载器
 */
class ConfigLoader {
  private config: OpenClawConfig | null = null;
  private configPath: string;

  constructor() {
    // 配置文件路径：优先使用工作目录，其次是应用目录
    const workingDir = process.cwd();
    const appDir = path.join(__dirname, '../../config');
    this.configPath = this.findConfigFile([workingDir, appDir]);
  }

  /**
   * 查找配置文件
   */
  private findConfigFile(searchDirs: string[]): string {
    for (const dir of searchDirs) {
      const configFile = path.join(dir, 'openclaw.json');
      if (fs.existsSync(configFile)) {
        return configFile;
      }
    }

    // 返回默认路径（即使不存在）
    return path.join(searchDirs[0], 'openclaw.json');
  }

  /**
   * 加载配置
   * 优先级：环境变量 > 配置文件 > 默认值
   */
  load(): OpenClawConfig {
    // 如果已经加载，直接返回
    if (this.config) {
      return this.config;
    }

    // 1. 从配置文件加载
    let fileConfig: Partial<OpenClawConfig> = {};
    if (fs.existsSync(this.configPath)) {
      try {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        fileConfig = JSON.parse(content);
      } catch (error) {
        console.warn(`⚠️  Failed to load config from ${this.configPath}:`, error);
      }
    }

    // 2. 从环境变量覆盖
    const envConfig = {
      gateway: {
        url: process.env.OPENCLAW_GATEWAY_URL,
        token: process.env.OPENCLAW_GATEWAY_TOKEN,
      },
      feishu: {
        appId: process.env.FEISHU_APP_ID,
        appSecret: process.env.FEISHU_APP_SECRET,
      },
    };

    // 3. 合并配置（环境变量 > 配置文件 > 默认值）
    this.config = {
      gateway: {
        url: envConfig.gateway.url || fileConfig.gateway?.url || 'ws://127.0.0.1:18789',
        token: envConfig.gateway.token || fileConfig.gateway?.token || '',
      },
      feishu: {
        appId: envConfig.feishu.appId || fileConfig.feishu?.appId || '',
        appSecret: envConfig.feishu.appSecret || fileConfig.feishu?.appSecret || '',
      },
    };

    // 4. 清理 undefined 值
    if (!this.config.feishu?.appId && !this.config.feishu?.appSecret) {
      delete this.config.feishu;
    }

    // 5. 验证配置
    this.validateConfig();

    console.log(`✅ Loaded OpenClaw config from ${this.getConfigSource()}`);
    return this.config;
  }

  /**
   * 获取当前配置来源
   */
  private getConfigSource(): string {
    if (process.env.OPENCLAW_GATEWAY_TOKEN) {
      return 'environment variables';
    }
    if (fs.existsSync(this.configPath)) {
      return this.configPath;
    }
    return 'default values';
  }

  /**
   * 验证配置
   */
  private validateConfig(): void {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    // Gateway Token 是必填的
    if (!this.config.gateway.token) {
      const errorMsg = [
        '❌ Missing required configuration: OpenClaw Gateway Token',
        '',
        'Please configure your Gateway Token using one of the following methods:',
        '',
        '1. Set environment variable:',
        '   export OPENCLAW_GATEWAY_TOKEN=your-token-here',
        '',
        '2. Create config file:',
        `   cp ${path.join(__dirname, '../../config/openclaw.json.example')} ${this.configPath}`,
        '   Then edit the file and add your token.',
        '',
        '3. Get your token by running:',
        '   openclaw gateway status',
        '',
      ].join('\n');

      throw new Error(errorMsg);
    }

    // 验证 Gateway URL 格式
    if (!this.config.gateway.url.startsWith('ws://') && !this.config.gateway.url.startsWith('wss://')) {
      throw new Error(`Invalid Gateway URL: ${this.config.gateway.url}. Must start with ws:// or wss://`);
    }

    // 如果提供了飞书配置，验证其完整性
    if (this.config.feishu) {
      const { appId, appSecret } = this.config.feishu;
      if ((appId && !appSecret) || (!appId && appSecret)) {
        console.warn('⚠️  Feishu configuration incomplete. Both appId and appSecret are required if one is provided.');
      }
    }
  }

  /**
   * 重新加载配置
   */
  reload(): OpenClawConfig {
    this.config = null;
    return this.load();
  }

  /**
   * 获取当前配置（带类型检查）
   */
  getConfig(): OpenClawConfig {
    if (!this.config) {
      this.load();
    }
    return this.config!;
  }

  /**
   * 检查飞书配置是否可用
   */
  hasFeishuConfig(): boolean {
    const config = this.getConfig();
    return !!(config.feishu?.appId && config.feishu?.appSecret);
  }
}

// 导出单例
export const configLoader = new ConfigLoader();

/**
 * 获取配置的便捷方法
 */
export function getConfig(): OpenClawConfig {
  return configLoader.getConfig();
}

/**
 * 检查飞书配置是否可用
 */
export function hasFeishuConfig(): boolean {
  return configLoader.hasFeishuConfig();
}