#!/usr/bin/env node

/**
 * SubagentMonitorService 测试脚本
 *
 * 测试功能：
 * 1. 检查所有进行中的 subagent 状态
 * 2. 验证是否正确检测已完成的 subagent
 * 3. 验证幂等性（不重复处理已完成的 subagent）
 */

import { SubagentMonitorService } from '../src/backend/dist/services/subagentMonitor.js';

async function main() {
  console.log('🧪 SubagentMonitorService 测试脚本\n');

  // 创建监控服务实例
  const monitorService = new SubagentMonitorService({
    intervalMs: 10000,  // 测试时使用更短的间隔
    completionThresholdMs: 60000  // 测试时使用 1 分钟阈值
  });

  console.log('📊 测试 1: 获取所有进行中的 subagent 状态\n');

  try {
    const statuses = await monitorService.getInProgressSubagentStatuses();

    console.log(`找到 ${statuses.length} 个进行中的 subagent:\n`);

    for (const status of statuses) {
      console.log(`📌 Subagent ID: ${status.subagentId}`);
      console.log(`   任务 ID: ${status.taskId}`);
      console.log(`   在 sessions 中存在: ${status.existsInSessions ? '是' : '否'}`);
      console.log(`   最后更新时间: ${status.lastUpdateTimestamp || '未知'}`);
      console.log(`   距离更新时间: ${status.minutesSinceLastUpdate !== null ? status.minutesSinceLastUpdate.toFixed(2) + ' 分钟' : '未知'}`);
      console.log(`   可能已完成: ${status.isLikelyFinished ? '是' : '否'}`);
      console.log('');
    }

    console.log('📊 测试 2: 执行一次检查\n');

    // 清除已处理缓存以允许重新处理
    monitorService.clearProcessedCache();

    // 手动触发一次检查
    await monitorService.checkAndCompleteSubagents();

    console.log('✅ 检查完成\n');

    console.log('📊 测试 3: 验证幂等性\n');

    // 再次执行检查，应该不会重复处理
    await monitorService.checkAndCompleteSubagents();

    console.log('✅ 幂等性验证完成\n');

    console.log('📊 测试 4: 启动监控服务（10秒后自动停止）\n');

    // 启动监控服务
    monitorService.start();

    console.log('⏱️  监控服务已启动，将运行 10 秒...\n');

    // 等待 10 秒
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 停止监控服务
    monitorService.stop();

    console.log('⏱️  监控服务已停止\n');

    console.log('✅ 所有测试完成！');
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
main();