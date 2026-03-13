import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import { WebSocketServer } from 'ws';
import { AgentService } from './services/agentService';
import { TaskService } from './services/taskService';
import { StatusSyncService } from './services/statusSyncService';
import { SubagentMonitorService } from './services/subagentMonitor';
import { SafeSyncService } from './services/safeSyncService';
import { FileWatcherService } from './services/fileWatcherService';
import { ProgressToDocService } from './services/progressToDocService';
import { ProgressOrchestrator } from './services/progressOrchestrator';
import { SyncLockService } from './services/syncLockService'; // PMW-030
import { agentRoutes } from './routes/agents';
import { taskRoutes } from './routes/tasks';
import { syncRoutes } from './routes/sync';
import { taskDocRoutes } from './routes/taskDoc'; // PMW-036: 任务文档写入路由
import healthCheckRouter from './routes/healthCheck';
import { WebSocketHandler } from './websocket/server';
import { AgentTaskScheduler } from './schedulers/agentTaskScheduler';
import { SyncManager } from './sync/syncManager';
import { MarkdownToJSON } from './sync/markdownToJSON';
import { JSONToMarkdown } from './sync/jsonToMarkdown';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;
const WS_PORT = Number(process.env.WS_PORT) || 3001;

app.use(cors());
app.use(express.json());

// 提供静态文件服务 - tasks 目录
const tasksPath = path.join(process.cwd(), '../../tasks');
app.use('/tasks', express.static(tasksPath));
console.log(`📁 Serving static files from: ${tasksPath}`);

const agentService = new AgentService();
const taskService = new TaskService();
const wsHandler = new WebSocketServer({ port: WS_PORT });
const wsServer = new WebSocketHandler(wsHandler);
const scheduler = new AgentTaskScheduler(taskService, wsServer);
const statusSyncService = new StatusSyncService(taskService, wsServer);
const subagentMonitorService = new SubagentMonitorService(taskService);

// ========================================
// PMW-023 Phase 2: 安全同步服务初始化
// ========================================
const safeSyncService = new SafeSyncService(taskService);

// ========================================
// PMW-030: 同步锁服务初始化
// ========================================
const syncLockService = new SyncLockService(5000); // 5秒超时
console.log('🔒 Sync lock service initialized (timeout: 5000ms)');

// ========================================
// PMW-029: 进度编排服务初始化
// ========================================
const progressToDocService = new ProgressToDocService(taskService);
// PMW-032: 先创建 progressOrchestrator，再传给 fileWatcherService
const progressOrchestrator = new ProgressOrchestrator(
  progressToDocService,
  safeSyncService,
  wsServer,
  syncLockService, // PMW-030
  undefined // PMW-030: fileWatcherService 先传 undefined，稍后注入
);

console.log('📊 Progress orchestrator service initialized');

// ========================================
// PMW-023 Phase 2: 文件监听服务初始化
// ========================================
// PMW-032: 将 progressOrchestrator 传入 fileWatcherService，实现 03 变更触发 04 刷新
const fileWatcherService = new FileWatcherService(
  safeSyncService,
  wsServer,
  progressOrchestrator // PMW-032: 注入 progressOrchestrator
);

// PMW-030: 将 fileWatcherService 注入到 progressOrchestrator（避免回环）
// 注意：这是为了避免 04 刷新时再次触发 03 监听
(progressOrchestrator as any).fileWatcherService = fileWatcherService;

// 注册进度同步回调到 TaskService
taskService.registerProgressSyncCallback((projectId: string) => {
  return progressOrchestrator.triggerProgressSync(projectId);
});

console.log('📊 Progress orchestrator service initialized');

app.use('/api/agents', agentRoutes(agentService));
app.use('/api/tasks', taskRoutes(taskService, wsServer));
app.use('/api/tasks', healthCheckRouter);
app.use('/api/sync', syncRoutes(taskService, wsServer, safeSyncService));
app.use('/api/task-doc', taskDocRoutes(taskService, safeSyncService, wsServer, progressOrchestrator)); // PMW-036: 任务文档写入

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

server.listen(PORT, () => {
  console.log(`✅ HTTP server listening on port ${PORT}`);
});

wsServer.start();

// 启动时同步 Markdown 到 JSON
const markdownToJSON = new MarkdownToJSON();
const jsonToMarkdown = new JSONToMarkdown();
const syncManager = new SyncManager(markdownToJSON, jsonToMarkdown, taskService);

syncManager.syncFromMarkdown('openclaw-visualization')
  .then(() => console.log('✅ Initial sync completed'))
  .catch(err => console.error('❌ Initial sync failed:', err));

// 启动状态同步服务（监控 SUBAGENTS任务分发记录.md）
statusSyncService.start();
console.log('📋 Status sync service started');

// 启动 Subagent 监控服务（自动补齐完成的 subagent）
subagentMonitorService.start();
console.log('🔍 Subagent monitor service started');

// ========================================
// PMW-023 Phase 2: 启动文件监听服务
// ========================================
fileWatcherService.start();
console.log('📁 File watcher service started');

// ========================================
// 初始同步（可选）
// ========================================
// 初始同步 pm-workflow-automation 项目
safeSyncService.safeSyncFromMarkdown('pm-workflow-automation')
  .then(result => {
    if (result.success) {
      console.log(`✅ Initial safe sync completed: ${result.tasks.length} tasks`);
    }
  })
  .catch(err => console.error('❌ Initial safe sync failed:', err));

// Start polling
setInterval(async () => {
  const agents = await agentService.getAllAgents();
  wsServer.broadcastAgents(agents);
}, 3000);

scheduler.start();
console.log(`🔄 Polling OpenClaw every 3000ms`);
console.log(`⏱️  Task scheduler running every 60000ms`);

process.on('SIGTERM', () => {
  fileWatcherService.stop();
  wsServer.stop();
  scheduler.stop();
  statusSyncService.stop?.();
  subagentMonitorService.stop();
  progressOrchestrator.cleanup();
  server.close();
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  fileWatcherService.stop();
  wsServer.stop();
  scheduler.stop();
  statusSyncService.stop?.();
  subagentMonitorService.stop();
  progressOrchestrator.cleanup();
  server.close();
  process.exit(0);
});

// 文件监听状态端点
app.get('/api/file-watcher/status', (req, res) => {
  res.json(fileWatcherService.getStatus());
});

// PMW-030: 同步锁状态端点
app.get('/api/sync-lock/status', (req, res) => {
  res.json(syncLockService.getStatus());
});
