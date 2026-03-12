import { TaskService } from './taskService';

/**
 * Subagent配置接口
 */
export interface SubagentConfig {
  projectId: string;
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  subagentType?: 'Dev Agent' | 'Test Agent' | 'Debug Agent';
}

/**
 * Subagent结果接口
 */
export interface SubagentResult {
  success: boolean;
  output: string;
  error?: string;
  completedAt: string;
}

/**
 * SubagentManager - 管理Subagent生命周期并同步任务状态
 *
 * 核心功能：
 * - 创建Subagent时自动更新任务状态为 "in-progress"
 * - Subagent完成时自动更新任务状态为 "done" 或 "todo"
 * - 实时更新SUBAGENTS任务分发记录.md
 */
export class SubagentManager {
  private taskService: TaskService;
  private recordingPath: string;

  constructor(taskService: TaskService) {
    this.taskService = taskService;
    this.recordingPath = '/Users/ot/.openclaw/workspace/projects/openclaw-visualization/docs/internal/SUBAGENTS任务分发记录.md';
  }

  /**
   * 创建Subagent并自动更新任务状态
   *
   * @param config - Subagent配置
   * @returns Subagent ID
   */
  async createSubagent(config: SubagentConfig): Promise<string> {
    const subagentId = `agent:main:subagent:${Date.now()}`;
    const now = new Date().toISOString();

    try {
      // 1. 更新任务状态为 "in-progress"
      await this.updateTaskStatus(config.projectId, config.taskId, {
        status: 'in-progress',
        claimedBy: subagentId,
        updatedAt: now
      });

      // 2. 记录到SUBAGENTS任务分发记录.md
      await this.updateSubagentRecord({
        subagentId,
        ...config,
        createdAt: now,
        action: 'create'
      });

      console.log(`✅ Subagent ${subagentId} created for task ${config.taskId}`);
      return subagentId;
    } catch (error) {
      console.error(`❌ Failed to create subagent for task ${config.taskId}:`, error);
      throw error;
    }
  }

  /**
   * 标记Subagent完成并更新任务状态
   *
   * @param subagentId - Subagent ID
   * @param result - Subagent执行结果
   */
  async markSubagentComplete(subagentId: string, result: SubagentResult): Promise<void> {
    try {
      console.log(`[SubagentManager] Marking subagent ${subagentId} as complete...`);

      // 1. 从记录文件中查找对应的任务ID
      const taskId = await this.findTaskIdBySubagentId(subagentId);
      console.log(`[SubagentManager] Found task ID: ${taskId}`);

      if (!taskId) {
        console.warn(`⚠️ Task ID not found for subagent ${subagentId}`);
        return;
      }

      // 2. 更新任务状态为 "done" 或 "todo"（根据结果）
      const status = result.success ? 'done' : 'todo';
      console.log(`[SubagentManager] Updating task ${taskId} to status: ${status}`);

      await this.updateTaskStatus('openclaw-visualization', taskId, {
        status,
        claimedBy: null,
        updatedAt: new Date().toISOString()
      });

      console.log(`✅ Subagent ${subagentId} marked as ${status}`);

      // 3. 更新记录文件
      console.log(`[SubagentManager] Updating recording file...`);
      await this.updateSubagentRecord({
        subagentId,
        action: 'complete',
        result
      });
      console.log(`[SubagentManager] Recording file updated`);
    } catch (error) {
      console.error(`❌ Failed to mark subagent ${subagentId} complete:`, error);
      throw error;
    }
  }

  /**
   * 更新任务状态
   *
   * @param projectId - 项目ID
   * @param taskId - 任务ID
   * @param updates - 更新字段
   */
  private async updateTaskStatus(
    projectId: string,
    taskId: string,
    updates: Partial<{
      status: 'todo' | 'in-progress' | 'done';
      claimedBy: string | null;
      updatedAt: string;
    }>
  ): Promise<void> {
    console.log(`[SubagentManager] updateTaskStatus: projectId=${projectId}, taskId=${taskId}, updates=`, updates);
    await this.taskService.updateTask(projectId, taskId, updates);
  }

