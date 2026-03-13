/**
 * FileWatcherService - 文件监听服务
 * 
 * 实现 PMW-023 Phase 2: 文档变更监听→自动同步到看板
 * 
 * 使用 chokidar 监听文件变更，触发安全同步
 */

import * as chokidar from 'chokidar';
import * as path from 'path';
import { SafeSyncService, ProjectDocConfig } from './safeSyncService';
import { WebSocketHandler } from '../websocket/server';
import { ProgressOrchestrator } from './progressOrchestrator'; // PMW-032

export interface FileWatcherOptions {
  debounceMs?: number;    // 防抖延迟（毫秒）
  ignoreInitial?: boolean; // 是否忽略初始扫描
}

const DEFAULT_OPTIONS: FileWatcherOptions = {
  debounceMs: 1000,      // 默认 1 秒防抖
  ignoreInitial: true,   // 忽略初始扫描
};

export class FileWatcherService {
  private safeSyncService: SafeSyncService;
  private wsServer: WebSocketHandler | null;
  private progressOrchestrator: ProgressOrchestrator | null; // PMW-032
  private options: FileWatcherOptions;
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;
  private isPaused: boolean = false; // PMW-030: 暂停状态
  private pauseDepth: number = 0; // PMW-030: 暂停深度计数器（支持嵌套 pause/resume）

  constructor(
    safeSyncService: SafeSyncService,
    wsServer?: WebSocketHandler,
    progressOrchestrator?: ProgressOrchestrator, // PMW-032
    options?: FileWatcherOptions
  ) {
    this.safeSyncService = safeSyncService;
    this.wsServer = wsServer || null;
    this.progressOrchestrator = progressOrchestrator || null; // PMW-032
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 启动文件监听
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ FileWatcherService is already running');
      return;
    }

    const projectIds = this.safeSyncService.getConfiguredProjects();
    
    for (const projectId of projectIds) {
      const config = this.safeSyncService.getProjectConfig(projectId);
      if (config) {
        this.watchProject(config);
      }
    }

