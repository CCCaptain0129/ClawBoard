/**
 * TaskDoc Routes - 任务文档写入路由
 * 
 * 实现新增任务写入 03-任务分解.md 的功能
 * 
 * 核心功能：
 * 1. 接收任务数据，追加到项目的 03-任务分解.md
 * 2. 自动生成任务ID（taskPrefix + 自增编号）
 * 3. 触发 watcher → safeSync → 看板更新 → 04刷新
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { TaskService } from '../services/taskService';
import { SafeSyncService, ProjectDocConfig } from '../services/safeSyncService';
import { WebSocketHandler } from '../websocket/server';
import { ProgressOrchestrator } from '../services/progressOrchestrator';

// 任务创建请求体
interface CreateTaskRequest {
  id?: string;           // 可选，若不提供则自动生成
  title: string;         // 必填
  description?: string;  // 可选
  priority?: 'P0' | 'P1' | 'P2' | 'P3';  // 默认 P2
  stage?: string;        // 可选，阶段
  category?: 'main' | 'temp';  // 默认 temp，决定写入哪个区块
  dependencies?: string[];  // 可选，依赖任务
  estimatedTime?: string;   // 可选，预计时间
}

// 任务创建响应
interface CreateTaskResponse {
  success: boolean;
  taskId?: string;
  taskDocPath?: string;
  error?: string;
}

export function taskDocRoutes(
  taskService: TaskService,
  safeSyncService: SafeSyncService,
  wsServer: WebSocketHandler,
  progressOrchestrator: ProgressOrchestrator
): Router {
  const router = Router();

  /**
   * POST /api/task-doc/:projectId/tasks
   * 新增任务到 03-任务分解.md
   */
  router.post('/:projectId/tasks', async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const body: CreateTaskRequest = req.body;

    // 1. 参数验证
    if (!body.title || typeof body.title !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'title is required and must be a string',
      } as CreateTaskResponse);
    }

    // 2. 获取项目配置
    const config = safeSyncService.getProjectConfig(projectId);
    if (!config) {
      return res.status(404).json({
        success: false,
        error: `Project "${projectId}" is not configured for task-doc operations. Please add it to SafeSyncService config.`,
      } as CreateTaskResponse);
    }

    const taskDocPath = path.join(config.projectPath, config.taskDoc);

    // 3. 检查文档是否存在
    if (!fs.existsSync(taskDocPath)) {
      return res.status(404).json({
        success: false,
        error: `Task document not found: ${taskDocPath}`,
      } as CreateTaskResponse);
    }

    try {
      // 4. 读取现有文档
      let content = fs.readFileSync(taskDocPath, 'utf-8');

      // 5. 生成任务ID
      let taskId: string;
      if (body.id) {
        taskId = body.id;
      } else {
        // 自动生成：解析现有任务ID，找到最大编号+1
        taskId = await generateTaskId(projectId, config, content, taskService);
      }

      // 6. 确定优先级
      const priority = body.priority || 'P2';

      // 7. 构建任务 Markdown 块
      const taskMarkdown = buildTaskMarkdown({
        id: taskId,
        title: body.title,
        description: body.description,
        priority,
        stage: body.stage,
        dependencies: body.dependencies,
        estimatedTime: body.estimatedTime,
      });

      // 8. 确定写入位置（临时/其他任务 区块）
      const category = body.category || 'temp';
      const insertResult = insertTaskToSection(content, taskMarkdown, category);

      // 9. 写入文档
      fs.writeFileSync(taskDocPath, insertResult.content, 'utf-8');

      console.log(`✅ [TaskDoc] Task ${taskId} written to ${taskDocPath}`);

      // 10. 触发 safeSync（由 fileWatcher 自动触发，这里手动触发一次确保）
      // 注意：fileWatcherService 会自动监听文件变更并触发 safeSync
      // 但为了确保立即响应，我们手动触发一次
      const syncResult = await safeSyncService.safeSyncFromMarkdown(projectId);

      if (syncResult.success) {
        console.log(`✅ [TaskDoc] SafeSync triggered for ${projectId}: ${syncResult.tasks.length} tasks`);

        // 广播任务创建事件
        wsServer.broadcast({
          type: 'TASK_CREATED_VIA_DOC',
          projectId,
          taskId,
          taskDocPath,
          timestamp: new Date().toISOString(),
        });
      }

      // 11. 返回成功响应
      return res.json({
        success: true,
        taskId,
        taskDocPath,
      } as CreateTaskResponse);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ [TaskDoc] Failed to create task:`, errorMessage);
      return res.status(500).json({
        success: false,
        error: errorMessage,
      } as CreateTaskResponse);
    }
  });

  return router;
}

/**
 * 生成任务ID
 * 策略：taskPrefix + 自增编号（从现有任务最大编号+1）
 */
async function generateTaskId(
  projectId: string,
  config: ProjectDocConfig,
  content: string,
  taskService: TaskService
): Promise<string> {
  // 获取项目信息，拿到 taskPrefix
  const project = await taskService.getProjectById(projectId);
  const prefix = project?.taskPrefix || 'TASK';

  // 从文档内容解析现有任务ID
  const taskIds = parseExistingTaskIds(content, prefix);

  // 找到最大编号
  let maxNumber = 0;
  for (const id of taskIds) {
    const match = id.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  // 生成新编号
  const nextNumber = maxNumber + 1;
  return `${prefix}-${nextNumber.toString().padStart(3, '0')}`;
}

/**
 * 从文档内容解析现有任务ID
 */
function parseExistingTaskIds(content: string, prefix: string): string[] {
  const ids: string[] = [];
  // 使用更简单的正则匹配所有 PREFIX-XXX 格式
  const regex = new RegExp(`${prefix}-\\d{3}`, 'g');
  const matches = content.match(regex) || [];
  
  // 去重
  const uniqueIds = [...new Set(matches)];
  return uniqueIds;
}

/**
 * 构建任务 Markdown 块
 */
function buildTaskMarkdown(options: {
  id: string;
  title: string;
  description?: string;
  priority: string;
  stage?: string;
  dependencies?: string[];
  estimatedTime?: string;
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

/**
 * 将任务插入到指定区块
 */
function insertTaskToSection(
  content: string,
  taskMarkdown: string,
  category: 'main' | 'temp'
): { content: string; inserted: boolean } {
  // 临时任务区块标题
  const tempSectionTitle = '## 临时/其他任务';

  if (category === 'temp') {
    // 查找"临时/其他任务"区块
    const tempSectionIndex = content.indexOf(tempSectionTitle);

    if (tempSectionIndex !== -1) {
      // 区块存在，找到区块内最后一个任务
      const afterSection = content.substring(tempSectionIndex);
      const lines = afterSection.split('\n');

      // 找到合适的插入位置（区块末尾，下一个 ## 标题之前）
      let insertLineIndex = lines.length;
      for (let i = 1; i < lines.length; i++) {
        // 找到下一个 ## 标题
        if (lines[i].startsWith('## ') && i > 0) {
          insertLineIndex = i;
          break;
        }
      }

      // 在该位置插入新任务
      lines.splice(insertLineIndex, 0, '', taskMarkdown, '');

      // 重组内容
      const newAfterSection = lines.join('\n');
      const newContent = content.substring(0, tempSectionIndex) + newAfterSection;

      return { content: newContent, inserted: true };
    } else {
      // 区块不存在，创建一个
      const newSection = `\n\n${tempSectionTitle}\n\n${taskMarkdown}\n`;

      // 在文档末尾添加新区块
      const newContent = content.trimEnd() + newSection;

      return { content: newContent, inserted: true };
    }
  } else {
    // 主线任务：添加到文档末尾（或创建"主线任务"区块）
    // 这里暂时也添加到临时区块
    const tempSectionIndex = content.indexOf(tempSectionTitle);

    if (tempSectionIndex !== -1) {
      // 复用临时区块逻辑
      return insertTaskToSection(content, taskMarkdown, 'temp');
    } else {
      // 创建临时区块
      const newSection = `\n\n${tempSectionTitle}\n\n${taskMarkdown}\n`;
      const newContent = content.trimEnd() + newSection;
      return { content: newContent, inserted: true };
    }
  }
}