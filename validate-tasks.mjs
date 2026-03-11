#!/usr/bin/env node
/**
 * JSON 验证实用工具
 * 用于验证 tasks 目录中的所有 JSON 文件
 */

import { validateJSONFile, validateAllJSONFiles } from './src/backend/src/middleware/jsonValidator';
import * as path from 'path';
import * as fs from 'fs';

const tasksPath = path.join(process.cwd(), 'tasks');

console.log('='.repeat(60));
console.log('OpenClaw Visualization - JSON 文件验证工具');
console.log('='.repeat(60));

if (!fs.existsSync(tasksPath)) {
  console.log(`\n⚠️  Tasks 目录不存在: ${tasksPath}`);
  console.log('请先运行项目创建 tasks 目录。');
  process.exit(0);
}

console.log(`\n📂 验证目录: ${tasksPath}`);

const results = validateAllJSONFiles(tasksPath);

if (results.size === 0) {
  console.log('\n✅ 没有找到 JSON 文件。');
} else {
  let validCount = 0;
  let invalidCount = 0;

  results.forEach((result, filePath) => {
    const fileName = path.basename(filePath);
    if (result.valid) {
      console.log(`   ✅ ${fileName}`);
      validCount++;
    } else {
      console.log(`   ❌ ${fileName}`);
      console.log(`      错误: ${result.error}`);
      if (result.line !== undefined) {
        console.log(`      位置: 第 ${result.line} 行, 第 ${result.column} 列`);
      }
      if (result.context) {
        console.log(`      上下文: "${result.context}"`);
      }
      invalidCount++;
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`📊 总结: ${validCount} 个有效, ${invalidCount} 个无效`);
  console.log('='.repeat(60));

  if (invalidCount > 0) {
    console.log('\n⚠️  发现无效的 JSON 文件！');
    console.log('请修复上述错误后重试。');
    process.exit(1);
  } else {
    console.log('\n✅ 所有 JSON 文件都有效！');
  }
}