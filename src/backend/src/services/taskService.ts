import { Task, Project } from '../types/tasks';
import * as fs from 'fs';
import * as path from 'path';
import { validateJSONFile } from '../middleware/jsonValidator';
import { getProjectRoot, getTasksRoot } from '../config/paths';

// 进度同步回调函数类型
export type ProgressSyncCallback = (projectId: string) => Promise<void> | void;

export class TaskService {
  private tasksPath = getTasksRoot();
  private projectsPath = path.join(this.tasksPath, 'projects.json');
  private progressSyncCallback?: ProgressSyncCallback;

  /**
   * 注册进度同步回调
   *
   * @param callback - 进度同步回调函数
   */
  registerProgressSyncCallback(callback: ProgressSyncCallback): void {
    this.progressSyncCallback = callback;
    console.log('[TaskService] Progress sync callback registered');
  }

  async getAllProjects(): Promise<Project[]> {
    try {
      const data = fs.readFileSync(this.projectsPath, 'utf-8');
      const projects = JSON.parse(data);
      return projects;
    } catch {
      return [];
    }
  }

  async getProjectById(id: string): Promise<Project | null> {
    const projects = await this.getAllProjects();
    return projects.find(p => p.id === id) || null;
  }

  private writeProjects(projects: Project[]): void {
    fs.writeFileSync(this.projectsPath, JSON.stringify(projects, null, 2));
  }

  getProjectTasksFilePath(projectId: string): string {
    return path.join(this.tasksPath, `${projectId}-tasks.json`);
  }

  validateProjectTasksFile(projectId: string) {
    this.ensureProjectTasksFile(projectId);
    return validateJSONFile(this.getProjectTasksFilePath(projectId));
  }

