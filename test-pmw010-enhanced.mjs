#!/usr/bin/env node

/**
 * PMW-010: 测试脚本 - 添加增强任务信息
 *
 * 添加具有以下字段的测试任务：
 * - estimatedTime: 预计执行时间
 * - comments: 执行日志数组
 * - 测试超时检测
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const tasksPath = join(process.cwd(), 'tasks/openclaw-visualization-tasks.json');

// 读取现有任务
const data = JSON.parse(readFileSync(tasksPath, 'utf-8'));

// 查找最后一个任务ID
const lastTaskId = data.tasks[data.tasks.length - 1]?.id || 'VIS-000';
const lastNumber = parseInt(lastTaskId.split('-')[1]) || 0;
const newId = `VIS-${String(lastNumber + 1).padStart(3, '0')}`;

// 当前时间（用于测试）
const now = new Date().toISOString();
const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
const twoHoursAgo = new Date(Date.now() - 7200000).toISOString();

// 创建测试任务
const testTasks = [
  {
    id: newId,
    title: 'PMW-010 测试：任务执行超时检测',
    description: '测试超时检测功能：预计30分钟，实际已执行1小时',
    status: 'in-progress',
    priority: 'P2',
    labels: ['PMW-010', '测试'],
    assignee: null,
    claimedBy: 'agent:main:subagent:test-timeout-task-1234567890ab',
    dueDate: null,
    startTime: oneHourAgo,  // 1小时前开始
    completeTime: null,
    estimatedTime: '30分钟',  // 预计30分钟
    createdAt: now,
    updatedAt: now,
    comments: [
      '开始执行任务...',
      '正在处理中...',
      '⚠️ 任务执行时间超过预计时间'
    ]
  },
  {
    id: `VIS-${String(lastNumber + 2).padStart(3, '0')}`,
    title: 'PMW-010 测试：带执行日志的任务',
    description: '测试执行日志展示功能',
    status: 'done',
    priority: 'P3',
    labels: ['PMW-010', '测试'],
    assignee: null,
    claimedBy: 'agent:main:subagent:log-test-abc123def456',
    dueDate: null,
    startTime: twoHoursAgo,
    completeTime: oneHourAgo,
    estimatedTime: '1小时',
    createdAt: now,
    updatedAt: now,
    comments: [
      '初始化任务环境...',
      '配置测试参数完成',
      '开始执行主要逻辑...',
      '✅ 任务执行成功',
      `完成时间: ${oneHourAgo}`
    ]
  }
];

// 添加任务
data.tasks.push(...testTasks);

// 更新统计
const total = data.tasks.length;
const todo = data.tasks.filter(t => t.status === 'todo').length;
const inProgress = data.tasks.filter(t => t.status === 'in-progress').length;
const done = data.tasks.filter(t => t.status === 'done').length;

data.stats = {
  total,
  todo,
  inProgress,
  done,
  progress: total > 0 ? Math.round((done / total) * 100) : 0
};

data.updatedAt = now;

// 写回文件
writeFileSync(tasksPath, JSON.stringify(data, null, 2), 'utf-8');

console.log('✅ 测试任务已添加！\n');
console.log('添加的任务:');
testTasks.forEach(task => {
  console.log(`  - ${task.id}: ${task.title}`);
  console.log(`    状态: ${task.status}`);
  console.log(`    预计时间: ${task.estimatedTime}`);
  console.log(`    日志数: ${task.comments?.length || 0}\n`);
});

console.log(`📊 项目统计:`);
console.log(`  总任务数: ${total}`);
console.log(`  待处理: ${todo}`);
console.log(`  进行中: ${inProgress}`);
console.log(`  已完成: ${done}`);
console.log(`  进度: ${data.stats.progress}%`);