import { promises as fs } from 'fs';
import path from 'path';
import type { TaskService } from './taskService';
import { getOpenClawSessionsPath, getSubagentRecordingPath } from '../config/paths';
import type { WebSocketHandler } from '../websocket/server';
import type { Task } from '../types/tasks';

/**
 * Subagent 状态接口
 */
export interface SubagentStatus {
  subagentId: string;
  taskId: string;
  existsInSessions: boolean;
  lastUpdateTime: number | null;
  lastUpdateTimestamp: string | null;
  minutesSinceLastUpdate: number | null;
  isLikelyFinished: boolean;
  sessionId?: string;
}

/**
 * OpenClaw Session 接口
 */
interface OpenClawSession {
  sessionId: string;
  updatedAt: number;
  label?: string;
  spawnDepth?: number;
  spawnedBy?: string;
  channel?: string;
}

/**
 * OpenClaw Sessions Store 接口
 */
interface OpenClawSessionsStore {
  [key: string]: OpenClawSession;
}

interface OpenClawRunsStore {
  runs?: Record<string, {
    runId: string;
    childSessionKey?: string;
    task?: string;
    endedAt?: number;
    endedReason?: string;
  }>;
}

export interface ActiveSubagentExecution {
  projectId: string;
  taskId: string;
  subagentId: string;
  label: string;
  lastUpdateTime: number;
  lastUpdateTimestamp: string;
}

/**
 * SubagentMonitorService - 监控 Subagent 完成状态并自动补齐任务状态
 *
 * 核心功能：
 * - 自动检测 OpenClaw sessions.json 中的新 subagent 会话
 * - 从 label 中解析任务 ID（如 "PMW-029-xxx" → "PMW-029"）
 * - 自动注册 subagent 并更新任务状态为 in-progress
 * - 监控 subagent 是否失活，并标记为需要人工复核
 * - 实现幂等、避免误判
 */
export class SubagentMonitorService {
  private sessionsJsonPath: string;
  private sessionsDir: string;
  private recordingPath: string;
  private intervalMs: number;
  private completionThresholdMs: number;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  private taskService: TaskService;
  private wsServer?: WebSocketHandler;

  // 幂等性控制：记录已处理的 subagent，避免重复标记
  private processedSubagents: Set<string> = new Set();
  
  // 已注册的 subagent（从 sessions.json 自动注册的）
  private registeredSubagents: Map<string, { taskId: string; projectId: string }> = new Map();

  constructor(taskService: TaskService, options?: {
    sessionsJsonPath?: string;
    recordingPath?: string;
    intervalMs?: number;
    completionThresholdMs?: number;
    wsServer?: WebSocketHandler;
  }) {
    this.taskService = taskService;
    this.wsServer = options?.wsServer;
    // OpenClaw sessions store 路径
    this.sessionsJsonPath = options?.sessionsJsonPath ||
      getOpenClawSessionsPath();
    this.sessionsDir = path.dirname(this.sessionsJsonPath);

    // SUBAGENTS任务分发记录.md 路径
    this.recordingPath = options?.recordingPath ||
      getSubagentRecordingPath();

    // 轮询间隔：默认 30 秒
    this.intervalMs = options?.intervalMs || 30000;

    // 完成判定阈值：默认 2 分钟（120,000 毫秒）
    this.completionThresholdMs = options?.completionThresholdMs || 120000;
  }

  async getActiveExecutions(): Promise<Map<string, ActiveSubagentExecution>> {
    const executions = new Map<string, ActiveSubagentExecution>();

    try {
      const sessions = await this.readAllSubagentSessions();
      const tasksByProject = await this.readTasksByProject();

      for (const [sessionKey, session] of sessions.entries()) {
        if (!sessionKey.startsWith('agent:main:subagent:')) {
          const runMatch = await this.matchRunBackedExecution(sessionKey, session, tasksByProject);
          if (runMatch) {
            executions.set(`${runMatch.projectId}:${runMatch.taskId}`, runMatch);
          }
          continue;
        }

        const directMatch = await this.matchLabelBackedExecution(sessionKey, session);
        if (directMatch) {
          executions.set(`${directMatch.projectId}:${directMatch.taskId}`, directMatch);
        }
      }
    } catch (error) {
      console.error('[SubagentMonitorService] Error collecting active executions:', error);
    }

    return executions;
  }

