# TOOLS.md - Project Manager Agent 工具配置

## 可用工具

### OpenClaw CLI

```bash
# 检查 Gateway 状态
openclaw gateway status

# 启动 Gateway
openclaw gateway start

# 绑定群组
openclaw bind feishu --group <group_id>
```

### 心跳脚本

位置：`__PROJECT_ROOT__/scripts/heartbeat-loop.mjs`

```bash
cd __PROJECT_ROOT__/scripts
node heartbeat-loop.mjs
```

### 任务 API

后端地址：`http://localhost:3000`

```bash
# 获取待办任务
curl http://localhost:3000/api/tasks/todo

# 创建 subagent
curl -X POST http://localhost:3000/api/tasks/subagent/create

# 更新任务状态
curl -X PATCH http://localhost:3000/api/tasks/<task_id>
```

## 配置文件

### 后端配置

位置：`__PROJECT_ROOT__/src/backend/config/openclaw.json`

```json
{
  "gateway": {
    "url": "ws://127.0.0.1:18789",
    "token": "<GATEWAY_TOKEN>"
  },
  "feishu": {
    "appId": "<APP_ID>",
    "appSecret": "<APP_SECRET>"
  }
}
```

### OpenClaw 主配置

位置：`~/.openclaw/openclaw.json`

包含 agent 定义和绑定配置。

## 端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| Gateway | 18789 | OpenClaw Gateway WebSocket |
| 后端 HTTP | 3000 | REST API |
| 后端 WS | 3001 | 实时通信 |
| 前端 | 5173 | Vite 开发服务器 |

---

## 文档索引

### 项目管理文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 项目管理规范 | `project-management/PROJECT-MANAGEMENT-GUIDE.md` | 项目工作流程、记忆管理、进度监控机制 |
| 任务分解指引 | `project-management/task-breakdown-guide.md` | 如何编写高质量的任务描述，减少 subagent tokens 消耗 |

### 技术文档

| 文档 | 路径 | 说明 |
|------|------|------|
| Dispatcher 优化思路 | `docs/pm-agent-dispatcher-optimization.md` | 调度器设计思路、优化历程和未来计划 |
| Prompt 可见性方案 | `docs/project-manager-prompt-visibility.md` | 如何让用户看到 subagent 收到的完整 prompt |

### 部署指南

| 文档 | 路径 | 说明 |
|------|------|------|
| 多群组部署指南 | `docs/MULTI-GROUP-DEPLOYMENT.md` | 如何在多个飞书群组中使用项目管理自动化流程 |

### 快速访问

```bash
# 查看项目管理规范
cat project-management/PROJECT-MANAGEMENT-GUIDE.md

# 查看任务分解指引
cat project-management/task-breakdown-guide.md

# 查看多群组部署指南
cat docs/MULTI-GROUP-DEPLOYMENT.md

# 查看优化思路
cat docs/pm-agent-dispatcher-optimization.md
```

---

*此文件记录工具使用方式*