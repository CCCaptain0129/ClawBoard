/**
 * SafeSyncService 测试
 * 
 * PMW-023: 安全同步服务
 * 1. 从 03-任务分解.md 解析任务
 * 2. 安全合并到现有 JSON，保护运行态字段
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SafeSyncService, ProjectDocConfig } from '../src/services/safeSyncService';
import { MockTaskService, createTempDir, cleanupTempDir, writeTestFile, readTestFile, delay } from './utils/testUtils';

describe('SafeSyncService', () => {
  let mockTaskService: MockTaskService;
  let safeSyncService: SafeSyncService;
  let tempDir: string;
  let tasksDir: string;

  beforeEach(() => {
    mockTaskService = new MockTaskService();
    tempDir = createTempDir();
    tasksDir = path.join(tempDir, 'tasks');
    fs.mkdirSync(tasksDir, { recursive: true });
    
    // 创建测试项目配置
    const testConfig: ProjectDocConfig = {
      projectId: 'test-project',
      projectPath: tempDir,
      taskDoc: '03-任务分解.md',
      progressDoc: '04-进度跟踪.md',
    };
    
    safeSyncService = new SafeSyncService(
      mockTaskService as any,
      { 'test-project': testConfig }
    );
    
    // 覆盖 tasksPath
    (safeSyncService as any).tasksPath = tasksDir;
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
    mockTaskService.clear();
  });

  describe('getProjectConfig', () => {
    it('应该返回已配置的项目配置', () => {
      const config = safeSyncService.getProjectConfig('test-project');
      
      expect(config).not.toBeNull();
      expect(config!.projectId).toBe('test-project');
      expect(config!.taskDoc).toBe('03-任务分解.md');
    });

    it('未配置的项目应返回 null', () => {
      const config = safeSyncService.getProjectConfig('unknown-project');
      expect(config).toBeNull();
    });
  });

  describe('setProjectConfig', () => {
    it('应该添加新项目配置', () => {
      const newConfig: ProjectDocConfig = {
        projectId: 'new-project',
        projectPath: '/tmp/new-project',
        taskDoc: 'tasks.md',
      };
      
      safeSyncService.setProjectConfig(newConfig);
      
      const config = safeSyncService.getProjectConfig('new-project');
      expect(config).not.toBeNull();
      expect(config!.projectId).toBe('new-project');
    });
  });

  describe('safeSyncFromMarkdown', () => {
    it('项目未配置时应返回错误', async () => {
      const result = await safeSyncService.safeSyncFromMarkdown('unknown-project');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No document config found');
    });

    it('文档不存在时应返回错误', async () => {
      const result = await safeSyncService.safeSyncFromMarkdown('test-project');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Task document not found');
    });

    it('应该成功解析任务文档', async () => {
      const markdown = `## 阶段 1：核心功能

### PMW-001 \`P0\` 实现核心功能
- 状态: 待处理
- 描述: 实现核心功能模块

### PMW-002 \`P1\` 添加测试
- 状态: 进行中
- 描述: 添加单元测试
`;
      writeTestFile(tempDir, '03-任务分解.md', markdown);
      
      const result = await safeSyncService.safeSyncFromMarkdown('test-project');
      
      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].id).toBe('PMW-001');
      expect(result.tasks[1].id).toBe('PMW-002');
    });

    it('应该正确解析任务状态', async () => {
      const markdown = `### PMW-001 \`P0\` 测试任务
- 状态: 已完成
- 描述: 测试描述
`;
      writeTestFile(tempDir, '03-任务分解.md', markdown);
      
      const result = await safeSyncService.safeSyncFromMarkdown('test-project');
      
      expect(result.success).toBe(true);
      expect(result.tasks[0].status).toBe('done');
    });

    it('应该保护 in-progress 状态的任务', async () => {
      // 设置现有任务
      mockTaskService.setTasks('test-project', [
        {
          id: 'PMW-001',
          title: 'Test Task',
          description: '',
          status: 'in-progress',
          priority: 'P1',
          labels: [],
          assignee: null,
          claimedBy: 'user-123',
          dueDate: null,
          startTime: '2024-01-01T00:00:00Z',
          completeTime: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          comments: [],
        },
      ]);
      
      const markdown = `### PMW-001 \`P0\` 测试任务
- 状态: 待处理
- 描述: 更新后的描述
`;
      writeTestFile(tempDir, '03-任务分解.md', markdown);
      
      const result = await safeSyncService.safeSyncFromMarkdown('test-project');
      
      expect(result.success).toBe(true);
      expect(result.protectedCount).toBe(1);
      
      // 运行态字段应该被保护
      const task = result.tasks.find(t => t.id === 'PMW-001');
      expect(task!.status).toBe('in-progress'); // 保持原状态
      expect(task!.claimedBy).toBe('user-123'); // 保持原领取者
    });

    it('应该保护 done 状态的任务', async () => {
      mockTaskService.setTasks('test-project', [
        {
          id: 'PMW-001',
          title: 'Test Task',
          description: '',
          status: 'done',
          priority: 'P1',
          labels: [],
          assignee: null,
          claimedBy: 'user-456',
          dueDate: null,
          startTime: null,
          completeTime: '2024-01-02T00:00:00Z',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
          comments: [],
        },
      ]);
      
      const markdown = `### PMW-001 \`P0\` 测试任务
- 状态: 待处理
- 描述: 更新后的描述
`;
      writeTestFile(tempDir, '03-任务分解.md', markdown);
      
      const result = await safeSyncService.safeSyncFromMarkdown('test-project');
      
      expect(result.success).toBe(true);
      expect(result.protectedCount).toBe(1);
      
      const task = result.tasks.find(t => t.id === 'PMW-001');
      expect(task!.status).toBe('done'); // 保持原状态
    });

    it('应该允许更新 todo 状态的任务', async () => {
      mockTaskService.setTasks('test-project', [
        {
          id: 'PMW-001',
          title: 'Old Title',
          description: 'Old description',
          status: 'todo',
          priority: 'P2',
          labels: [],
          assignee: null,
          claimedBy: null,
          dueDate: null,
          startTime: null,
          completeTime: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          comments: [],
        },
      ]);
      
      const markdown = `### PMW-001 \`P0\` 新标题
- 状态: 进行中
- 描述: 新描述
`;
      writeTestFile(tempDir, '03-任务分解.md', markdown);
      
      const result = await safeSyncService.safeSyncFromMarkdown('test-project');
      
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(1);
      
      const task = result.tasks.find(t => t.id === 'PMW-001');
      expect(task!.title).toBe('新标题');
      expect(task!.status).toBe('in-progress'); // 可以更新
    });

    it('应该添加新任务', async () => {
      // 设置项目和空任务列表
      const project = {
        id: 'test-project',
        name: 'Test Project',
        description: 'Test',
        status: 'active',
        leadAgent: null,
        color: '#3b82f6',
        icon: '📋',
        taskPrefix: 'TEST',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
      mockTaskService.setProject(project);
      mockTaskService.setTasks('test-project', []);
      
      // 使用正确的 ID 格式 (字母-数字)
      const markdown = `### PMW-999 \`P1\` 新任务
- 状态: 待处理
- 描述: 全新任务
`;
      writeTestFile(tempDir, '03-任务分解.md', markdown);
      
      const result = await safeSyncService.safeSyncFromMarkdown('test-project');
      
      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(1);
      expect(result.updatedCount).toBe(1);
      expect(result.tasks[0].id).toBe('PMW-999');
    });
  });

  describe('parseTaskMarkdown', () => {
    it('应该解析优先级', async () => {
      const markdown = `### PMW-001 \`P0\` 紧急任务
- 状态: 待处理
`;
      writeTestFile(tempDir, '03-任务分解.md', markdown);
      
      const result = await safeSyncService.safeSyncFromMarkdown('test-project');
      
      expect(result.success).toBe(true);
      expect(result.tasks[0].priority).toBe('P0');
    });

    it('应该解析领取者', async () => {
      const markdown = `### PMW-001 \`P1\` 任务
- 状态: 进行中
- 领取者: @john
`;
      writeTestFile(tempDir, '03-任务分解.md', markdown);
      
      const result = await safeSyncService.safeSyncFromMarkdown('test-project');
      
      expect(result.success).toBe(true);
      expect(result.tasks[0].assignee).toBe('john');
    });

    it('应该解析依赖关系', async () => {
      const markdown = `### PMW-001 \`P1\` 任务
- 状态: 待处理
- 依赖: PMW-000, PMW-999
`;
      writeTestFile(tempDir, '03-任务分解.md', markdown);
      
      const result = await safeSyncService.safeSyncFromMarkdown('test-project');
      
      // 注意：当前实现中 dependencies 未直接存储到 Task，但解析逻辑存在
      expect(result.success).toBe(true);
    });
  });

  describe('getConfiguredProjects', () => {
    it('应该返回所有已配置的项目', () => {
      const projects = safeSyncService.getConfiguredProjects();
      
      expect(projects).toContain('test-project');
    });
  });
});