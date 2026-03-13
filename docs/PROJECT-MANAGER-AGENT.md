# Project Manager Agent 调度系统

> 版本: 1.0.0 | 最后更新: 2026-03-13

## 概述

Project Manager Agent（简称 PM-Agent）是一个自动化的任务调度系统，用于：

1. **自动监控任务状态** - 检测 `in-progress` 且未分配的任务
2. **生成高质量 Prompt** - 根据任务信息和全局约束生成执行指令
3. **自动创建 Subagent** - 通过 OpenClaw Gateway 或 API 创建执行代理
4. **记录执行日志** - 完整记录任务分配和 Prompt 生成历史

## 快速开始

### 1. 启动服务

```bash
# 启动后端和前端
./start.sh

# 或单独启动 PM-Agent 调度器
node scripts/pm-agent-dispatcher.mjs
```

### 2. 验收流程

1. 在看板中将某个 `todo` 任务点击"开始"（状态变为 `in-progress`）
2. 确保任务的 `claimedBy` 字段为空
3. 等待 1 个轮询周期（默认 30 秒）
4. 自动出现 `claimedBy=subagent...`，subagent 启动
5. 看板卡片显示分配的 subagent
6. 完成后自动标记为 `done`

### 3. 查看日志

```bash
# 调度日志
cat tmp/logs/pm-dispatcher.log

# Prompt 日志
cat tmp/logs/pm-prompts.log

# 分发记录
cat docs/internal/SUBAGENTS任务分发记录.md
```

## 配置

### 配置文件

位置：`config/pm-agent-dispatcher.json`

```json
{
  "projectAllowlist": [],
  "pollIntervalMs": 30000,
  "maxConcurrent": 3,
  "backendUrl": "http://localhost:3000",
  "globalConstraints": {
    "codeStyle": "TypeScript/Node.js，遵循项目现有代码风格",
    "commitStyle": "conventional commits",
    "testRequired": false,
    "docRequired": true,
    "timeoutMinutes": 30,
    "defaultModel": "bailian/glm-4.7"
  }
}
```

### 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `projectAllowlist` | string[] | [] | 允许调度的项目 ID 列表（空=全部） |
| `pollIntervalMs` | number | 30000 | 轮询间隔（毫秒），最小 5000 |
| `maxConcurrent` | number | 3 | 最大并发 subagent 数量，范围 1-10 |
| `backendUrl` | string | http://localhost:3000 | 后端 API 地址 |
| `tasksDir` | string | ./tasks | 任务数据目录 |
| `logsDir` | string | ./tmp/logs | 日志目录 |
| `promptLogFile` | string | ./tmp/logs/pm-prompts.log | Prompt 日志文件 |
| `dispatchRecordFile` | string | ./docs/internal/SUBAGENTS任务分发记录.md | 分发记录文件 |

### 全局约束配置

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `codeStyle` | string | 代码风格要求 |
| `commitStyle` | string | 提交信息格式 |
| `testRequired` | boolean | 是否要求编写测试 |
| `docRequired` | boolean | 是否要求更新文档 |
| `timeoutMinutes` | number | 任务超时时间（分钟） |
| `defaultModel` | string | 默认使用的模型 |

## 使用方式

### 命令行

```bash
# 持续运行（守护模式）
node scripts/pm-agent-dispatcher.mjs

# 单次执行
node scripts/pm-agent-dispatcher.mjs --once

# 使用自定义配置
node scripts/pm-agent-dispatcher.mjs --config ./my-config.json
```

### 作为 OpenClaw Heartbeat

在 `~/.openclaw/agents/project-manager/HEARTBEAT.md` 中配置：

```markdown
# 心跳任务

每次心跳时执行调度脚本：

```bash
cd /path/to/openclaw-visualization
node scripts/pm-agent-dispatcher.mjs --once
```
```

### 通过 OpenClaw run

```bash
openclaw run --agent project-manager --script scripts/pm-agent-dispatcher.mjs
```

## 启用/停用

### 启用

1. **通过配置启用**

编辑 `~/.openclaw/openclaw.json`，确保 `project-manager` agent 的 `heartbeat` 配置正确：

```json
{
  "agents": {
    "list": [{
      "id": "project-manager",
      "heartbeat": {
        "every": "5m"
      }
    }]
  }
}
```

2. **通过命令启动**

```bash
# 后台运行
nohup node scripts/pm-agent-dispatcher.mjs > tmp/logs/pm-dispatcher.out 2>&1 &
```

### 停用

1. **停止后台进程**

```bash
# 查找进程
ps aux | grep pm-agent-dispatcher

# 终止进程
kill <pid>
```

2. **禁用 Heartbeat**

编辑 `~/.openclaw/openclaw.json`，注释或删除 `heartbeat` 配置：

