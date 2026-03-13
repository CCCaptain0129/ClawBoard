#!/usr/bin/env node
/**
 * sync-tasks.mjs - 任务同步脚本
 * 
 * 功能：
 * 1. 同步 Markdown 和 JSON 任务文件
 * 2. 双向转换
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TASKS_DIR = path.resolve(__dirname, '../tasks');

/**
 * 解析 Markdown 任务文件
 */
function parseMarkdownTasks(content) {
  const tasks = [];
  const lines = content.split('\n');
  
  let currentTask = null;
  
  for (const line of lines) {
    // 匹配任务标题: - [ ] 或 - [x]
    const taskMatch = line.match(/^-\s*\[([ x])\]\s*(.+)$/);
    if (taskMatch) {
      if (currentTask) {
        tasks.push(currentTask);
      }
      currentTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: taskMatch[2].trim(),
        status: taskMatch[1] === 'x' ? 'done' : 'todo',
        priority: 'P2',
        description: ''
      };
      continue;
    }
    
    // 匹配优先级标签
    if (currentTask && line.includes('**优先级**:')) {
      const priorityMatch = line.match(/\*\*优先级\*\*:\s*(P[0-3])/);
      if (priorityMatch) {
        currentTask.priority = priorityMatch[1];
      }
    }
    
    // 匹配描述内容
    if (currentTask && line.trim() && !line.startsWith('#')) {
      currentTask.description += line + '\n';
    }
  }
  
  if (currentTask) {
    tasks.push(currentTask);
  }
  
  return tasks;
}

/**
 * 生成 Markdown 任务文件
 */
function generateMarkdown(data) {
  let markdown = `# ${data.project || 'Tasks'} 任务列表

> 自动生成于 ${new Date().toLocaleString('zh-CN')}

## 任务概览

- 总计: ${data.tasks?.length || 0} 个任务
- 待办: ${data.tasks?.filter(t => t.status === 'todo').length || 0} 个
- 完成: ${data.tasks?.filter(t => t.status === 'done').length || 0} 个

---

## 任务列表

`;

  for (const task of (data.tasks || [])) {
    const checkbox = task.status === 'done' ? '[x]' : '[ ]';
    markdown += `- ${checkbox} **${task.priority || 'P2'}** ${task.title}\n`;
    
    if (task.description) {
      markdown += `  ${task.description.split('\n')[0]}\n`;
    }
    markdown += '\n';
  }

  return markdown;
}

/**
 * 同步单个项目
 */
function syncProject(projectName) {
  const jsonFile = path.join(TASKS_DIR, `${projectName}-tasks.json`);
  const mdFile = path.join(TASKS_DIR, `${projectName}-TASKS.md`);
  
  if (!fs.existsSync(jsonFile)) {
    console.log(`跳过 ${projectName}: JSON 文件不存在`);
    return;
  }
  
  const jsonStat = fs.statSync(jsonFile);
  const mdStat = fs.existsSync(mdFile) ? fs.statSync(mdFile) : { mtime: new Date(0) };
  
  if (jsonStat.mtime > mdStat.mtime) {
    // JSON 比 Markdown 新，更新 Markdown
    console.log(`更新 Markdown: ${projectName}`);
    const data = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
    const markdown = generateMarkdown(data);
    fs.writeFileSync(mdFile, markdown);
  } else if (fs.existsSync(mdFile)) {
    // Markdown 比 JSON 新，可以选择更新 JSON（当前不实现，避免覆盖）
    console.log(`Markdown 较新: ${projectName}（不自动同步）`);
  }
}

/**
 * 主函数
 */
function main() {
  console.log('任务同步开始...\n');
  
  // 获取所有 JSON 文件
  const files = fs.readdirSync(TASKS_DIR)
    .filter(f => f.endsWith('-tasks.json'))
    .map(f => f.replace('-tasks.json', ''));
  
  for (const project of files) {
    syncProject(project);
  }
  
  console.log('\n任务同步完成');
}

main();