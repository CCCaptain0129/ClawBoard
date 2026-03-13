import { promises as fs } from 'fs';
import path from 'path';
import { SubagentManager } from './subagentManager';
import type { TaskService } from './taskService';

/**
 * Subagent 状态接口
 */
export interface SubagentStatus {
  subagentId: string;
  taskId: string;
  existsInSessions: boolean;
  lastUpdateTime: number | null;
  lastUpdateTimestamp: string | null;
  minutesSinceLastUpdate: number | null;
  isLikelyFinished: boolean;
  sessionId?: string;
}

/**
 * SubagentMonitorService - 监控 Subagent 完成状态并自动补齐任务状态
 *
 * 核心功能：
 * - 每 30 秒检查 SUBAGENTS任务分发记录.md 中仍为进行中的 subagentId
 * - 结合 OpenClaw sessions store 判断是否已结束
 * - 若结束则调用 SubagentManager.markSubagentComplete 并更新任务状态
 * - 实现幂等、避免误判（>=2分钟无更新）
 */
export class SubagentMonitorService {
  private sessionsJsonPath: string;
  private sessionsDir: string;
  private recordingPath: string;
  private intervalMs: number;
  private completionThresholdMs: number;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  private subagentManager: SubagentManager;

  // 幂等性控制：记录已处理的 subagent，避免重复标记
  private processedSubagents: Set<string> = new Set();

  constructor(taskService: TaskService, options?: {
    sessionsJsonPath?: string;
    recordingPath?: string;
    intervalMs?: number;
    completionThresholdMs?: number;
  }) {
    this.subagentManager = new SubagentManager(taskService);
    // OpenClaw sessions store 路径
    this.sessionsJsonPath = options?.sessionsJsonPath ||
      '/Users/ot/.openclaw/agents/main/sessions/sessions.json';
    this.sessionsDir = path.dirname(this.sessionsJsonPath);

    // SUBAGENTS任务分发记录.md 路径
    this.recordingPath = options?.recordingPath ||
      '/Users/ot/.openclaw/workspace/projects/openclaw-visualization/docs/internal/SUBAGENTS任务分发记录.md';

    // 轮询间隔：默认 30 秒
    this.intervalMs = options?.intervalMs || 30000;

    // 完成判定阈值：默认 2 分钟（120,000 毫秒）
    this.completionThresholdMs = options?.completionThresholdMs || 120000;
  }

