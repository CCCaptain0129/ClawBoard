import { TaskService } from '../services/taskService';
import { WebSocketHandler } from '../websocket/server';
import { ProjectExecutionService } from '../execution/projectExecutionService';

export class AgentTaskScheduler {
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private taskService: TaskService,
    private wsServer: WebSocketHandler,
    private projectExecutionService: ProjectExecutionService = new ProjectExecutionService(taskService, wsServer)
  ) {}

  start() {
    console.log('🔔 Task scheduler started (interval: 60s)');
    
    this.interval = setInterval(async () => {
      await this.runSchedulingCycle();
    }, 60000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('🔕 Task scheduler stopped');
    }
  }

  private async runSchedulingCycle() {
    try {
      await this.projectExecutionService.runCycle();
    } catch (error) {
      console.error('❌ Task scheduler error:', error);
    }
  }
}
