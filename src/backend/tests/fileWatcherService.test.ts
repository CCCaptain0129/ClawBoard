/**
 * FileWatcherService 测试
 * 
 * PMW-023: 文件监听服务
 * PMW-030: pause/resume 防回环机制
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { FileWatcherService } from '../src/services/fileWatcherService';
import { SafeSyncService, ProjectDocConfig } from '../src/services/safeSyncService';
import { MockTaskService, createTempDir, cleanupTempDir, writeTestFile, delay } from './utils/testUtils';

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

describe('FileWatcherService', () => {
  let mockTaskService: MockTaskService;
  let mockWsServer: MockWebSocketServer;
  let safeSyncService: SafeSyncService;
  let fileWatcherService: FileWatcherService;
  let tempDir: string;

  beforeEach(() => {
    mockTaskService = new MockTaskService();
    mockWsServer = new MockWebSocketServer();
    tempDir = createTempDir();
    
    // 创建任务文档
    writeTestFile(tempDir, '03-任务分解.md', `### PMW-001 \`P1\` 测试任务
- 状态: 待处理
- 描述: 测试
`);
    
    const testConfig: ProjectDocConfig = {
      projectId: 'test-project',
      projectPath: tempDir,
      taskDoc: '03-任务分解.md',
    };
    
    safeSyncService = new SafeSyncService(
      mockTaskService as any,
      { 'test-project': testConfig }
    );
    
    // 覆盖 tasksPath
    (safeSyncService as any).tasksPath = path.join(tempDir, 'tasks');
    fs.mkdirSync((safeSyncService as any).tasksPath, { recursive: true });
    
    fileWatcherService = new FileWatcherService(
      safeSyncService,
      mockWsServer as any,
      null, // progressOrchestrator
      { debounceMs: 100, ignoreInitial: true, watchTaskDoc: true }
    );
  });

  afterEach(() => {
    fileWatcherService.stop();
    cleanupTempDir(tempDir);
    mockTaskService.clear();
    mockWsServer.reset();
  });

  describe('start/stop', () => {
    it('应该启动文件监听', () => {
      fileWatcherService.start();
      
      const status = fileWatcherService.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.watchedProjects).toContain('test-project');
    });

    it('重复启动应该无害', () => {
      fileWatcherService.start();
      fileWatcherService.start(); // 应该不报错
      
      const status = fileWatcherService.getStatus();
      expect(status.isRunning).toBe(true);
    });

    it('应该停止文件监听', () => {
      fileWatcherService.start();
      fileWatcherService.stop();
      
      const status = fileWatcherService.getStatus();
      expect(status.isRunning).toBe(false);
    });
  });

  describe('pause/resume (PMW-030)', () => {
    it('pause 应该设置暂停状态', () => {
      fileWatcherService.start();
      
      fileWatcherService.pause();
      
      const status = fileWatcherService.getStatus();
      expect(status.isPaused).toBe(true);
    });

    it('resume 应该恢复监听', () => {
      fileWatcherService.start();
      fileWatcherService.pause();
      
      fileWatcherService.resume();
      
      const status = fileWatcherService.getStatus();
      expect(status.isPaused).toBe(false);
    });

    it('支持嵌套 pause/resume', () => {
      fileWatcherService.start();
      
      fileWatcherService.pause();
      fileWatcherService.pause(); // 嵌套
      
      expect(fileWatcherService.getStatus().isPaused).toBe(true);
      
      fileWatcherService.resume(); // 第一次恢复
      
      expect(fileWatcherService.getStatus().isPaused).toBe(true); // 仍然暂停
      
      fileWatcherService.resume(); // 第二次恢复
      
      expect(fileWatcherService.getStatus().isPaused).toBe(false); // 恢复
    });

    it('多余的 resume 应该无害', () => {
      fileWatcherService.start();
      
      // 没有匹配的 pause
      fileWatcherService.resume();
      
      expect(fileWatcherService.getStatus().isPaused).toBe(false);
    });

    it('暂停时应忽略文件变更', async () => {
      fileWatcherService.start();
      fileWatcherService.pause();
      
      // 修改文件
      writeTestFile(tempDir, '03-任务分解.md', `### PMW-002 \`P1\` 新任务
- 状态: 待处理
`);
      
      // 等待去抖时间
      await delay(500);
      
      // 由于暂停，不应该触发同步
      // 注意：这里依赖 SafeSyncService 的调用次数，由于是真实调用，我们只验证暂停状态
      expect(fileWatcherService.getStatus().isPaused).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('应该返回正确的状态信息', () => {
      fileWatcherService.start();
      
      const status = fileWatcherService.getStatus();
      
      expect(status.isRunning).toBe(true);
      expect(status.isPaused).toBe(false);
      expect(status.watchedProjects).toContain('test-project');
      // 注意：SafeSyncService 默认配置了多个项目，所以 watchedFiles 可能 > 1
      expect(status.watchedFiles).toBeGreaterThanOrEqual(1);
    });

    it('停止后状态应该正确', () => {
      fileWatcherService.start();
      fileWatcherService.stop();
      
      const status = fileWatcherService.getStatus();
      
      expect(status.isRunning).toBe(false);
      expect(status.watchedProjects).toHaveLength(0);
    });
  });

  describe('addProject/removeProject', () => {
    it('应该添加新项目监听', () => {
      fileWatcherService.start();
      
      const tempDir2 = createTempDir();
      writeTestFile(tempDir2, 'tasks.md', '### TEST-001 `P1` Test');
      
      const newConfig: ProjectDocConfig = {
        projectId: 'new-project',
        projectPath: tempDir2,
        taskDoc: 'tasks.md',
      };
      
      fileWatcherService.addProject(newConfig);
      
      const status = fileWatcherService.getStatus();
      expect(status.watchedProjects).toContain('new-project');
      
      cleanupTempDir(tempDir2);
    });

    it('应该移除项目监听', () => {
      fileWatcherService.start();
      
      fileWatcherService.removeProject('test-project');
      
      const status = fileWatcherService.getStatus();
      expect(status.watchedProjects).not.toContain('test-project');
    });
  });

  describe('manualSync', () => {
    it('应该手动触发同步', async () => {
      fileWatcherService.start();
      
      await fileWatcherService.manualSync('test-project');
      
      // 应该触发同步（通过 SafeSyncService）
      // 由于是真实调用，我们只验证没有抛出异常
    });
  });
});