  /**
   * 启动监控服务
   */
  start(): void {
    if (this.isRunning) {
      console.log('[SubagentMonitorService] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[SubagentMonitorService] Starting...');
    console.log(`  - Interval: ${this.intervalMs}ms`);
    console.log(`  - Completion threshold: ${this.completionThresholdMs}ms`);
    console.log(`  - Recording file: ${this.recordingPath}`);

    // 立即执行一次检查
    this.checkAndCompleteSubagents();

    // 启动定时器
    this.intervalId = setInterval(() => {
      this.checkAndCompleteSubagents();
    }, this.intervalMs);

    console.log('[SubagentMonitorService] Started');
  }

  /**
   * 停止监控服务
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('[SubagentMonitorService] Stopped');
  }

  /**
   * 检查并完成已结束的 Subagent
   */
  async checkAndCompleteSubagents(): Promise<void> {
    try {
      console.log('[SubagentMonitorService] Checking for completed subagents...');

      // 1. 从记录文件中提取所有进行中的 subagentId
      const inProgressSubagents = await this.getInProgressSubagents();

      if (inProgressSubagents.length === 0) {
        console.log('[SubagentMonitorService] No in-progress subagents found');
        return;
      }

      console.log(`[SubagentMonitorService] Found ${inProgressSubagents.length} in-progress subagents`);

      // 2. 检查每个 subagent 的状态
      const completedSubagents: Array<{ subagentId: string; taskId: string }> = [];

      for (const { subagentId, taskId } of inProgressSubagents) {
        // 跳过已处理的 subagent（幂等性）
        if (this.processedSubagents.has(subagentId)) {
          continue;
        }

        const status = await this.checkSubagentStatus(subagentId);

        console.log(`[SubagentMonitorService] Subagent ${subagentId}:`, {
          exists: status.existsInSessions,
          lastUpdate: status.lastUpdateTimestamp,
          minutesSinceUpdate: status.minutesSinceLastUpdate,
          isLikelyFinished: status.isLikelyFinished
        });

        if (status.isLikelyFinished) {
          completedSubagents.push({ subagentId, taskId });
          // 标记为已处理
          this.processedSubagents.add(subagentId);
        }
      }

      // 3. 标记完成的 subagent
      if (completedSubagents.length > 0) {
        console.log(`[SubagentMonitorService] Found ${completedSubagents.length} completed subagents`);

        for (const { subagentId, taskId } of completedSubagents) {
          await this.markSubagentComplete(subagentId, taskId);
        }
      } else {
        console.log('[SubagentMonitorService] No completed subagents detected');
      }
    } catch (error) {
      console.error('[SubagentMonitorService] Error during check:', error);
    }
  }

  /**
   * 从记录文件中提取所有进行中的 subagentId
   */
  private async getInProgressSubagents(): Promise<Array<{ subagentId: string; taskId: string }>> {
    const content = await fs.readFile(this.recordingPath, 'utf-8');
    const subagents: Array<{ subagentId: string; taskId: string }> = [];

    // 匹配进行中的 subagent 条目
    // 格式：**Subagent ID**: `xxx` ... **状态**: 🔄 进行中
    const pattern = /\*\*Subagent ID\*\*:\s*`([^`]+)`[\s\S]*?\*\*任务\*\*:\s*([A-Z][A-Z0-9-]+)[\s\S]*?\*\*状态\*\*:\s*🔄 进行中/g;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      subagents.push({
        subagentId: match[1],
        taskId: match[2]
      });
    }

    return subagents;
  }

  /**
   * 检查 subagent 状态
   */
  private async checkSubagentStatus(subagentId: string): Promise<SubagentStatus> {
    try {
      // 1. 读取 sessions.json
      const sessionsJson = await fs.readFile(this.sessionsJsonPath, 'utf-8');
      const sessions = JSON.parse(sessionsJson);

      // 2. 查找对应的 session
      const sessionKey = `agent:main:subagent:${subagentId.split(':').pop()}`;
      const session = sessions[sessionKey];

      if (!session) {
        // session 不存在，说明 subagent 已结束并清理
        return {
          subagentId,
          taskId: '',
          existsInSessions: false,
          lastUpdateTime: null,
          lastUpdateTimestamp: null,
          minutesSinceLastUpdate: null,
          isLikelyFinished: true
        };
      }

      // 3. 检查最后更新时间
      const lastUpdateTime = session.updatedAt || 0;
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTime;
      const minutesSinceLastUpdate = timeSinceLastUpdate / 60000;

      // 4. 判断是否可能已完成
      // 判断条件：
      // - session 存在但 >= 2 分钟无更新
      const isLikelyFinished = timeSinceLastUpdate >= this.completionThresholdMs;

      return {
        subagentId,
        taskId: '',
        existsInSessions: true,
        lastUpdateTime,
        lastUpdateTimestamp: new Date(lastUpdateTime).toISOString(),
        minutesSinceLastUpdate,
        isLikelyFinished
      };
    } catch (error) {
      console.error(`[SubagentMonitorService] Error checking subagent ${subagentId}:`, error);

      // 出错时保守处理：不判定为已完成
      return {
        subagentId,
        taskId: '',
        existsInSessions: false,
        lastUpdateTime: null,
        lastUpdateTimestamp: null,
        minutesSinceLastUpdate: null,
        isLikelyFinished: false
      };
    }
  }

  /**
   * 标记 subagent 完成：调用 SubagentManager 统一更新任务状态 + 记录文件
   */
  private async markSubagentComplete(subagentId: string, taskId: string): Promise<void> {
    try {
      console.log(`[SubagentMonitorService] Marking subagent ${subagentId} as complete... taskId=${taskId}`);

      await this.subagentManager.markSubagentComplete(subagentId, {
        success: true,
        output: 'Subagent 已自动检测完成（monitor）',
        completedAt: new Date().toISOString()
      });

      console.log(`[SubagentMonitorService] ✓ Marked complete via SubagentManager: ${subagentId}`);
    } catch (error) {
      console.error(`[SubagentMonitorService] Error marking subagent ${subagentId} complete:`, error);
    }
  }

  /**
   * 获取当前所有进行中的 subagent 状态（用于测试和监控）
   */
  async getInProgressSubagentStatuses(): Promise<SubagentStatus[]> {
    const inProgressSubagents = await this.getInProgressSubagents();
    const statuses: SubagentStatus[] = [];

    for (const { subagentId, taskId } of inProgressSubagents) {
      const status = await this.checkSubagentStatus(subagentId);
      status.taskId = taskId;
      statuses.push(status);
    }

    return statuses;
  }

  /**
   * 清除已处理记录（用于测试重置）
   */
  clearProcessedCache(): void {
    this.processedSubagents.clear();
    console.log('[SubagentMonitorService] Processed cache cleared');
  }
}