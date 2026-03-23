import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { WebSocket } from 'ws';
import { getWorkspaceRoot } from '../config/paths';

export type DispatcherMode = 'manual' | 'auto';

export interface DispatcherStatus {
  mode: DispatcherMode;
  running: boolean;
  pid: number | null;
  intervalMs: number;
  projectAllowlist: string[];
  pidFile: string;
  logFile: string;
  updatedAt: string;
}

export interface GatewayReadiness {
  status: 'ready' | 'missing_config' | 'connection_failed';
  configured: boolean;
  url: string;
  configPath: string;
  message: string;
}

export interface DispatcherPrerequisites {
  gateway: GatewayReadiness;
  checkedAt: string;
}

interface RuntimeState {
  mode: DispatcherMode;
  intervalMs: number;
  updatedAt: string;
}

const DEFAULT_INTERVAL_MS = 10000;

export class DispatcherControlService {
  private workspaceRoot: string;
  private pidFilePath: string;
  private logFilePath: string;
  private runtimeStatePath: string;
  private dispatcherConfigPath: string;
  private gatewayCache: DispatcherPrerequisites | null = null;
  private gatewayCacheAt = 0;

  constructor() {
    this.workspaceRoot = getWorkspaceRoot();
    this.pidFilePath = path.join(this.workspaceRoot, 'tmp/pm-dispatcher.pid');
    this.logFilePath = path.join(this.workspaceRoot, 'tmp/logs/pm-dispatcher.out');
    this.runtimeStatePath = path.join(this.workspaceRoot, 'tmp/dispatcher-mode.json');
    this.dispatcherConfigPath = path.join(this.workspaceRoot, 'config/pm-agent-dispatcher.json');
  }

  async getPrerequisites(force = false): Promise<DispatcherPrerequisites> {
    const now = Date.now();
    if (!force && this.gatewayCache && now - this.gatewayCacheAt < 10000) {
      return this.gatewayCache;
    }

    const gateway = await this.checkGatewayReadiness();
    const result: DispatcherPrerequisites = {
      gateway,
      checkedAt: new Date().toISOString(),
    };
    this.gatewayCache = result;
    this.gatewayCacheAt = now;
    return result;
  }

  getStatus(): DispatcherStatus {
    const runtime = this.loadRuntimeState();
    const pid = this.readPid();
    const running = pid ? this.isProcessRunning(pid) : false;
    const mode: DispatcherMode = running ? 'auto' : runtime.mode;

    if (pid && !running) {
      this.removePidFile();
    }

    return {
      mode,
      running,
      pid: running ? pid : null,
      intervalMs: runtime.intervalMs,
      projectAllowlist: this.getProjectAllowlist(),
      pidFile: this.pidFilePath,
      logFile: this.logFilePath,
      updatedAt: runtime.updatedAt,
    };
  }

  async setMode(mode: DispatcherMode, intervalMs?: number): Promise<DispatcherStatus> {
    const nextIntervalMs = this.normalizeInterval(intervalMs);
    if (mode === 'auto') {
      await this.start(nextIntervalMs);
      return this.getStatus();
    }

    await this.stop();
    this.saveRuntimeState({
      mode: 'manual',
      intervalMs: nextIntervalMs,
      updatedAt: new Date().toISOString(),
    });
    return this.getStatus();
  }

  async setProjectEnabled(projectId: string, enabled: boolean): Promise<DispatcherStatus> {
    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) {
      throw new Error('projectId is required');
    }

    const dispatcherConfig = this.loadDispatcherConfig();
    const allowlist = new Set(this.getProjectAllowlist());
    if (enabled) {
      allowlist.add(normalizedProjectId);
    } else {
      allowlist.delete(normalizedProjectId);
    }

    dispatcherConfig.projectAllowlist = Array.from(allowlist).sort();
    this.saveDispatcherConfig(dispatcherConfig);

    const status = this.getStatus();
    if (status.running) {
      await this.stop();
      await this.start(status.intervalMs);
    }