```json
{
  "agents": {
    "list": [{
      "id": "project-manager",
      "heartbeat": null
    }]
  }
}
```

## 调参指南

### 轃询间隔

- **快速响应**: 设置为 10000ms（10秒），适合开发调试
- **标准配置**: 30000ms（30秒），平衡性能和响应
- **节能模式**: 60000ms（1分钟），减少资源消耗

### 并发控制

- **低配机器**: maxConcurrent = 1
- **标准配置**: maxConcurrent = 3
- **高性能**: maxConcurrent = 5-10

### 项目过滤

如果只想让 PM-Agent 处理特定项目：

```json
{
  "projectAllowlist": ["openclaw-visualization", "pm-workflow-automation"]
}
```

## 任务分配流程

```
┌─────────────────────────────────────────────────────────────┐
│                    PM-Agent 调度流程                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 轮询检查                                                 │
│     └── 读取所有项目任务                                      │
│     └── 筛选 status=in-progress && claimedBy=null           │
│                                                             │
│  2. 并发控制                                                 │
│     └── 检查运行中 subagent 数量                             │
│     └── 是否达到 maxConcurrent 上限                          │
│                                                             │
│  3. 任务排序                                                 │
│     └── 按优先级排序：P0 > P1 > P2 > P3                      │
│                                                             │
│  4. Prompt 生成                                              │
│     └── 合并全局约束 + 任务信息                               │
│     └── 记录到 pm-prompts.log                                │
│                                                             │
│  5. Subagent 创建                                            │
│     └── 尝试 WebSocket 方式                                  │
│     └── 失败则回退到 API 方式                                │
│                                                             │
│  6. 状态更新                                                 │
│     └── 更新任务 claimedBy                                   │
│     └── 记录分发到 SUBAGENTS任务分发记录.md                   │
│                                                             │
│  7. 监控完成                                                 │
│     └── SubagentMonitorService 自动检测完成                  │
│     └── 自动更新任务状态为 done                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 日志说明

### pm-dispatcher.log

记录调度器的运行日志：

```
[2026-03-13T14:30:00.000Z] [INFO] 开始调度检查...
[2026-03-13T14:30:00.100Z] [INFO] 发现 2 个待分配任务
[2026-03-13T14:30:00.200Z] [INFO] 当前运行中 subagent: 1
[2026-03-13T14:30:00.300Z] [INFO] 处理任务: VIS-029 [P1] 实现新功能
[2026-03-13T14:30:01.500Z] [INFO] ✓ 任务 VIS-029 已分配给 agent:main:subagent:xxx
```

### pm-prompts.log

记录生成的 Prompt，便于回溯：

```
================================================================================
时间: 2026-03-13T14:30:00.500Z
任务 ID: VIS-029
Subagent ID: agent:main:subagent:xxx
================================================================================

# 任务: 实现新功能

## 基本信息
- **任务 ID**: VIS-029
...
```

## 故障排查

### 问题：任务没有被分配

检查清单：
1. 任务状态是否为 `in-progress`？
2. 任务的 `claimedBy` 是否为空？
3. 调度器是否在运行？
4. 是否达到并发上限？
5. 项目是否在 `projectAllowlist` 中？

### 问题：Subagent 创建失败

检查清单：
1. Gateway 是否运行？`openclaw gateway status`
2. Gateway Token 是否正确配置？
3. 后端服务是否运行？`curl http://localhost:3000/api/tasks/projects`
4. 查看错误日志：`tmp/logs/pm-dispatcher.log`

### 问题：任务完成后状态未更新

检查清单：
1. SubagentMonitorService 是否运行？
2. `docs/internal/SUBAGENTS任务分发记录.md` 是否存在？
3. 查看 sessions.json：`~/.openclaw/agents/main/sessions/sessions.json`

## API 集成

### 获取待分配任务

```bash
curl http://localhost:3000/api/tasks/projects/openclaw-visualization/tasks?status=in-progress
```

### 手动创建 Subagent

```bash
curl -X POST http://localhost:3000/api/tasks/subagent/create \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "openclaw-visualization",
    "taskId": "VIS-029",
    "taskTitle": "实现新功能",
    "taskDescription": "详细描述..."
  }'
```

### 更新任务状态

```bash
curl -X PUT http://localhost:3000/api/tasks/projects/openclaw-visualization/tasks/VIS-029 \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'
```

## 相关文档

- [安装指南](./INSTALL.md)
- [用户指南](./USER_GUIDE.md)
- [架构设计](./ARCHITECTURE.md)
- [OpenClaw 集成](./OPENCLAW_INTEGRATION.md)

---

*此文档由 PM-Agent-Dispatcher 自动生成并维护*