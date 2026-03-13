/**
 * 测试 PMW-040: 修复前端"新增任务"表单填写了任务描述，但是 JSON 文件中 description 为 null
 */

import { MarkdownToJSON } from './src/sync/markdownToJSON.ts';
import * as fs from 'fs';

const testMarkdown = "# 测试任务\n\n## 阶段 1：测试阶段\n\n### PMW-001 `P0` 测试任务1\n\n- 状态: 待处理\n- 描述: 这是一个测试任务的描述\n- 领取者: (空)\n- 预计时间: 1小时\n- 依赖: (无)\n\n### PMW-002 `P1` 测试任务2：空描述\n\n- 状态: 待处理\n- 描述: 测试任务2\n- 领取者: (空)\n- 预计时间: 30分钟\n- 依赖: (无)\n\n## 临时/其他任务\n\n### PMW-003 `P2` 临时任务：带详细描述\n\n- 状态: 待处理\n- 描述: 这是一个很详细的描述，包含很多信息\n- 领取者: (空)\n- 预计时间: 2小时\n- 依赖: (无)\n";

async function test() {
  console.log('开始测试 PMW-040...\n');

  try {
    const parser = new MarkdownToJSON();
    const lines = testMarkdown.split('\n');

    // 测试1: 带 ### 格式的任务（从表单创建）
    const task1Line = lines.find(l => l.includes('PMW-001 `P0`')) || '';
    const task1 = parser['parseTask'](task1Line, lines, lines.indexOf(task1Line) + 1, '测试阶段');

    console.log('测试1: ### 格式任务（从表单创建）');
    console.log('  taskId:', task1.id);
    console.log('  title:', task1.title);
    console.log('  description:', task1.description);
    console.log('  priority:', task1.priority);
    console.log('  status:', task1.status);

    if (task1.description === '这是一个测试任务的描述') {
      console.log('  ✅ 描述正确\n');
    } else {
      console.log('  ❌ 描述错误！期望 "这是一个测试任务的描述"，实际:', task1.description, '\n');
    }

    // 测试2: 带 ### 格式的任务（空描述时使用 title）
    const task2Line = lines.find(l => l.includes('PMW-002 `P1`')) || '';
    const task2 = parser['parseTask'](task2Line, lines, lines.indexOf(task2Line) + 1, '测试阶段');

    console.log('测试2: ### 格式任务（空描述时使用 title）');
    console.log('  taskId:', task2.id);
    console.log('  title:', task2.title);
    console.log('  description:', task2.description);

    if (task2.description === '测试任务2') {
      console.log('  ✅ 描述正确\n');
    } else {
      console.log('  ❌ 描述错误！期望 "测试任务2"，实际:', task2.description, '\n');
    }

    // 测试3: 临时任务区块
    const task3Line = lines.find(l => l.includes('PMW-003 `P2`')) || '';
    const task3 = parser['parseTask'](task3Line, lines, lines.indexOf(task3Line) + 1, '临时/其他任务');

    console.log('测试3: 临时任务区块');
    console.log('  taskId:', task3.id);
    console.log('  title:', task3.title);
    console.log('  description:', task3.description);
    console.log('  priority:', task3.priority);

    if (task3.description === '这是一个很详细的描述，包含很多信息') {
      console.log('  ✅ 描述正确\n');
    } else {
      console.log('  ❌ 描述错误！期望 "这是一个很详细的描述，包含很多信息"，实际:', task3.description, '\n');
    }

    console.log('✅ 测试完成！');

  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

test();