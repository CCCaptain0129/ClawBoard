# 技术架构设计

---

## 1. 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                         前端层                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Agent 列表   │  │ Agent 详情   │  │ 错误日志     │          │
│  │  组件       │  │  组件       │  │  组件       │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │   状态管理    │  (Zustand Store)        │
│                    └──────┬──────┘                          │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            │ WebSocket
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                         后端层                                │
│                    ┌─────────────┐                          │
│                    │ Express 服务器│                         │
│                    └──────┬──────┘                          │
│                           │                                 │
│         ┌─────────────────┼─────────────────┐               │
│         │                 │                 │               │
│    ┌────▼────┐     ┌─────▼─────┐    ┌─────▼─────┐          │
│    │ REST API │     │ WebSocket │    │ 定时任务   │          │
│    │  服务    │     │  服务     │    │  服务     │          │
│    └────┬────┘     └─────┬─────┘    └─────┬─────┘          │
│         │                 │                 │               │
└─────────┼─────────────────┼─────────────────┼───────────────┘
          │                 │                 │
          │                 │                 │
┌─────────▼─────────────────▼─────────────────▼───────────────┐
│                       数据层                                 │
│                    ┌─────────────┐                          │
│                    │ OpenClaw    │                          │
│                    │ 数据/日志    │                          │
│                    └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 前端架构

### 2.1 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **路由**: React Router v6
- **状态管理**: Zustand
- **UI组件**: shadcn/ui
- **样式**: Tailwind CSS
- **图表**: Recharts
- **WebSocket**: 原生 WebSocket API

### 2.2 目录结构

```
src/frontend/src/
├── components/           # 可复用组件
│   ├── AgentCard.tsx    # Agent 卡片组件
│   ├── AgentList.tsx    # Agent 列表组件
│   ├── StatusBadge.tsx  # 状态徽章组件
│   ├── ProgressBar.tsx  # 进度条组件
│   └── ErrorLog.tsx     # 错误日志组件
├── pages/               # 页面组件
│   ├── Dashboard.tsx    # 仪表盘页面
│   ├── AgentDetail.tsx  # Agent 详情页
│   └── ErrorLogs.tsx    # 错误日志页
├── stores/              # Zustand 状态管理
│   ├── agentStore.ts    # Agent 状态
│   ├── uiStore.ts       # UI 状态
│   └── websocketStore.ts # WebSocket 连接状态
├── hooks/               # 自定义 Hooks
│   ├── useWebSocket.ts  # WebSocket 连接管理
│   └── useAgentData.ts  # Agent 数据获取
├── services/            # API 服务
│   └── agentApi.ts      # Agent API 封装
├── types/               # TypeScript 类型定义
│   └── agent.ts         # Agent 相关类型
├── utils/               # 工具函数
│   ├── formatters.ts    # 格式化函数
│   └── constants.ts     # 常量
├── App.tsx              # 根组件
└── main.tsx             # 入口文件
```

### 2.3 状态管理设计

**agentStore.ts**
```typescript
interface AgentState {
  agents: Agent[];
  selectedAgent: Agent | null;
  setAgents: (agents: Agent[]) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  selectAgent: (agent: Agent | null) => void;
  getAgentById: (id: string) => Agent | undefined;
}
```

**websocketStore.ts**
```typescript
interface WebSocketState {
  connected: boolean;
  reconnecting: boolean;
  error: Error | null;
  connect: () => void;
  disconnect: () => void;
}
```

### 2.4 WebSocket 连接管理

```typescript
// hooks/useWebSocket.ts
export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setReconnecting(false);
      };

      ws.onclose = () => {
        setConnected(false);
        // 自动重连
        setReconnecting(true);
        setTimeout(() => connect(), 3000);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // 处理接收到的消息
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { connected, reconnecting };
}
```

---

## 3. 后端架构

### 3.1 技术栈

- **运行时**: Node.js 18+
- **框架**: Express
- **WebSocket**: ws 库
- **数据库**: （根据实际情况）
- **日志**: Winston

### 3.2 目录结构

```
src/backend/src/
├── routes/              # 路由
│   ├── agents.ts        # Agent 相关路由
│   └── logs.ts          # 日志相关路由
├── services/            # 业务逻辑
│   ├── AgentService.ts  # Agent 服务
│   ├── LogService.ts    # 日志服务
│   └── OpenClawAdapter.ts # OpenClaw 数据适配器
├── websocket/           # WebSocket 服务
│   ├── WebSocketServer.ts # WebSocket 服务器
│   └── handlers.ts      # 消息处理器
├── schedulers/          # 定时任务
│   └── AgentStateScheduler.ts # Agent 状态轮询
├── types/               # TypeScript 类型
│   └── index.ts         # 类型定义
├── utils/               # 工具函数
│   └── logger.ts        # 日志工具
├── middleware/          # 中间件
│   └── cors.ts          # CORS 配置
├── index.ts             # 入口文件
└── config.ts            # 配置文件
```

### 3.3 API 设计

