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

3. 给 Agent 初始化（核心）

**方式一：使用页面指引（推荐）**
- 访问看板后，点击 `给 Agent 的说明` 页面
- 点击"复制 AGENTS.md 文档"按钮
- 粘贴到 Agent 对话中，让 Agent 阅读理解

**方式二：直接使用模板**
- 参考 [AGENTS.md 模板](./docs/AGENTS_TEMPLATE.md)
- 复制模板内容到你的 AGENTS.md
- 根据实际情况调整项目名称和目录

**方式三：手动配置**
在 Agent 的 AGENTS.md 中添加以下内容：

```markdown
## ClawBoard 集成

### 数据源配置
- 真源规则：GET http://127.0.0.1:3000/api/tasks/source-of-truth
- 项目列表：GET http://127.0.0.1:3000/api/tasks/projects
- 项目任务：GET http://127.0.0.1:3000/api/tasks/projects/:projectId/tasks

### 工作流程
1. 读取看板规则和项目真源
2. 创建或更新项目/任务（优先使用 API）
3. 持续更新任务状态（todo → in-progress → review → done）
```

4. 如何设置 OpenClaw 自动实现任务调度（可选）

【风险提示】  
开启 OpenClaw 自动任务调度后，系统会主动创建 SubAgent 来执行任务（包括 `todo` 任务，以及 `in-progress` 且未被认领的任务）。  
开启前请先确认：你已经检查过当前项目中的任务内容，并接受自动执行带来的代码/文档变更风险。

设置步骤：
1. 启动服务：`./clawboard start`
2. 在顶部开启：`自动调度：开`
3. 在目标项目开启：`Agent 自动调度：开`
4. 创建任务时保持：`执行模式 = 可自动派发（auto）`
5. 将需要执行的任务放到：`todo`
6. 在任务卡片和 Agent 看板中观察是否出现 SubAgent

错误排查：
1. 全局自动调度未开启：检查顶部开关是否为“开”。
2. 项目自动调度未开启：检查项目卡片内“Agent 自动调度”是否为“开”。
3. 任务执行模式错误：任务若为 `manual`，不会自动派发。请改为 `auto`。
4. 任务已被占用：若任务 `claimedBy` 非空，说明已被认领，不会重复派发。
5. 任务信息不完整：任务缺少目标/交付物/验收标准时，可能被过滤。
6. 依赖未完成：有依赖任务且未完成时，不会派发当前任务。
7. 并发已满：当前运行中的 SubAgent 达到上限时，新任务会等待下一轮。
8. 查看调度日志：`tmp/logs/pm-dispatcher.log`，日志里会直接给出“未派发原因”。

5. 常见运维命令
```bash
./clawboard status   # 查看服务状态
./clawboard stop     # 停止服务
./clawboard restart  # 重启服务
```

6. 让看板可被外部访问（服务器场景）

默认情况下，前端通常只监听本机地址，外部设备无法直接访问。  
如果你需要在服务器上运行并通过 IP 远程查看，请按以下步骤调整：

macOS / Linux:
1. 编辑 [`scripts/cli/start.sh`](./scripts/cli/start.sh)
2. 将 `FRONTEND_HOST="127.0.0.1"` 改为 `FRONTEND_HOST="0.0.0.0"`
3. 重启服务：`./clawboard restart`
4. 使用 `http://<服务器IP>:5173` 访问

Windows:
1. 编辑 [`scripts/cli/start.bat`](./scripts/cli/start.bat)
2. 将前端启动命令改为带 host 参数（`npm run dev -- --host 0.0.0.0`）
3. 重新启动服务：`clawboard.bat start`
4. 使用 `http://<服务器IP>:5173` 访问

注意事项（强烈建议）：
1. 至少保留 `BOARD_ACCESS_TOKEN` 访问码鉴权（默认已启用）。
2. 服务器防火墙仅放行必要端口（通常只需 `5173`）。
3. 不建议直接暴露到公网，建议放在内网/VPN 下使用。
4. 如需公网访问，建议增加 Nginx + HTTPS + IP 白名单。

## 任务目录约定

- 开源默认任务运行态目录为项目内 `tasks/`（安装脚本会写入 `.env` 的 `OPENCLAW_VIS_TASKS_ROOT=tasks`）。
- 前端与后端都以该目录下的 `tasks/*.json` 作为任务运行态真源。
- 如需自定义目录，可手动修改 `.env` 中的 `OPENCLAW_VIS_TASKS_ROOT`。

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

- **快速开始**：本文档的上文"快速开始（3 分钟）"章节
- [Agent 初始化模板](./docs/AGENTS_TEMPLATE.md) - 给负责项目管理的 OpenClaw Agent 的完整使用说明
- [用户指南](./docs/USER_GUIDE.md) - 完整使用手册
- [安装指南](./docs/INSTALL.md)
- [使用说明](./docs/USAGE.md)
- [部署指南](./docs/DEPLOY.md)
- [开发流程](./docs/DEVELOPMENT_WORKFLOW.md)

## 技术栈

- 前端：React 18 + TypeScript + Vite + Tailwind CSS
- 后端：Node.js + Express + WebSocket + TypeScript
- 数据：JSON + Markdown
