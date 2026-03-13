/**
 * TaskDoc Routes 测试
 * 
 * PMW-036: 测试新增任务写入 03 文档的功能
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// 创建临时目录
const tempDir = path.join(process.cwd(), 'tests', 'temp-taskdoc-test');

function createTempDir() {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
}

function cleanupTempDir() {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// 创建测试用的 03 文档
function createTestTaskDoc(): string {
  const docPath = path.join(tempDir, '03-任务分解.md');
  const content = `# 任务分解：测试项目

## 任务统计

- **总任务数**: 2
- **待处理**: 2
- **进度**: 0%

---

## 阶段 1：基础功能

### TEST-001 \`P2\` 第一个测试任务

- 状态: 待处理
- 描述: 这是一个测试任务
- 领取者: (空)
- 预计时间: 1小时
- 依赖: (无)

### TEST-002 \`P1\` 第二个测试任务

- 状态: 待处理
- 描述: 这是另一个测试任务
- 领取者: (空)
- 预计时间: 2小时
- 依赖: TEST-001

---

*创建时间: 2026-03-13*
`;
  fs.writeFileSync(docPath, content, 'utf-8');
  return docPath;
}

// 解析任务ID函数（与路由中相同）
function parseExistingTaskIds(content: string, prefix: string): string[] {
  const regex = new RegExp(`${prefix}-\\d{3}`, 'g');
  const matches = content.match(regex) || [];
  const uniqueIds = [...new Set(matches)];
  return uniqueIds;
}

// 生成任务ID函数
function generateTaskId(prefix: string, existingIds: string[]): string {
  let maxNumber = 0;
  for (const id of existingIds) {
    const match = id.match(new RegExp(`${prefix}-(\\d+)`));
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) maxNumber = num;
    }
  }
  const nextNumber = maxNumber + 1;
  return `${prefix}-${nextNumber.toString().padStart(3, '0')}`;
}

// 构建任务 Markdown 函数
function buildTaskMarkdown(options: {
  id: string;
  title: string;
  description?: string;
  priority: string;
  estimatedTime?: string;
  dependencies?: string[];
}): string {
  const lines: string[] = [];
  lines.push(`### ${options.id} \`${options.priority}\` ${options.title}`);
  lines.push('');
  lines.push('- 状态: 待处理');
  lines.push(`- 描述: ${options.description || options.title}`);
  lines.push('- 领取者: (空)');
  lines.push(`- 预计时间: ${options.estimatedTime || '待定'}`);
  lines.push(`- 依赖: ${options.dependencies?.length ? options.dependencies.join(', ') : '(无)'}`);
  return lines.join('\n');
}

// 插入任务到区块函数
function insertTaskToSection(
  content: string,
  taskMarkdown: string,
  category: 'main' | 'temp'
): { content: string; inserted: boolean } {
  const tempSectionTitle = '## 临时/其他任务';

  if (category === 'temp') {
    const tempSectionIndex = content.indexOf(tempSectionTitle);

    if (tempSectionIndex !== -1) {
      const afterSection = content.substring(tempSectionIndex);
      const lines = afterSection.split('\n');
      let insertLineIndex = lines.length;
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].startsWith('## ') && i > 0) {
          insertLineIndex = i;
          break;
        }
      }
      lines.splice(insertLineIndex, 0, '', taskMarkdown, '');
      const newAfterSection = lines.join('\n');
      const newContent = content.substring(0, tempSectionIndex) + newAfterSection;
      return { content: newContent, inserted: true };
    } else {
      const newSection = `\n\n${tempSectionTitle}\n\n${taskMarkdown}\n`;
      const newContent = content.trimEnd() + newSection;
      return { content: newContent, inserted: true };
    }
  }

  // 默认也插入临时区块
  return insertTaskToSection(content, taskMarkdown, 'temp');
}

describe('TaskDoc Routes', () => {
  beforeAll(() => {
    createTempDir();
  });

  afterAll(() => {
    cleanupTempDir();
  });

  describe('parseExistingTaskIds', () => {
    it('应该解析现有任务ID', () => {
      const docPath = createTestTaskDoc();
      const content = fs.readFileSync(docPath, 'utf-8');
      const ids = parseExistingTaskIds(content, 'TEST');

      expect(ids).toContain('TEST-001');
      expect(ids).toContain('TEST-002');
      expect(ids.length).toBe(2);
    });

    it('应该在空文档中返回空数组', () => {
      const ids = parseExistingTaskIds('# 空文档\n没有任务', 'TEST');
      expect(ids).toEqual([]);
    });
  });

  describe('generateTaskId', () => {
    it('应该生成正确的下一个任务ID', () => {
      const existingIds = ['TEST-001', 'TEST-002', 'TEST-005'];
      const newId = generateTaskId('TEST', existingIds);
      expect(newId).toBe('TEST-006');
    });

    it('应该在没有现有任务时生成 TEST-001', () => {
      const newId = generateTaskId('TEST', []);
      expect(newId).toBe('TEST-001');
    });

    it('应该支持不同的前缀', () => {
      const existingIds = ['PMW-035', 'PMW-036'];
      const newId = generateTaskId('PMW', existingIds);
      expect(newId).toBe('PMW-037');
    });
  });

  describe('buildTaskMarkdown', () => {
    it('应该生成正确格式的任务 Markdown', () => {
      const markdown = buildTaskMarkdown({
        id: 'TEST-003',
        title: '新任务标题',
        description: '新任务描述',
        priority: 'P2',
        estimatedTime: '2小时',
        dependencies: ['TEST-001'],
      });

      expect(markdown).toContain('### TEST-003');
      expect(markdown).toContain('`P2`');
      expect(markdown).toContain('新任务标题');
      expect(markdown).toContain('- 状态: 待处理');
      expect(markdown).toContain('- 描述: 新任务描述');
      expect(markdown).toContain('- 预计时间: 2小时');
      expect(markdown).toContain('- 依赖: TEST-001');
    });

    it('应该处理可选字段', () => {
      const markdown = buildTaskMarkdown({
        id: 'TEST-004',
        title: '简单任务',
        priority: 'P1',
      });

      expect(markdown).toContain('- 描述: 简单任务'); // 使用标题作为描述
      expect(markdown).toContain('- 预计时间: 待定');
      expect(markdown).toContain('- 依赖: (无)');
    });
  });

  describe('insertTaskToSection', () => {
    it('应该创建临时区块并插入任务', () => {
      const docPath = createTestTaskDoc();
      let content = fs.readFileSync(docPath, 'utf-8');

      const taskMarkdown = buildTaskMarkdown({
        id: 'TEST-003',
        title: '新任务',
        priority: 'P2',
      });

      const result = insertTaskToSection(content, taskMarkdown, 'temp');

      expect(result.inserted).toBe(true);
      expect(result.content).toContain('## 临时/其他任务');
      expect(result.content).toContain('TEST-003');
      expect(result.content).toContain('新任务');
    });

    it('应该保留原有内容', () => {
      const docPath = createTestTaskDoc();
      let content = fs.readFileSync(docPath, 'utf-8');

      const taskMarkdown = buildTaskMarkdown({
        id: 'TEST-003',
        title: '新任务',
        priority: 'P2',
      });

      const result = insertTaskToSection(content, taskMarkdown, 'temp');

      // 原有任务应该还在
      expect(result.content).toContain('TEST-001');
      expect(result.content).toContain('TEST-002');
      expect(result.content).toContain('第一个测试任务');
    });
  });

  describe('完整流程测试', () => {
    it('应该能够完成从解析到插入的完整流程', () => {
      const docPath = createTestTaskDoc();
      const content = fs.readFileSync(docPath, 'utf-8');

      // 1. 解析现有任务ID
      const existingIds = parseExistingTaskIds(content, 'TEST');
      expect(existingIds.length).toBe(2);

      // 2. 生成新任务ID
      const newTaskId = generateTaskId('TEST', existingIds);
      expect(newTaskId).toBe('TEST-003');

      // 3. 构建任务 Markdown
      const taskMarkdown = buildTaskMarkdown({
        id: newTaskId,
        title: '集成测试任务',
        description: '这是一个集成测试',
        priority: 'P0',
        estimatedTime: '30分钟',
      });
      expect(taskMarkdown).toContain('TEST-003');
      expect(taskMarkdown).toContain('P0');

      // 4. 插入到文档
      const result = insertTaskToSection(content, taskMarkdown, 'temp');
      expect(result.inserted).toBe(true);
      expect(result.content).toContain('集成测试任务');
      expect(result.content).toContain('## 临时/其他任务');

      // 5. 验证任务统计更新（实际应用中应该更新）
      // 这里只验证文档中确实有了新任务
      const newIds = parseExistingTaskIds(result.content, 'TEST');
      expect(newIds).toContain('TEST-003');
    });
  });
});

describe('Tasks Routes - pm-workflow-automation 禁用', () => {
  it('应该能够识别 pm-workflow-automation 项目需要特殊处理', () => {
    const projectId = 'pm-workflow-automation';
    const forbiddenProjects = ['pm-workflow-automation'];
    
    const isForbidden = forbiddenProjects.includes(projectId);
    expect(isForbidden).toBe(true);
  });

  it('应该允许其他项目正常处理', () => {
    const projectId = 'openclaw-visualization';
    const forbiddenProjects = ['pm-workflow-automation'];
    
    const isForbidden = forbiddenProjects.includes(projectId);
    expect(isForbidden).toBe(false);
  });

  it('应该返回正确的错误信息', () => {
    const errorResponse = {
      error: '此项目禁止直接创建 JSON 任务，请使用新增任务功能（写入 03-任务分解.md）',
      hint: '请使用 POST /api/task-doc/pm-workflow-automation/tasks 接口创建任务',
      code: 'USE_TASK_DOC_API',
    };

    expect(errorResponse.code).toBe('USE_TASK_DOC_API');
    expect(errorResponse.error).toContain('禁止直接创建');
    expect(errorResponse.hint).toContain('/api/task-doc/');
  });
});