import { Task } from '../types/tasks';
import { ProjectExecutionConfig, TaskSelectionResult } from './types';
import { WorkflowPolicyService } from './workflowPolicyService';

export class TaskSelectionService {
  constructor(private workflowPolicyService: WorkflowPolicyService = new WorkflowPolicyService()) {}

  selectNextTask(tasks: Task[], projectConfig: ProjectExecutionConfig): TaskSelectionResult {
    if (!this.workflowPolicyService.hasAvailableCapacity(tasks, projectConfig)) {
      return {
        taskId: null,
        reason: `项目已达到并发上限 ${projectConfig.maxConcurrentSubagents}`,
      };
    }

    const candidates = tasks
      .filter((task) => this.workflowPolicyService.isTaskAutoDispatchEligible(task, tasks, projectConfig))
      .sort((a, b) => {
        const priorityDiff = this.workflowPolicyService.getPriorityScore(a) - this.workflowPolicyService.getPriorityScore(b);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    const selectedTask = candidates[0];
    if (!selectedTask) {
      return {
        taskId: null,
        reason: '没有满足自动派发条件的任务',
      };
    }

    return {
      taskId: selectedTask.id,
      reason: `按优先级和依赖规则选择 ${selectedTask.id}`,
    };
  }
}
