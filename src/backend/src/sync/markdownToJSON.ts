import * as fs from 'fs';
import * as path from 'path';
import { Task, Project, Stage } from '../types/tasks';

export class MarkdownToJSON {
  async parse(projectId: string): Promise<{ project: Project; tasks: Task[] }> {
    const tasksMdPath = path.join(process.cwd(), '../../tasks', `${projectId}-TASKS.md`);

    try {
      const markdown = fs.readFileSync(tasksMdPath, 'utf-8');
      const lines = markdown.split('\n');

      let currentStage: Stage | null = null;
      const stages: Stage[] = [];
      let projectInfo: any = {};

      let i = 0;
      while (i < lines.length) {
        const line = lines[i];

        if (line.match(/^##+ 阶段 \d+.*$/)) {
          currentStage = {
            name: line.trim().replace(/^#+\s*/, '').trim(),
            week: '',
            tasks: []
          };
          stages.push(currentStage);
          i++;
          continue;
        }

        if (line.match(/^-\s+(?:\[x?\]|\*\*TASK-\d+\*\*)/)) {
          const task = this.parseTask(line, lines, i + 1, currentStage?.name || '');
          if (currentStage) {
            currentStage.tasks.push(task);
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
    let priority = 'P2' as 'P1' | 'P2' | 'P3';
    let labels: string[] = [];
    let status: 'todo' | 'in-progress' | 'done' = 'todo';
    let assignee: string | null = null;

    const format2Match = line.match(/^-\s+\*\*(TASK-\d+)\*\*\s+(.*)$/);
    
    if (format2Match) {
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
      dueDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: [],
    };
  }

  private parseStatusText(text: string): 'todo' | 'in-progress' | 'done' {
    if (text === '已完成' || text === 'done') return 'done';
    if (text === '进行中' || text === 'in-progress') return 'in-progress';
    return 'todo';
  }

  private extractStatus(meta: string): 'todo' | 'in-progress' | 'done' {
    const lowerMeta = meta.toLowerCase();
    if (lowerMeta.includes('done') || lowerMeta.includes('已完成')) return 'done';
    if (lowerMeta.includes('in-progress') || lowerMeta.includes('进行中')) return 'in-progress';
    return 'todo';
  }

  private extractPriority(meta: string): 'P1' | 'P2' | 'P3' {
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
      if (!seen.has(label) && label !== 'todo' && label !== 'done' && label !== 'in-progress') {
        seen.add(label);
        result.push(label);
      }
    }
    return result;
  }
}
