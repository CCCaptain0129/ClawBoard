import { Task, Project } from '../types/tasks';
import * as fs from 'fs';
import * as path from 'path';

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
    let data = '';
    
    try {
      data = fs.readFileSync(filePath, 'utf-8');
      const project = JSON.parse(data);
      return project.tasks || [];
    } catch (error) {
      console.error(`❌ Failed to load tasks for project "${projectId}":`);
      console.error(`   File path: ${filePath}`);
      console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      
      // 尝试提取错误行号（仅在 JSON 解析错误时）
      if (error instanceof SyntaxError && data) {
        const match = /position (\d+)/.exec(error.message);
        if (match) {
          const position = parseInt(match[1], 10);
          const lines = data.split('\n');
          let line = 1, col = 0;
          for (let i = 0, count = 0; i < lines.length && count < position; i++) {
            count += lines[i].length + 1; // +1 for newline
            if (count <= position) {
              line = i + 1;
              col = position - (count - lines[i].length - 1);
            }
          }
          console.error(`   Error location: Line ${line}, Column ${col}`);
          console.error(`   Context: ${lines[line - 1]?.trim() || '(empty line)'}`);
        }
      }
      
      if (error instanceof SyntaxError) {
        console.error(`   This appears to be a JSON syntax error.`);
        console.error(`   Common issues:`);
        console.error(`   - Missing quotes around keys`);
        console.error(`   - Trailing commas`);
        console.error(`   - Invalid characters`);
        console.error(`   - Unmatched brackets or braces`);
        console.error(`   Tip: Use 'python3 -m json.tool <file>' to validate JSON`);
      }
      
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
