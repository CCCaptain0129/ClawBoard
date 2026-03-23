import { describe, expect, it } from 'vitest';
import { WorkflowPolicyService } from '../src/execution/workflowPolicyService';
import { ProjectExecutionConfig } from '../src/execution/types';
import { Task } from '../src/types/tasks';

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
  it('当任务已指定负责人时，不应自动派发', () => {
    const service = new WorkflowPolicyService();
    const task = createTask({ assignee: 'Alice' });
    const config = createProjectConfig();

    const eligible = service.isTaskAutoDispatchEligible(task, [task], config);

    expect(eligible).toBe(false);
  });

  it('当负责人为空白字符串时，应视为未指定负责人', () => {
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
});
