# OpenClaw Visualization

> OpenClaw Agent 可视化监控平台

## 简介

一个实时监控和管理 OpenClaw Agent 的可视化平台，包含 Agent 状态监控和 Trello 风格的任务看板系统。

## 功能特性

### Agent 监控
- 实时展示所有 Agent 状态
- 显示 Token 使用统计
- WebSocket 实时更新（3 秒轮询）
- Agent 详细信息查看

### 任务看板
- Trello 风格三列布局（待处理、进行中、已完成）
- 任务状态实时切换
- Markdown ↔ JSON 双向同步
- 任务统计和进度追踪
- 优先级和标签分类
- 响应式设计，极简风格

## 技术栈

### 前端
- React 18 + TypeScript
- Vite
- Tailwind CSS
- WebSocket 客户端

### 后端
- Node.js + Express
- TypeScript
- WebSocket 服务
- 文件系统操作

## 快速开始

### 一键启动（推荐）

**macOS/Linux:**
```bash
./start.sh
```

**Windows:**
```cmd
start.bat
```

一键启动脚本会自动：
- ✅ 检查 Node.js 和 npm 环境
- ✅ 自动安装依赖（首次运行）
- ✅ 启动后端服务（端口 3000 / 3001）
- ✅ 启动前端服务（端口 5173）

**停止服务：**
```bash
./stop.sh  # macOS/Linux
stop.bat    # Windows
```

### 手动启动

如果需要手动启动，请按以下步骤操作：

#### 前置要求
- Node.js >= 18
- npm 或 yarn

#### 安装依赖

```bash
# 后端
cd src/backend
npm install

# 前端
cd ../frontend
npm install
```

#### 启动服务

```bash
# 启动后端服务（端口 3000 / 3001）
cd src/backend
npm run dev

# 启动前端服务（端口 5173）
cd src/frontend
npm run dev
```

### 访问应用

- 前端：http://localhost:5173
- 后端 API：http://localhost:3000
- WebSocket：ws://localhost:3001

### 命令行工具

项目提供了命令行工具 `task-cli`，可以快速创建项目、任务和查看进度：

```bash
# 查看帮助
./task-cli help

# 查看所有项目进度
./task-cli progress

# 创建新项目
./task-cli create-project --id my-project --name "我的项目"

# 创建任务
./task-cli create-task --project openclaw-visualization --title "新功能"

# 更新任务状态
./task-cli update TASK-001 --status done
```

详见：[用户指南](./USER_GUIDE.md#命令行工具)

## API 文档

### Agent API

#### 获取所有 Agent
```http
GET /api/agents
```

### 任务 API

#### 获取所有项目
```http
GET /api/tasks/projects
```

#### 获取项目任务
```http
GET /api/tasks/projects/:id/tasks
```

#### 更新任务状态
```http
PUT /api/tasks/projects/:id/tasks/:taskId
Content-Type: application/json

{
  "status": "in-progress"
}
```

### 同步 API

#### Markdown → JSON
```http
POST /api/sync/from-markdown/:projectId
```

#### JSON → Markdown
```http
POST /api/sync/to-markdown/:projectId
```

#### 双向同步
```http
POST /api/sync/:projectId
```

## 项目结构

```
openclaw-visualization/
├── src/
│   ├── backend/          # 后端服务
│   │   ├── src/
│   │   │   ├── routes/   # API 路由
│   │   │   ├── services/ # 业务逻辑
│   │   │   ├── websocket/# WebSocket 服务
│   │   │   ├── sync/     # 同步逻辑
│   │   │   └── schedulers/# 定时任务
│   │   └── package.json
│   └── frontend/         # 前端应用
│       ├── src/
│       │   ├── components/# React 组件
│       │   ├── pages/    # 页面组件
│       │   ├── services/ # API 调用
│       │   └── hooks/    # 自定义 Hook
│       └── package.json
├── tasks/                # 任务数据
│   ├── projects.json
│   └── openclaw-visualization-tasks.json
└── TASKS.md             # 任务清单（Markdown 格式）
```

## 任务管理

任务以 Markdown 格式存储在 `TASKS.md`，通过同步 API 自动转换为 JSON 格式供前端使用。

### 添加新任务

在 `TASKS.md` 中按照以下格式添加：

```markdown
## 阶段 X

### 任务列表

-  **TASK-XXX** `P1` `frontend`
  - 状态: 待处理
  - 描述: 任务描述
  - 负责人: @username
```

然后点击"同步到 Markdown"按钮，或调用同步 API。

### 任务模板与使用说明

详细的任务创建规范、最佳实践和示例，请参考：📖 [用户指南](./USER_GUIDE.md)

## 开发进度

- ✅ Agent 监控：100%
- ✅ 任务看板后端：100%
- ✅ 任务看板前端：100%
- 🚧 功能增强：开发中
- ⏳ 部署到生产：待开始

## 部署

### 环境变量

创建 `.env` 文件：

```env
PORT=3000
WS_PORT=3001
```

### 构建生产版本

```bash
# 前端构建
cd src/frontend
npm run build

# 后端构建（可选）
cd ../backend
npm run build
```

### 使用 PM2 部署

```bash
# 安装 PM2
npm install -g pm2

# 启动后端
pm2 start src/backend/src/index.ts --name openclaw-backend

# 启动前端（使用 nginx 提供静态文件）
# 或使用 PM2 + serve
cd src/frontend
npm run build
pm2 serve dist 5173 --name openclaw-frontend
```

## 常见问题

### WebSocket 连接失败
检查后端服务是否启动，端口 3001 是否被占用。

### 任务同步失败
检查 `tasks/` 目录是否有写入权限。

### 前端无法连接后端
检查 CORS 配置和后端服务状态。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

- GitHub: https://github.com/CCCaptain0129/OpenClaw_Visualization