**获取所有 Agent**
```
GET /api/agents
Response: {
  "agents": [
    {
      "id": "agent-001",
      "name": "Agent 1",
      "status": "running",
      "currentTask": "Processing data",
      "progress": 45,
      "startTime": "2026-03-10T10:00:00Z"
    }
  ]
}
```

**获取 Agent 详情**
```
GET /api/agents/:id
Response: {
  "id": "agent-001",
  "name": "Agent 1",
  "status": "running",
  "currentTask": "Processing data",
  "progress": 45,
  "startTime": "2026-03-10T10:00:00Z",
  "history": [...],
  "metrics": {...}
}
```

**获取错误日志**
```
GET /api/agents/:id/logs?level=error&limit=100
Response: {
  "logs": [
    {
      "timestamp": "2026-03-10T10:00:00Z",
      "level": "error",
      "message": "Connection failed",
      "stack": "..."
    }
  ]
}
```

### 3.4 WebSocket 协议

**连接**
```
Client → Server: CONNECT
Server → Client: CONNECTED
```

**状态更新推送**
```
Server → Client: AGENT_UPDATE
{
  "type": "AGENT_UPDATE",
  "data": {
    "id": "agent-001",
    "status": "running",
    "currentTask": "Processing data",
    "progress": 50
  }
}
```

**心跳**
```
Client → Server: PING
Server → Client: PONG
```

### 3.5 Agent 状态轮询

```typescript
// schedulers/AgentStateScheduler.ts
class AgentStateScheduler {
  private intervalId: NodeJS.Timeout | null = null;

  start(pollInterval: number = 3000) {
    this.intervalId = setInterval(async () => {
      const agents = await this.fetchAgentStates();
      const previousStates = this.getPreviousStates();
      const changes = this.detectChanges(agents, previousStates);

      if (changes.length > 0) {
        this.broadcastChanges(changes);
      }

      this.saveStates(agents);
    }, pollInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
```

### 3.6 OpenClaw 数据适配器

根据 OpenClaw 的实际数据源实现：

**方案 A：数据库查询**
```typescript
async function fetchAgentStates() {
  const agents = await db.query('SELECT * FROM agents');
  return agents;
}
```

**方案 B：日志文件解析**
```typescript
async function fetchAgentStates() {
  const logFile = await fs.readFile('/path/to/openclaw.log', 'utf8');
  const agents = parseLogFile(logFile);
  return agents;
}
```

**方案 C：OpenClaw API**
```typescript
async function fetchAgentStates() {
  const response = await fetch('http://localhost:8080/api/agents');
  const data = await response.json();
  return data.agents;
}
```

---

## 4. 数据模型

### 4.1 Agent

```typescript
interface Agent {
  id: string;              // Agent ID
  name: string;            // Agent 名称
  status: AgentStatus;     // 状态
  currentTask: string | null; // 当前任务
  progress: number;        // 进度 (0-100)
  startTime: string | null; // 开始时间
  endTime: string | null;  // 结束时间
  metrics?: AgentMetrics;  // 性能指标
}

type AgentStatus = 'running' | 'idle' | 'error' | 'stopped';

interface AgentMetrics {
  cpuUsage: number;        // CPU 使用率 (%)
  memoryUsage: number;     // 内存使用量 (MB)
  uptime: number;          // 运行时间 (秒)
}
```

### 4.2 日志

```typescript
interface LogEntry {
  timestamp: string;       // 时间戳
  level: LogLevel;         // 日志级别
  agentId: string;         // Agent ID
  message: string;         // 日志消息
  stack?: string;          // 堆栈信息
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
```

### 4.3 任务历史

```typescript
interface TaskHistory {
  id: string;              // 任务 ID
  agentId: string;         // Agent ID
  name: string;            // 任务名称
  status: TaskStatus;      // 任务状态
  startTime: string;       // 开始时间
  endTime: string | null;  // 结束时间
  duration: number | null; // 耗时 (秒)
}

type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';
```

---

## 5. 部署架构

### 5.1 开发环境

```
Frontend (localhost:5173)
    ↓
Backend (localhost:3000)
    ↓
OpenClaw (运行中)
```

### 5.2 生产环境

```
Nginx (反向代理)
    ├── Frontend (静态文件)
    └── Backend (Node.js 服务)
            ↓
      OpenClaw 系统
```

---

## 6. 性能优化

### 6.1 前端优化

- **虚拟滚动**: Agent 列表使用虚拟滚动
- **请求缓存**: REST API 请求缓存
- **防抖/节流**: 搜索和筛选使用防抖

### 6.2 后端优化

- **连接池**: 数据库连接池
- **缓存**: Redis 缓存 Agent 状态
- **批量推送**: WebSocket 批量推送更新

### 6.3 WebSocket 优化

- **压缩**: 消息压缩
- **心跳优化**: 调整心跳间隔
- **重连策略**: 指数退避重连

---

## 7. 安全考虑

- **CORS 配置**: 限制允许的域名
- **WebSocket 认证**: （可选）连接时验证 token
- **日志脱敏**: 不记录敏感信息
- **输入验证**: 验证所有输入参数

---

*版本: 1.0.0*  
*最后更新: 2026-03-10*