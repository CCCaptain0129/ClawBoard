/**
 * 测试工具和模拟对象
 */

import { Task, Project } from '../src/types/tasks';

// 模拟任务数据
export function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'TEST-001',
    title: 'Test Task',
    description: 'Test task description',
    status: 'todo',
    priority: 'P1',
    labels: [],
    assignee: null,
    claimedBy: null,
    dueDate: null,
    startTime: null,
    completeTime: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    comments: [],
    ...overrides,
  };
}

// 模拟项目数据
export function createMockProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'test-project',
    name: 'Test Project',
    description: 'Test project description',
    status: 'active',
    leadAgent: null,
    color: '#3b82f6',
    icon: '📋',
    taskPrefix: 'TEST',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// 模拟 TaskService
export class MockTaskService {
  private tasks: Map<string, Task[]> = new Map();
  private projects: Map<string, Project> = new Map();

  constructor() {
    // 默认创建一个测试项目
    this.projects.set('test-project', createMockProject());
  }

  async getTasksByProject(projectId: string): Promise<Task[]> {
    return this.tasks.get(projectId) || [];
  }

  async getProjectById(projectId: string): Promise<Project | null> {
    return this.projects.get(projectId) || null;
  }

  setTasks(projectId: string, tasks: Task[]): void {
    this.tasks.set(projectId, tasks);
  }

  setProject(project: Project): void {
    this.projects.set(project.id, project);
  }

  clear(): void {
    this.tasks.clear();
    this.projects.clear();
  }
}

// 延迟函数
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 等待条件
export async function waitFor(
  condition: () => boolean,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50 } = options;
  const start = Date.now();

  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }
    await delay(interval);
  }
}

// 创建临时目录
export function createTempDir(): string {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmw-test-'));
  return tempDir;
}

// 清理临时目录
export function cleanupTempDir(dir: string): void {
  const fs = require('fs');
  
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// 写入测试文件
export function writeTestFile(dir: string, filename: string, content: string): string {
  const fs = require('fs');
  const path = require('path');
  
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

// 读取测试文件
export function readTestFile(dir: string, filename: string): string {
  const fs = require('fs');
  const path = require('path');
  
  const filePath = path.join(dir, filename);
  return fs.readFileSync(filePath, 'utf-8');
}