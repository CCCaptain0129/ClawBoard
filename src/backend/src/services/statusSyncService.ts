import * as chokidar from 'chokidar';
import * as fs from 'fs';
import { TaskService } from './taskService';
import { WebSocketHandler } from '../websocket/server';
import { getSubagentRecordingPath } from '../config/paths';

/**
 * Subagent 记录接口
 */
interface SubagentRecord {
  subagentId: string;
  taskId: string;
  status: 'in-progress' | 'review' | 'failed';
}

/**
 * StatusSyncService - 监控 SUBAGENTS任务分发记录.md 并自动同步任务状态
 *
 * 工作流程：
 * 1. 使用 chokidar 监控文件变化
 * 2. 解析文件内容，提取 Subagent 信息
 * 3. 根据状态更新任务（创建 → in-progress，完成 → review/failed）
 * 4. 通过 WebSocket 广播更新
 */
export class StatusSyncService {
  private taskService: TaskService;
  private wsServer: WebSocketHandler;
  private recordingPath: string;
  private watcher: chokidar.FSWatcher | null = null;
  private processedRecords: Map<string, string> = new Map(); // subagentId -> status

  constructor(taskService: TaskService, wsServer: WebSocketHandler) {
    this.taskService = taskService;
    this.wsServer = wsServer;
    this.recordingPath = getSubagentRecordingPath();
  }

  /**
   * 启动文件监控
   */
  start(): void {
    console.log('[StatusSyncService] Starting file watcher...');

    // 确保文件存在
    if (!fs.existsSync(this.recordingPath)) {
      console.warn('[StatusSyncService] Recording file not found, creating it...');
      const dir = this.recordingPath.substring(0, this.recordingPath.lastIndexOf('/'));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.recordingPath, '# SUBAGENTS 任务分发记录\n\n', 'utf-8');
    }

    // 初始化：先处理现有记录
    this.syncFromFile();

    // 启动文件监控
    this.watcher = chokidar.watch(this.recordingPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });

    this.watcher.on('change', () => {
      console.log('[StatusSyncService] File changed, syncing...');
      this.syncFromFile();
    });

    this.watcher.on('error', (error) => {
      console.error('[StatusSyncService] Watcher error:', error);
    });

    console.log('[StatusSyncService] File watcher started');
  }

  /**
   * 停止文件监控
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('[StatusSyncService] File watcher stopped');
    }
  }

  /**
   * 从文件同步状态
   */
  private async syncFromFile(): Promise<void> {
    try {
      const content = fs.readFileSync(this.recordingPath, 'utf-8');
      const records = this.parseRecords(content);

      for (const record of records) {
        await this.processRecord(record);
      }
    } catch (error) {
      console.error('[StatusSyncService] Failed to sync from file:', error);
    }
  }

  /**
   * 解析文件内容，提取 Subagent 记录
   */
  private parseRecords(content: string): SubagentRecord[] {
    const records: SubagentRecord[] = [];

    // 匹配每个 Subagent 块
    // 格式：
    // ### [日期时间] 创建 Subagent
    // **Subagent ID**: `subagentId`
    // ...
    // **任务**: TASK-XXX - ...
    // ...
    // **状态**: 🔄 进行中 / ✅ 成功 / ❌ 失败

    const blocks = content.split(/### \[\d{4}-\d{2}-\d{2}.*?\] 创建 Subagent/);

    for (const block of blocks) {
      if (!block.trim()) continue;

      // 提取 Subagent ID
      const idMatch = block.match(/\*\*Subagent ID\*\*:\s*`([^`]+)`/);
      if (!idMatch) continue;

      const subagentId = idMatch[1];

      // 提取任务 ID
      const taskMatch = block.match(/\*\*任务\*\*:\s*TASK-(\d+)/);
      if (!taskMatch) continue;

      const taskId = `TASK-${taskMatch[1]}`;

      // 提取状态
      const statusMatch = block.match(/\*\*状态\*\*:\s*(🔄 进行中|✅ 成功|❌ 失败|成功完成|失败)/);
      if (!statusMatch) continue;

      const statusStr = statusMatch[1];
      let status: 'in-progress' | 'review' | 'failed';

      if (statusStr.includes('进行中')) {
        status = 'in-progress';
      } else if (statusStr.includes('成功') || statusStr.includes('完成')) {
        status = 'review';
      } else if (statusStr.includes('失败')) {
        status = 'failed';
      } else {
        continue; // 未知状态
      }

      records.push({
        subagentId,
        taskId,
        status
      });
    }

    return records;
  }

  /**
   * 处理单个记录
   */
  private async processRecord(record: SubagentRecord): Promise<void> {
    const cachedStatus = this.processedRecords.get(record.subagentId);

    // 如果状态没有变化，跳过
    if (cachedStatus === record.status) {
      return;
    }

    console.log(`[StatusSyncService] Processing record: ${record.subagentId} -> ${record.status}`);

    // 更新任务状态
    try {
      const task = await this.taskService.updateTask(
        'openclaw-visualization',
        record.taskId,
        this.mapStatusToTask(record.status)
      );

      if (task) {
        // 缓存状态
        this.processedRecords.set(record.subagentId, record.status);

        // 广播更新
        this.wsServer.broadcastTaskUpdate('openclaw-visualization', task);

        console.log(`[StatusSyncService] ✅ Updated task ${record.taskId} to ${task.status}`);
      } else {
        console.warn(`[StatusSyncService] Task ${record.taskId} not found`);
      }
    } catch (error) {
      console.error(`[StatusSyncService] Failed to update task ${record.taskId}:`, error);
    }
  }

  /**
   * 映射 Subagent 状态到任务状态
   */
  private mapStatusToTask(
    subagentStatus: 'in-progress' | 'review' | 'failed'
  ): Partial<{ status: 'todo' | 'in-progress' | 'review' | 'done'; claimedBy: string | null; updatedAt: string }> {
    const base = {
      updatedAt: new Date().toISOString()
    };

    switch (subagentStatus) {
      case 'in-progress':
        return {
          ...base,
          status: 'in-progress' as const,
          claimedBy: 'subagent' // 标记为 subagent 占用
        };
      case 'review':
        return {
          ...base,
          status: 'review' as const,
          claimedBy: null
        };
      case 'failed':
        return {
          ...base,
          status: 'todo' as const, // 失败后回到待处理
          claimedBy: null
        };
      default:
        return base;
    }
  }
}
