/**
 * SafeSyncService - 安全同步服务
 * 
 * 实现 PMW-023 Phase 2: 文档变更监听→自动同步到看板（安全）
 * 
 * 核心功能：
 * 1. 从 03-任务分解.md 解析任务（支持不同的 markdown 格式）
 * 2. 安全合并到现有 JSON，保护运行态字段（status/claimedBy）
 * 3. 支持配置化的文件路径映射
 */

import * as fs from 'fs';
import * as path from 'path';
import { Task, Project } from '../types/tasks';
import { TaskService } from '../services/taskService';

// 项目文档路径配置
export interface ProjectDocConfig {
  projectId: string;
  projectPath: string;  // 项目根目录
  taskDoc: string;      // 任务分解文档相对路径（如 docs/03-任务分解.md）
  progressDoc?: string; // 进度跟踪文档相对路径（如 docs/04-进度跟踪.md）
}

// 默认项目文档配置
const DEFAULT_PROJECT_DOCS: Record<string, ProjectDocConfig> = {
  'pm-workflow-automation': {
    projectId: 'pm-workflow-automation',
    projectPath: '/Users/ot/.openclaw/workspace/projects/2026-03-13-pm-workflow-automation',
    taskDoc: 'docs/03-任务分解.md',
    progressDoc: 'docs/04-进度跟踪.md',
  },
  'openclaw-visualization': {
    projectId: 'openclaw-visualization',
    projectPath: '/Users/ot/.openclaw/workspace/projects/openclaw-visualization',
    taskDoc: 'tasks/openclaw-visualization-TASKS.md',
  },
};

// 运行态字段 - 这些字段在同步时不应该被覆盖
const RUNTIME_FIELDS: (keyof Task)[] = ['status', 'claimedBy', 'assignee'];

export class SafeSyncService {
  private taskService: TaskService;
  private tasksPath: string;
  private projectConfigs: Record<string, ProjectDocConfig>;

  constructor(taskService: TaskService, customConfigs?: Record<string, ProjectDocConfig>) {
    this.taskService = taskService;
    this.tasksPath = path.join(process.cwd(), '../../tasks');
    this.projectConfigs = { ...DEFAULT_PROJECT_DOCS, ...customConfigs };
    
    // 确保 tasks 目录存在
    if (!fs.existsSync(this.tasksPath)) {
      fs.mkdirSync(this.tasksPath, { recursive: true });
    }
  }

  /**
   * 获取项目的文档配置
   */
  getProjectConfig(projectId: string): ProjectDocConfig | null {
    return this.projectConfigs[projectId] || null;
  }

  /**
   * 添加或更新项目配置
   */
  setProjectConfig(config: ProjectDocConfig): void {
    this.projectConfigs[config.projectId] = config;
  }

