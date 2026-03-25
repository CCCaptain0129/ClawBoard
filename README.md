# ClawBoard

> 项目看板与任务监控应用，适配 OpenClaw，也可用于通用人机协作流程。

`ClawBoard` 是一个轻量、可自托管的项目执行看板。
它将「任务流转」「负责人协作」「Agent/subagent 运行监控」放在同一个界面，并通过 API 与自动化系统对接。

## 为什么用 ClawBoard

- 状态清晰：`todo / in-progress / review / done` 全流程可视化
- 协作直接：任务可手动分配负责人，支持人类与 Agent 混合执行
- 监控实时：追踪 Agent/subagent 活跃度、最近更新与执行风险
- 控制简单：保持最小链路，任务创建与状态流转可直接在看板完成；调度由 Agent 侧 cron/heartbeat 驱动
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

4. 如何让 OpenClaw Agent 执行任务（推荐）

当前版本不再内置自动派发进程，改为 **Agent 主导调度**。推荐流程是：
1. 在看板创建任务，并补全目标/交付物/验收标准。
2. 在“给 Agent 的说明”页面复制 `AGENTS.md` 指引给你的项目管理 Agent。
3. 为该 Agent 配置定时触发（cron 或 heartbeat），按固定周期执行一轮调度检查。
4. 调度检查时，Agent 按规则筛选任务并创建 SubAgent 执行。
5. SubAgent 返回完成信号后，项目管理 Agent 将任务推进到 `review`，验收通过后再到 `done`。

建议的调度周期：
- 常规项目：每 5 分钟一轮
- 高实时项目：每 1-2 分钟一轮（注意并发与成本）

5. 使用 ClawHub 技能实现自动调度（推荐）

如果你希望 Agent 自动检查待办并创建 SubAgent，可安装 `task-dispatch` 技能。

前置条件：
- ClawBoard 已部署并可访问（默认 `http://127.0.0.1:3000`）
- 已获取 `BOARD_ACCESS_TOKEN`（查看项目根目录 `.env`，或通过 ClawBoard API 获取）

安装技能：
```bash
clawhub install task-dispatch
```

在 Agent workspace 配置环境变量：
```bash
export TASKBOARD_API_URL=http://127.0.0.1:3000
export TASKBOARD_ACCESS_TOKEN=your-token-here
```

创建可自动派发任务（关键是 `executionMode: "auto"`）：
```bash
curl -X POST http://127.0.0.1:3000/api/tasks/projects/my-project/tasks \
  -H "Authorization: Bearer $TASKBOARD_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "创建 README 文档",
    "description": "为项目创建 README.md 说明文档",
    "status": "todo",
    "executionMode": "auto",
    "priority": "P2",
    "deliverables": ["docs/README.md"],
    "acceptanceCriteria": [
      "文件已创建",
      "包含项目标题和简介"
    ]
  }'
```

启用自动调度（给 Agent 的指令示例）：
- “设置每 5 分钟自动检查任务看板”

执行流程：
1. Agent 检查看板任务
2. 筛选 `executionMode=auto` 且 `status=todo`（并满足可派发条件）任务
3. 创建 SubAgent 执行任务
4. SubAgent 返回结果
5. Agent 验收交付物
6. 任务进入 `review`
7. 继续下一任务

手动触发（不等 cron）：
- “检查任务看板，派发所有待执行任务”
- “查看当前任务调度状态”

任务状态说明：
- `todo`：待处理，可被自动派发
- `in-progress`：执行中
- `review`：待审核
- `done`：已完成
- `failed`：执行失败

验收任务：
- 查看 `deliverables` 对应产物
- 通过后将任务更新为 `done`（也可让 Agent代为验收）
- 未通过则给出修改意见并重新执行

API 验收通过示例：
```bash
curl -X PUT http://127.0.0.1:3000/api/tasks/projects/my-project/tasks/TASK-001 \
  -H "Authorization: Bearer $TASKBOARD_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'
```

注意事项：
- `executionMode=manual` 不会自动派发
- 有 `assignee` 的任务默认不自动派发
- 依赖未完成的任务不会派发
- 任务完成先进入 `review`，验收后再 `done`

6. 常见运维命令
```bash
./clawboard status   # 查看服务状态
./clawboard stop     # 停止服务
./clawboard restart  # 重启服务
```

7. 让看板可被外部访问（服务器场景）

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

## 目录结构

```text
openclaw-visualization/
├── src/frontend/         # 前端
├── src/backend/          # 后端
├── tasks/                # 项目与任务真源
├── docs/                 # 文档
└── scripts/
    └── cli/              # install/start/stop/verify 脚本
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
