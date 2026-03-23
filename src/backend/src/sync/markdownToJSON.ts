import * as fs from 'fs';
import * as path from 'path';
import { Task, Project, Stage } from '../types/tasks';
import { getTasksRoot } from '../config/paths';

export class MarkdownToJSON {
  async parse(projectId: string): Promise<{ project: Project; tasks: Task[] }> {
    const tasksMdPath = path.join(getTasksRoot(), `${projectId}-TASKS.md`);

    try {
      const markdown = fs.readFileSync(tasksMdPath, 'utf-8');
      const lines = markdown.split('\n');

      let currentStage: Stage | null = null;
      const stages: Stage[] = [];
      let projectInfo: any = {};

      let i = 0;
      while (i < lines.length) {
        const line = lines[i];

        // 匹配阶段标题 (## 阶段 X)
        if (line.match(/^##\s+阶段\s+\d+.*$/)) {
          currentStage = {
            name: line.trim().replace(/^#+\s*/, '').trim(),
            week: '',
            tasks: []
          };
          stages.push(currentStage);
          i++;
          continue;
        }
        
        // 匹配临时/其他任务区块 (## 临时/其他任务)
        if (line.match(/^##\s+临时\/其他任务/)) {
          currentStage = {
            name: '临时/其他任务',
            week: '',
            tasks: []
          };
          stages.push(currentStage);
          i++;
          continue;
        }

        // 匹配任务行 (- **PMW-XXX** 或 ### PMW-XXX)
        if (line.match(/^###\s+[A-Z]+-\d+/) || line.match(/^-\s+\*\*[A-Z]+-\d+\*\*/)) {
          const task = this.parseTask(line, lines, i + 1, currentStage?.name || '');
          if (currentStage) {
            currentStage.tasks.push(task);
          } else {
            // 如果没有当前阶段，创建一个临时阶段
            const tempStage: Stage = {
              name: '未分类',
              week: '',
              tasks: [task]
            };
            stages.push(tempStage);
            currentStage = tempStage;
          }
          i += 2;
        } else {
          i++;
        }
      }

      const allTasks = stages.flatMap(stage => stage.tasks);

      const project: Project = {
        id: projectId,
        name: projectInfo.name || projectId,
        description: projectInfo.description || '',
        status: projectInfo.status || 'active',
        leadAgent: projectInfo.leadAgent || null,
        color: projectInfo.color || '#3B82F6',
        icon: projectInfo.icon || '📊',
        taskPrefix: projectInfo.taskPrefix || 'TASK',
        createdAt: projectInfo.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return { project, tasks: allTasks };
    } catch (error) {
      console.error('Error parsing markdown:', error);
      throw error;
    }
  }

  private parseTask(line: string, lines: string[], startIndex: number, stageName: string): Task {
    let taskId = '';
    let taskTitle = '';
    let taskDescription = '';
    let priority = 'P2' as 'P0' | 'P1' | 'P2' | 'P3';
    let labels: string[] = [];
    let status: 'todo' | 'in-progress' | 'review' | 'done' = 'todo';
    let assignee: string | null = null;

    // 格式1: - **PMW-001** `P0` meta
    const format2Match = line.match(/^-\s+\*\*([A-Z]+-\d+)\*\*\s+(.*)$/);
    
    // 格式2: ### PMW-001 `P0` Title
    const format3Match = line.match(/^###\s+([A-Z]+-\d+)\s+`([P\d]+)`\s+(.*)$/);
    
    if (format3Match) {
      // 解析格式2 (### 标题格式)
      taskId = format3Match[1];
      priority = format3Match[2] as 'P0' | 'P1' | 'P2' | 'P3';
      taskTitle = format3Match[3].trim();
      taskDescription = taskTitle; // 初始时 title 和 description 相同
      
      // 解析后续行
      let i = startIndex;
      while (i < lines.length && i < startIndex + 10) {
        const nextLine = lines[i].trim();
        if (!nextLine || nextLine.startsWith('##') || nextLine.startsWith('#') || 
            (nextLine.startsWith('-') && !nextLine.match(/^-\s*(状态|描述|领取者|负责人|预计时间|依赖)/))) {
          break;
        }
        
        if (nextLine.match(/^-\s*状态:/)) {
          const statusText = nextLine.replace(/^-\s*状态:\s*/, '').trim();
          status = this.parseStatusText(statusText);
        } else if (nextLine.match(/^-\s*描述:/)) {
          taskDescription = nextLine.replace(/^-\s*描述:\s*/, '').trim();
        } else if (nextLine.match(/^-\s*(负责人|领取者):/)) {
          const assigneeText = nextLine.replace(/^-\s*(负责人|领取者):\s*/, '').trim();
          if (!assigneeText.match(/^[a-f0-9-]{36}$/i)) {
            assignee = assigneeText.startsWith('@') ? assigneeText : assigneeText || null;
          }
        }
        // 预计时间和依赖字段暂时不需要解析
        
        i++;
      }
      
      // 确保有 title
      if (!taskTitle) {
        taskTitle = taskDescription || taskId;
      }
      
    } else if (format2Match) {
      // 解析格式1 (- **PMW-001** 格式)
      taskId = format2Match[1];
      const meta = format2Match[2] || '';
      
      priority = this.extractPriority(meta);
      labels = this.extractLabels(meta);
      status = this.extractStatus(meta);
      
      let i = startIndex;
      while (i < lines.length && i < startIndex + 5) {
        const nextLine = lines[i].trim();
        if (!nextLine || nextLine.startsWith('##') || nextLine.startsWith('#') || 
            (nextLine.startsWith('-') && !nextLine.match(/^-\s*(状态|描述|领取者|负责人|截止)/))) {
          break;
        }
        
        if (nextLine.match(/^-\s*状态:/)) {
          const statusText = nextLine.replace(/^-\s*状态:\s*/, '').trim();
          status = this.parseStatusText(statusText);
        } else if (nextLine.match(/^-\s*描述:/)) {
          taskDescription = nextLine.replace(/^-\s*描述:\s*/, '').trim();
          taskTitle = taskDescription;
        } else if (nextLine.match(/^-\s*(负责人|领取者):/)) {
          const assigneeText = nextLine.replace(/^-\s*(负责人|领取者):\s*/, '').trim();
          if (!assigneeText.match(/^[a-f0-9-]{36}$/i)) {
            assignee = assigneeText.startsWith('@') ? assigneeText : assigneeText || null;
          }
        }
        
        i++;
      }
    }

    if (stageName && !labels.includes(stageName)) {
      labels.unshift(stageName);
    }

    return {
      id: taskId || '',
      title: taskTitle || taskId || '未命名任务',
      description: taskDescription,
      status,
      priority,
      labels: this.deduplicateLabels(labels),
      assignee,
      claimedBy: null,
      dependencies: [],
      contextSummary: '',
      acceptanceCriteria: [],
      deliverables: [],
      executionMode: 'auto',
      agentType: 'general',
      blockingReason: null,
      dueDate: null,
      estimatedTime: null,
      startTime: null,
      completeTime: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: [],
    };
  }

  private parseStatusText(text: string): 'todo' | 'in-progress' | 'review' | 'done' {
    if (text === '已完成' || text === 'done') return 'done';
    if (text === '待审核' || text === 'review') return 'review';
    if (text === '进行中' || text === 'in-progress') return 'in-progress';
    return 'todo';
  }

  private extractStatus(meta: string): 'todo' | 'in-progress' | 'review' | 'done' {
    const lowerMeta = meta.toLowerCase();
    if (lowerMeta.includes('done') || lowerMeta.includes('已完成')) return 'done';
    if (lowerMeta.includes('review') || lowerMeta.includes('待审核')) return 'review';
    if (lowerMeta.includes('in-progress') || lowerMeta.includes('进行中')) return 'in-progress';
    return 'todo';
  }

  private extractPriority(meta: string): 'P0' | 'P1' | 'P2' | 'P3' {
    if (meta.includes('P0')) return 'P0';
    if (meta.includes('P1')) return 'P1';
    if (meta.includes('P3')) return 'P3';
    return 'P2';
  }

  private extractLabels(meta: string): string[] {
    const labels: string[] = [];
    const matches = meta.match(/`([^`]+)`/g);
    if (matches) {
      matches.forEach(match => {
        const label = match.replace(/`/g, '').trim();
        if (label && !label.match(/^P\d+$/)) {
          labels.push(label);
        }
      });
    }
    return labels;
  }

  private deduplicateLabels(labels: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const label of labels) {
      if (!seen.has(label) && label !== 'todo' && label !== 'done' && label !== 'in-progress' && label !== 'review') {
        seen.add(label);
        result.push(label);
      }
    }
    return result;
  }
}
