import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { AgentService } from './services/agentService';
import { TaskService } from './services/taskService';
import { agentRoutes } from './routes/agents';
import { taskRoutes } from './routes/tasks';
import { syncRoutes } from './routes/sync';
import { WebSocketHandler } from './websocket/server';
import { AgentTaskScheduler } from './schedulers/agentTaskScheduler';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;
const WS_PORT = Number(process.env.WS_PORT) || 3001;

app.use(cors());
app.use(express.json());

const agentService = new AgentService();
const taskService = new TaskService();
const wsHandler = new WebSocketServer({ port: WS_PORT });
const wsServer = new WebSocketHandler(wsHandler);
const scheduler = new AgentTaskScheduler(taskService, wsServer);

app.use('/api/agents', agentRoutes(agentService));
app.use('/api/tasks', taskRoutes(taskService, wsServer));
app.use('/api/sync', syncRoutes(wsServer));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

server.listen(PORT, () => {
  console.log(`✅ HTTP server listening on port ${PORT}`);
});

wsServer.start();

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
  server.close();
});
