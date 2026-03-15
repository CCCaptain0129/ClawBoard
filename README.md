# OpenClaw Visualization

> OpenClaw Agent 可视化监控平台

## 简介

一个用于监控 OpenClaw Agent、管理项目任务、同步 Markdown/JSON 任务数据的可视化平台。

## 功能特性

### Agent 监控
- 实时展示所有 Agent 状态
- 显示 Token 使用统计
- WebSocket 实时更新（3 秒轮询）
- Agent 详细信息查看

### 任务看板
- Trello 风格三列布局（待处理、进行中、已完成）
- 任务状态实时切换
- Markdown / JSON 同步与任务文档写入
- 任务统计和进度追踪
- 优先级和标签分类
- 响应式设计，极简风格

### 编排与同步
- 任务文档安全同步到看板 JSON
- 进度文档自动回写
- Subagent 状态联动任务状态
- 文件监听、同步锁和防回环处理

## 开发指南

### 开发原则

1. **小步快跑**：每完成一个小任务就进行测试
2. **测试优先**：开发新功能前先编写测试用例
3. **定期推送**：每完成一个功能模块就推送到 GitHub
4. **文档同步**：代码变更后立即更新相关文档

### 重要教训

- 修改代码前先提交到 git，避免数据丢失

### 技术栈

- **前端**: React 18 + TypeScript + Vite + Tailwind CSS
- **后端**: Node.js + Express + WebSocket
- **同步链路**: 文件监听 + JSON / Markdown 双格式任务数据

## 配置

本项目需要配置 OpenClaw Gateway Token 才能连接到 OpenClaw 服务。飞书应用配置是可选的，用于获取群组名称。

### 获取 Gateway Token

1. 确保已安装 OpenClaw 并启动 Gateway：
   ```bash
   openclaw gateway status
   openclaw gateway start
   ```

2. 获取 Gateway Token：
   ```bash
   openclaw gateway status
   ```
   输出中会显示 `Gateway Token`，复制该值。

### 配置方式

本项目支持两种配置方式：

#### 方式 1：配置文件（推荐）

1. 复制示例配置文件：
   ```bash
   cd src/backend/config
   cp openclaw.json.example openclaw.json
   ```

2. 编辑 `openclaw.json`，填入你的配置：
   ```json
   {
     "gateway": {
       "url": "ws://127.0.0.1:18789",
       "token": "你的-gateway-token-here"
     },
     "feishu": {
       "appId": "cli_你的app_id",
       "appSecret": "你的app_secret"
     }
   }
   ```

3. 飞书配置是可选的，如果不配置将跳过群组名称获取功能。

#### 方式 2：环境变量

设置环境变量（推荐在 `.env` 文件或 shell 配置中）：

```bash
export OPENCLAW_GATEWAY_URL="ws://127.0.0.1:18789"
export OPENCLAW_GATEWAY_TOKEN="你的-gateway-token-here"
export FEISHU_APP_ID="cli_你的app_id"
export FEISHU_APP_SECRET="你的app_secret"
```

**配置优先级：** 环境变量 > 配置文件 > 默认值

### 飞书应用配置（可选）

如果需要获取飞书群组名称，需要配置飞书应用：

