import type express from 'express';
import { agentRoutes } from '../routes/agents';
import { taskRoutes } from '../routes/tasks';
import { syncRoutes } from '../routes/sync';
import { taskDocRoutes } from '../routes/taskDoc';
import { executionRoutes } from '../routes/execution';
import healthCheckRouter from '../routes/healthCheck';
import type { AppServices } from './bootstrap';
import { accessTokenMiddleware } from '../middleware/accessToken';

export function registerApiRoutes(app: express.Express, services: AppServices): void {
  app.use('/api', accessTokenMiddleware);
  app.use('/api/agents', agentRoutes(services.agentService));
  app.use('/api/tasks', taskRoutes(services.taskService, services.wsServer, services.subagentMonitorService));
  app.use('/api/tasks', healthCheckRouter);
  app.use('/api/execution', executionRoutes(services.projectExecutionService));
  app.use('/api/sync', syncRoutes(services.taskService, services.wsServer, services.safeSyncService));
  app.use(
    '/api/task-doc',
    taskDocRoutes(
      services.taskService,
      services.safeSyncService,
      services.wsServer,
      services.progressOrchestrator
    )
  );

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/file-watcher/status', (req, res) => {
    res.json(services.fileWatcherService.getStatus());
  });

  app.get('/api/sync-lock/status', (req, res) => {
    res.json(services.syncLockService.getStatus());
  });
}
