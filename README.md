# ClawBoard

> 项目看板与任务监控应用，适配 OpenClaw，也可用于通用人机协作流程。

`ClawBoard` 是一个轻量、可自托管的项目执行看板。  
它将「任务流转」「负责人协作」「Agent/subagent 运行监控」放在同一个界面，并通过 API 与自动化系统对接。

## 为什么用 ClawBoard

- 状态清晰：`todo / in-progress / review / done` 全流程可视化
- 协作直接：任务可手动分配负责人，支持人类与 Agent 混合执行
- 监控实时：追踪 Agent/subagent 活跃度、最近更新与执行风险
- 控制简单：支持自动调度开关（全局 + 项目级）
- API-first：OpenClaw 可直接接入，也支持其他自动化系统

## 快速开始（3 分钟）

1. 安装依赖与初始化：
```bash
./install.sh
```

2. 启动服务：
```bash
./start.sh
```

3. 打开看板：
- 前端：[http://127.0.0.1:5173](http://127.0.0.1:5173)
- 后端：[http://127.0.0.1:3000](http://127.0.0.1:3000)

首次访问需要输入 `.env` 中的 `BOARD_ACCESS_TOKEN`。

停止服务：
```bash
./stop.sh
```

## 数据真源（Source of Truth）

- 前端仅做可视化，不作为最终真源
- 外部 Agent 建议通过 API 读写（API-first）
- 服务端任务真源为 `tasks/*.json`
- 全局真源入口：`GET /api/tasks/source-of-truth`
- 项目真源入口：`GET /api/tasks/projects/:projectId/source-of-truth`

## 常用 API

- `GET /api/tasks/projects`
- `GET /api/tasks/projects/:projectId/tasks`
- `POST /api/tasks/projects/:projectId/tasks`
- `PUT /api/tasks/projects/:projectId/tasks/:taskId`
- `DELETE /api/tasks/projects/:projectId/tasks/:taskId`
- `GET /api/dispatcher/status`
- `POST /api/dispatcher/mode`

## 目录结构

```text
openclaw-visualization/
├── src/frontend/         # 前端
├── src/backend/          # 后端
├── tasks/                # 项目与任务真源
├── docs/                 # 文档
└── scripts/              # 调度与脚本
```

## 文档入口

- [安装指南](./docs/INSTALL.md)
- [使用说明](./docs/USAGE.md)
- [部署指南](./docs/DEPLOY.md)
- [开发流程](./docs/DEVELOPMENT_WORKFLOW.md)

## 技术栈

- 前端：React 18 + TypeScript + Vite + Tailwind CSS
- 后端：Node.js + Express + WebSocket + TypeScript
- 数据：JSON + Markdown
