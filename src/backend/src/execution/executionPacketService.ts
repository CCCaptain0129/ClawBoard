import * as path from 'path';
import { getProjectRoot, getTasksRoot, getWorkspaceRoot } from '../config/paths';
import { ProjectMemoryService } from '../memory/projectMemoryService';
import { Task } from '../types/tasks';
import { TaskExecutionPacket } from './types';

export class ExecutionPacketService {
  constructor(private projectMemoryService: ProjectMemoryService = new ProjectMemoryService()) {}

  buildPacket(projectId: string, task: Task): TaskExecutionPacket {
    const memory = this.projectMemoryService.getProjectMemory(projectId, task);

    return {
      projectId,
      taskId: task.id,
      taskTitle: task.title,
      taskGoal: this.buildTaskGoal(task),
      projectSummary: memory.planningSummary,
      hardConstraints: memory.hardConstraints,
      taskContextSummary: task.contextSummary?.trim() || task.description.trim(),
      sourceOfTruthDocs: memory.relevantDocs,
      sourceOfTruthFiles: this.buildRelevantFiles(projectId, memory.relevantDocs),
      fallbackInstructions: this.buildFallbackInstructions(projectId, memory.relevantDocs),
      constraints: this.buildConstraints(task),
      acceptanceCriteria: this.buildAcceptanceCriteria(task),
      expectedDeliverables: this.buildDeliverables(task),
      outputLocation: null,
      handoffNotes: this.buildHandoffNotes(memory.relevantFacts),
    };
  }

  private buildTaskGoal(task: Task): string {
    const description = task.description.trim();
    if (description.length > 0 && description !== task.title) {
      return description;
    }

    return task.title.trim();
  }

  private buildRelevantFiles(projectId: string, docs: string[]): string[] {
    const projectRoot = getProjectRoot(projectId);
    const files = [
      getWorkspaceRoot(),
      path.join(getTasksRoot(), `${projectId}-tasks.json`),
      ...docs.map((doc) => path.join(projectRoot, doc)),
    ];

    return files.filter((file, index, array) => array.indexOf(file) === index);
  }

  private buildFallbackInstructions(projectId: string, docs: string[]): string[] {
    const instructions: string[] = [
      `如需确认任务运行态真源，查看 ${path.join(getTasksRoot(), `${projectId}-tasks.json`)}`,
    ];

    for (const doc of docs) {
      if (doc.includes('01-project-plan')) {
        instructions.push(`如需确认技术栈、接口或关键路径，优先查看 ${doc}`);
      } else if (doc.endsWith('-TASKS.md')) {
        instructions.push(`如需确认任务拆解、依赖或阶段信息，查看 ${doc}`);
      } else {
        instructions.push(`如需补充上下文，查看 ${doc}`);
      }
    }

    if (instructions.length === 0) {
      instructions.push(`如执行包信息不足，请在项目 ${projectId} 的规划文档和任务文档中补查相关信息。`);
    }

    return instructions;
  }

  private buildConstraints(task: Task): string[] {
    const constraints: string[] = [];

    if (task.executionMode === 'manual') {
      constraints.push('该任务默认按人工审阅标准执行，变更前先确保输出可检查。');
    }

    if (task.agentType) {
      constraints.push(`建议使用 ${task.agentType} 类型的执行方式聚焦当前任务。`);
    }

    return constraints;
  }

  private buildAcceptanceCriteria(task: Task): string[] {
    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      return task.acceptanceCriteria;
    }

    return ['完成任务目标，并给出可检查的结果说明。'];
  }

  private buildDeliverables(task: Task): string[] {
    if (task.deliverables && task.deliverables.length > 0) {
      return task.deliverables;
    }

    return ['任务结果说明'];
  }

  private buildHandoffNotes(relevantFacts: string[]): string | null {
    if (relevantFacts.length === 0) {
      return null;
    }

    return relevantFacts.join('\n');
  }
}
