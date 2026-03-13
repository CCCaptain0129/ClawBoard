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

*此文件记录工具使用方式*