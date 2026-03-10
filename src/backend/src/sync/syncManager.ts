import { MarkdownToJSON } from './markdownToJSON';
import { JSONToMarkdown } from './jsonToMarkdown';
import { TaskService } from '../services/taskService';
import * as fs from 'fs';
import * as path from 'path';
import { Task, Project } from '../types/tasks';

export class SyncManager {
  private taskService: TaskService;
  
  constructor(
    private markdownToJSON: MarkdownToJSON,
    private jsonToMarkdown: JSONToMarkdown,
    taskService: TaskService
  ) {
    this.taskService = taskService;
  }

  /**
   * 从 TASKS.md 同步到 JSON 文件
   */
  async syncFromMarkdown(projectId: string): Promise<{ project: Project; tasks: Task[] }> {
    const { project, tasks } = await this.markdownToJSON.parse(projectId);
    
    const tasksDir = path.join(process.cwd(), '../../tasks');
    if (!fs.existsSync(tasksDir)) {
      fs.mkdirSync(tasksDir, { recursive: true });
    }
    
    // 保存任务 JSON
    const filePath = path.join(tasksDir, `${projectId}-tasks.json`);
    fs.writeFileSync(filePath, JSON.stringify({ ...project, tasks }, null, 2));
    
    console.log(`✅ Synced from markdown: ${tasks.length} tasks loaded`);
    return { project, tasks };
  }

  /**
   * 从 JSON 文件同步到 TASKS.md
   */
  async syncToMarkdown(projectId: string): Promise<void> {
    const tasks = await this.taskService.getTasksByProject(projectId);
    const project = await this.taskService.getProjectById(projectId);
    
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    const markdown = this.jsonToMarkdown.generate(project, tasks);
    
    const tasksMdPath = path.join(process.cwd(), '../../TASKS.md');
    fs.writeFileSync(tasksMdPath, markdown);
    
    console.log(`✅ Synced to markdown: ${tasks.length} tasks saved`);
  }

  /**
   * 双向同步: Markdown -> JSON -> Markdown (保持格式一致)
   */
  async sync(projectId: string): Promise<void> {
    await this.syncFromMarkdown(projectId);
    await this.syncToMarkdown(projectId);
  }
}