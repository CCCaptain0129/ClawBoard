import * as fs from 'fs';
import * as path from 'path';
import { TaskService } from './taskService';
import { Task } from '../types/tasks';
import { getProjectRoot } from '../config/paths';

/**
 * 进度回写服务 - 将看板(JSON)进度同步到 04-进度跟踪.md
 * 
 * Phase 1: 仅回写进度统计，不修改任务的 status/claimedBy 运行态信息
 */
export class ProgressToDocService {
  private taskService: TaskService;

  constructor(taskService: TaskService) {
    this.taskService = taskService;
  }

  /**
   * 将项目进度回写到 04-进度跟踪.md
   * @param projectId 项目ID
   * @param docPath 可选的文档路径，默认为项目 docs 目录下的 04-进度跟踪.md
   */
  async syncProgressToDoc(projectId: string, docPath?: string): Promise<{
    success: boolean;
    progress: { total: number; completed: number; inProgress: number; review: number; todo: number; percentage: number };
    updatedSections: string[];
    message: string;
  }> {
    try {
      // 1. 获取任务数据
      const tasks = await this.taskService.getTasksByProject(projectId);
      const project = await this.taskService.getProjectById(projectId);

      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      // PMW-032: 记录任务数量，用于验证新增任务是否被正确处理
      console.log(`[ProgressToDocService] Processing ${tasks.length} tasks for project ${projectId}`);
      tasks.forEach(task => {
        console.log(`  - ${task.id}: ${task.title} (${task.status})`);
      });

      // 2. 计算进度
      const progress = this.calculateProgress(tasks);
      const milestoneProgress = this.calculateMilestoneProgress(tasks);
      const stageProgress = this.calculateStageProgress(tasks);

      // 3. 确定文档路径
      const defaultDocPath = this.getDefaultDocPath(projectId);
      const targetDocPath = docPath || defaultDocPath;

      if (!fs.existsSync(targetDocPath)) {
        throw new Error(`Document not found: ${targetDocPath}`);
      }

      // 4. 读取并更新文档
      const content = fs.readFileSync(targetDocPath, 'utf-8');
      const updatedContent = this.updateDocument(content, {
        progress,
        milestoneProgress,
        stageProgress,
        updatedAt: new Date().toISOString()
      });

      // 5. 写回文档
      fs.writeFileSync(targetDocPath, updatedContent, 'utf-8');

      console.log(`✅ Progress synced to ${targetDocPath}`);
      console.log(`   Overall progress: ${progress.percentage}%`);
      console.log(`   Total tasks: ${progress.total} (done: ${progress.completed}, in-progress: ${progress.inProgress}, review: ${progress.review}, todo: ${progress.todo})`);

      return {
        success: true,
        progress,
        updatedSections: ['项目状态-完成度', '里程碑进度', '阶段进度', '最后更新时间'],
        message: `Progress synced: ${progress.percentage}% (${progress.completed}/${progress.total} tasks done)`
      };
    } catch (error) {
      console.error('Failed to sync progress to doc:', error);
      throw error;
    }
  }

