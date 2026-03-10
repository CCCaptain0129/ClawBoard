import { TaskService } from '../services/taskService';
import { WebSocketHandler } from '../websocket/server';

export class AgentTaskScheduler {
  private interval: NodeJS.Timeout | null = null;
  private readonly projectId = 'openclaw-visualization';

  constructor(
    private taskService: TaskService,
    private wsServer: WebSocketHandler
  ) {}

  start() {
    console.log('🔔 Task scheduler started (interval: 60s)');
    
    this.interval = setInterval(async () => {
      await this.assignTasks();
    }, 60000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('🔕 Task scheduler stopped');
    }
  }

  /**
   * 检查待处理任务并尝试自动分配
   */
  private async assignTasks() {
    try {
      const tasks = await this.taskService.getTasksByProject(this.projectId);
      
      // 获取所有待处理的高优先级任务
      const pendingTasks = tasks.filter(t => 
        t.status === 'todo' && 
        t.priority === 'P1'
      );
      
      if (pendingTasks.length === 0) {
        return;
      }

      console.log(`📋 Found ${pendingTasks.length} pending P1 tasks`);
      
      // 这里可以添加实际的 Agent 分配逻辑
      // 目前只记录日志，前端可以手动分配
      pendingTasks.forEach(task => {
        console.log(`  - ${task.id}: ${task.title} (${task.labels.join(', ')})`);
      });
      
    } catch (error) {
      console.error('❌ Task scheduler error:', error);
    }
  }
}