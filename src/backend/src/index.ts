import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import { WebSocketServer } from 'ws';
import { AgentService } from './services/agentService';
import { TaskService } from './services/taskService';
import { StatusSyncService } from './services/statusSyncService';
import { SubagentMonitorService } from './services/subagentMonitor';
import { agentRoutes } from './routes/agents';
import { taskRoutes } from './routes/tasks';
import { syncRoutes } from './routes/sync';
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

app.use('/api/agents', agentRoutes(agentService));
app.use('/api/tasks', taskRoutes(taskService, wsServer));
app.use('/api/tasks', healthCheckRouter);
app.use('/api/sync', syncRoutes(taskService, wsServer));

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

// Start polling
setInterval(async () => {
  const agents = await agentService.getAllAgents();
  wsServer.broadcastAgents(agents);
}, 3000);

scheduler.start();
console.log(`🔄 Polling OpenClaw every 3000ms`);
console.log(`⏱️  Task scheduler running every 60000ms`);

process.on('SIGTERM', () => {
  wsServer.stop();
  scheduler.stop();
  statusSyncService.stop?.();
  subagentMonitorService.stop();
  server.close();
});
