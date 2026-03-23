/**
 * SubagentMonitorService - Completion Signal Test
 * 
 * 测试目标：验证 SubagentMonitorService 能够正确识别 completion_signal
 * 并驱动任务状态流转。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { SubagentMonitorService } from '../src/services/subagentMonitor';
import type { Task } from '../src/types/tasks';

// Mock TaskService
class MockTaskService {
  private tasks: Map<string, Task[]> = new Map();

  async getAllProjects(): Promise<Array<{ id: string; name: string }>> {
    return [
      { id: 'test-project', name: 'Test Project' }
    ];
  }

  async getTasksByProject(projectId: string): Promise<Task[]> {
    return this.tasks.get(projectId) || [];
  }

  async updateTask(projectId: string, taskId: string, updates: Partial<Task>): Promise<void> {
    const tasks = this.tasks.get(projectId);
    if (tasks) {
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      if (taskIndex >= 0) {
        tasks[taskIndex] = { ...tasks[taskIndex], ...updates };
      }
    }
  }

  // Helper methods for testing
  setTasks(projectId: string, tasks: Task[]): void {
    this.tasks.set(projectId, tasks);
  }

  getTask(projectId: string, taskId: string): Task | undefined {
    const tasks = this.tasks.get(projectId);
    return tasks?.find(t => t.id === taskId);
  }
}

// Mock WebSocketHandler
class MockWebSocketHandler {
  broadcastTaskUpdate(_projectId: string, _task: Task): void {
    // Do nothing in tests
  }
}

describe('SubagentMonitorService - Completion Signal Handling', () => {
  let taskService: MockTaskService;
  let wsServer: MockWebSocketHandler;
  let monitorService: SubagentMonitorService;
  let tempDir: string;
  let sessionsJsonPath: string;
  let recordingPath: string;

  beforeEach(async () => {
    // Create temp directory
    tempDir = `/tmp/test-subagent-monitor-${Date.now()}`;
    await fs.mkdir(tempDir, { recursive: true });

    // Setup paths
    sessionsJsonPath = path.join(tempDir, 'sessions.json');
    recordingPath = path.join(tempDir, 'recording.md');

    // Initialize services
    taskService = new MockTaskService();
    wsServer = new MockWebSocketHandler();

    // Create SubagentMonitorService with custom paths
    monitorService = new (SubagentMonitorService as any)(taskService, {
      sessionsJsonPath,
      recordingPath,
      intervalMs: 1000, // Fast polling for tests
      completionThresholdMs: 1000,
      wsServer
    });

    // Create initial sessions.json
    await fs.writeFile(sessionsJsonPath, JSON.stringify({}));
    await fs.writeFile(recordingPath, '# Subagent Recording\n');
  });

  afterEach(async () => {
    monitorService.stop();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Completion Signal Recognition', () => {
    it('should parse completion_signal from assistant message', () => {
      const content = JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: '已完成任务。\n\n```completion_signal\ntask_id: TEST-001\nstatus: done\nsummary: 实现了完成信号识别\n```\n'
            }
          ]
        }
      });

      const signals = (monitorService as any).extractCompletionSignalsFromJsonl(content);

      expect(signals).toHaveLength(1);
      expect(signals[0].taskId).toBe('TEST-001');
      expect(signals[0].status).toBe('done');
      expect(signals[0].summary).toBe('实现了完成信号识别');
    });

    it('should parse completion_signal with blocked status', () => {
      const content = JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: '任务阻塞。\n\n```completion_signal\ntask_id: TEST-002\nstatus: blocked\nsummary: 缺少必要依赖\nnext_step: 安装依赖后重试\n```\n'
            }
          ]
        }
      });

      const signals = (monitorService as any).extractCompletionSignalsFromJsonl(content);

      expect(signals).toHaveLength(1);
      expect(signals[0].taskId).toBe('TEST-002');
      expect(signals[0].status).toBe('blocked');
      expect(signals[0].nextStep).toBe('安装依赖后重试');
    });

    it('should handle multiple completion signals in one message', () => {
      const content = JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: '完成任务1。\n```completion_signal\ntask_id: TEST-001\nstatus: done\nsummary: 完成1\n```\n\n完成任务2。\n```completion_signal\ntask_id: TEST-002\nstatus: done\nsummary: 完成2\n```\n'
            }
          ]
        }
      });

      const signals = (monitorService as any).extractCompletionSignalsFromJsonl(content);

      expect(signals).toHaveLength(2);
      expect(signals[0].taskId).toBe('TEST-001');
      expect(signals[1].taskId).toBe('TEST-002');
    });

    it('should ignore non-assistant messages', () => {
      const content = JSON.stringify({
        type: 'message',
        message: {
          role: 'user',
          content: 'This is a user message'
        }
      });

      const signals = (monitorService as any).extractCompletionSignalsFromJsonl(content);

      expect(signals).toHaveLength(0);
    });

    it('should handle malformed completion_signal gracefully', () => {
      const content = JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: '```completion_signal\ninvalid format\n```\n'
            }
          ]
        }
      });

      const signals = (monitorService as any).extractCompletionSignalsFromJsonl(content);

      expect(signals).toHaveLength(0);
    });
  });

  describe('Status Transition', () => {
    it('should transition task from in-progress to review on done signal', async () => {
      // Setup task
      const task: Task = {
        id: 'TEST-001',
        title: 'Test Task',
        description: 'Test description',
        status: 'in-progress',
        priority: 'P1',
        labels: [],
        assignee: null,
        claimedBy: 'agent:main:subagent:test123',
        dependencies: [],
        acceptanceCriteria: [],
        deliverables: [],
        executionMode: 'auto',
        agentType: 'general',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      taskService.setTasks('test-project', [task]);

      // Create completion signal
      const signal = {
        taskId: 'TEST-001',
        status: 'done' as const,
        summary: 'Task completed successfully',
        deliverables: 'file1.ts, file2.ts',
        nextStep: 'N/A'
      };

      // Apply signal
      await (monitorService as any).applyCompletionSignal(
        'agent:main:subagent:test123',
        signal,
        'session-file.jsonl'
      );

      // Verify transition
      const updatedTask = taskService.getTask('test-project', 'TEST-001');
      expect(updatedTask?.status).toBe('review');
      expect(updatedTask?.claimedBy).toBe(null);
      expect(updatedTask?.completeTime).toBeTruthy();
      expect(updatedTask?.blockingReason).toBe(null);
    });

    it('should transition task from in-progress to todo on blocked signal', async () => {
      // Setup task
      const task: Task = {
        id: 'TEST-002',
        title: 'Test Task 2',
        description: 'Test description',
        status: 'in-progress',
        priority: 'P1',
        labels: [],
        assignee: null,
        claimedBy: 'agent:main:subagent:test456',
        dependencies: [],
        acceptanceCriteria: [],
        deliverables: [],
        executionMode: 'auto',
        agentType: 'general',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      taskService.setTasks('test-project', [task]);

      // Create completion signal
      const signal = {
        taskId: 'TEST-002',
        status: 'blocked' as const,
        summary: 'Missing dependency',
        deliverables: '',
        nextStep: 'Install required dependency'
      };

      // Apply signal
      await (monitorService as any).applyCompletionSignal(
        'agent:main:subagent:test456',
        signal,
        'session-file.jsonl'
      );

      // Verify transition
      const updatedTask = taskService.getTask('test-project', 'TEST-002');
      expect(updatedTask?.status).toBe('todo');
      expect(updatedTask?.claimedBy).toBe(null);
      expect(updatedTask?.completeTime).toBe(null);
      expect(updatedTask?.blockingReason).toBe('Install required dependency');
    });

    it('should add comment with completion signal details', async () => {
      // Setup task
      const task: Task = {
        id: 'TEST-003',
        title: 'Test Task 3',
        description: 'Test description',
        status: 'in-progress',
        priority: 'P1',
        labels: [],
        assignee: null,
        claimedBy: 'agent:main:subagent:test789',
        dependencies: [],
        acceptanceCriteria: [],
        deliverables: [],
        executionMode: 'auto',
        agentType: 'general',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        comments: []
      };

      taskService.setTasks('test-project', [task]);

      // Create completion signal
      const signal = {
        taskId: 'TEST-003',
        status: 'done' as const,
        summary: 'Task completed',
        deliverables: 'output.txt',
        nextStep: 'N/A'
      };

      // Apply signal
      await (monitorService as any).applyCompletionSignal(
        'agent:main:subagent:test789',
        signal,
        'session-file.jsonl'
      );

      // Verify comment
      const updatedTask = taskService.getTask('test-project', 'TEST-003');
      expect(updatedTask?.comments).toHaveLength(1);
      expect(updatedTask?.comments![0].content).toContain('agent:main:subagent:test789');
      expect(updatedTask?.comments![0].content).toContain('output.txt');
    });

    it('should skip signal if task is not waiting for subagent', async () => {
      // Setup task with status 'todo' (not in-progress)
      const task: Task = {
        id: 'TEST-004',
        title: 'Test Task 4',
        description: 'Test description',
        status: 'todo',
        priority: 'P1',
        labels: [],
        assignee: null,
        claimedBy: null,
        dependencies: [],
        acceptanceCriteria: [],
        deliverables: [],
        executionMode: 'auto',
        agentType: 'general',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      taskService.setTasks('test-project', [task]);

      // Create completion signal
      const signal = {
        taskId: 'TEST-004',
        status: 'done' as const,
        summary: 'Task completed',
        deliverables: '',
        nextStep: 'N/A'
      };

      // Apply signal
      await (monitorService as any).applyCompletionSignal(
        'agent:main:subagent:test000',
        signal,
        'session-file.jsonl'
      );

      // Verify no transition
      const updatedTask = taskService.getTask('test-project', 'TEST-004');
      expect(updatedTask?.status).toBe('todo'); // Should remain unchanged
    });
  });

  describe('Recording Status Update', () => {
    it('should update recording file status on done signal', async () => {
      // Create initial recording
      const initialRecording = `### 2026-03-23 12:00 创建 Subagent

**Subagent ID**: \`agent:main:subagent:test123\`
**任务**: TEST-001 - Test Task
**状态**: 🔄 进行中

`;

      await fs.writeFile(recordingPath, initialRecording);

      // Create completion signal
      const signal = {
        taskId: 'TEST-001',
        status: 'done' as const,
        summary: 'Task completed',
        deliverables: '',
        nextStep: 'N/A'
      };

      // Apply signal
      await (monitorService as any).patchRecordStatusFromCompletion(
        'agent:main:subagent:test123',
        signal
      );

      // Verify recording update
      const updatedRecording = await fs.readFile(recordingPath, 'utf-8');
      expect(updatedRecording).toContain('✅ 成功');
      expect(updatedRecording).toContain('**释放时间**:');
    });
  });
});