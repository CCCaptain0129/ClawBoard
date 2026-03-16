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
    if (!projectConfig.autoDispatchEnabled) {
      return false;
    }

    if (projectConfig.executionMode === 'manual') {
      return false;
    }

    if (task.status !== 'todo') {
      return false;
    }

    if (task.executionMode === 'manual') {
      return false;
    }

    if (!this.hasMinimumExecutionInfo(task)) {
      return false;
    }

    if (!this.areDependenciesSatisfied(task, allTasks)) {
      return false;
    }

    return true;
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
