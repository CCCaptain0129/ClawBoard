import { TaskService } from './taskService';
import { getSubagentRecordingPath } from '../config/paths';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';

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
 * - Subagent完成时自动更新任务状态为 "review" 或 "todo"
 * - 实时更新SUBAGENTS任务分发记录.md
 */
export class SubagentManager {
  private taskService: TaskService;
  private recordingPath: string;

  constructor(taskService: TaskService) {
    this.taskService = taskService;
    this.recordingPath = getSubagentRecordingPath();
  }

  /**
   * 创建Subagent并自动更新任务状态
   *
   * @param config - Subagent配置
   * @returns Subagent ID
   */
  async createSubagent(config: SubagentConfig): Promise<string> {
    const subagentId = `agent:main:subagent:${randomUUID()}`;
    const subagentLabel = `${config.taskId}-${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    try {
      // 1. 先创建并启动真实 subagent 会话
      await this.createAndStartSubagent(subagentId, subagentLabel, config.taskDescription);

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

  private createAndStartSubagent(subagentId: string, label: string, taskDescription: string): Promise<void> {
    const message = `[Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.\n\n[Subagent Task]: ${taskDescription}`;
    const model = process.env.OPENCLAW_SUBAGENT_MODEL?.trim();

    return (async () => {
      const patchResult = await this.callGatewayRPC('sessions.patch', {
        key: subagentId,
        spawnDepth: 1
      });

      if (!patchResult.ok) {
        throw new Error(patchResult.error || 'sessions.patch failed');
      }

      if (model) {
        // 模型设置失败不阻塞创建流程
        try {
          await this.callGatewayRPC('sessions.patch', {
            key: subagentId,
            model
          });
        } catch {
          // ignore
        }
      }

      const agentResult = await this.callGatewayRPC('agent', {
        message,
        sessionKey: subagentId,
        lane: 'subagent',
        deliver: false,
        label,
        spawnedBy: 'backend-dispatch-once',
        idempotencyKey: randomUUID()
      });

      if (!agentResult.ok && !agentResult.runId) {
        try {
          await this.callGatewayRPC('sessions.delete', {
            key: subagentId,
            emitLifecycleHooks: false
          });
        } catch {
          // ignore cleanup failure
        }
        throw new Error(agentResult.error || 'agent RPC failed');
      }
    })();
  }

  private callGatewayRPC(method: string, params: Record<string, unknown>): Promise<Record<string, any>> {
    return new Promise((resolve, reject) => {
      const args = ['gateway', 'call', method, '--json', '--params', JSON.stringify(params)];
      const child = spawn('openclaw', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code: number | null) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(stdout || '{}'));
          } catch (error) {
            reject(new Error(`Failed to parse gateway response: ${String(error)}`));
          }
          return;
        }
        reject(new Error(`Gateway call failed (${method}): ${stderr || stdout || `exit=${String(code)}`}`));
      });

      child.on('error', (error: Error) => {
        reject(new Error(`Failed to start openclaw CLI: ${error.message}`));
      });

      setTimeout(() => {
        child.kill();
        reject(new Error(`Gateway call timeout (${method})`));
      }, 30000);
    });
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

      // 2. 成功完成后进入待审核，失败则回到 todo
      const status = result.success ? 'review' : 'todo';
      console.log(`[SubagentManager] Updating task ${taskId} to status: ${status}`);

      // ✅ 不要硬编码项目ID：根据 taskId 反查所在项目
      const projectId = await this.findProjectIdByTaskId(taskId);
      if (!projectId) {
        console.warn(`[SubagentManager] Project ID not found for task ${taskId}; skip task update`);
      } else {
      await this.updateTaskStatus(projectId, taskId, {
          status,
          claimedBy: null,
          updatedAt: new Date().toISOString()
        });
      }

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
      status: 'todo' | 'in-progress' | 'review' | 'done';
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
   * 根据 taskId 反查所在项目 ID
   *
   * 说明：subagent 记录文件里默认只包含 taskId，不包含 projectId。
   * 为避免 markSubagentComplete 时误更新到错误项目，这里通过扫描 projects.json
   * 找到包含该 taskId 的项目。
   */
  private async findProjectIdByTaskId(taskId: string): Promise<string | null> {
    try {
      const projects = await this.taskService.getAllProjects();
      for (const p of projects) {
        const tasks = await this.taskService.getTasksByProject(p.id);
        if (tasks.some(t => t.id === taskId)) return p.id;
      }
      return null;
    } catch (err) {
      console.error('[SubagentManager] findProjectIdByTaskId failed:', err);
      return null;
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

    // 使用更灵活的匹配：从 Subagent ID 到任务标题
    // 支持多种任务ID格式：VIS-xxx, INT-xxx, EXA-xxx, TASK-xxx, TASK-TEST-xxx, TEST-xxx 等
    // 格式：一个或多个大写字母、数字、短横线组成的任务ID
    const pattern = new RegExp(
      'Subagent ID.*`' + escapedId + '`[\\s\\S]*?\\*\\*任务\\*\\*:\\s*([A-Z][A-Z0-9-]+)',
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
