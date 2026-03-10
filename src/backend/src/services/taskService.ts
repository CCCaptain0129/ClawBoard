import { Task, Project } from '../types/tasks';
import * as fs from 'fs';
import * as path from 'path';

export class TaskService {
  private tasksPath = path.join(process.cwd(), '../tasks');
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

  async getTasksByProject(projectId: string): Promise<Task[]> {
    try {
      const filePath = path.join(this.tasksPath, `${projectId}-tasks.json`);
      const data = fs.readFileSync(filePath, 'utf-8');
      const project = JSON.parse(data);
      return project.tasks || [];
    } catch {
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
