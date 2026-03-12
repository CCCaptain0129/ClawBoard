/**
 * 测试脚本：验证状态同步机制
 *
 * 运行方式：
 * cd /Users/ot/.openclaw/workspace/projects/openclaw-visualization/src/backend
 * npm run dev
 * (在另一个终端)
 * node test-status-sync.mjs
 */

import fs from 'fs';
import path from 'path';

const RECORDING_PATH = '/Users/ot/.openclaw/workspace/projects/openclaw-visualization/docs/internal/SUBAGENTS任务分发记录.md';
const TASKS_PATH = '/Users/ot/.openclaw/workspace/projects/openclaw-visualization/tasks/openclaw-visualization-tasks.json';

// 读取任务数据
function getTasks() {
  const data = fs.readFileSync(TASKS_PATH, 'utf-8');
  return JSON.parse(data).tasks;
}

// 获取任务状态
function getTaskStatus(taskId) {
  const tasks = getTasks();
  const task = tasks.find(t => t.id === taskId);
  return task ? task.status : null;
}

// 添加测试 Subagent 记录
function addTestSubagentRecord(taskId, taskTitle, subagentId) {
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const entry = `
### ${timestamp} 创建 Subagent

**Subagent ID**: \`${subagentId}\`
**类型**: Test Agent
**任务**: ${taskId} - ${taskTitle}
**分配时间**: ${new Date().toISOString()}

**任务描述**:
- 测试状态同步机制

**返回结果**:
- 等待 Subagent 完成中...

**释放时间**: -
**状态**: 🔄 进行中

`;

  fs.appendFileSync(RECORDING_PATH, entry, 'utf-8');
  console.log(`✅ 添加测试 Subagent 记录: ${subagentId}`);
}

// 标记 Subagent 完成
function markSubagentComplete(subagentId, success = true) {
  const content = fs.readFileSync(RECORDING_PATH, 'utf-8');
  const escapedId = subagentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(### [^\\n]+ 创建 Subagent\\n\\*\\*Subagent ID\\*\\*:\\s*\`${escapedId}\`[^]*?)(\\*\\*状态\\*\\*:\\s*🔄 进行中\\n)`);

  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const status = success ? '✅ 成功' : '❌ 失败';
  const output = success
    ? '测试成功：状态已同步'
    : '测试失败：模拟错误场景';

  const newContent = content.replace(pattern, (match, prefix, statusLine) => {
    return prefix + `**释放时间**: ${timestamp}\n**状态**: ${status}\n\n**返回结果**:\n- ${output}\n\n`;
  });

  if (newContent !== content) {
    fs.writeFileSync(RECORDING_PATH, newContent, 'utf-8');
    console.log(`✅ 标记 Subagent 完成: ${subagentId} (${status})`);
  } else {
    console.warn(`⚠️ 未找到 Subagent 记录: ${subagentId}`);
  }
}

// 主测试流程
async function runTests() {
  console.log('🧪 开始测试状态同步机制\n');

  // 测试 1: 创建测试任务
  console.log('=== 测试 1: 创建测试任务 ===');
  const testTaskId = 'TASK-SYNC-001';
  const testTaskTitle = '状态同步测试任务';
  const testSubagentId = `agent:main:subagent:${Date.now()}`;

  // 检查任务初始状态
  const initialStatus = getTaskStatus(testTaskId);
  console.log(`任务初始状态: ${initialStatus || '不存在'}`);

  // 如果任务不存在，需要先创建（这里跳过，因为需要通过 API 创建）

  // 测试 2: 添加 Subagent 记录
  console.log('\n=== 测试 2: 添加 Subagent 记录 ===');
  addTestSubagentRecord(testTaskId, testTaskTitle, testSubagentId);

  // 等待 3 秒，让 StatusSyncService 处理
  console.log('\n⏳ 等待 3 秒...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 检查任务状态是否更新
  const afterCreateStatus = getTaskStatus(testTaskId);
  console.log(`任务状态（创建 Subagent 后）: ${afterCreateStatus}`);

  if (afterCreateStatus === 'in-progress') {
    console.log('✅ 测试 2 通过：任务状态已更新为 in-progress');
  } else {
    console.warn('⚠️ 测试 2 失败：任务状态未更新');
  }

  // 测试 3: 标记 Subagent 完成
  console.log('\n=== 测试 3: 标记 Subagent 完成 ===');
  markSubagentComplete(testSubagentId, true);

  // 等待 3 秒
  console.log('\n⏳ 等待 3 秒...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 检查任务状态是否更新
  const afterCompleteStatus = getTaskStatus(testTaskId);
  console.log(`任务状态（Subagent 完成后）: ${afterCompleteStatus}`);

  if (afterCompleteStatus === 'done') {
    console.log('✅ 测试 3 通过：任务状态已更新为 done');
  } else {
    console.warn('⚠️ 测试 3 失败：任务状态未更新');
  }

  console.log('\n🎉 测试完成');
}

// 运行测试
runTests().catch(console.error);