import { describe, expect, it } from 'vitest';
import { WorkflowPolicyService } from '../src/execution/workflowPolicyService';
import { ProjectExecutionConfig } from '../src/execution/types';
import { Task } from '../src/types/tasks';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'TEST-001',
    title: 'Test task',
    description: 'Test description',
    status: 'todo',
    priority: 'P1',
    labels: [],
    assignee: null,
    claimedBy: null,
    dependencies: [],
    contextSummary: 'Context summary',
    acceptanceCriteria: ['完成验收'],
    deliverables: ['输出结果'],
    executionMode: 'auto',
    agentType: 'general',
    blockingReason: null,
    dueDate: null,
    estimatedTime: null,
    startTime: null,
    completeTime: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    comments: [],
    ...overrides,
  };
}

function createProjectConfig(overrides: Partial<ProjectExecutionConfig> = {}): ProjectExecutionConfig {
  return {
    projectId: 'test-project',
    leadAgent: null,
    autoDispatchEnabled: true,
    executionMode: 'auto',
    maxConcurrentSubagents: 3,
    ...overrides,
  };
}

describe('WorkflowPolicyService', () => {
  it('项目 executionMode 为 manual 时，不应单独阻断自动派发', () => {
    const service = new WorkflowPolicyService();
    const task = createTask({ executionMode: 'auto' });
    const config = createProjectConfig({ executionMode: 'manual', autoDispatchEnabled: true });

    const eligible = service.isTaskAutoDispatchEligible(task, [task], config);

    expect(eligible).toBe(true);
  });

  it('当任务已指定负责人且满足其他条件时，仍允许自动派发', () => {
    const service = new WorkflowPolicyService();
    const task = createTask({ assignee: 'Alice' });
    const config = createProjectConfig();

    const eligible = service.isTaskAutoDispatchEligible(task, [task], config);

    expect(eligible).toBe(true);
  });

  it('当负责人为空白字符串时，应允许自动派发', () => {
    const service = new WorkflowPolicyService();
    const task = createTask({ assignee: '   ' });
    const config = createProjectConfig();

    const eligible = service.isTaskAutoDispatchEligible(task, [task], config);

    expect(eligible).toBe(true);
  });

  it('当无负责人且满足其他条件时，应允许自动派发', () => {
    const service = new WorkflowPolicyService();
    const task = createTask({ assignee: null });
    const config = createProjectConfig();

    const eligible = service.isTaskAutoDispatchEligible(task, [task], config);

    expect(eligible).toBe(true);
  });

  it('进行中但未被占用的任务，应允许自动派发', () => {
    const service = new WorkflowPolicyService();
    const task = createTask({ status: 'in-progress', claimedBy: null });
    const config = createProjectConfig();

    const eligible = service.isTaskAutoDispatchEligible(task, [task], config);

    expect(eligible).toBe(true);
  });

  it('进行中且已被占用的任务，不应重复自动派发', () => {
    const service = new WorkflowPolicyService();
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    const task = createTask({
      status: 'in-progress',
      claimedBy: 'agent:main:subagent:abc',
      updatedAt: thirtySecondsAgo,
      startTime: thirtySecondsAgo,
    });
    const config = createProjectConfig();

    const eligible = service.isTaskAutoDispatchEligible(task, [task], config);

    expect(eligible).toBe(false);
  });

  it('claimedBy 超过 1 分钟且无活跃 subagent 时，应视为可重新派发', () => {
    const service = new WorkflowPolicyService();
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const task = createTask({
      status: 'in-progress',
      claimedBy: 'subagent',
      updatedAt: twoMinutesAgo,
      startTime: twoMinutesAgo,
    });
    const config = createProjectConfig();

    const eligible = service.isTaskAutoDispatchEligible(task, [task], config);

    expect(eligible).toBe(true);
  });

  it('claimedBy 在 1 分钟内时，应避免重复派发', () => {
    const service = new WorkflowPolicyService();
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    const task = createTask({
      status: 'in-progress',
      claimedBy: 'subagent',
      updatedAt: thirtySecondsAgo,
      startTime: thirtySecondsAgo,
    });
    const config = createProjectConfig();

    const eligible = service.isTaskAutoDispatchEligible(task, [task], config);

    expect(eligible).toBe(false);
  });

  it('claimedBy 对应活跃 subagent 会话时，即使超过 1 分钟也不应重复派发', () => {
    const service = new WorkflowPolicyService();
    const oldTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const sessionsPath = path.join(os.tmpdir(), `workflow-policy-sessions-${Date.now()}.json`);

    const previousPath = process.env.OPENCLAW_SESSIONS_PATH;
    process.env.OPENCLAW_SESSIONS_PATH = sessionsPath;
    (WorkflowPolicyService as any).sessionsCache = null;
    fs.writeFileSync(
      sessionsPath,
      JSON.stringify({
        'agent:main:subagent:test-active': {
          updatedAt: Date.now(),
        },
      }),
      'utf-8'
    );

    try {
      const task = createTask({
        status: 'in-progress',
        claimedBy: 'agent:main:subagent:test-active',
        updatedAt: oldTime,
        startTime: oldTime,
      });
      const config = createProjectConfig();

      const eligible = service.isTaskAutoDispatchEligible(task, [task], config);

      expect(eligible).toBe(false);
    } finally {
      if (previousPath === undefined) {
        delete process.env.OPENCLAW_SESSIONS_PATH;
      } else {
        process.env.OPENCLAW_SESSIONS_PATH = previousPath;
      }
      (WorkflowPolicyService as any).sessionsCache = null;
      if (fs.existsSync(sessionsPath)) {
        fs.unlinkSync(sessionsPath);
      }
    }
  });

  it('并发上限只应统计已被占用的进行中任务', () => {
    const service = new WorkflowPolicyService();
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    const tasks: Task[] = [
      createTask({
        id: 'A',
        status: 'in-progress',
        claimedBy: 'agent:main:subagent:1',
        updatedAt: thirtySecondsAgo,
        startTime: thirtySecondsAgo,
      }),
      createTask({ id: 'B', status: 'in-progress', claimedBy: null }),
      createTask({ id: 'C', status: 'todo', claimedBy: null }),
    ];

    expect(service.getActiveTaskCount(tasks)).toBe(1);
    expect(service.hasAvailableCapacity(tasks, createProjectConfig({ maxConcurrentSubagents: 1 }))).toBe(false);
    expect(service.hasAvailableCapacity(tasks, createProjectConfig({ maxConcurrentSubagents: 2 }))).toBe(true);
  });
});
