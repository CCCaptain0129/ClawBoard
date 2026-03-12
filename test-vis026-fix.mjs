#!/usr/bin/env node

/**
 * 测试 VIS-026 修复
 * 验证任务ID查找和任务持久化
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 模拟 SubagentManager 的 findTaskIdBySubagentId 方法
function findTaskIdBySubagentId(subagentId, recordingPath) {
  const content = fs.readFileSync(recordingPath, 'utf-8');

  // 转义Subagent ID中的特殊字符
  const escapedId = subagentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 使用更精确的匹配：从 Subagent ID 到任务标题
  // 支持多种任务ID格式：VIS-xxx, INT-xxx, EXA-xxx, TASK-xxx, TASK-TEST-xxx 等
  // 格式：PREFIX(XXX)-NNN 或 PREFIX(XXX)-PREFIX(XXX)-NNN
  const pattern = new RegExp(
    'Subagent ID.*`' + escapedId + '`[\\s\\S]*?\\*\\*任务\\*\\*:\\s*([A-Z][A-Z0-9-]*\\d{3,4})',
    's'
  );
  const match = content.match(pattern);

  if (match) {
    const taskId = match[1];
    console.log(`✅ 找到任务ID: ${taskId}`);
    return taskId;
  }

  console.log(`❌ 未找到任务ID for ${subagentId}`);
  return null;
}

// 测试用例（使用实际存在于文件中的 Subagent ID）
const testCases = [
  {
    subagentId: 'agent:main:subagent:1773247354722',
    expectedTaskId: 'TASK-FINAL-001',
    description: '测试 TASK-FINAL-xxx 格式的任务ID'
  },
  {
    subagentId: 'agent:main:subagent:test-sync-001',
    expectedTaskId: 'TASK-SYNC-001',
    description: '测试 TASK-SYNC-xxx 格式的任务ID'
  }
];

const recordingPath = path.join(__dirname, 'docs/internal/SUBAGENTS任务分发记录.md');

console.log('='.repeat(60));
console.log('VIS-026 修复验证测试');
console.log('='.repeat(60));
console.log();

// 测试任务ID查找
console.log('📋 测试 1: 任务ID查找功能');
console.log('-'.repeat(60));

let passCount = 0;
let failCount = 0;

for (const testCase of testCases) {
  console.log(`\n${testCase.description}`);
  console.log(`  Subagent ID: ${testCase.subagentId}`);
  const foundTaskId = findTaskIdBySubagentId(testCase.subagentId, recordingPath);

  if (foundTaskId === testCase.expectedTaskId) {
    console.log(`  ✅ 通过: 期望 ${testCase.expectedTaskId}, 实际 ${foundTaskId}`);
    passCount++;
  } else {
    console.log(`  ❌ 失败: 期望 ${testCase.expectedTaskId}, 实际 ${foundTaskId}`);
    failCount++;
  }
}

console.log();
console.log(`结果: ${passCount}/${testCases.length} 通过, ${failCount}/${testCases.length} 失败`);
console.log();

// 测试任务持久化
console.log('📋 测试 2: 任务持久化功能');
console.log('-'.repeat(60));

const tasksPath = path.join(__dirname, 'tasks/openclaw-visualization-tasks.json');

if (fs.existsSync(tasksPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
    const tasks = data.tasks || [];

    console.log(`\n✅ 任务文件存在`);
    console.log(`📊 任务总数: ${tasks.length}`);

    // 检查测试任务是否存在
    const testTasks = tasks.filter(t => t.id.startsWith('TASK-TEST') || t.id.startsWith('TASK-FINAL'));
    console.log(`📝 测试任务数: ${testTasks.length}`);

    if (testTasks.length > 0) {
      console.log('\n测试任务列表:');
      testTasks.forEach(task => {
        console.log(`  - ${task.id}: ${task.status}`);
      });
    }

    // 检查任务格式是否正确
    // 格式：字母开头的ID，包含至少3位数字，如 VIS-001, TASK-SYNC-001
    const hasValidIds = tasks.every(t => t.id && /^[A-Z][A-Z0-9-]*\d{3,}$/.test(t.id));
    console.log(`\n${hasValidIds ? '✅' : '❌'} 任务ID格式验证: ${hasValidIds ? '正确' : '有误'}`);

    // 显示一些任务ID示例
    console.log('\n任务ID示例:');
    tasks.slice(0, 5).forEach(t => {
      console.log(`  - ${t.id}`);
    });

  } catch (error) {
    console.log(`\n❌ 读取任务文件失败: ${error.message}`);
  }
} else {
  console.log(`\n❌ 任务文件不存在: ${tasksPath}`);
}

console.log();
console.log('='.repeat(60));
console.log('测试完成');
console.log('='.repeat(60));