    this.isRunning = true;
    console.log(`📁 FileWatcherService started, watching ${this.watchers.size} project(s)`);
  }

  /**
   * 停止文件监听
   */
  stop(): void {
    for (const [projectId, watcher] of this.watchers) {
      watcher.close();
      console.log(`📁 Stopped watching project: ${projectId}`);
    }
    this.watchers.clear();

    // 清除所有防抖定时器
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    this.isRunning = false;
    console.log('📁 FileWatcherService stopped');
  }

  /**
   * PMW-030: 暂停文件监听（临时禁用）
   * 用于防止回环：在写回 04-进度跟踪.md 时暂停 watcher
   *
   * 支持嵌套调用：多次 pause() 需要相应次数的 resume() 才能恢复
   */
  pause(): void {
    this.pauseDepth++;
    if (this.pauseDepth === 1) {
      // 第一次暂停
      this.isPaused = true;
      console.log('⏸️ FileWatcherService paused');
    } else {
      console.log(`⏸️ FileWatcherService pause depth increased to ${this.pauseDepth}`);
    }
  }

  /**
   * PMW-030: 恢复文件监听
   *
   * 支持嵌套调用：只有当 pauseDepth 回到 0 时才真正恢复
   */
  resume(): void {
    if (this.pauseDepth <= 0) {
      console.warn('⚠️ FileWatcherService: resume() called without matching pause()');
      return;
    }

    this.pauseDepth--;
    if (this.pauseDepth === 0) {
      // 最后一次 resume
      this.isPaused = false;
      console.log('▶️ FileWatcherService resumed');
    } else {
      console.log(`▶️ FileWatcherService pause depth decreased to ${this.pauseDepth}`);
    }
  }

  /**
   * 监听单个项目的文档
   */
  private watchProject(config: ProjectDocConfig): void {
    const filesToWatch: string[] = [];
    
    // 添加任务文档
    if (config.taskDoc) {
      filesToWatch.push(path.join(config.projectPath, config.taskDoc));
    }
    
    // 添加进度文档（可选）
    if (config.progressDoc) {
      filesToWatch.push(path.join(config.projectPath, config.progressDoc));
    }

    if (filesToWatch.length === 0) {
      console.log(`⚠️ No files to watch for project: ${config.projectId}`);
      return;
    }

    // 创建 watcher
    const watcher = chokidar.watch(filesToWatch, {
      ignoreInitial: this.options.ignoreInitial,
      awaitWriteFinish: {
        stabilityThreshold: 500,  // 文件写入完成后等待 500ms
        pollInterval: 100,
      },
    });

    // 监听变更事件
    watcher.on('change', (filePath: string) => {
      this.handleFileChange(filePath, config.projectId);
    });

    watcher.on('add', (filePath: string) => {
      if (!this.options.ignoreInitial) {
        this.handleFileChange(filePath, config.projectId);
      }
    });

    watcher.on('error', (error: unknown) => {
      console.error(`❌ FileWatcher error for ${config.projectId}:`, error);
    });

    this.watchers.set(config.projectId, watcher);
    console.log(`📁 Watching ${config.projectId}: ${filesToWatch.join(', ')}`);
  }

  /**
   * 处理文件变更（带防抖）
   */
  private handleFileChange(filePath: string, projectId: string): void {
    // PMW-030: 如果已暂停，忽略文件变更
    if (this.isPaused) {
      console.log(`⏸️ [FileWatcher] Ignoring file change (watcher paused): ${filePath}`);
      return;
    }

    // 清除之前的定时器
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 设置新的防抖定时器
    const timer = setTimeout(() => {
      this.triggerSync(filePath, projectId);
      this.debounceTimers.delete(filePath);
    }, this.options.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  /**
   * 触发同步
   */
  private async triggerSync(filePath: string, projectId: string): Promise<void> {
    console.log(`📝 File changed: ${filePath}`);
    console.log(`🔄 Triggering safe sync for project: ${projectId}`);

    try {
      const result = await this.safeSyncService.safeSyncFromMarkdown(projectId);

      if (result.success) {
        console.log(`✅ Sync completed: ${result.tasks.length} tasks, ${result.protectedCount} protected, ${result.updatedCount} updated`);

        // 广播同步完成事件
        if (this.wsServer) {
          this.wsServer.broadcast({
            type: 'SAFE_SYNC_COMPLETED',
            projectId,
            taskCount: result.tasks.length,
            protectedCount: result.protectedCount,
            updatedCount: result.updatedCount,
            timestamp: new Date().toISOString(),
          });
        }

        // PMW-032: 03变更触发04刷新
        // 当 taskDoc（03）变更且同步成功后，触发进度文档（04）的刷新
        const config = this.safeSyncService.getProjectConfig(projectId);
        const fileName = path.basename(filePath);
        const isTaskDocChanged = config?.taskDoc && fileName === path.basename(config.taskDoc);

        if (isTaskDocChanged && this.progressOrchestrator) {
          console.log(`📊 [PMW-032] Task document changed, triggering progress sync for ${projectId}`);
          
          // 触发进度同步（04刷新）
          // 注意：ProgressOrchestrator 内部已实现防抖、锁机制，且会暂停 watcher 避免回环
          await this.progressOrchestrator.triggerProgressSync(projectId, false);
        }
      } else {
        console.error(`❌ Sync failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Sync error:`, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 添加项目监听
   */
  addProject(config: ProjectDocConfig): void {
    this.safeSyncService.setProjectConfig(config);
    if (this.isRunning) {
      this.watchProject(config);
    }
  }

  /**
   * 移除项目监听
   */
  removeProject(projectId: string): void {
    const watcher = this.watchers.get(projectId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(projectId);
      console.log(`📁 Stopped watching project: ${projectId}`);
    }
  }

  /**
   * 手动触发同步
   */
  async manualSync(projectId: string): Promise<void> {
    await this.triggerSync('manual-trigger', projectId);
  }

  /**
   * 获取运行状态
   */
  getStatus(): {
    isRunning: boolean;
    isPaused: boolean; // PMW-030
    watchedProjects: string[];
    watchedFiles: number;
  } {
    const watchedProjects = Array.from(this.watchers.keys());
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused, // PMW-030
      watchedProjects,
      watchedFiles: watchedProjects.length,
    };
  }
}