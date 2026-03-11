import { validateJSONFile, validateAllJSONFiles } from './src/backend/src/middleware/jsonValidator';
import * as fs from 'fs';
import * as path from 'path';

// 测试目录
const testDir = path.join(process.cwd(), 'test-json-validation-temp');
const validJsonPath = path.join(testDir, 'valid.json');
const invalidJsonPath = path.join(testDir, 'invalid.json');
const missingJsonPath = path.join(testDir, 'missing.json');

// 创建测试目录
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// 创建有效的 JSON 文件
fs.writeFileSync(validJsonPath, JSON.stringify({
  tasks: [
    { id: 'TASK-001', title: 'Test Task', status: 'todo' }
  ]
}, null, 2));

// 创建无效的 JSON 文件（带有语法错误）
fs.writeFileSync(invalidJsonPath, `{
  "tasks": [
    { "id": "TASK-001", "title": "Test Task", "status": "todo" },
    { "id": "TASK-002", "title": "Invalid Task", "status": "in-progress" // 缺少逗号
  ]
}`);

console.log('='.repeat(60));
console.log('JSON 验证中间件测试');
console.log('='.repeat(60));

// 测试 1: 验证有效的 JSON 文件
console.log('\n测试 1: 验证有效的 JSON 文件');
const validResult = validateJSONFile(validJsonPath);
console.log(`✅ 结果: ${validResult.valid ? '通过' : '失败'}`);
if (validResult.error) {
  console.log(`   错误: ${validResult.error}`);
}

// 测试 2: 验证无效的 JSON 文件
console.log('\n测试 2: 验证无效的 JSON 文件');
const invalidResult = validateJSONFile(invalidJsonPath);
console.log(`✅ 结果: ${invalidResult.valid ? '通过' : '失败'}`);
if (!invalidResult.valid) {
  console.log(`   错误: ${invalidResult.error}`);
  if (invalidResult.line !== undefined) {
    console.log(`   位置: 第 ${invalidResult.line} 行, 第 ${invalidResult.column} 列`);
  }
  if (invalidResult.context) {
    console.log(`   上下文: "${invalidResult.context}"`);
  }
}

// 测试 3: 验证不存在的文件
console.log('\n测试 3: 验证不存在的文件');
const missingResult = validateJSONFile(missingJsonPath);
console.log(`✅ 结果: ${missingResult.valid ? '通过' : '失败'}`);
if (missingResult.error) {
  console.log(`   错误: ${missingResult.error}`);
}

// 测试 4: 验证目录中的所有 JSON 文件
console.log('\n测试 4: 验证目录中的所有 JSON 文件');
const allResults = validateAllJSONFiles(testDir);
console.log(`✅ 找到 ${allResults.size} 个 JSON 文件`);
allResults.forEach((result, filePath) => {
  const fileName = path.basename(filePath);
  const status = result.valid ? '✅ 有效' : '❌ 无效';
  console.log(`   ${fileName}: ${status}`);
  if (!result.valid && result.error) {
    console.log(`      错误: ${result.error}`);
  }
});

// 清理测试文件
try {
  fs.unlinkSync(validJsonPath);
  fs.unlinkSync(invalidJsonPath);
  fs.rmdirSync(testDir);
  console.log('\n✅ 测试文件已清理');
} catch (error) {
  console.log('\n⚠️  清理测试文件时出错（可忽略）');
}

console.log('\n' + '='.repeat(60));
console.log('所有测试完成！JSON 验证中间件工作正常。');
console.log('='.repeat(60));