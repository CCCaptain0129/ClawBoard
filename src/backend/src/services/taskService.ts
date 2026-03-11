import { Task, Project } from '../types/tasks';
import * as fs from 'fs';
import * as path from 'path';
import { validateJSONFile } from '../middleware/jsonValidator';

export class TaskService {
  private tasksPath = path.join(process.cwd(), '../../tasks');
  private projectsPath = path.join(this.tasksPath, 'projects.json');

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

  async createTask(projectId: string, task: Partial<Task>): Promise<Task> {
    const tasks = await this.getTasksByProject(projectId);
    const newTask: Task = {
      id: task.id || `TASK-${Date.now()}`,
      title: task.title || 'New Task',
      description: task.description || '',
      status: 'todo',
      priority: task.priority || 'P2',
      labels: task.labels || [],
      assignee: task.assignee || null,
      claimedBy: null,
      dueDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: [],
    };
    
    tasks.push(newTask);
    await this.saveTasks(projectId, tasks);
    return newTask;
  }

  async getTasksByProject(projectId: string): Promise<Task[]> {
    const filePath = path.join(this.tasksPath, `${projectId}-tasks.json`);

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
    
    tasks[taskIndex] = { ...tasks[taskIndex], ...updates, updatedAt: new Date().toISOString() };
    
    await this.saveTasks(projectId, tasks);
    return tasks[taskIndex];
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
