import * as fs from 'fs';
import * as path from 'path';

export interface JSONValidationError {
  valid: boolean;
  error?: string;
  line?: number;
  column?: number;
  context?: string;
}

/**
 * 验证 JSON 文件语法
 * @param filePath JSON 文件路径
 * @returns 验证结果
 */
export function validateJSONFile(filePath: string): JSONValidationError {
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
 * @param directory 目录路径
 * @returns 验证结果映射
 */
export function validateAllJSONFiles(directory: string): Map<string, JSONValidationError> {
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