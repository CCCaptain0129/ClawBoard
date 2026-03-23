import { Task } from '../types/tasks';
import { ProjectExecutionConfig } from './types';

const PRIORITY_ORDER: Record<Task['priority'], number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

export class WorkflowPolicyService {
  isTaskAutoDispatchEligible(task: Task, allTasks: Task[], projectConfig: ProjectExecutionConfig): boolean {
    return this.getIneligibleReason(task, allTasks, projectConfig) === null;
  }

  getIneligibleReason(task: Task, allTasks: Task[], projectConfig: ProjectExecutionConfig): string | null {
    if (!projectConfig.autoDispatchEnabled) {
      return '项目未开启自动调度';
    }

    if (projectConfig.executionMode === 'manual') {
      return '项目执行模式为手动';
    }

    if (task.status !== 'todo') {
      return `任务状态为 ${task.status}`;
    }

    if (task.executionMode === 'manual') {
      return '任务执行模式为手动';
    }

    if (this.hasAssignee(task)) {
      return `任务已指定负责人（${task.assignee?.trim()}）`;
    }

    if (!this.hasMinimumExecutionInfo(task)) {
      return '任务缺少执行信息（目标/交付物/验收标准）';
    }

    if (!this.areDependenciesSatisfied(task, allTasks)) {
      return '任务依赖未完成';
    }

    return null;
  }

  private hasAssignee(task: Task): boolean {
    return (task.assignee ?? '').trim().length > 0;
  }

  hasMinimumExecutionInfo(task: Task): boolean {
    const hasGoal = task.title.trim().length > 0 || task.description.trim().length > 0;
    const hasDeliverables = (task.deliverables?.length ?? 0) > 0;
    const hasAcceptanceCriteria = (task.acceptanceCriteria?.length ?? 0) > 0;

    return hasGoal && hasDeliverables && hasAcceptanceCriteria;
  }

  areDependenciesSatisfied(task: Task, allTasks: Task[]): boolean {
    const dependencies = task.dependencies ?? [];
    if (dependencies.length === 0) {
      return true;
    }

    const completedIds = new Set(allTasks.filter((item) => item.status === 'done').map((item) => item.id));
    return dependencies.every((dependencyId) => completedIds.has(dependencyId));
  }

  getPriorityScore(task: Task): number {
    return PRIORITY_ORDER[task.priority];
  }

  getActiveTaskCount(tasks: Task[]): number {
    return tasks.filter((task) => task.status === 'in-progress').length;
  }

  hasAvailableCapacity(tasks: Task[], projectConfig: ProjectExecutionConfig): boolean {
    return this.getActiveTaskCount(tasks) < projectConfig.maxConcurrentSubagents;
  }
}