    return this.getStatus();
  }

  private async start(intervalMs: number): Promise<void> {
    const status = this.getStatus();
    if (status.running) {
      this.saveRuntimeState({
        mode: 'auto',
        intervalMs,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    fs.mkdirSync(path.dirname(this.pidFilePath), { recursive: true });
    fs.mkdirSync(path.dirname(this.logFilePath), { recursive: true });
    const outFd = fs.openSync(this.logFilePath, 'a');
    const intervalSeconds = Math.max(5, Math.round(intervalMs / 1000));
    const commandArgs = [
      'scripts/pm-agent-dispatcher.mjs',
      '--watch',
      '--interval',
      String(intervalSeconds),
      '--pidfile',
      this.pidFilePath,
    ];

    const child = spawn('node', commandArgs, {
      cwd: this.workspaceRoot,
      detached: true,
      stdio: ['ignore', outFd, outFd],
      env: process.env,
    });
    child.unref();
    fs.closeSync(outFd);

    await this.waitForPidReady(2000);

    this.saveRuntimeState({
      mode: 'auto',
      intervalMs,
      updatedAt: new Date().toISOString(),
    });
  }

  private async stop(): Promise<void> {
    const pid = this.readPid();
    if (!pid) {
      return;
    }

    if (!this.isProcessRunning(pid)) {
      this.removePidFile();
      return;
    }

    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      this.removePidFile();
      return;
    }

    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (!this.isProcessRunning(pid)) {
        this.removePidFile();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // ignore
    }
    this.removePidFile();
  }

  private normalizeInterval(intervalMs?: number): number {
    if (!intervalMs || Number.isNaN(intervalMs)) {
      return this.loadRuntimeState().intervalMs;
    }
    return Math.min(600000, Math.max(5000, Math.round(intervalMs)));
  }

  private resolveGatewayConfig(): { url: string; token: string; configPath: string } {
    const configPath = path.join(this.workspaceRoot, 'src/backend/config/openclaw.json');
    let fileConfig: { gateway?: { url?: string; token?: string } } = {};

    if (fs.existsSync(configPath)) {
      try {
        fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch {
        // ignore parse errors and fallback to env/defaults
      }
    }

    const url = (process.env.OPENCLAW_GATEWAY_URL || fileConfig.gateway?.url || 'ws://127.0.0.1:18789').trim();
    const token = (process.env.OPENCLAW_GATEWAY_TOKEN || fileConfig.gateway?.token || '').trim();
    return { url, token, configPath };
  }

  private async checkGatewayReadiness(): Promise<GatewayReadiness> {
    const { url, token, configPath } = this.resolveGatewayConfig();

    if (!token) {
      return {
        status: 'missing_config',
        configured: false,
        url,
        configPath,
        message: `未配置 Gateway Token，请在 ${configPath} 的 gateway.token 中填写。`,
      };
    }

    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      return {
        status: 'missing_config',
        configured: false,
        url,
        configPath,
        message: `Gateway URL 格式无效（${url}），需要以 ws:// 或 wss:// 开头。`,
      };
    }

    const reachable = await this.tryConnectGateway(url, token, 1500);
    if (!reachable.ok) {
      return {
        status: 'connection_failed',
        configured: true,
        url,
        configPath,
        message: `Gateway 连接失败：${reachable.reason || '未知错误'}。请确认 openclaw gateway 已启动且 token 正确。`,
      };
    }

    return {
      status: 'ready',
      configured: true,
      url,
      configPath,
      message: 'Gateway 连接正常，可自动创建 subagent。',
    };
  }

  private tryConnectGateway(url: string, token: string, timeoutMs: number): Promise<{ ok: boolean; reason?: string }> {
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          ws.close();
        } catch {
          // ignore
        }
        resolve({ ok: false, reason: '连接超时' });
      }, timeoutMs);

      const wsUrl = `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);

      ws.once('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        ws.close();
        resolve({ ok: true });
      });

      ws.once('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ ok: false, reason: error.message });
      });
    });
  }

  private readPid(): number | null {
    if (!fs.existsSync(this.pidFilePath)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(this.pidFilePath, 'utf-8').trim();
      const pid = Number.parseInt(raw, 10);
      return Number.isFinite(pid) && pid > 0 ? pid : null;
    } catch {
      return null;
    }
  }

  private isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private removePidFile(): void {
    if (!fs.existsSync(this.pidFilePath)) {
      return;
    }
    try {
      fs.unlinkSync(this.pidFilePath);
    } catch {
      // ignore
    }
  }

  private loadRuntimeState(): RuntimeState {
    const fromConfig = this.loadIntervalFromConfig();
    const fallback: RuntimeState = {
      mode: 'manual',
      intervalMs: fromConfig ?? DEFAULT_INTERVAL_MS,
      updatedAt: new Date().toISOString(),
    };

    if (!fs.existsSync(this.runtimeStatePath)) {
      return fallback;
    }

    try {
      const raw = fs.readFileSync(this.runtimeStatePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<RuntimeState>;
      return {
        mode: parsed.mode === 'auto' ? 'auto' : 'manual',
        intervalMs: this.normalizeInterval(parsed.intervalMs ?? fallback.intervalMs),
        updatedAt: parsed.updatedAt || fallback.updatedAt,
      };
    } catch {
      return fallback;
    }
  }

  private saveRuntimeState(state: RuntimeState): void {
    fs.mkdirSync(path.dirname(this.runtimeStatePath), { recursive: true });
    fs.writeFileSync(this.runtimeStatePath, JSON.stringify(state, null, 2), 'utf-8');
  }

  private loadIntervalFromConfig(): number | null {
    if (!fs.existsSync(this.dispatcherConfigPath)) {
      return null;
    }
    try {
      const raw = fs.readFileSync(this.dispatcherConfigPath, 'utf-8');
      const parsed = JSON.parse(raw) as { pollIntervalMs?: number };
      return parsed.pollIntervalMs && Number.isFinite(parsed.pollIntervalMs)
        ? this.normalizeInterval(parsed.pollIntervalMs)
        : null;
    } catch {
      return null;
    }
  }

  private getProjectAllowlist(): string[] {
    const config = this.loadDispatcherConfig();
    const raw = config.projectAllowlist;
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private loadDispatcherConfig(): Record<string, unknown> {
    if (!fs.existsSync(this.dispatcherConfigPath)) {
      return {};
    }
    try {
      const raw = fs.readFileSync(this.dispatcherConfigPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }

  private saveDispatcherConfig(config: Record<string, unknown>): void {
    const nextConfig = {
      ...config,
      projectAllowlist: Array.isArray(config.projectAllowlist) ? config.projectAllowlist : [],
    };
    fs.writeFileSync(this.dispatcherConfigPath, JSON.stringify(nextConfig, null, 2), 'utf-8');
  }

  private async waitForPidReady(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const pid = this.readPid();
      if (pid && this.isProcessRunning(pid)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }
}
