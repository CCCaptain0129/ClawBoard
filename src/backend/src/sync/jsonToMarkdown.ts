import { Task, Project } from '../types/tasks';

export class JSONToMarkdown {
  generate(project: Project, tasks: Task[]): string {
    const lines: string[] = [];
    
    // 标题部分
    lines.push(`# ${project.name}`);
    lines.push('');
    lines.push(`> ${project.description}`);
    lines.push('');
    
    // 统计信息
    const todoCount = tasks.filter(t => t.status === 'todo').length;
    const inProgressCount = tasks.filter(t => t.status === 'in-progress').length;
    const reviewCount = tasks.filter(t => t.status === 'review').length;
    const doneCount = tasks.filter(t => t.status === 'done').length;
    const totalTasks = tasks.length;
    const progress = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;
    
    lines.push('## 统计');
    lines.push('');
    lines.push(`- **任务总数**: ${totalTasks}`);
    lines.push(`- **待处理**: ${todoCount}`);
    lines.push(`- **进行中**: ${inProgressCount}`);
    lines.push(`- **待审核**: ${reviewCount}`);
    lines.push(`- **已完成**: ${doneCount}`);
    lines.push(`- **进度**: ${progress}% (${doneCount}/${totalTasks})`);
    lines.push('');
    
    // 按标签分组任务
    const tasksByLabel = this.groupTasksByLabel(tasks);
    
    Object.entries(tasksByLabel).forEach(([label, labelTasks]) => {
      if (label === '') return;
      
      lines.push(`## ${label}`);
      lines.push('');
      lines.push('### 任务列表');
      lines.push('');
      
      labelTasks.forEach(task => {
        const statusEmoji = this.getStatusEmoji(task.status);
        const statusText = this.getStatusText(task.status);
        const labelsStr = task.labels.filter(l => l !== label && l !== task.status).map(l => `\`${l}\``).join(' ');
        const meta = [task.priority, labelsStr].filter(Boolean).join(' ');
        
        lines.push(`-  **${task.id}** \`${meta}\``);
        lines.push(`  - 状态: ${statusText}`);
        lines.push(`  - 描述: ${task.description}`);
        if (task.assignee) {
          lines.push(`  - 负责人: ${task.assignee.startsWith('@') ? task.assignee : `@${task.assignee}`}`);
        }
        lines.push('');
      });
    });
    
    return lines.join('\n');
  }
  
  private groupTasksByLabel(tasks: Task[]): Record<string, Task[]> {
    const grouped: Record<string, Task[]> = {};
    
    tasks.forEach(task => {
      // 找到第一个非状态、非优先级的标签作为分组标签
      const groupLabel = task.labels.find(l => 
        !['todo', 'in-progress', 'review', 'done', 'P1', 'P2', 'P3'].includes(l)
      ) || '未分类';
      
      if (!grouped[groupLabel]) {
        grouped[groupLabel] = [];
      }
      grouped[groupLabel].push(task);
    });
    
    return grouped;
  }
  
  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'done': return '✅';
      case 'review': return '🟣';
      case 'in-progress': return '🔄';
      default: return '⏳';
    }
  }
  
  private getStatusText(status: string): string {
    switch (status) {
      case 'done': return '已完成';
      case 'review': return '待审核';
      case 'in-progress': return '进行中';
      default: return '待处理';
    }
  }
}