1. 在[飞书开放平台](https://open.feishu.cn/)创建应用
2. 获取 `app_id` 和 `app_secret`
3. 在配置文件或环境变量中填入上述值

## 快速开始

### 一键安装（推荐）

首次使用推荐使用一键安装脚本：

```bash
# macOS/Linux
./install.sh

# Windows
install.bat
```

安装脚本会自动：
- ✅ 检查 Node.js/npm 版本
- ✅ 创建临时目录
- ✅ 检查/创建配置文件
- ✅ 安装后端和前端依赖

详细安装指南请参考：📖 [安装指南](./docs/INSTALL.md)

### 启动服务

**普通模式（推荐用于开发）：**

```bash
./start.sh      # macOS/Linux
start.bat       # Windows
```

**守护进程模式（推荐用于生产环境）：**

以守护进程模式启动，服务会在后台运行，并自动监控服务状态，崩溃时自动重启。

```bash
./start.sh --daemon      # macOS/Linux
start.bat --daemon       # Windows
```

一键启动脚本会自动：
- ✅ 检查 Node.js 和 npm 环境
- ✅ 自动安装依赖（首次运行）
- ✅ 启动后端服务（端口 3000 / 3001）
- ✅ 启动前端服务（端口 5173）
- ✅ 守护模式：自动监控服务状态

**停止服务：**

```bash
./stop.sh       # macOS/Linux
stop.bat        # Windows
```

### 验证服务

启动后可使用验证脚本检查服务状态：

```bash
# macOS/Linux
./verify.sh           # 标准验证
./verify.sh --quick   # 快速检查
./verify.sh --full    # 完整检查

# Windows
verify.bat           # 标准验证
verify.bat --quick   # 快速检查
verify.bat --full    # 完整检查
```

验证脚本会检查：
- ✅ 后端/前端进程状态
- ✅ 端口监听状态
- ✅ 健康检查端点
- ✅ 文件监听服务（--full 模式）
- ✅ 同步锁服务（--full 模式）

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

## 当前结构

当前代码以 `src/backend` 和 `src/frontend` 为准，历史 `src/src_backup` 目录已移除。后端启动装配已拆分为入口、服务装配和路由注册三层。

```text
openclaw-visualization/
├── src/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── app/          # 启动装配、路由注册
│   │   │   ├── config/       # 路径与配置解析
│   │   │   ├── routes/       # HTTP API
│   │   │   ├── services/     # 任务、同步、subagent 服务
│   │   │   ├── sync/         # Markdown / JSON 转换
│   │   │   └── websocket/    # WebSocket 广播
│   └── frontend/
│       ├── src/
│       │   ├── components/   # 看板与任务组件
│       │   ├── hooks/        # WebSocket 等 Hook
│       │   ├── pages/        # Agent 监控页面
│       │   └── services/     # 前端 API 访问层
├── tasks/                    # 项目与任务 JSON / Markdown
├── docs/                     # 安装、部署、设计文档
└── templates/                # 模板与提示词资产
```

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
./task-cli update VIS-004 --status done
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

## 任务管理

任务数据保存在 `tasks/` 目录下：

- `projects.json` 保存项目列表
- `<projectId>-tasks.json` 保存看板任务
- `<projectId>-TASKS.md` 或项目内任务文档作为 Markdown 来源

前端看板以 JSON 为直接数据源，文档同步由后端服务执行。

### 添加新任务

在项目任务文档中按照以下格式添加：

```markdown
## 阶段 X

### 任务列表

-  **TASK-XXX** `P1` `frontend`
  - 状态: 待处理
  - 描述: 任务描述
  - 负责人: @username
```

然后调用同步 API，或使用任务文档写入接口。

### 任务模板与使用说明

详细的任务创建规范、最佳实践和示例，请参考：📖 [用户指南](./USER_GUIDE.md)

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
检查 `VITE_API_URL` / `VITE_WS_URL` 配置、反向代理和后端服务状态。

## 相关文档

- 📥 [安装指南](./docs/INSTALL.md) - 15分钟快速启动（新用户必读）
- 📖 [用户指南](./USER_GUIDE.md) - 任务管理、命令行工具使用说明
- 🏗️ [架构设计](./docs/ARCHITECTURE.md) - 历史架构设计与设计决策参考
- 🚀 [部署指南](./docs/DEPLOY.md) - 生产环境部署说明
- 🔄 [开发流程](./docs/DEVELOPMENT_WORKFLOW.md) - 开发工作流和规范
- 📋 [产品需求文档](./docs/PRD.md) - 产品功能和需求定义
- 🔌 [OpenClaw 集成](./docs/OPENCLAW_INTEGRATION.md) - OpenClaw 集成实现
- 🧭 [使用说明](./docs/USAGE.md) - 运行、排错和使用说明
- 🛠️ [集成设计](./docs/INTEGRATION_DESIGN.md) - 各模块集成设计

### 归档文档
- 📁 [归档文档](./docs/archive/) - 历史测试文件和临时文档

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

- GitHub: https://github.com/CCCaptain0129/OpenClaw_Visualization
