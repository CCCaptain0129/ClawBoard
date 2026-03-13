/**
 * ProgressOrchestrator - 进度编排服务
 *
 * PMW-029: 看板运行态自动回写到 04-进度跟踪.md
 *
 * 核心功能：
 * 1. 监听任务状态变更（status/claimedBy/assignee/startTime/completeTime）
 * 2. 去抖处理（同一 projectId 1 秒内多次更新合并一次）
 * 3. 自动触发 ProgressToDocService 更新 04-进度跟踪.md
 * 4. 通过 WebSocket 广播更新事件
 */

import { ProgressToDocService } from './progressToDocService';
import { SafeSyncService } from './safeSyncService';
import { WebSocketHandler } from '../websocket/server';
import { SyncLockService } from './syncLockService';
import { FileWatcherService } from './fileWatcherService';

// 去抖配置
const DEBOUNCE_MS = 1000; // 1秒去抖

// 待处理更新队列
interface PendingUpdate {
  projectId: string;
  timestamp: number;
  timeoutId?: NodeJS.Timeout;
}

export class ProgressOrchestrator {
  private progressService: ProgressToDocService;
  private safeSyncService: SafeSyncService;
  private wsServer: WebSocketHandler;
  private syncLockService: SyncLockService; // PMW-030
  private fileWatcherService: FileWatcherService | null; // PMW-030
  private pendingUpdates: Map<string, PendingUpdate>;

  constructor(
    progressService: ProgressToDocService,
    safeSyncService: SafeSyncService,
    wsServer: WebSocketHandler,
    syncLockService?: SyncLockService, // PMW-030
    fileWatcherService?: FileWatcherService // PMW-030
  ) {
    this.progressService = progressService;
    this.safeSyncService = safeSyncService;
    this.wsServer = wsServer;
    this.syncLockService = syncLockService || new SyncLockService(); // PMW-030
    this.fileWatcherService = fileWatcherService || null; // PMW-030
    this.pendingUpdates = new Map();
  }

  /**
   * 触发进度同步（带去抖）
   *
   * @param projectId - 项目ID
   * @param immediate - 是否立即执行（跳过去抖）
   */
  async triggerProgressSync(projectId: string, immediate: boolean = false): Promise<void> {
    // 如果是 pm-workflow-automation 项目，则触发同步
    if (projectId !== 'pm-workflow-automation') {
      console.log(`[ProgressOrchestrator] Skipping non-pm-workflow-automation project: ${projectId}`);
      return;
    }

    const pending = this.pendingUpdates.get(projectId);

    // 如果有待处理的更新，取消之前的定时器
    if (pending && pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    // 如果立即执行，直接调用同步
    if (immediate) {
      console.log(`[ProgressOrchestrator] Immediate progress sync for ${projectId}`);
      await this.performSync(projectId);
      this.pendingUpdates.delete(projectId);
      return;
    }

    // 设置新的去抖定时器
    const timeoutId = setTimeout(async () => {
      console.log(`[ProgressOrchestrator] Debounced progress sync for ${projectId}`);
      await this.performSync(projectId);
      this.pendingUpdates.delete(projectId);
    }, DEBOUNCE_MS);

    this.pendingUpdates.set(projectId, {
      projectId,
      timestamp: Date.now(),
      timeoutId,
    });

    console.log(`[ProgressOrchestrator] Progress sync scheduled for ${projectId} (debounce: ${DEBOUNCE_MS}ms)`);
  }

  /**
   * 执行实际的进度同步
   *
   * PMW-030: 增加防回环机制
   * 1. 获取锁
   * 2. 暂停文件监听
   * 3. 执行同步
   * 4. 恢复文件监听
   * 5. 释放锁
   *
   * @param projectId - 项目ID
   */
  private async performSync(projectId: string): Promise<void> {
    // PMW-030: 获取锁
    const lockKey = `progress-sync-${projectId}`;
    if (!this.syncLockService.acquire(lockKey, projectId)) {
      console.warn(`⚠️ [ProgressOrchestrator] Failed to acquire lock for ${projectId}, skipping sync`);
      return;
    }

    // PMW-030: 暂停文件监听
    if (this.fileWatcherService) {
      this.fileWatcherService.pause();
    }

    try {
      // 获取项目配置
      const config = this.safeSyncService.getProjectConfig(projectId);
      if (!config || !config.progressDoc) {
        console.warn(`[ProgressOrchestrator] No progressDoc config found for project: ${projectId}`);
        return;
      }

      // 构建进度文档的完整路径
      const progressDocPath = `${config.projectPath}/${config.progressDoc}`;
      console.log(`[ProgressOrchestrator] Syncing progress to: ${progressDocPath}`);

      // 调用 ProgressToDocService 同步进度
      const result = await this.progressService.syncProgressToDoc(projectId, progressDocPath);

      if (result.success) {
        console.log(`✅ [ProgressOrchestrator] Progress synced successfully: ${result.message}`);

        // 广播进度同步事件
        this.wsServer.broadcast({
          type: 'PROGRESS_SYNCED',
          projectId,
          progress: result.progress,
          updatedSections: result.updatedSections,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.error(`❌ [ProgressOrchestrator] Progress sync failed: ${result.message}`);
      }
    } catch (error) {
      console.error(`❌ [ProgressOrchestrator] Failed to sync progress for ${projectId}:`, error);
    } finally {
      // PMW-030: 恢复文件监听
      if (this.fileWatcherService) {
        this.fileWatcherService.resume();
      }

      // PMW-030: 释放锁
      this.syncLockService.release(lockKey);
    }
  }

  /**
   * 清理所有待处理的更新
   */
  cleanup(): void {
    this.pendingUpdates.forEach((pending) => {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
    });
    this.pendingUpdates.clear();
    console.log('[ProgressOrchestrator] Cleaned up all pending updates');
  }
}