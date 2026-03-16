import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { AgentService } from '../services/agentService';
import { TaskService } from '../services/taskService';
import { StatusSyncService } from '../services/statusSyncService';
import { SubagentMonitorService } from '../services/subagentMonitor';
import { SafeSyncService } from '../services/safeSyncService';
import { FileWatcherService } from '../services/fileWatcherService';
import { ProgressToDocService } from '../services/progressToDocService';
import { ProgressOrchestrator } from '../services/progressOrchestrator';
import { SyncLockService } from '../services/syncLockService';
import { WebSocketHandler } from '../websocket/server';
import { AgentTaskScheduler } from '../schedulers/agentTaskScheduler';
import { SyncManager } from '../sync/syncManager';
import { MarkdownToJSON } from '../sync/markdownToJSON';
import { JSONToMarkdown } from '../sync/jsonToMarkdown';
import { getTasksRoot } from '../config/paths';
import { ProjectExecutionService } from '../execution/projectExecutionService';
import { registerApiRoutes } from './routes';
import { accessTokenMiddleware } from '../middleware/accessToken';

export interface AppServices {
  agentService: AgentService;
  taskService: TaskService;
  wsServer: WebSocketHandler;
  projectExecutionService: ProjectExecutionService;
  scheduler: AgentTaskScheduler;
  statusSyncService: StatusSyncService;
  subagentMonitorService: SubagentMonitorService;
  safeSyncService: SafeSyncService;
  syncLockService: SyncLockService;
  progressOrchestrator: ProgressOrchestrator;
  fileWatcherService: FileWatcherService;
  syncManager: SyncManager;
}

export interface BootstrappedApp {
  app: express.Express;
  server: ReturnType<typeof createServer>;
  port: number | string;
  wsPort: number;
  services: AppServices;
}

function createServices(wsPort: number): AppServices {
  const agentService = new AgentService();
  const taskService = new TaskService();
  const wsHandler = new WebSocketServer({ port: wsPort });
  const wsServer = new WebSocketHandler(wsHandler);
  const projectExecutionService = new ProjectExecutionService(taskService, wsServer);
  const scheduler = new AgentTaskScheduler(taskService, wsServer, projectExecutionService);
  const statusSyncService = new StatusSyncService(taskService, wsServer);
  const subagentMonitorService = new SubagentMonitorService(taskService);
  const safeSyncService = new SafeSyncService(taskService);
  const syncLockService = new SyncLockService(5000);
  const progressToDocService = new ProgressToDocService(taskService);
  const progressOrchestrator = new ProgressOrchestrator(
    progressToDocService,
    safeSyncService,
    wsServer,
    syncLockService,
    undefined
  );
  const fileWatcherService = new FileWatcherService(
    safeSyncService,
    wsServer,
    progressOrchestrator,
    {
      watchTaskDoc: false,
      debounceMs: 1000,
      ignoreInitial: true,
    }
  );
  const syncManager = new SyncManager(new MarkdownToJSON(), new JSONToMarkdown(), taskService);

  (progressOrchestrator as any).fileWatcherService = fileWatcherService;
  taskService.registerProgressSyncCallback((projectId: string) => progressOrchestrator.triggerProgressSync(projectId));

  return {
    agentService,
    taskService,
    wsServer,
    projectExecutionService,
    scheduler,
    statusSyncService,
    subagentMonitorService,
    safeSyncService,
    syncLockService,
    progressOrchestrator,
    fileWatcherService,
    syncManager,
  };
}

export function createApp(): BootstrappedApp {
  const app = express();
  const server = createServer(app);
  const port = process.env.PORT || 3000;
  const wsPort = Number(process.env.WS_PORT) || 3001;
  const services = createServices(wsPort);

  app.use(cors());
  app.use(express.json());
  app.use('/tasks', accessTokenMiddleware, express.static(getTasksRoot()));

  registerApiRoutes(app, services);

  return {
    app,
    server,
    port,
    wsPort,
    services,
  };
}

export async function runInitialSyncs(services: AppServices): Promise<void> {
  const projectIds = services.safeSyncService.getConfiguredProjects();

  await Promise.allSettled(projectIds.map(async (projectId) => {
    try {
      await services.syncManager.syncFromMarkdown(projectId);
      console.log(`✅ Initial sync completed for ${projectId}`);
    } catch (error) {
      console.error(`❌ Initial sync failed for ${projectId}:`, error);
    }
  }));

  await Promise.allSettled(projectIds.map(async (projectId) => {
    try {
      const result = await services.safeSyncService.safeSyncFromMarkdown(projectId);
      if (result.success) {
        console.log(`✅ Initial safe sync completed for ${projectId}: ${result.tasks.length} tasks`);
      }
    } catch (error) {
      console.error(`❌ Initial safe sync failed for ${projectId}:`, error);
    }
  }));
}

export function startBackgroundServices(services: AppServices): NodeJS.Timeout {
  services.wsServer.start();
  services.statusSyncService.start();
  console.log('📋 Status sync service started');
  services.subagentMonitorService.start();
  console.log('🔍 Subagent monitor service started');
  services.fileWatcherService.start();
  console.log('📁 File watcher service started');
  services.scheduler.start();
  console.log('⏱️  Task scheduler running every 60000ms');

  const pollingInterval = setInterval(async () => {
    const agents = await services.agentService.getAllAgents();
    services.wsServer.broadcastAgents(agents);
  }, 3000);

  console.log('🔄 Polling OpenClaw every 3000ms');
  return pollingInterval;
}

export async function stopBackgroundServices(services: AppServices, pollingInterval?: NodeJS.Timeout | null): Promise<void> {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  services.fileWatcherService.stop();
  services.scheduler.stop();
  services.statusSyncService.stop?.();
  services.subagentMonitorService.stop();
  services.progressOrchestrator.cleanup();
  await services.wsServer.stop();
}
