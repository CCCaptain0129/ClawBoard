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

1. 克隆仓库并进入目录：
```bash
git clone https://github.com/CCCaptain0129/ClawBoard.git
cd ClawBoard
```

2. 安装依赖与初始化：
```bash
./clawboard install
```

3. 启动服务：
```bash
./clawboard start
```

4. 打开看板：
- 前端：[http://127.0.0.1:5173](http://127.0.0.1:5173)
- 后端：[http://127.0.0.1:3000](http://127.0.0.1:3000)

首次访问需要输入 `.env` 中的 `BOARD_ACCESS_TOKEN`。
如果不确定 token 是什么，可在服务器上执行：
```bash
./clawboard token
```

停止服务：
```bash
./clawboard stop
```

快速检查服务状态：
```bash
./clawboard status
```

脚本位置说明：底层脚本已收敛到 `scripts/cli/`，推荐统一使用 `./clawboard`。

## 首次使用（用户视角）

1. 登录看板  
访问 `http://127.0.0.1:5173`，输入访问码进入系统。  
不会找访问码时，在服务器执行：
```bash
./clawboard token
```

2. 管理任务  
点击顶部 `任务看板`，可查看 `待处理 / 进行中 / 待审核 / 已完成` 四列。  
点击任务卡片可展开详情、填写负责人并保存，再通过按钮推进状态（如 `开始 →`）。

3. 使用自动调度（可选）  
如果希望系统自动分派任务，按顺序操作：  
先让 OpenClaw 主 Agent 阅读面板中的 `主 Agent 初始化` 页面（或直接复制该页指引给它），确保它理解看板规则与任务真源；  
然后开启顶部 `全局自动调度`，再开启项目内 `本项目自动调度`，最后将任务切换到 `进行中`。

推荐最顺滑流程：
1. 先在 `主 Agent 初始化` 页面完成一次初始化对话  
2. 再让 Agent 开始创建/拆解任务  
3. 最后开启自动调度，让系统接管分派

4. 常见运维命令
```bash
./clawboard status   # 查看服务状态
./clawboard stop     # 停止服务
./clawboard restart  # 重启服务
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
└── scripts/
    ├── cli/              # install/start/stop/verify 脚本
    └── pm-agent-dispatcher.mjs
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
