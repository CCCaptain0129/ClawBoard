#!/usr/bin/env node

/**
 * 测试任务持久化
 * 模拟创建任务并验证是否正确保存
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 模拟 taskService 的逻辑
class TestTaskService {
  constructor() {
    this.tasksPath = path.join(__dirname, 'tasks');
  }

  async createTestTask(projectId, taskData) {
    const tasks = await this.getTasksByProject(projectId);

    const newTask = {
      id: `TEST-${Date.now()}`,
      title: taskData.title,
      description: taskData.description || '',
      status: 'todo',
      priority: 'P3',
      labels: [],
      assignee: null,
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

  async getTasksByProject(projectId) {
    const filePath = path.join(this.tasksPath, `${projectId}-tasks.json`);
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const project = JSON.parse(data);
      return project.tasks || [];
    } catch (error) {
      console.error(`Error loading tasks: ${error.message}`);
      return [];
    }
  }

  async saveTasks(projectId, tasks) {
    const filePath = path.join(this.tasksPath, `${projectId}-tasks.json`);
    const projectsPath = path.join(this.tasksPath, 'projects.json');

    try {
      const projectsData = fs.readFileSync(projectsPath, 'utf-8');
      const projects = JSON.parse(projectsData);
      const project = projects.find(p => p.id === projectId);

      if (project) {
        const data = { ...project, tasks, updatedAt: new Date().toISOString() };

        // 写入文件
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

        // 立即验证写入
        const verify = fs.readFileSync(filePath, 'utf-8');
        const verifyData = JSON.parse(verify);

        return verifyData.tasks && verifyData.tasks.length === tasks.length;
      }
    } catch (error) {
      console.error(`Error saving tasks: ${error.message}`);
      return false;
    }
  }
}

console.log('='.repeat(60));
console.log('任务持久化测试');
console.log('='.repeat(60));
console.log();

const taskService = new TestTaskService();

// 测试 1: 创建任务并验证保存
console.log('📋 测试 1: 创建任务并验证保存');
console.log('-'.repeat(60));

const testTask = await taskService.createTestTask('openclaw-visualization', {
  title: '持久化测试任务',
  description: '测试任务是否正确保存到JSON文件'
});

console.log(`✅ 创建任务: ${testTask.id}`);
console.log(`   标题: ${testTask.title}`);
console.log(`   创建时间: ${testTask.createdAt}`);
console.log();

// 测试 2: 立即读取验证
console.log('📋 测试 2: 立即读取验证');
console.log('-'.repeat(60));

const tasks = await taskService.getTasksByProject('openclaw-visualization');
const foundTask = tasks.find(t => t.id === testTask.id);

if (foundTask) {
  console.log(`✅ 任务已保存: ${foundTask.id}`);
  console.log(`   标题: ${foundTask.title}`);
  console.log(`   状态: ${foundTask.status}`);
} else {
  console.log(`❌ 任务未找到: ${testTask.id}`);
}
console.log();

// 测试 3: 验证文件内容
console.log('📋 测试 3: 验证文件内容');
console.log('-'.repeat(60));

const filePath = path.join(__dirname, 'tasks/openclaw-visualization-tasks.json');
const fileContent = fs.readFileSync(filePath, 'utf-8');
const fileData = JSON.parse(fileContent);
const fileTask = fileData.tasks.find(t => t.id === testTask.id);

if (fileTask) {
  console.log(`✅ 文件中存在任务: ${fileTask.id}`);
  console.log(`   标题: ${fileTask.title}`);
  console.log(`   状态: ${fileTask.status}`);
  console.log(`   文件更新时间: ${fileData.updatedAt}`);
} else {
  console.log(`❌ 文件中未找到任务: ${testTask.id}`);
}
console.log();

// 测试 4: 模拟重启服务（重新加载）
console.log('📋 测试 4: 模拟重启服务（重新加载）');
console.log('-'.repeat(60));

const newService = new TestTaskService();
const reloadedTasks = await newService.getTasksByProject('openclaw-visualization');
const reloadedTask = reloadedTasks.find(t => t.id === testTask.id);

if (reloadedTask) {
  console.log(`✅ 重启后任务仍然存在: ${reloadedTask.id}`);
  console.log(`   标题: ${reloadedTask.title}`);
  console.log(`   状态: ${reloadedTask.status}`);
  console.log(`   创建时间: ${reloadedTask.createdAt}`);
} else {
  console.log(`❌ 重启后任务丢失: ${testTask.id}`);
}
console.log();

// 清理测试任务
console.log('📋 清理测试任务');
console.log('-'.repeat(60));

const allTasks = await taskService.getTasksByProject('openclaw-visualization');
const filteredTasks = allTasks.filter(t => t.id !== testTask.id);
await taskService.saveTasks('openclaw-visualization', filteredTasks);

console.log(`✅ 已删除测试任务: ${testTask.id}`);
console.log();

console.log('='.repeat(60));
console.log('测试完成');
console.log('='.repeat(60));