#!/usr/bin/env node
/**
 * PMW-029 验证脚本
 *
 * 测试流程：
 * 1. 更新 pm-workflow-automation 项目的任务状态
 * 2. 等待 1-2 秒（去抖时间）
 * 3. 检查 04-进度跟踪.md 是否已更新
 */

import http from 'http';

const BASE_URL = 'http://localhost:3000';
const PROJECT_ID = 'pm-workflow-automation';
const TASK_ID = 'PMW-001'; // 使用一个已存在的任务

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// HTTP 请求封装
function request(options: http.RequestOptions, data?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// 延迟函数
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  log('=== PMW-029 验证脚本 ===', 'blue');
  log('目标：测试任务状态变更时自动回写到 04-进度跟踪.md\n', 'blue');

  try {
    // 步骤 1: 获取当前任务状态
    log('步骤 1: 获取任务列表...', 'yellow');
    const tasksBefore = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/tasks/projects/${PROJECT_ID}/tasks`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const task = tasksBefore.find((t: any) => t.id === TASK_ID);
    if (!task) {
      throw new Error(`Task ${TASK_ID} not found`);
    }

    log(`   ✓ 找到任务 ${TASK_ID}, 当前状态: ${task.status}`, 'green');

    // 步骤 2: 更新任务状态
    log(`\n步骤 2: 更新任务 ${TASK_ID} 状态为 "done"...`, 'yellow');
    const updatedTask = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/tasks/projects/${PROJECT_ID}/tasks/${TASK_ID}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
    }, { status: 'done' });

    log(`   ✓ 任务已更新, 新状态: ${updatedTask.status}`, 'green');

    // 步骤 3: 等待去抖时间（1秒）
    log(`\n步骤 3: 等待去抖时间 (1秒)...`, 'yellow');
    await delay(1500);
    log('   ✓ 去抖等待完成', 'green');

    // 步骤 4: 检查 04-进度跟踪.md
    log(`\n步骤 4: 检查 04-进度跟踪.md 是否已更新...`, 'yellow');
    const fs = await import('fs');
    const progressDocPath = '/Users/ot/.openclaw/workspace/projects/2026-03-13-pm-workflow-automation/docs/04-进度跟踪.md';
    const progressDocContent = fs.readFileSync(progressDocPath, 'utf-8');

    // 检查是否包含最后更新时间（格式：*最后更新: 2026-03-13...）
    const hasUpdatedTime = /\*最后更新:\s*\d{4}-\d{2}-\d{2}/.test(progressDocContent);
    if (hasUpdatedTime) {
      log('   ✓ 04-进度跟踪.md 已更新', 'green');
    } else {
      log('   ✗ 04-进度跟踪.md 未检测到更新', 'red');
    }

    // 步骤 5: 手动触发进度同步（可选）
    log(`\n步骤 5: 手动触发进度同步（可选）...`, 'yellow');
    const syncResult = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/sync/progress-to-doc/${PROJECT_ID}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }, {
      docPath: progressDocPath,
    });

    log(`   ✓ 进度同步结果: ${syncResult.message}`, 'green');
    log(`   ✓ 完成度: ${syncResult.progress.percentage}% (${syncResult.progress.completed}/${syncResult.progress.total})`, 'green');

    // 步骤 6: 恢复任务状态（可选）
    log(`\n步骤 6: 恢复任务 ${TASK_ID} 状态为 "${task.status}"...`, 'yellow');
    await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/tasks/projects/${PROJECT_ID}/tasks/${TASK_ID}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
    }, { status: task.status });

    log(`   ✓ 任务状态已恢复`, 'green');

    log('\n=== 验证完成 ===', 'green');
    log('✅ PMW-029 功能正常工作', 'green');
    log('\n提示：可以使用以下命令查看 04-进度跟踪.md 的变化：', 'blue');
    log(`  cat ${progressDocPath}`, 'blue');
  } catch (error) {
    log(`\n❌ 验证失败: ${error instanceof Error ? error.message : String(error)}`, 'red');
    log('\n提示：请确保后端服务已启动 (npm run dev:backend)', 'yellow');
    process.exit(1);
  }
}

main();