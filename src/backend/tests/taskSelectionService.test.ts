import { describe, expect, it } from 'vitest';
import { TaskSelectionService } from '../src/execution/taskSelectionService';
import { ProjectExecutionConfig } from '../src/execution/types';
import { Task } from '../src/types/tasks';

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'TASK-001',
    title: 'Task',
    description: 'Task description',
    status: 'todo',
    priority: 'P1',
    labels: [],
    assignee: null,
    claimedBy: null,
    dependencies: [],
    contextSummary: 'Context',
    acceptanceCriteria: ['通过验收'],
    deliverables: ['提交结果'],
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

function createConfig(overrides: Partial<ProjectExecutionConfig> = {}): ProjectExecutionConfig {
  return {
    projectId: 'test-project',
    leadAgent: null,
    autoDispatchEnabled: true,
    executionMode: 'auto',
    maxConcurrentSubagents: 3,
    ...overrides,
  };
}

describe('TaskSelectionService', () => {
  it('当任务已指定负责人且满足条件时，仍应可被选中自动派发', () => {
    const service = new TaskSelectionService();
    const task = createTask({ id: 'TASK-ASSIGNED', assignee: 'Alice' });
    const config = createConfig();

    const result = service.selectNextTask([task], config);

    expect(result.taskId).toBe('TASK-ASSIGNED');
  });

  it('应优先选择可自动派发的任务', () => {
    const service = new TaskSelectionService();
    const tasks = [
      createTask({ id: 'TASK-ASSIGNED', assignee: 'Alice' }),
      createTask({ id: 'TASK-OPEN', assignee: null, priority: 'P0' }),
    ];
    const config = createConfig();

    const result = service.selectNextTask(tasks, config);

    expect(result.taskId).toBe('TASK-OPEN');
  });
});