  private async readAllSubagentSessions(): Promise<Map<string, OpenClawSession>> {
    const sessionMap = new Map<string, OpenClawSession>();
    const agentsRoot = path.join(process.env.HOME || '', '.openclaw/agents');

    try {
      const entries = await fs.readdir(agentsRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const sessionsPath = path.join(agentsRoot, entry.name, 'sessions', 'sessions.json');
        try {
          const content = await fs.readFile(sessionsPath, 'utf-8');
          const sessions: OpenClawSessionsStore = JSON.parse(content);
          for (const [sessionKey, session] of Object.entries(sessions)) {
            if (sessionKey.includes(':subagent:')) {
              sessionMap.set(sessionKey, session);
            }
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      console.error('[SubagentMonitorService] Failed to read session directories:', error);
    }

    return sessionMap;
  }

  private async readTasksByProject(): Promise<Map<string, Awaited<ReturnType<TaskService['getTasksByProject']>>>> {
    const taskMap = new Map<string, Awaited<ReturnType<TaskService['getTasksByProject']>>>();
    const projects = await this.taskService.getAllProjects();
    for (const project of projects) {
      taskMap.set(project.id, await this.taskService.getTasksByProject(project.id));
    }
    return taskMap;
  }

  private async matchLabelBackedExecution(
    sessionKey: string,
    session: OpenClawSession
  ): Promise<ActiveSubagentExecution | null> {
    const label = session.label || '';
    const taskId = this.parseTaskIdFromLabel(label);
    if (!taskId) {
      return null;
    }

    const lastUpdateTime = typeof session.updatedAt === 'number' ? session.updatedAt : 0;
    if (this.determineSessionActivity(session, sessionKey, lastUpdateTime) !== 'running') {
      return null;
    }

    const projectId = await this.findProjectIdByTaskId(taskId);
    if (!projectId) {
      return null;
    }

    return {
      projectId,
      taskId,
      subagentId: sessionKey,
      label: this.normalizeExecutionLabel(label, sessionKey),
      lastUpdateTime,
      lastUpdateTimestamp: new Date(lastUpdateTime).toISOString(),
    };
  }

  private async matchRunBackedExecution(
    sessionKey: string,
    session: OpenClawSession,
    tasksByProject: Map<string, Awaited<ReturnType<TaskService['getTasksByProject']>>>
  ): Promise<ActiveSubagentExecution | null> {
    const lastUpdateTime = typeof session.updatedAt === 'number' ? session.updatedAt : 0;
    if (this.determineSessionActivity(session, sessionKey, lastUpdateTime) !== 'running') {
      return null;
    }

    const runsPath = path.join(process.env.HOME || '', '.openclaw/subagents/runs.json');
    let runsStore: OpenClawRunsStore;
    try {
      runsStore = JSON.parse(await fs.readFile(runsPath, 'utf-8'));
    } catch {
      return null;
    }

    const run = Object.values(runsStore.runs || {}).find((item) =>
      item.childSessionKey === sessionKey && !item.endedAt
    );
    if (!run?.task) {
      return null;
    }

    const directTaskId = this.parseTaskIdFromLabel(run.task);

    for (const [projectId, tasks] of tasksByProject.entries()) {
      const matchedTask = tasks.find((task) => (
        (directTaskId && task.id === directTaskId)
        || run.task?.includes(task.id)
        || run.task?.includes(task.title)
      ));

      if (matchedTask) {
        return {
          projectId,
          taskId: matchedTask.id,
          subagentId: sessionKey,
          label: this.normalizeExecutionLabel(session.label || matchedTask.title, sessionKey),
          lastUpdateTime,
          lastUpdateTimestamp: new Date(lastUpdateTime).toISOString(),
        };
      }
    }

    return null;
  }

  /**
   * 启动监控服务
   */
  start(): void {
    if (this.isRunning) {
      console.log('[SubagentMonitorService] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[SubagentMonitorService] Starting...');
    console.log(`  - Interval: ${this.intervalMs}ms`);
    console.log(`  - Completion threshold: ${this.completionThresholdMs}ms`);
    console.log(`  - Recording file: ${this.recordingPath}`);

    // 立即执行一次检查
    this.checkAndCompleteSubagents();

    // 启动定时器
    this.intervalId = setInterval(() => {
      this.checkAndCompleteSubagents();
    }, this.intervalMs);

    console.log('[SubagentMonitorService] Started');
  }

  /**
   * 停止监控服务
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('[SubagentMonitorService] Stopped');
  }

  /**
   * 检查失活的 Subagent
   */
  async checkAndCompleteSubagents(): Promise<void> {
    try {
      console.log('[SubagentMonitorService] Checking for completed subagents...');

      // 0. 首先检测并注册新的 subagent 会话
      await this.detectAndRegisterNewSubagents();

      // 1. 从记录文件中提取所有进行中的 subagentId
      const inProgressSubagents = await this.getInProgressSubagents();

      if (inProgressSubagents.length === 0) {
        console.log('[SubagentMonitorService] No in-progress subagents found');
        return;
      }

      console.log(`[SubagentMonitorService] Found ${inProgressSubagents.length} in-progress subagents`);

      // 2. 检查每个 subagent 的状态
      const inactiveSubagents: Array<{ subagentId: string; taskId: string }> = [];

      for (const { subagentId, taskId } of inProgressSubagents) {
        // 跳过已处理的 subagent（幂等性）
        if (this.processedSubagents.has(subagentId)) {
          continue;
        }

        const status = await this.checkSubagentStatus(subagentId);

        console.log(`[SubagentMonitorService] Subagent ${subagentId}:`, {
          exists: status.existsInSessions,
          lastUpdate: status.lastUpdateTimestamp,
          minutesSinceUpdate: status.minutesSinceLastUpdate,
          isLikelyFinished: status.isLikelyFinished
        });

        if (status.isLikelyFinished) {
          inactiveSubagents.push({ subagentId, taskId });
          // 标记为已处理
          this.processedSubagents.add(subagentId);
        }
      }

      // 3. 标记失活的 subagent
      if (inactiveSubagents.length > 0) {
        console.log(`[SubagentMonitorService] Found ${inactiveSubagents.length} inactive subagents`);

        for (const { subagentId, taskId } of inactiveSubagents) {
          await this.markSubagentInactive(subagentId, taskId);
        }
      } else {
        console.log('[SubagentMonitorService] No inactive subagents detected');
      }
    } catch (error) {
      console.error('[SubagentMonitorService] Error during check:', error);
    }
  }

  /**
   * 检测并注册新的 subagent 会话
   * 
   * 核心功能：
   * - 读取 sessions.json 中的 subagent 会话
   * - 从 label 中解析任务 ID
   * - 自动注册到 SUBAGENTS任务分发记录.md
   * - 更新任务状态为 in-progress
   */
  private async detectAndRegisterNewSubagents(): Promise<void> {
    try {
      console.log('[SubagentMonitorService] Detecting new subagent sessions...');

      // 1. 读取 sessions.json
      const sessionsJson = await fs.readFile(this.sessionsJsonPath, 'utf-8');
      const sessions: OpenClawSessionsStore = JSON.parse(sessionsJson);

      // 2. 遍历所有 subagent 会话
      for (const [sessionKey, session] of Object.entries(sessions)) {
        // 只处理 subagent 会话
        if (!sessionKey.startsWith('agent:main:subagent:')) {
          continue;
        }

        const subagentId = sessionKey;
        const lastUpdateTime = typeof session.updatedAt === 'number' ? session.updatedAt : 0;

        // 只自动注册“当前仍在运行”的会话，避免历史会话在重启后反复回写
        if (this.determineSessionActivity(session, sessionKey, lastUpdateTime) !== 'running') {
          continue;
        }

        // 跳过已注册的 subagent
        if (this.registeredSubagents.has(subagentId)) {
          continue;
        }

        // 从 label 中解析任务 ID
        const label = session.label || '';
        const taskId = this.parseTaskIdFromLabel(label);

        if (!taskId) {
          // 没有 task ID，跳过
          continue;
        }

        console.log(`[SubagentMonitorService] Detected new subagent: ${subagentId}, label: ${label}, taskId: ${taskId}`);

        // 查找任务所在的项目
        const projectId = await this.findProjectIdByTaskId(taskId);
        if (!projectId) {
          console.warn(`[SubagentMonitorService] Project not found for task ${taskId}`);
          continue;
        }

        // 获取任务详情
        const task = await this.getTaskById(projectId, taskId);
        if (!task) {
          console.warn(`[SubagentMonitorService] Task ${taskId} not found in project ${projectId}`);
          continue;
        }

        // dispatcher 已经写过记录或任务已经绑定到该 subagent 时，不再重复注册
        if (await this.hasRecordForSubagent(subagentId) || task.claimedBy === subagentId) {
          this.registeredSubagents.set(subagentId, { taskId, projectId });
          continue;
        }

        // 注册 subagent
        await this.registerSubagent(subagentId, projectId, taskId, task.title, label);
      }

      console.log(`[SubagentMonitorService] Registered subagents count: ${this.registeredSubagents.size}`);
    } catch (error) {
      console.error('[SubagentMonitorService] Error detecting new subagents:', error);
    }
  }

  /**
   * 从 label 中解析任务 ID
   * 
   * 支持格式：
   * - "PMW-029-xxx" → "PMW-029"
   * - "VIS-012-xxx" → "VIS-012"
   * - "fix-VIS-012-xxx" → "VIS-012"
   * - "TASK-TEST-001-xxx" → "TASK-TEST-001"
   */
  private parseTaskIdFromLabel(label: string): string | null {
    // 支持多种任务 ID 格式
    // 格式：一个或多个大写字母、数字、短横线组成的任务ID
    // 匹配模式：任务ID + 可选的后缀（如 -glm5, -test 等）
    
    // 先尝试匹配标准格式（如 PMW-029, VIS-012）
    const standardPattern = /^([A-Z]{2,}-\d{3})(?:-|$)/;
    const standardMatch = label.match(standardPattern);
    if (standardMatch) {
      return standardMatch[1];
    }

    // 尝试匹配带前缀的格式（如 fix-VIS-012-xxx）
    const prefixedPattern = /(?:^|-)([A-Z]{2,}-\d{3})(?:-|$)/;
    const prefixedMatch = label.match(prefixedPattern);
    if (prefixedMatch) {
      return prefixedMatch[1];
    }

    // 尝试匹配复合格式（如 TASK-TEST-001）
    const compoundPattern = /^([A-Z]+-[A-Z]+-\d+)(?:-|$)/;
    const compoundMatch = label.match(compoundPattern);
    if (compoundMatch) {
      return compoundMatch[1];
    }

    return null;
  }

  /**
   * 根据 taskId 查找所在项目
   */
  private async findProjectIdByTaskId(taskId: string): Promise<string | null> {
    try {
      const projects = await this.taskService.getAllProjects();
      for (const p of projects) {
        const tasks = await this.taskService.getTasksByProject(p.id);
        if (tasks.some(t => t.id === taskId)) {
          return p.id;
        }
      }
      return null;
    } catch (err) {
      console.error('[SubagentMonitorService] findProjectIdByTaskId failed:', err);
      return null;
    }
  }

  /**
   * 获取任务详情
   */
  private async getTaskById(projectId: string, taskId: string): Promise<Task | null> {
    try {
      const tasks = await this.taskService.getTasksByProject(projectId);
      return tasks.find(t => t.id === taskId) || null;
    } catch (err) {
      console.error('[SubagentMonitorService] getTaskById failed:', err);
      return null;
    }
  }

  private async hasRecordForSubagent(subagentId: string): Promise<boolean> {
    try {
      const content = await fs.readFile(this.recordingPath, 'utf-8');
      return content.includes(`**Subagent ID**: \`${subagentId}\``);
    } catch {
      return false;
    }
  }

  private determineSessionActivity(
    session: OpenClawSession,
    sessionKey: string,
    lastUpdateTime: number
  ): 'running' | 'stopped' {
    const now = Date.now();
    const inactiveTime = lastUpdateTime > 0 ? now - lastUpdateTime : Number.POSITIVE_INFINITY;
    const hasRealtimeConnection = (session as any).connectionState === 'connected' || (session as any).isAlive;
    const hasActivePolling = Boolean((session as any).polling);

    if (hasRealtimeConnection || hasActivePolling) {
      return 'running';
    }

    if (sessionKey.includes('subagent:') && inactiveTime <= 3 * 60 * 1000) {
      return 'running';
    }

    return 'stopped';
  }

  private normalizeExecutionLabel(label: string, subagentId: string): string {
    const normalized = label.trim();
    if (normalized) {
      return normalized;
    }

    const tail = subagentId.split(':').pop() || 'unknown';
    return `subagent:${tail.slice(-12)}`;
  }

  private async broadcastTaskRuntimeUpdate(projectId: string, taskId: string): Promise<void> {
    if (!this.wsServer) {
      return;
    }

    const task = await this.getTaskById(projectId, taskId);
    if (!task) {
      return;
    }

    const execution = (await this.getActiveExecutions()).get(`${projectId}:${taskId}`);
    this.wsServer.broadcastTaskUpdate(projectId, {
      ...task,
      activeExecutorId: execution?.subagentId || null,
      activeExecutorLabel: execution?.label || null,
      activeExecutorLastUpdate: execution?.lastUpdateTimestamp || null,
    });
  }

  /**
   * 注册 subagent：更新任务状态 + 写入记录文件
   */
  private async registerSubagent(
    subagentId: string,
    projectId: string,
    taskId: string,
    taskTitle: string,
    label: string
  ): Promise<void> {
    try {
      console.log(`[SubagentMonitorService] Registering subagent ${subagentId} for task ${taskId}...`);

      const now = new Date().toISOString();

      // 1. 更新任务状态为 in-progress
      await this.taskService.updateTask(projectId, taskId, {
        status: 'in-progress',
        claimedBy: subagentId,
        updatedAt: now
      });

      // 2. 写入记录文件
      const entry = this.formatSubagentEntry(subagentId, taskId, taskTitle, label, now);
      await fs.appendFile(this.recordingPath, entry, 'utf-8');

      // 3. 记录到内存
      this.registeredSubagents.set(subagentId, { taskId, projectId });
      await this.broadcastTaskRuntimeUpdate(projectId, taskId);

      console.log(`[SubagentMonitorService] ✓ Registered subagent ${subagentId} for task ${taskId}`);
    } catch (error) {
      console.error(`[SubagentMonitorService] Error registering subagent ${subagentId}:`, error);
    }
  }

  /**
   * 格式化 subagent 记录条目
   */
  private formatSubagentEntry(
    subagentId: string,
    taskId: string,
    taskTitle: string,
    label: string,
    createdAt: string
  ): string {
    const timestamp = createdAt.slice(0, 16).replace('T', ' ');
    return `
### ${timestamp} 创建 Subagent (自动检测)

**Subagent ID**: \`${subagentId}\`
**类型**: Dev Agent
**任务**: ${taskId} - ${taskTitle}
**分配时间**: ${createdAt}
**Label**: ${label}

**任务描述**:
- 由 SubagentMonitorService 自动检测并注册

**返回结果**:
- 等待 Subagent 完成中...

**释放时间**: -
**状态**: 🔄 进行中

`;
  }

  /**
   * 从记录文件中提取所有进行中的 subagentId
   */
  private async getInProgressSubagents(): Promise<Array<{ subagentId: string; taskId: string }>> {
    const content = await fs.readFile(this.recordingPath, 'utf-8');
    const subagents: Array<{ subagentId: string; taskId: string }> = [];

    // 匹配进行中的 subagent 条目
    // 格式：**Subagent ID**: `xxx` ... **状态**: 🔄 进行中
    const pattern = /\*\*Subagent ID\*\*:\s*`([^`]+)`[\s\S]*?\*\*任务\*\*:\s*([A-Z][A-Z0-9-]+)[\s\S]*?\*\*状态\*\*:\s*🔄 进行中/g;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      subagents.push({
        subagentId: match[1],
        taskId: match[2]
      });
    }

    return subagents;
  }

  /**
   * 检查 subagent 状态
   */
  private async checkSubagentStatus(subagentId: string): Promise<SubagentStatus> {
    try {
      // 1. 读取 sessions.json
      const sessionsJson = await fs.readFile(this.sessionsJsonPath, 'utf-8');
      const sessions = JSON.parse(sessionsJson);

      // 2. 查找对应的 session
      const sessionKey = `agent:main:subagent:${subagentId.split(':').pop()}`;
      const session = sessions[sessionKey];

      if (!session) {
        // session 不存在，说明 subagent 已结束并清理
        return {
          subagentId,
          taskId: '',
          existsInSessions: false,
          lastUpdateTime: null,
          lastUpdateTimestamp: null,
          minutesSinceLastUpdate: null,
          isLikelyFinished: true
        };
      }

      // 3. 检查最后更新时间
      const lastUpdateTime = session.updatedAt || 0;
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTime;
      const minutesSinceLastUpdate = timeSinceLastUpdate / 60000;

      // 4. 判断是否可能已完成
      // 判断条件：
      // - session 存在但 >= 2 分钟无更新
      const isLikelyFinished = timeSinceLastUpdate >= this.completionThresholdMs;

      return {
        subagentId,
        taskId: '',
        existsInSessions: true,
        lastUpdateTime,
        lastUpdateTimestamp: new Date(lastUpdateTime).toISOString(),
        minutesSinceLastUpdate,
        isLikelyFinished
      };
    } catch (error) {
      console.error(`[SubagentMonitorService] Error checking subagent ${subagentId}:`, error);

      // 出错时保守处理：不判定为已完成
      return {
        subagentId,
        taskId: '',
        existsInSessions: false,
        lastUpdateTime: null,
        lastUpdateTimestamp: null,
        minutesSinceLastUpdate: null,
        isLikelyFinished: false
      };
    }
  }

  /**
   * 标记 subagent 失活
   *
   * 注意：这里不再把“会话失活/超时”直接等同于“任务成功完成”。
   * 否则会把短暂失败、无输出退出、人工中断等情况都误判成 done。
   */
  private async markSubagentInactive(subagentId: string, taskId: string): Promise<void> {
    try {
      console.log(`[SubagentMonitorService] Marking subagent ${subagentId} as inactive... taskId=${taskId}`);

      const projectId = await this.findProjectIdByTaskId(taskId);
      if (!projectId) {
        console.warn(`[SubagentMonitorService] Project not found for inactive subagent task ${taskId}`);
        return;
      }

      const currentTask = await this.getTaskById(projectId, taskId);
      if (!currentTask) {
        return;
      }

      // 如果用户或主流程已手动解绑该 subagent（例如改回 todo），不要再覆盖回 in-progress
      if (currentTask.claimedBy !== subagentId) {
        console.log(`[SubagentMonitorService] Skip inactive mark for ${subagentId}: task ${taskId} is no longer claimed by this subagent`);
        return;
      }

      await this.taskService.updateTask(projectId, taskId, {
        status: 'in-progress',
        claimedBy: subagentId,
        blockingReason: 'Subagent 会话已失活或长时间无更新，需要人工复核后再决定是否完成。',
        updatedAt: new Date().toISOString()
      });

      await this.appendInactiveNote(subagentId);
      await this.broadcastTaskRuntimeUpdate(projectId, taskId);

      console.log(`[SubagentMonitorService] ✓ Marked inactive for manual review: ${subagentId}`);
    } catch (error) {
      console.error(`[SubagentMonitorService] Error marking subagent ${subagentId} inactive:`, error);
    }
  }

  private async appendInactiveNote(subagentId: string): Promise<void> {
    const content = await fs.readFile(this.recordingPath, 'utf-8');
    const escapedId = subagentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp('(\\*\\*Subagent ID\\*\\*:\\s*`' + escapedId + '`[\\s\\S]*?\\*\\*状态\\*\\*:\\s*🔄 进行中\\n)');

    if (!pattern.test(content)) {
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const updatedContent = content.replace(
      pattern,
      `$1\n**监控备注**: ${timestamp} 检测到会话失活，已保留任务为进行中，等待人工复核。\n`
    );

    if (updatedContent !== content) {
      await fs.writeFile(this.recordingPath, updatedContent, 'utf-8');
    }
  }

  /**
   * 获取当前所有进行中的 subagent 状态（用于测试和监控）
   */
  async getInProgressSubagentStatuses(): Promise<SubagentStatus[]> {
    const inProgressSubagents = await this.getInProgressSubagents();
    const statuses: SubagentStatus[] = [];

    for (const { subagentId, taskId } of inProgressSubagents) {
      const status = await this.checkSubagentStatus(subagentId);
      status.taskId = taskId;
      statuses.push(status);
    }

    return statuses;
  }

  /**
   * 清除已处理记录（用于测试重置）
   */
  clearProcessedCache(): void {
    this.processedSubagents.clear();
    this.registeredSubagents.clear();
    console.log('[SubagentMonitorService] Processed and registered cache cleared');
  }

  /**
   * 获取已注册的 subagent 列表（用于调试）
   */
  getRegisteredSubagents(): Map<string, { taskId: string; projectId: string }> {
    return new Map(this.registeredSubagents);
  }
}