  /**
   * 更新SUBAGENTS任务分发记录.md
   *
   * @param data - 记录数据
   */
  private async updateSubagentRecord(data: {
    subagentId: string;
    action: 'create' | 'complete';
    projectId?: string;
    taskId?: string;
    taskTitle?: string;
    taskDescription?: string;
    subagentType?: string;
    createdAt?: string;
    result?: SubagentResult;
  }): Promise<void> {
    const fs = await import('fs/promises');

    if (data.action === 'create') {
      const timestamp = data.createdAt!.slice(0, 16).replace('T', ' ');
      const entry = `
### ${timestamp} 创建 Subagent

**Subagent ID**: \`${data.subagentId}\`
**类型**: ${data.subagentType || 'Dev Agent'}
**任务**: ${data.taskId} - ${data.taskTitle}
**分配时间**: ${data.createdAt}

**任务描述**:
- ${data.taskDescription!.split('\n').join('\n- ')}

**返回结果**:
- 等待 Subagent 完成中...

**释放时间**: -
**状态**: 🔄 进行中

`;

      await fs.appendFile(this.recordingPath, entry, 'utf-8');
    } else if (data.action === 'complete') {
      // 读取整个文件
      const content = await fs.readFile(this.recordingPath, 'utf-8');

      // 查找对应的 Subagent ID 的条目
      const escapedId = data.subagentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const subagentIdPattern = new RegExp(`(### [^\\n]+ 创建 Subagent\\n\\*\\*Subagent ID\\*\\*:\\s*\`${escapedId}\`[^]*?)(\\*\\*状态\\*\\*:\\s*🔄 进行中\\n)`);

      // 替换状态行并添加完成信息
      const timestamp = data.result!.completedAt.slice(0, 16).replace('T', ' ');
      const status = data.result!.success ? '✅ 成功' : '❌ 失败';

      const newContent = content.replace(subagentIdPattern, (match, prefix, statusLine) => {
        // 在状态行之前插入完成信息
        return prefix + `**释放时间**: ${timestamp}\n**状态**: ${status}\n\n**返回结果**:\n- ${data.result!.output.split('\n').join('\n- ')}\n\n`;
      });

      // 如果没有找到匹配，直接追加
      if (newContent === content) {
        const entry = `\n**释放时间**: ${timestamp}\n**状态**: ${status}\n\n**返回结果**:\n- ${data.result!.output.split('\n').join('\n- ')}\n\n`;
        await fs.appendFile(this.recordingPath, entry, 'utf-8');
      } else {
        // 写回文件
        await fs.writeFile(this.recordingPath, newContent, 'utf-8');
      }
    }
  }

  /**
   * 根据Subagent ID查找任务ID
   *
   * @param subagentId - Subagent ID
   * @returns 任务ID或null
   */
  private async findTaskIdBySubagentId(subagentId: string): Promise<string | null> {
    const fs = await import('fs');
    const content = fs.readFileSync(this.recordingPath, 'utf-8');

    // 转义Subagent ID中的特殊字符
    const escapedId = subagentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 使用更精确的匹配：从 Subagent ID 到任务标题
    // 支持多种任务ID格式：VIS-xxx, INT-xxx, EXA-xxx, TASK-xxx, TASK-TEST-xxx 等
    // 格式：PREFIX(XXX)-NNN 或 PREFIX(XXX)-PREFIX(XXX)-NNN
    const pattern = new RegExp(
      'Subagent ID.*`' + escapedId + '`[\\s\\S]*?\\*\\*任务\\*\\*:\\s*([A-Z][A-Z0-9-]*\\d{3,4})',
      's'
    );
    const match = content.match(pattern);

    if (match) {
      const taskId = match[1];
      console.log(`[SubagentManager] findTaskIdBySubagentId: Found taskId = ${taskId}`);
      return taskId;
    }

    console.log(`[SubagentManager] findTaskIdBySubagentId: No match found for ${subagentId}`);
    return null;
  }

  /**
   * 根据Subagent ID查找项目的创建记录，返回是否成功
   *
   * @param subagentId - Subagent ID
   * @returns 是否找到创建记录
   */
  private async findCreationRecord(subagentId: string): Promise<boolean> {
    const fs = await import('fs');
    const content = fs.readFileSync(this.recordingPath, 'utf-8');
    const match = content.match(new RegExp(`Subagent ID.*\`${subagentId}\``, 's'));
    return !!match;
  }
}