  /**
   * 安全同步：从 03-任务分解.md 同步到看板 JSON
   * 保护运行态字段（in-progress/done 的 status/claimedBy 不被覆盖）
   */
  async safeSyncFromMarkdown(projectId: string): Promise<{
    success: boolean;
    tasks: Task[];
    protectedCount: number;
    updatedCount: number;
    error?: string;
  }> {
    const config = this.getProjectConfig(projectId);
    if (!config) {
      return {
        success: false,
        tasks: [],
        protectedCount: 0,
        updatedCount: 0,
        error: `No document config found for project: ${projectId}`,
      };
    }

    const taskDocPath = path.join(config.projectPath, config.taskDoc);
    
    if (!fs.existsSync(taskDocPath)) {
      return {
        success: false,
        tasks: [],
        protectedCount: 0,
        updatedCount: 0,
        error: `Task document not found: ${taskDocPath}`,
      };
    }

    try {
      // 1. 解析 markdown 文件
      const markdown = fs.readFileSync(taskDocPath, 'utf-8');
      const parsedTasks = this.parseTaskMarkdown(markdown, projectId);

      // 2. 获取现有任务数据
      const existingTasks = await this.taskService.getTasksByProject(projectId);
      const existingMap = new Map(existingTasks.map(t => [t.id, t]));

      // 3. 安全合并：保护运行态字段
      let protectedCount = 0;
      let updatedCount = 0;
      const mergedTasks: Task[] = [];

      for (const parsedTask of parsedTasks) {
        const existing = existingMap.get(parsedTask.id);
        
        if (existing) {
          // 检查是否需要保护运行态字段
          const needsProtection = existing.status === 'in-progress' || existing.status === 'done';
          
          if (needsProtection) {
            // 保护运行态字段，只更新静态信息
            const mergedTask: Task = {
              ...parsedTask,
              // 保留运行态字段
              status: existing.status,
              claimedBy: existing.claimedBy,
              assignee: existing.assignee,
              // 保留评论历史
              comments: existing.comments,
              // 更新时间戳
              createdAt: existing.createdAt,
              updatedAt: new Date().toISOString(),
            };
            mergedTasks.push(mergedTask);
            protectedCount++;
          } else {
            // todo 状态可以完全更新
            mergedTasks.push({
              ...parsedTask,
              comments: existing.comments,
              createdAt: existing.createdAt,
              updatedAt: new Date().toISOString(),
            });
            updatedCount++;
          }
        } else {
          // 新任务
          mergedTasks.push(parsedTask);
          updatedCount++;
        }
      }

      // 4. 保存合并后的数据
      await this.saveTasksJson(projectId, mergedTasks);

      console.log(`✅ Safe sync completed for ${projectId}: ${mergedTasks.length} tasks, ${protectedCount} protected, ${updatedCount} updated`);

      return {
        success: true,
        tasks: mergedTasks,
        protectedCount,
        updatedCount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Safe sync failed for ${projectId}:`, errorMessage);
      return {
        success: false,
        tasks: [],
        protectedCount: 0,
        updatedCount: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * 解析 03-任务分解.md 格式
   * 
   * 支持格式：
   * ### PMW-001 `P0` 配置 project-manager Agent 的 HEARTBEAT.md
   * - 状态: 已完成
   * - 描述: 编写 HEARTBEAT.md 文件...
   * - 领取者: (空)
   */
  private parseTaskMarkdown(markdown: string, projectId: string): Task[] {
    const tasks: Task[] = [];
    const lines = markdown.split('\n');
    
    let currentStage = '';
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // 匹配阶段标题: ## 阶段 X：xxx
      const stageMatch = line.match(/^##\s+阶段\s+\d+[：:].*/);
      if (stageMatch) {
        currentStage = line.replace(/^##\s+/, '').trim();
        i++;
        continue;
      }

      // 匹配任务标题: ### PMW-001 `P0` 任务标题
      const taskMatch = line.match(/^###\s+([A-Z]+-\d+)\s+`([P]\d+)`\s+(.+)$/);
      if (taskMatch) {
        const taskId = taskMatch[1];
        const priority = taskMatch[2] as 'P0' | 'P1' | 'P2' | 'P3';
        const title = taskMatch[3].trim();
        
        // 解析任务详情
        const task = this.parseTaskDetails(lines, i + 1, {
          id: taskId,
          title,
          priority,
          stage: currentStage,
          projectId,
        });
        
        tasks.push(task);
        i += 10; // 跳过已解析的行
        continue;
      }

      i++;
    }

    return tasks;
  }

  /**
   * 解析任务详情行
   */
  private parseTaskDetails(
    lines: string[],
    startIndex: number,
    meta: { id: string; title: string; priority: string; stage: string; projectId: string }
  ): Task {
    let description = '';
    let status: 'todo' | 'in-progress' | 'done' = 'todo';
    let assignee: string | null = null;
    let dueDate: string | null = null;
    let dependencies: string[] = [];

    // 扫描接下来的行，直到遇到空行或新任务
    for (let i = startIndex; i < lines.length && i < startIndex + 10; i++) {
      const line = lines[i].trim();
      
      if (!line || line.startsWith('###') || line.startsWith('##')) {
        break;
      }

      // 状态: 已完成 / 进行中 / 待处理
      if (line.startsWith('- 状态:') || line.startsWith('- 状态：')) {
        const statusText = line.replace(/^-\s*状态[:：]\s*/, '').trim();
        status = this.parseStatusText(statusText);
        continue;
      }

      // 描述: xxx
      if (line.startsWith('- 描述:') || line.startsWith('- 描述：')) {
        description = line.replace(/^-\s*描述[:：]\s*/, '').trim();
        continue;
      }

      // 领取者: @xxx / (空)
      if (line.startsWith('- 领取者:') || line.startsWith('- 领取者：')) {
        const assigneeText = line.replace(/^-\s*领取者[:：]\s*/, '').trim();
        if (assigneeText && assigneeText !== '(空)') {
          assignee = assigneeText.startsWith('@') ? assigneeText.slice(1) : assigneeText;
        }
        continue;
      }

      // 预计时间: xxx
      if (line.startsWith('- 预计时间:') || line.startsWith('- 预计时间：')) {
        // 可以用于计算 dueDate，暂时忽略
        continue;
      }

      // 依赖: PMW-xxx
      if (line.startsWith('- 依赖:') || line.startsWith('- 依赖：')) {
        const depText = line.replace(/^-\s*依赖[:：]\s*/, '').trim();
        if (depText && depText !== '(无)') {
          dependencies = depText.split(/[,，]/).map(d => d.trim()).filter(Boolean);
        }
        continue;
      }
    }

    return {
      id: meta.id,
      title: meta.title,
      description,
      status,
      priority: meta.priority as 'P0' | 'P1' | 'P2' | 'P3',
      labels: meta.stage ? [meta.stage] : [],
      assignee,
      claimedBy: null,
      dueDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: [],
    };
  }

  /**
   * 解析状态文本
   */
  private parseStatusText(text: string): 'todo' | 'in-progress' | 'done' {
    const lowerText = text.toLowerCase();
    
    // 检查是否包含"已完成"或"done"
    if (text.includes('已完成') || lowerText.includes('done')) {
      return 'done';
    }
    
    // 检查是否包含"进行中"或"in-progress"
    if (text.includes('进行中') || lowerText.includes('in-progress')) {
      return 'in-progress';
    }
    
    // 检查是否包含"待处理"或"todo"
    if (text.includes('待处理') || lowerText.includes('todo')) {
      return 'todo';
    }
    
    // 默认根据文本推断
    if (text.includes('待定')) {
      return 'todo';
    }
    
    return 'todo';
  }

  /**
   * 保存任务 JSON 文件
   */
  private async saveTasksJson(projectId: string, tasks: Task[]): Promise<void> {
    const filePath = path.join(this.tasksPath, `${projectId}-tasks.json`);
    const project = await this.taskService.getProjectById(projectId);
    
    if (project) {
      const data = {
        ...project,
        tasks,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } else {
      // 如果项目不存在，创建基本结构
      const data = {
        id: projectId,
        name: projectId,
        description: '',
        status: 'active',
        tasks,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
  }

  /**
   * 获取所有已配置的项目
   */
  getConfiguredProjects(): string[] {
    return Object.keys(this.projectConfigs);
  }
}