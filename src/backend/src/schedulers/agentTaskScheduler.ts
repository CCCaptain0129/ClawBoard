import { TaskService } from '../services/taskService';
import { WebSocketHandler } from '../websocket/server';

export class AgentTaskScheduler {
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private taskService: TaskService,
    private wsServer: WebSocketHandler
  ) {}

  start() {
    this.interval = setInterval(async () => {
      await this.assignTasks();
    }, 60000);
    
    console.log('Task check completed');
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async assignTasks() {
    const tasks = await this.taskService.getTasksByProject('openclaw-visualization');
    const pendingTasks = tasks.filter(t => t.status === 'todo');
    
    if (pendingTasks.length === 0) return;

    console.log(`Available tasks found: ${pendingTasks.length}`);
  }
}
