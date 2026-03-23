import { TaskService } from '../services/taskService';
import { SubagentManager } from '../services/subagentManager';
import { Task } from '../types/tasks';
import { WebSocketHandler } from '../websocket/server';
import { ExecutionPacketService } from './executionPacketService';
import { ProjectConfigService } from './projectConfigService';
import { TaskSelectionService } from './taskSelectionService';

export class ProjectExecutionService {
  private isRunning = false;

  constructor(
    private taskService: TaskService,
    private wsServer: WebSocketHandler,
    private projectConfigService: ProjectConfigService = new ProjectConfigService(),
    private taskSelectionService: TaskSelectionService = new TaskSelectionService(),
    private executionPacketService: ExecutionPacketService = new ExecutionPacketService(),
    private subagentManager: SubagentManager = new SubagentManager(taskService)
  ) {}

  async runCycle(): Promise<void> {
    if (this.isRunning) {
      console.log('[ProjectExecutionService] Previous cycle still running, skipping');
      return;
    }

    this.isRunning = true;

    try {
      const projects = await this.taskService.getAllProjects();

      for (const project of projects) {
        const projectConfig = this.projectConfigService.getEffectiveConfig(project);
        if (!projectConfig.autoDispatchEnabled) {
          continue;
        }

        const tasks = await this.taskService.getTasksByProject(project.id);
        const selection = this.taskSelectionService.selectNextTask(tasks, projectConfig);
        if (!selection.taskId) {
          console.log(`[ProjectExecutionService] ${project.id}: ${selection.reason}`);
          continue;
        }

        const selectedTask = tasks.find((task) => task.id === selection.taskId);
        if (!selectedTask) {
          console.warn(`[ProjectExecutionService] Selected task ${selection.taskId} not found in ${project.id}`);
          continue;
        }

        await this.dispatchTask(project.id, selectedTask, selection.reason);
      }
    } catch (error) {
      console.error('[ProjectExecutionService] Run cycle failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async previewProject(projectId: string, forceAutoDispatch = false): Promise<{
    projectId: string;
    selectedTaskId: string | null;
    reason: string;
    packet: ReturnType<ExecutionPacketService['buildPacket']> | null;
  }> {
    const project = (await this.taskService.getAllProjects()).find((item) => item.id === projectId);
    if (!project) {
      throw new Error(`Project "${projectId}" not found`);
    }

    const effectiveConfig = this.projectConfigService.getEffectiveConfig(project);
    const projectConfig = {
      ...effectiveConfig,
      autoDispatchEnabled: forceAutoDispatch ? true : effectiveConfig.autoDispatchEnabled,
    };
    const tasks = await this.taskService.getTasksByProject(project.id);
    const selection = this.taskSelectionService.selectNextTask(tasks, projectConfig);

    if (!selection.taskId) {
      return {
        projectId,
        selectedTaskId: null,
        reason: selection.reason,
        packet: null,
      };
    }

    const task = tasks.find((item) => item.id === selection.taskId);
    if (!task) {
      throw new Error(`Selected task "${selection.taskId}" not found`);
    }

    return {
      projectId,
      selectedTaskId: task.id,
      reason: selection.reason,
      packet: this.executionPacketService.buildPacket(projectId, task),
    };
  }

  async dispatchOnce(projectId: string, forceAutoDispatch = false): Promise<{
    projectId: string;
    dispatched: boolean;
    taskId: string | null;
    reason: string;
    subagentId?: string;
  }> {
    const preview = await this.previewProject(projectId, forceAutoDispatch);
    if (!preview.selectedTaskId || !preview.packet) {
      return {
        projectId,
        dispatched: false,
        taskId: null,
        reason: preview.reason,
      };
    }

    const tasks = await this.taskService.getTasksByProject(projectId);
    const task = tasks.find((item) => item.id === preview.selectedTaskId);
    if (!task) {
      throw new Error(`Task "${preview.selectedTaskId}" not found before dispatch`);
    }

    const subagentId = await this.dispatchTask(projectId, task, preview.reason);

    return {
      projectId,
      dispatched: true,
      taskId: task.id,
      reason: preview.reason,
      subagentId,
    };
  }

  async getTaskExecutionContext(projectId: string, taskId: string): Promise<{
    projectId: string;
    taskId: string;
    projectName: string;
    packet: ReturnType<ExecutionPacketService['buildPacket']>;
    prompt: string;
    mainAgentChecklist: string[];
  }> {
    const project = (await this.taskService.getAllProjects()).find((item) => item.id === projectId);
    if (!project) {
      throw new Error(`Project "${projectId}" not found`);
    }

    const tasks = await this.taskService.getTasksByProject(projectId);
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      throw new Error(`Task "${taskId}" not found in project "${projectId}"`);
    }

    const packet = this.executionPacketService.buildPacket(projectId, task);

    return {
      projectId,
      taskId,
      projectName: project.name,
      packet,
      prompt: this.buildSubagentPrompt(project.name, packet),
      mainAgentChecklist: this.buildMainAgentChecklist(project.id, task),
    };
  }

  async getProjectExecutionGuide(projectId: string): Promise<{
    projectId: string;
    projectName: string;
    docs: {
      planningDoc: string | null;
      taskDoc: string | null;
      progressDoc: string | null;
    };
    startupChecklist: string[];
    subagentDispatchRules: string[];
    suggestedPrompt: string;
  }> {
    const project = (await this.taskService.getAllProjects()).find((item) => item.id === projectId);
    if (!project) {
      throw new Error(`Project "${projectId}" not found`);
    }

    const config = this.projectConfigService.getConfigByProjectId(projectId);
    const docs = {
      planningDoc: config?.planningDoc || null,
      taskDoc: config?.taskDoc || null,
      progressDoc: config?.progressDoc || null,
    };

    return {
      projectId,
      projectName: project.name,
      docs,
      startupChecklist: [
        '先阅读项目规划、任务拆解、进度跟踪三份文档，再决定是否执行任务。',
        '确认当前任务 JSON 真源文件中的状态、交付物、验收标准是否完整。',
        '优先通过 /api/execution/projects/:projectId/tasks/:taskId/context 获取结构化执行包，而不是手工拼接 prompt。',
        '主 Agent 负责调度与验收，复杂实现、命令执行、跨文件检查应优先派发给 Subagent。',
      ],
      subagentDispatchRules: [
        '任务目标、交付物、验收标准缺失时，不要直接派发。',
        'Subagent 默认只处理单个任务，不要让其从头理解整个项目。',
        'Subagent 返回后先进入 review，由人工或主 Agent 验收后再进入 done。',
        '如果执行包信息不足，只允许回查指定的真源文档和文件，不要自由扩展搜索范围。',
      ],
      suggestedPrompt: this.buildMainAgentPrompt(project.id, project.name, docs),
    };
  }

  private async dispatchTask(projectId: string, task: Task, reason: string): Promise<string> {
    const project = (await this.taskService.getAllProjects()).find((item) => item.id === projectId);
    const packet = this.executionPacketService.buildPacket(projectId, task);
    const taskDescription = `${this.buildSubagentPrompt(project?.name || projectId, packet)}\n\n调度原因: ${reason}`;

    console.log(`[ProjectExecutionService] Dispatching ${task.id} for project ${projectId}`);
    const subagentId = await this.subagentManager.createSubagent({
      projectId,
      taskId: task.id,
      taskTitle: task.title,
      taskDescription,
      subagentType: this.mapAgentType(task.agentType),
    });

    const updatedTask = await this.taskService.getTasksByProject(projectId)
      .then((tasks) => tasks.find((item) => item.id === task.id) || null);
    if (updatedTask) {
      this.wsServer.broadcastTaskUpdate(projectId, updatedTask);
    }

    return subagentId;
  }

  private buildSubagentPrompt(projectLabel: string, packet: ReturnType<ExecutionPacketService['buildPacket']>): string {
    const hardConstraints = packet.hardConstraints.length > 0
      ? packet.hardConstraints.map((item) => `- ${item}`).join('\n')
      : '- 遵循项目现有结构和约束，不要自行扩展无关范围。';

    const docs = packet.sourceOfTruthDocs.length > 0
      ? packet.sourceOfTruthDocs.map((item) => `- ${item}`).join('\n')
      : '- 当前未提供额外文档路径。';

    const files = packet.sourceOfTruthFiles.length > 0
      ? packet.sourceOfTruthFiles.map((item) => `- ${item}`).join('\n')
      : '- 当前未提供额外文件路径。';

    const fallbackInstructions = packet.fallbackInstructions.length > 0
      ? packet.fallbackInstructions.map((item) => `- ${item}`).join('\n')
      : '- 若上下文不足，先暂停并请求补充，不要自行脑补。';

    const deliverables = packet.expectedDeliverables.length > 0
      ? packet.expectedDeliverables.map((item) => `- ${item}`).join('\n')
      : '- 输出本次任务的结果说明。';

    const acceptance = packet.acceptanceCriteria.length > 0
      ? packet.acceptanceCriteria.map((item) => `- ${item}`).join('\n')
      : '- 结果可检查，且满足任务目标。';

    const constraints = packet.constraints.length > 0
      ? packet.constraints.map((item) => `- ${item}`).join('\n')
      : '- 只处理当前任务，不修改无关内容。';

    const handoffNotes = packet.handoffNotes?.trim()
      ? `## Additional Notes（补充说明）\n${packet.handoffNotes}\n\n`
      : '';

    return `# ${packet.taskTitle}

你是一个只负责当前任务的 Subagent。不要从头理解整个项目，只根据下面的信息完成当前任务。

## Task Identity（任务身份）
- 项目: ${projectLabel}
- 任务 ID: ${packet.taskId}
- 任务标题: ${packet.taskTitle}

## Goal（目标）
${packet.taskGoal}

## Project Summary（项目摘要）
${packet.projectSummary || '当前未提供项目摘要，请优先使用下方硬约束和真源文档。'}

## Task Context（任务上下文）
${packet.taskContextSummary || '当前未提供额外任务上下文。'}

## Hard Constraints（硬约束）
${hardConstraints}

## Source-of-truth Docs（真源文档）
${docs}

## Source-of-truth Files（真源文件）
${files}

## Fallback Instructions（信息不足时）
${fallbackInstructions}

## Deliverables（交付物）
${deliverables}

## Acceptance Criteria（验收标准）
${acceptance}

## Execution Constraints（执行约束）
${constraints}

${handoffNotes}## Output Format（输出格式）
- 简要说明你做了什么
- 列出关键结果或产物位置
- 说明是否已满足验收标准
- 如果没有满足，明确指出阻塞点
- 在回复末尾必须输出“完成信号”代码块，严格使用以下格式（不要改字段名）：
  \`\`\`completion_signal
  task_id: ${packet.taskId}
  status: done | blocked
  summary: <一句话总结>
  deliverables: <逗号分隔的产物路径或结果>
  next_step: <若 blocked，写阻塞点和建议下一步；若 done，写 N/A>
  \`\`\`
`.trim();
  }

  private buildMainAgentChecklist(projectId: string, task: Task): string[] {
    const checklist = [
      `先确认任务 ${task.id} 当前状态、目标、交付物和验收标准是否完整。`,
      `优先调用 /api/execution/projects/${projectId}/tasks/${task.id}/context 获取结构化执行包。`,
      '只有在任务需要实际实现、命令执行、跨文件排查或较长时间处理时，才优先创建 Subagent。',
      '派发时直接使用执行上下文接口返回的 prompt 作为基础，不要手工遗漏硬约束。',
      '要求 Subagent 在回复末尾输出 completion_signal 代码块，便于系统识别结束状态。',
      'Subagent 返回后先进入 review，再由人工或主 Agent 判断是否 done。',
    ];

    if (task.executionMode === 'manual') {
      checklist.splice(2, 0, '该任务默认是人工确认模式，如需派发，先确认本次是否属于受控测试或明确授权。');
    }

    return checklist;
  }

  private buildMainAgentPrompt(
    projectId: string,
    projectName: string,
    docs: { planningDoc: string | null; taskDoc: string | null; progressDoc: string | null }
  ): string {
    const docLines = [
      docs.planningDoc ? `- 项目规划: ${docs.planningDoc}` : null,
      docs.taskDoc ? `- 任务拆解: ${docs.taskDoc}` : null,
      docs.progressDoc ? `- 进度跟踪: ${docs.progressDoc}` : null,
    ].filter(Boolean).join('\n');

    return `你现在是项目 "${projectName}" 的主 Agent。

你的职责是先理解项目，再挑选任务、打包上下文、决定是否创建 Subagent，并在结果返回后执行验收。

请按下面顺序工作：
1. 先阅读项目文档：
${docLines || '- 当前未配置项目文档。'}
2. 再查看任务真源与状态。
3. 对单个任务先调用：
   GET /api/execution/projects/${projectId}/tasks/:taskId/context
4. 只有当任务适合下放执行时，才创建 Subagent。
5. 派发时优先直接使用接口返回的 prompt，不要手工重写硬约束。
6. Subagent 完成后先进入 review，不要直接视为 done。

如果信息不足，只允许从项目真源文档和执行上下文接口补查，不要自由发挥。`;
  }

  private mapAgentType(agentType: Task['agentType']): 'Dev Agent' | 'Test Agent' | 'Debug Agent' | undefined {
    switch (agentType) {
      case 'test':
        return 'Test Agent';
      case 'debug':
        return 'Debug Agent';
      case 'dev':
      case 'general':
      default:
        return 'Dev Agent';
    }
  }
}
