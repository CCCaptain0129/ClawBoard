# OpenClaw Visualization

> 通用项目看板与任务监控系统

## 简介

`openclaw-visualization` 是一个通用的项目看板与任务监控应用。

它的核心职责是：

- 管理项目
- 管理任务
- 展示任务状态
- 维护任务运行态真源
- 提供稳定的前端界面和后端 API

它可以被真人用户、AI Agent 或其他自动化系统使用，但项目本身不依赖某一个特定 Agent 平台。OpenClaw 相关能力可以存在，但属于扩展集成，不是产品定位本身。

## 核心能力

### 任务看板

- 项目切换与多项目视图
- 任务创建、更新、删除
- `todo / in-progress / review / done`
- 优先级、标签、执行模式、交付物、验收标准
- 进度统计与项目概览

### Agent 监控

- 展示 Agent / subagent 状态
- 展示最近活动情况
- 展示上下文风险与运行信息

### 数据与同步

- 任务运行态真源使用 `tasks/*.json`
- 文档可用于规划、说明和进度跟踪
- WebSocket 实时广播任务更新
- 后端统一写入真源，前端负责展示与操作

## 真源规则

- 前端不是任务真源，只是可视化入口
- 任务运行态真源是 `tasks/*.json`
- 项目文档建议保存在 `projects/<project-name>/docs/`
- 修改任务状态或任务内容时，优先通过后端 API

详细说明请参考：[看板使用说明](./docs/USAGE.md)

## 快速开始

### 安装

```bash
./install.sh
```

或手动安装：

```bash
cd src/backend && npm install
cd ../frontend && npm install
```

### 启动

```bash
./start.sh
```

访问地址：

- 前端：[http://127.0.0.1:5173](http://127.0.0.1:5173)
- 后端：[http://127.0.0.1:3000](http://127.0.0.1:3000)
- WebSocket：`ws://127.0.0.1:3001`
- 首次打开看板时，需要输入安装向导生成的访问码（保存在根目录 `.env` 的 `BOARD_ACCESS_TOKEN`）

停止服务：

```bash
./stop.sh
```

### PM2 托管

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
```

## 目录结构

```text
openclaw-visualization/
├── src/
│   ├── backend/
│   │   └── src/
│   │       ├── app/
│   │       ├── config/
│   │       ├── routes/
│   │       ├── services/
│   │       ├── sync/
│   │       └── websocket/
│   └── frontend/
│       └── src/
│           ├── components/
│           ├── hooks/
│           ├── pages/
│           └── services/
├── tasks/          # 项目与任务真源
├── docs/           # 使用、安装、部署说明
└── templates/      # 模板与提示词资产
```

## 推荐 API

### 项目

- `GET /api/tasks/projects`

### 任务

- `GET /api/tasks/projects/:projectId/tasks`
- `POST /api/tasks/projects/:projectId/tasks`
- `PUT /api/tasks/projects/:projectId/tasks/:taskId`
- `DELETE /api/tasks/projects/:projectId/tasks/:taskId`

### 扩展接口

- `GET /api/execution/projects/:projectId/guide`
- `GET /api/execution/projects/:projectId/tasks/:taskId/context`

这些扩展接口适合 AI Agent 或自动化系统读取操作说明与任务上下文，但不是看板基础功能的前提。

## 文档入口

- [安装指南](./docs/INSTALL.md)
- [看板使用说明](./docs/USAGE.md)
- [部署指南](./docs/DEPLOY.md)
- [开发流程](./docs/DEVELOPMENT_WORKFLOW.md)
- [产品需求文档](./docs/PRD.md)

## 技术栈

- 前端：React 18 + TypeScript + Vite + Tailwind CSS
- 后端：Node.js + Express + WebSocket + TypeScript
- 存储：JSON + Markdown

## 当前说明

当前仓库仍保留一部分 Agent 相关初始化说明和实验性扩展接口。它们可以继续作为附加能力存在，但这个项目的核心定位已经收口为通用项目看板与任务监控系统。
