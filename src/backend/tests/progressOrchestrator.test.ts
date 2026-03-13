/**
 * ProgressOrchestrator 测试
 * 
 * PMW-029: 看板运行态自动回写到 04-进度跟踪.md
 * 1. 监听任务状态变更
 * 2. 去抖处理（1秒内多次更新合并一次）
 * 3. 自动触发 ProgressToDocService 更新
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ProgressOrchestrator } from '../src/services/progressOrchestrator';
import { SafeSyncService, ProjectDocConfig } from '../src/services/safeSyncService';
import { SyncLockService } from '../src/services/syncLockService';
import { FileWatcherService } from '../src/services/fileWatcherService';
import { MockTaskService, createTempDir, cleanupTempDir, writeTestFile, delay } from './utils/testUtils';

// 模拟 ProgressToDocService
class MockProgressToDocService {
  syncCount = 0;
  lastProjectId: string | null = null;
  shouldFail = false;

  async syncProgressToDoc(projectId: string, docPath?: string): Promise<{
    success: boolean;
    progress: { total: number; completed: number; inProgress: number; todo: number; percentage: number };
    updatedSections: string[];
    message: string;
  }> {
    this.syncCount++;
    this.lastProjectId = projectId;

    if (this.shouldFail) {
      throw new Error('Mock sync failed');
    }

    return {
      success: true,
      progress: { total: 10, completed: 5, inProgress: 2, todo: 3, percentage: 50 },
      updatedSections: ['进度统计'],
      message: 'Synced successfully',
    };
  }

  reset(): void {
    this.syncCount = 0;
    this.lastProjectId = null;
    this.shouldFail = false;
  }
}

// 模拟 WebSocket 服务器
class MockWebSocketServer {
  broadcasts: any[] = [];

  broadcast(data: any): void {
    this.broadcasts.push(data);
  }

  reset(): void {
    this.broadcasts = [];
  }
}

describe('ProgressOrchestrator', () => {
  let mockTaskService: MockTaskService;
  let mockProgressService: MockProgressToDocService;
  let mockWsServer: MockWebSocketServer;
  let syncLockService: SyncLockService;
  let orchestrator: ProgressOrchestrator;
  let tempDir: string;
  let safeSyncService: SafeSyncService;

  beforeEach(() => {
    mockTaskService = new MockTaskService();
    mockProgressService = new MockProgressToDocService();
    mockWsServer = new MockWebSocketServer();
    syncLockService = new SyncLockService(5000);
    
    tempDir = createTempDir();
    
    // 创建测试项目配置
    const testConfig: ProjectDocConfig = {
      projectId: 'pm-workflow-automation',
      projectPath: tempDir,
      taskDoc: '03-任务分解.md',
      progressDoc: '04-进度跟踪.md',
    };
    
    safeSyncService = new SafeSyncService(
      mockTaskService as any,
      { 'pm-workflow-automation': testConfig }
    );
    
    orchestrator = new ProgressOrchestrator(
      mockProgressService as any,
      safeSyncService,
      mockWsServer as any,
      syncLockService,
      null // fileWatcherService
    );
    
    // 创建进度文档
    writeTestFile(tempDir, '04-进度跟踪.md', `# 进度跟踪

## 项目状态
- **完成度**: 0%
- 总任务: 10
- 已完成: 0
- 进行中: 0
- 待处理: 10

*最后更新: 2024-01-01*
`);
  });

  afterEach(() => {
    orchestrator.cleanup();
    syncLockService.clearAll();
    cleanupTempDir(tempDir);
    mockTaskService.clear();
    mockProgressService.reset();
    mockWsServer.reset();
  });

  describe('triggerProgressSync', () => {
    it('应该触发进度同步', async () => {
      await orchestrator.triggerProgressSync('pm-workflow-automation', true);
      
      expect(mockProgressService.syncCount).toBe(1);
      expect(mockProgressService.lastProjectId).toBe('pm-workflow-automation');
    });

    it('应该广播同步事件', async () => {
      await orchestrator.triggerProgressSync('pm-workflow-automation', true);
      
      expect(mockWsServer.broadcasts).toHaveLength(1);
      expect(mockWsServer.broadcasts[0].type).toBe('PROGRESS_SYNCED');
    });

    it('非 pm-workflow-automation 项目应跳过同步', async () => {
      await orchestrator.triggerProgressSync('other-project', true);
      
      expect(mockProgressService.syncCount).toBe(0);
    });
  });

  describe('去抖机制', () => {
    it('多次快速调用应该合并为一次同步', async () => {
      // 快速触发三次
      orchestrator.triggerProgressSync('pm-workflow-automation');
      orchestrator.triggerProgressSync('pm-workflow-automation');
      orchestrator.triggerProgressSync('pm-workflow-automation');
      
      // 等待去抖时间
      await delay(1500);
      
      // 应该只同步一次
      expect(mockProgressService.syncCount).toBe(1);
    });

    it('immediate=true 应跳过去抖', async () => {
      await orchestrator.triggerProgressSync('pm-workflow-automation', true);
      
      expect(mockProgressService.syncCount).toBe(1);
    });

    it('去抖后应该清理待处理更新', async () => {
      orchestrator.triggerProgressSync('pm-workflow-automation');
      
      await delay(1500);
      
      // 再次触发应该能正常执行
      await orchestrator.triggerProgressSync('pm-workflow-automation', true);
      
      expect(mockProgressService.syncCount).toBe(2);
    });
  });

  describe('锁机制', () => {
    it('同步时应获取锁', async () => {
      await orchestrator.triggerProgressSync('pm-workflow-automation', true);
      
      // 锁应该在同步完成后释放
      expect(syncLockService.isHeld('progress-sync-pm-workflow-automation')).toBe(false);
    });

    it('锁被持有时应跳过同步', async () => {
      // 手动获取锁
      syncLockService.acquire('progress-sync-pm-workflow-automation', 'pm-workflow-automation');
      
      await orchestrator.triggerProgressSync('pm-workflow-automation', true);
      
      // 应该跳过同步
      expect(mockProgressService.syncCount).toBe(0);
    });
  });

  describe('错误处理', () => {
    it('同步失败应该捕获错误', async () => {
      mockProgressService.shouldFail = true;
      
      // 不应该抛出异常
      await expect(
        orchestrator.triggerProgressSync('pm-workflow-automation', true)
      ).resolves.not.toThrow();
      
      expect(mockProgressService.syncCount).toBe(1);
    });

    it('项目配置缺失应该跳过同步', async () => {
      // 移除项目配置
      (safeSyncService as any).projectConfigs = {};
      
      await orchestrator.triggerProgressSync('pm-workflow-automation', true);
      
      expect(mockProgressService.syncCount).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('应该清理所有待处理的更新', () => {
      orchestrator.triggerProgressSync('pm-workflow-automation');
      orchestrator.triggerProgressSync('pm-workflow-automation');
      
      orchestrator.cleanup();
      
      // 获取内部状态
      const pendingUpdates = (orchestrator as any).pendingUpdates;
      expect(pendingUpdates.size).toBe(0);
    });
  });
});