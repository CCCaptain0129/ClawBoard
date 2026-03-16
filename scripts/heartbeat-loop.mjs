#!/usr/bin/env node
/**
 * heartbeat-loop.mjs - 通用项目心跳脚本示例
 *
 * 功能：
 * 1. 拉取指定项目的 todo 任务
 * 2. 按优先级排序（P0→P1→P2→P3）
 * 3. 限制并发 subagent 数量
 * 4. 对高优先级任务创建 subagent
 * 5. 记录分发结果
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const CONFIG = {
  projectRoot: process.env.PROJECT_ROOT || path.resolve(__dirname, '..'),
  projectId: process.env.PROJECT_ID || 'example-project',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
  maxConcurrency: 3,
  logFile: path.resolve(__dirname, '../tmp/logs/heartbeat.log')
};

// 日志函数
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim());
  
  try {
    fs.appendFileSync(CONFIG.logFile, logMessage);
  } catch (e) {
    // 忽略日志写入错误
  }
}

// 优先级映射
const PRIORITY_ORDER = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };

/**
 * 获取待办任务
 */
async function getTodoTasks() {
  const tasksFile = path.join(CONFIG.projectRoot, `tasks/${CONFIG.projectId}-tasks.json`);
  
  if (!fs.existsSync(tasksFile)) {
    log(`任务文件不存在: ${tasksFile}`);
    return [];
  }
  
  try {
    const content = fs.readFileSync(tasksFile, 'utf-8');
    const data = JSON.parse(content);
    
    // 过滤 todo 状态的任务
    const todoTasks = data.tasks?.filter(t => t.status === 'todo') || [];
    
    // 按优先级排序
    todoTasks.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 99;
      const pb = PRIORITY_ORDER[b.priority] ?? 99;
      return pa - pb;
    });
    
    return todoTasks;
  } catch (e) {
    log(`解析任务文件失败: ${e.message}`);
    return [];
  }
}

/**
 * 获取运行中的 subagent 数量
 */
async function getRunningSubagentCount() {
  try {
    const response = await fetch(`${CONFIG.backendUrl}/api/subagents/status`);
    const data = await response.json();
    return data.running?.length || 0;
  } catch (e) {
    log(`获取 subagent 状态失败: ${e.message}`);
    return 0;
  }
}

/**
 * 创建 subagent 处理任务
 */
async function createSubagentForTask(task) {
  try {
    const response = await fetch(`${CONFIG.backendUrl}/api/tasks/subagent/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: task.id,
        title: task.title,
        description: task.description || task.title,
        priority: task.priority
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      log(`创建 subagent 成功: ${task.id} -> ${result.subagentId}`);
      return { success: true, subagentId: result.subagentId };
    } else {
      log(`创建 subagent 失败: ${result.error}`);
      return { success: false, error: result.error };
    }
  } catch (e) {
    log(`创建 subagent 异常: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * 记录分发结果
 */
function recordDispatch(task, subagentId) {
  const recordFile = path.join(CONFIG.projectRoot, 'docs/internal/SUBAGENT_DISPATCH_RECORDS.md');
  
  // 确保目录存在
  const recordDir = path.dirname(recordFile);
  if (!fs.existsSync(recordDir)) {
    fs.mkdirSync(recordDir, { recursive: true });
  }
  
  // 如果文件不存在，创建表头
  if (!fs.existsSync(recordFile)) {
    const header = `# SUBAGENTS 任务分发记录

此文件记录任务分发给 subagent 的历史。

| 时间 | 任务ID | 任务标题 | 优先级 | Subagent ID | 状态 |
|------|--------|----------|--------|-------------|------|
`;
    fs.writeFileSync(recordFile, header);
  }
  
  // 追加记录
  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const record = `| ${timestamp} | ${task.id} | ${task.title} | ${task.priority} | ${subagentId} | 运行中 |\n`;
  fs.appendFileSync(recordFile, record);
  
  log(`记录分发: ${task.id} -> ${subagentId}`);
}

/**
 * 主函数
 */
async function main() {
  log(`========== 心跳开始 (${CONFIG.projectId}) ==========`);
  
  // 1. 获取待办任务
  const todoTasks = await getTodoTasks();
  log(`待办任务数量: ${todoTasks.length}`);
  
  if (todoTasks.length === 0) {
    log('无待办任务');
    console.log('HEARTBEAT_OK');
    return;
  }
  
  // 2. 检查并发限制
  const runningCount = await getRunningSubagentCount();
  log(`运行中 subagent 数量: ${runningCount}`);
  
  const availableSlots = CONFIG.maxConcurrency - runningCount;
  if (availableSlots <= 0) {
    log('已达到并发上限，跳过分配');
    console.log('HEARTBEAT_OK:max_concurrency');
    return;
  }
  
  // 3. 分配任务
  const tasksToAssign = todoTasks.slice(0, availableSlots);
  log(`将分配 ${tasksToAssign.length} 个任务`);
  
  let assignedCount = 0;
  for (const task of tasksToAssign) {
    log(`处理任务: ${task.id} [${task.priority}] ${task.title}`);
    
    const result = await createSubagentForTask(task);
    
    if (result.success) {
      recordDispatch(task, result.subagentId);
      assignedCount++;
    }
    
    // 间隔 1 秒，避免过快请求
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  log(`已分配 ${assignedCount} 个任务`);
  log(`========== 心跳结束 (${CONFIG.projectId}) ==========`);
  
  // 输出结果供 Agent 读取
  if (assignedCount > 0) {
    console.log(`HEARTBEAT_DISPATCHED:${assignedCount}`);
  } else {
    console.log('HEARTBEAT_OK');
  }
}

// 运行
main().catch(e => {
  log(`心跳异常: ${e.message}`);
  console.log('HEARTBEAT_ERROR');
  process.exit(1);
});
