import { Task } from '../types/tasks';
import { ProjectExecutionConfig } from './types';
import * as fs from 'fs';
import { getOpenClawSessionsPath } from '../config/paths';

const PRIORITY_ORDER: Record<Task['priority'], number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

export class WorkflowPolicyService {
  private static readonly CLAIM_GRACE_WINDOW_MS = 60 * 1000;
  private static readonly SESSIONS_CACHE_TTL_MS = 5 * 1000;
  private static sessionsCache: {
    expiresAt: number;
    keys: Set<string>;
  } | null = null;

  isTaskAutoDispatchEligible(task: Task, allTasks: Task[], projectConfig: ProjectExecutionConfig): boolean {
    return this.getIneligibleReason(task, allTasks, projectConfig) === null;
  }

  getIneligibleReason(task: Task, allTasks: Task[], projectConfig: ProjectExecutionConfig): string | null {
    if (!projectConfig.autoDispatchEnabled) {
      return '项目未开启自动调度';
    }

    if (task.status !== 'todo' && task.status !== 'in-progress') {
      return `任务状态为 ${task.status}`;
    }

    if (this.hasClaimedBy(task)) {
      return `任务已被占用（${task.claimedBy?.trim()}）`;
    }

    if (task.executionMode === 'manual') {
      return '任务执行模式为手动';
    }

    if (!this.hasMinimumExecutionInfo(task)) {
      return '任务缺少执行信息（目标/交付物/验收标准）';
    }

    if (!this.areDependenciesSatisfied(task, allTasks)) {
      return '任务依赖未完成';
    }

    return null;
  }

  private hasClaimedBy(task: Task): boolean {
    const claimedBy = (task.claimedBy ?? '').trim();
    if (!claimedBy) {
      return false;
    }

    if (this.isActiveSubagentSession(claimedBy)) {
      return true;
    }

    const claimedAt = this.getClaimedAt(task);
    if (claimedAt === null) {
      return false;
    }

    return Date.now() - claimedAt <= WorkflowPolicyService.CLAIM_GRACE_WINDOW_MS;
  }

  private getClaimedAt(task: Task): number | null {
    // claimedBy 没有独立时间戳时，回退使用任务更新时间作为 claim 生效窗口依据。
    const timestamps = [task.updatedAt, task.startTime, task.createdAt];
    for (const timestamp of timestamps) {
      const parsed = this.parseTimestamp(timestamp);
      if (parsed !== null) {
        return parsed;
      }
    }
    return null;
  }

  private parseTimestamp(value: string | null | undefined): number | null {
    if (!value) {
      return null;
    }

    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }

    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }

    return null;
  }

  private isActiveSubagentSession(sessionKey: string): boolean {
    if (!sessionKey.startsWith('agent:main:subagent:')) {
      return false;
    }

    const keys = this.getActiveSessionKeys();
    return keys.has(sessionKey);
  }

  private getActiveSessionKeys(): Set<string> {
    const now = Date.now();
    const cache = WorkflowPolicyService.sessionsCache;
    if (cache && cache.expiresAt > now) {
      return cache.keys;
    }

    const keys = new Set<string>();
    try {
      const sessionsPath = getOpenClawSessionsPath();
      if (fs.existsSync(sessionsPath)) {
        const raw = fs.readFileSync(sessionsPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          for (const key of Object.keys(parsed)) {
            if (key.startsWith('agent:main:subagent:')) {
              keys.add(key);
            }
          }
        }
      }
    } catch {
      // sessions 读取失败时，不阻断调度，只按时间窗口判定 claimedBy。
    }

    WorkflowPolicyService.sessionsCache = {
      expiresAt: now + WorkflowPolicyService.SESSIONS_CACHE_TTL_MS,
      keys,
    };
    return keys;
  }

  hasMinimumExecutionInfo(task: Task): boolean {
    const hasGoal = task.title.trim().length > 0 || task.description.trim().length > 0;
    const hasDeliverables = (task.deliverables?.length ?? 0) > 0;
    const hasAcceptanceCriteria = (task.acceptanceCriteria?.length ?? 0) > 0;

    return hasGoal && hasDeliverables && hasAcceptanceCriteria;
  }

  areDependenciesSatisfied(task: Task, allTasks: Task[]): boolean {
    const dependencies = task.dependencies ?? [];
    if (dependencies.length === 0) {
      return true;
    }

    const completedIds = new Set(allTasks.filter((item) => item.status === 'done').map((item) => item.id));
    return dependencies.every((dependencyId) => completedIds.has(dependencyId));
  }

  getPriorityScore(task: Task): number {
    return PRIORITY_ORDER[task.priority];
  }

  getActiveTaskCount(tasks: Task[]): number {
    return tasks.filter((task) => task.status === 'in-progress' && this.hasClaimedBy(task)).length;
  }

  hasAvailableCapacity(tasks: Task[], projectConfig: ProjectExecutionConfig): boolean {
    return this.getActiveTaskCount(tasks) < projectConfig.maxConcurrentSubagents;
  }
}