  ensureProjectTasksFile(projectId: string): void {
    const filePath = this.getProjectTasksFilePath(projectId);
    if (fs.existsSync(filePath)) {
      return;
    }

    const project = fs.existsSync(this.projectsPath)
      ? (JSON.parse(fs.readFileSync(this.projectsPath, 'utf-8')) as Project[]).find((item) => item.id === projectId)
      : null;

    if (!project) {
      return;
    }

    const initialData = {
      ...project,
      tasks: [],
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2));
  }

  async createProject(input: Partial<Project> & { id: string; name: string }): Promise<Project> {
    const projects = await this.getAllProjects();
    if (projects.some((project) => project.id === input.id)) {
      throw new Error(`Project "${input.id}" already exists`);
    }

    const now = new Date().toISOString();
    const project: Project = {
      id: input.id,
      name: input.name,
      description: input.description || '',
      status: input.status || 'active',
      leadAgent: input.leadAgent || null,
      color: input.color || '#3B82F6',
      icon: input.icon || '📁',
      taskPrefix: input.taskPrefix || this.deriveTaskPrefix(input.id, input.name),
      createdAt: now,
      updatedAt: now,
    };

    this.writeProjects([...projects, project]);
    this.ensureProjectTasksFile(project.id);
    this.ensureProjectDocs(project);
    return project;
  }

  async updateProject(projectId: string, updates: Partial<Project>): Promise<Project | null> {
    const projects = await this.getAllProjects();
    const projectIndex = projects.findIndex((project) => project.id === projectId);

    if (projectIndex === -1) {
      return null;
    }

    const currentProject = projects[projectIndex];
    const nextProject: Project = {
      ...currentProject,
      ...updates,
      id: currentProject.id,
      createdAt: currentProject.createdAt,
      updatedAt: new Date().toISOString(),
    };

    projects[projectIndex] = nextProject;
    this.writeProjects(projects);
    return nextProject;
  }

  private ensureProjectDocs(project: Project): void {
    const projectRoot = getProjectRoot(project.id);
    const docsDir = path.join(projectRoot, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });

    const planningPath = path.join(docsDir, '01-project-plan.md');
    const taskBreakdownPath = path.join(docsDir, '03-task-breakdown.md');
    const progressPath = path.join(docsDir, '04-进度跟踪.md');

    if (!fs.existsSync(planningPath)) {
      fs.writeFileSync(planningPath, `# ${project.name} - 项目规划\n\n## 项目目标\n\n- 待补充\n\n## 当前重点\n\n- 建立任务与文档基础结构\n\n## 技术栈\n\n- 待补充\n\n## 关键约束\n\n- 任务运行态以 tasks/*.json 为真源\n`, 'utf-8');
    }

    if (!fs.existsSync(taskBreakdownPath)) {
      fs.writeFileSync(taskBreakdownPath, `# ${project.name} - 任务分解\n\n## 任务列表\n\n- 暂无任务\n`, 'utf-8');
    }

    if (!fs.existsSync(progressPath)) {
      fs.writeFileSync(progressPath, `# ${project.name} - 进度跟踪\n\n## 项目状态\n\n- **完成度**: 0%\n- **总任务数**: 0\n- **已完成**: 0\n- **进行中**: 0\n- **待审核**: 0\n- **待处理**: 0\n\n## 里程碑进度\n\n| 里程碑 | 状态 |\n| --- | --- |\n| M1 | 未开始 |\n\n## 阶段进度\n\n- 暂无阶段数据\n\n*最后更新: 初始化*\n`, 'utf-8');
    }
  }

  private deriveTaskPrefix(projectId: string, projectName: string): string {
    const idPrefix = projectId
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 4);

    if (idPrefix.length >= 2) {
      return idPrefix;
    }

    const namePrefix = projectName
      .replace(/[^A-Za-z0-9\u4e00-\u9fa5]/g, '')
      .slice(0, 3)
      .toUpperCase();

    return namePrefix || 'TASK';
  }

  async createTask(projectId: string, task: Partial<Task>): Promise<Task> {
    const project = await this.getProjectById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    this.ensureProjectTasksFile(projectId);
    const tasks = await this.getTasksByProject(projectId);

    // 获取当前项目的任务前缀，并生成序号
    const prefix = project.taskPrefix || 'TASK';
    const existingTaskIds = tasks.map(t => t.id);
    const nextNumber = this.getNextTaskNumber(prefix, existingTaskIds);
    const taskId = `${prefix}-${nextNumber.toString().padStart(3, '0')}`;

    const newTask: Task = {
      id: task.id || taskId,
      title: task.title || 'New Task',
      description: task.description || '',
      status: 'todo',
      priority: task.priority || 'P2',
      labels: task.labels || [],
      assignee: task.assignee || null,
      claimedBy: null,
      dependencies: task.dependencies || [],
      contextSummary: task.contextSummary || '',
      acceptanceCriteria: task.acceptanceCriteria || [],
      deliverables: task.deliverables || [],
      executionMode: task.executionMode || 'manual',
      agentType: task.agentType || 'general',
      blockingReason: task.blockingReason || null,
      dueDate: null,
      estimatedTime: task.estimatedTime || null,
      startTime: null,
      completeTime: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: [],
    };

    tasks.push(newTask);
    await this.saveTasks(projectId, tasks);
    return newTask;
  }

  private getNextTaskNumber(prefix: string, existingTaskIds: string[]): number {
    const prefixPattern = new RegExp(`^${prefix}-(\\d+)$`);
    const numbers = existingTaskIds
      .map(id => {
        const match = id.match(prefixPattern);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => num > 0);

    return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  }

  async getTasksByProject(projectId: string): Promise<Task[]> {
    const filePath = this.getProjectTasksFilePath(projectId);
    this.ensureProjectTasksFile(projectId);

    // 提前验证 JSON 文件
    const validation = validateJSONFile(filePath);
    if (!validation.valid) {
      console.error(`❌ JSON validation failed for project "${projectId}":`);
      console.error(`   File path: ${filePath}`);
      console.error(`   Error: ${validation.error}`);
      if (validation.line !== undefined) {
        console.error(`   Location: Line ${validation.line}, Column ${validation.column}`);
      }
      if (validation.context) {
        console.error(`   Context: "${validation.context}"`);
      }
      console.error(`   Tip: Use 'python3 -m json.tool <file>' to validate JSON`);
      return [];
    }

    // 验证通过，正常读取
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const project = JSON.parse(data);
      return project.tasks || [];
    } catch (error) {
      console.error(`❌ Failed to load tasks for project "${projectId}":`);
      console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  async updateTask(projectId: string, taskId: string, updates: Partial<Task>): Promise<Task | null> {
    const tasks = await this.getTasksByProject(projectId);
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) return null;
    
    const oldTask = tasks[taskIndex];
    tasks[taskIndex] = { ...tasks[taskIndex], ...updates, updatedAt: new Date().toISOString() };
    
    await this.saveTasks(projectId, tasks);

    // 检查是否需要触发进度同步
    // 监听字段: status, claimedBy, assignee, startTime, completeTime
    const shouldTriggerSync = this.shouldTriggerProgressSync(oldTask, updates);
    
    if (shouldTriggerSync && this.progressSyncCallback) {
      console.log(`[TaskService] Progress changes detected for task ${taskId} in project ${projectId}, triggering sync`);
      // 异步触发，不阻塞任务更新
      setImmediate(() => {
        try {
          const result = this.progressSyncCallback!(projectId);
          if (result && typeof result.then === 'function') {
            result.catch((error: Error) => {
              console.error(`[TaskService] Progress sync callback failed:`, error);
            });
          }
        } catch (error) {
          console.error(`[TaskService] Progress sync callback error:`, error);
        }
      });
    }

    return tasks[taskIndex];
  }

  /**
   * 删除任务
   * JSON-first: 只允许删除 todo 状态的任务
   * 
   * @param projectId - 项目ID
   * @param taskId - 任务ID
   * @returns 删除的任务，如果任务不存在或状态不允许删除则返回 null
   */
  async deleteTask(projectId: string, taskId: string): Promise<{ success: boolean; task?: Task; error?: string }> {
    const tasks = await this.getTasksByProject(projectId);
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      return { success: false, error: 'Task not found' };
    }
    
    const taskToDelete = tasks[taskIndex];
    
    // JSON-first: 只允许删除 todo 状态的任务
    if (taskToDelete.status !== 'todo') {
      return { 
        success: false, 
        error: `Cannot delete task with status "${taskToDelete.status}". Only "todo" tasks can be deleted.` 
      };
    }
    
    // 删除任务
    tasks.splice(taskIndex, 1);
    await this.saveTasks(projectId, tasks);
    
    console.log(`[TaskService] Task ${taskId} deleted from project ${projectId}`);
    
    return { success: true, task: taskToDelete };
  }

  /**
   * 检查是否需要触发进度同步
   *
   * 监听字段: status, claimedBy, assignee, startTime, completeTime
   *
   * @param oldTask - 旧任务数据
   * @param updates - 更新字段
   * @returns 是否需要触发同步
   */
  private shouldTriggerProgressSync(oldTask: Task, updates: Partial<Task>): boolean {
    const monitoredFields: (keyof Task)[] = ['status', 'claimedBy', 'assignee', 'startTime', 'completeTime'];

    for (const field of monitoredFields) {
      if (field in updates) {
        const oldValue = oldTask[field];
        const newValue = updates[field];

        // 检查值是否发生变化
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          console.log(`[TaskService] Field ${field} changed:`, {
            oldValue,
            newValue,
          });
          return true;
        }
      }
    }

    return false;
  }

  private async saveTasks(projectId: string, tasks: Task[]): Promise<void> {
    const filePath = path.join(this.tasksPath, `${projectId}-tasks.json`);
    const project = await this.getProjectById(projectId);
    
    if (project) {
      const data = { ...project, tasks, updatedAt: new Date().toISOString() };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
  }
}
