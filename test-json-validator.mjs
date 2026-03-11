import * as fs from 'fs';
import * as path from 'path';

// 从 jsonValidator.ts 复制的验证逻辑
export interface JSONValidationError {
  valid: boolean;
  error?: string;
  line?: number;
  column?: number;
  context?: string;
}

/**
 * 验证 JSON 文件语法
 */
function validateJSONFile(filePath: string): JSONValidationError {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        valid: false,
        error: `File not found: ${filePath}`
      };
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    try {
      JSON.parse(content);
      return { valid: true };
    } catch (error) {
      if (error instanceof SyntaxError) {
        // 尝试提取错误位置
        const match = error.message.match(/position (\d+)/);
        const position = match ? parseInt(match[1], 10) : 0;

        const { line, column } = getLineAndColumn(content, position);
        const context = getContext(content, position);

        return {
          valid: false,
          error: error.message,
          line,
          column,
          context
        };
      }

      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 计算错误位置的行号和列号
 */
function getLineAndColumn(content: string, position: number): { line: number; column: number } {
  const lines = content.substring(0, position).split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

/**
 * 获取错误位置的上下文
 */
function getContext(content: string, position: number, contextSize: number = 50): string {
  const start = Math.max(0, position - contextSize);
  const end = Math.min(content.length, position + contextSize);
  return content.substring(start, end);
}

/**
 * 验证目录中的所有 JSON 文件
 */
function validateAllJSONFiles(directory: string): Map<string, JSONValidationError> {
  const results = new Map<string, JSONValidationError>();

  const files = fs.readdirSync(directory);

  for (const file of files) {
    if (file.endsWith('.json')) {
      const filePath = path.join(directory, file);
      const result = validateJSONFile(filePath);
      results.set(filePath, result);
    }
  }

  return results;
}

// 测试逻辑
console.log('=== JSON 验证中间件测试 ===\n');

// 测试有效的 JSON
console.log('1. 测试有效的 JSON 文件');
const validResult = validateJSONFile('tasks/openclaw-visualization-tasks.json');
console.log(`   结果: ${validResult.valid === true ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   详情: ${JSON.stringify(validResult, null, 2)}\n`);

// 测试无效的 JSON
console.log('2. 测试无效的 JSON 文件');
const invalidResult = validateJSONFile('tasks/test-project-tasks.json');
console.log(`   结果: ${!invalidResult.valid ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   Error info: ${invalidResult.error}`);
if (invalidResult.line !== undefined) {
  console.log(`   Location: Line ${invalidResult.line}, Column ${invalidResult.column}`);
}
if (invalidResult.context) {
  console.log(`   Context: "${invalidResult.context}"`);
}
console.log('');

// 测试批量验证
console.log('3. 测试批量验证');
const results = validateAllJSONFiles('tasks/');
console.log(`   结果: ${results.size > 0 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`   验证了 ${results.size} 个 JSON 文件\n`);

// 显示批量验证详情
console.log('4. 批量验证详情:');
let validCount = 0;
let invalidCount = 0;
results.forEach((result, filePath) => {
  const fileName = filePath.split('/').pop();
  if (result.valid) {
    console.log(`   ✅ ${fileName} - 有效`);
    validCount++;
  } else {
    console.log(`   ❌ ${fileName} - ${result.error}`);
    invalidCount++;
  }
});
console.log(`\n   总计: ${validCount} 个有效, ${invalidCount} 个无效`);
console.log('\n=== 测试完成 ===');