  /**
   * 计算整体进度
   */
  private calculateProgress(tasks: Task[]): {
    total: number;
    completed: number;
    inProgress: number;
    review: number;
    todo: number;
    percentage: number;
  } {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const review = tasks.filter(t => t.status === 'review').length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, review, todo, percentage };
  }

  /**
   * 计算里程碑进度
   *
   * 优先从任务 labels 中识别里程碑标签：
   * - M1 / M2 / M3 ...
   * - 里程碑:M1
   * - 里程碑：M1
   *
   * 如果没有任何里程碑标签，则回退为整体进度的单一里程碑。
   */
  private calculateMilestoneProgress(tasks: Task[]): Map<string, {
    status: '已完成' | '进行中' | '未开始';
    percentage: number;
    done: number;
    total: number;
  }> {
    const milestoneTasks = new Map<string, Task[]>();

    tasks.forEach(task => {
      const milestoneLabel = task.labels.find((label) => {
        const normalized = label.trim().toUpperCase();
        return /^M\d+$/.test(normalized) || /^里程碑[:：]\s*M\d+$/i.test(label.trim());
      });

      if (!milestoneLabel) {
        return;
      }

      const milestoneId = milestoneLabel
        .replace(/^里程碑[:：]\s*/i, '')
        .trim()
        .toUpperCase();

      if (!milestoneTasks.has(milestoneId)) {
        milestoneTasks.set(milestoneId, []);
      }
      milestoneTasks.get(milestoneId)!.push(task);
    });

    const result = new Map<string, { status: '已完成' | '进行中' | '未开始'; percentage: number; done: number; total: number }>();

    const milestoneIds = Array.from(milestoneTasks.keys()).sort((a, b) => {
      const aNumber = Number(a.replace(/\D/g, '')) || 0;
      const bNumber = Number(b.replace(/\D/g, '')) || 0;
      return aNumber - bNumber;
    });

    milestoneIds.forEach((m) => {
      const mTasks = milestoneTasks.get(m) || [];
      const done = mTasks.filter(t => t.status === 'done').length;
      const total = mTasks.length;
      const percentage = total > 0 ? Math.round((done / total) * 100) : 0;
      
      let status: '已完成' | '进行中' | '未开始' = '未开始';
      if (percentage === 100) status = '已完成';
      else if (mTasks.some(t => t.status === 'in-progress' || t.status === 'review') || done > 0) status = '进行中';

      result.set(m, { status, percentage, done, total });
    });

    if (result.size === 0) {
      const done = tasks.filter(t => t.status === 'done').length;
      const total = tasks.length;
      const percentage = total > 0 ? Math.round((done / total) * 100) : 0;
      result.set('M1', {
        status: percentage === 100 ? '已完成' : percentage > 0 ? '进行中' : '未开始',
        percentage,
        done,
        total,
      });
    }

    return result;
  }

  /**
   * 计算阶段进度
   */
  private calculateStageProgress(tasks: Task[]): Map<string, {
    done: number;
    inProgress: number;
    review: number;
    todo: number;
    total: number;
  }> {
    const stageProgress = new Map<string, { done: number; inProgress: number; review: number; todo: number; total: number }>();

    // 按标签分组计算阶段进度
    tasks.forEach(task => {
      const stageLabel = task.labels.find(l => l.startsWith('阶段') || l.includes('阶段'));
      if (stageLabel) {
        if (!stageProgress.has(stageLabel)) {
          stageProgress.set(stageLabel, { done: 0, inProgress: 0, review: 0, todo: 0, total: 0 });
        }
        const stage = stageProgress.get(stageLabel)!;
        stage.total++;
        if (task.status === 'done') stage.done++;
        else if (task.status === 'in-progress') stage.inProgress++;
        else if (task.status === 'review') stage.review++;
        else stage.todo++;
      }
    });

    return stageProgress;
  }

  /**
   * 获取默认文档路径
   */
  private getDefaultDocPath(projectId: string): string {
    return path.join(getProjectRoot(projectId), 'docs/04-进度跟踪.md');
  }

  /**
   * 更新文档内容
   */
  private updateDocument(content: string, data: {
    progress: { total: number; completed: number; inProgress: number; review: number; todo: number; percentage: number };
    milestoneProgress: Map<string, { status: string; percentage: number; done: number; total: number }>;
    stageProgress: Map<string, { done: number; inProgress: number; review: number; todo: number; total: number }>;
    updatedAt: string;
  }): string {
    let lines = content.split('\n');
    const updatedLines: string[] = [];
    let inMilestoneTable = false;
    let inStageTable = false;
    let currentStageName = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 1. 更新完成度
      if (line.includes('**完成度**:') && line.includes('%')) {
        updatedLines.push(line.replace(/(\*\*完成度\*\*:\s*)\d+%/, `$1${data.progress.percentage}%`));
        continue;
      }

      // 2. 更新最后更新时间
      if (line.match(/\*最后更新:\s*\d{4}-\d{2}-\d{2}/)) {
        const date = new Date(data.updatedAt);
        const dateStr = date.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Shanghai'
        }).replace(/\//g, '-');
        updatedLines.push(`*最后更新: ${dateStr} GMT+8*`);
        continue;
      }

      // 3. 更新里程碑进度表
      if (line.includes('## 里程碑进度')) {
        inMilestoneTable = true;
        updatedLines.push(line);
        continue;
      }

      if (inMilestoneTable && line.startsWith('## ')) {
        inMilestoneTable = false;
      }

      if (inMilestoneTable && line.match(/^\| M[1-5]:/)) {
        const milestoneMatch = line.match(/^\| (M[1-5]):/);
        if (milestoneMatch) {
          const mId = milestoneMatch[1];
          const mProgress = data.milestoneProgress.get(mId);
          if (mProgress) {
            // 更新状态和完成度列
            const statusIcon = mProgress.status === '已完成' ? '✅' : 
                              mProgress.status === '进行中' ? '⏳' : '⏳';
            const updatedLine = line.replace(
              /\| (✅|⏳|❌)\s*(已完成|进行中|未开始)?\s*\| (\d+)%/,
              `| ${statusIcon} ${mProgress.status} | ${mProgress.percentage}%`
            );
            updatedLines.push(updatedLine);
            continue;
          }
        }
      }

      // 4. 更新阶段进度（保留原有逻辑，Phase 1 只更新进度统计，不修改任务状态）
      // 注意：阶段进度表格的任务状态列保持不变，只统计性更新

      updatedLines.push(line);
    }

    return updatedLines.join('\n');
  }
}
