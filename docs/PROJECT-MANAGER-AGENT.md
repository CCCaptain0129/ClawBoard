# Project Manager Agent 调度系统

> 版本: 1.1.0 | 最后更新: 2026-03-13

## 概述

Project Manager Agent（简称 PM-Agent）是一个自动化的任务调度系统，用于：

1. **自动监控任务状态** - 检测 `in-progress` 且未分配的任务
2. **生成高质量 Prompt** - 根据任务信息和全局约束生成执行指令
3. **自动创建 Subagent** - 通过 OpenClaw Gateway 或 API 创建执行代理
4. **记录执行日志** - 完整记录任务分配和 Prompt 生成历史

## 快速开始

### 1. 启动服务

```bash
# 启动后端、前端和 PM-Agent Dispatcher
./start.sh

# 查看调度器状态
cat tmp/pm-dispatcher.pid

# 查看调度日志
tail -f tmp/logs/pm-dispatcher.log
```

### 2. 验收流程

1. 在看板中将某个 `todo` 任务点击"开始"（状态变为 `in-progress`）
2. 确保任务的 `claimedBy` 字段为空
3. 等待 1 个轮询周期（默认 10 秒）
4. 自动出现 `claimedBy=subagent...`，subagent 启动
5. 看板卡片显示分配的 subagent
6. 完成后自动标记为 `done`

### 3. 查看日志

```bash
# 调度日志
tail -f tmp/logs/pm-dispatcher.log

# Prompt 日志
cat tmp/logs/pm-prompts.log

# 标准输出日志
tail -f tmp/logs/pm-dispatcher.out

# 分发记录
cat docs/internal/SUBAGENTS任务分发记录.md
```

## 运行模式

### Watch 模式（常驻轮询）

默认模式，启动后持续轮询任务：

```bash
# 启动 watch 模式（默认 10 秒间隔）
node scripts/pm-agent-dispatcher.mjs --watch

# 自定义轮询间隔（30 秒）
node scripts/pm-agent-dispatcher.mjs --watch --interval 30

# 指定 PID 文件
node scripts/pm-agent-dispatcher.mjs --watch --pidfile tmp/my-dispatcher.pid
```

### Once 模式（单次执行）

执行一次调度后退出：

```bash
# 单次执行
node scripts/pm-agent-dispatcher.mjs --once
```

### 通过启动脚本

推荐通过 `start.sh` 启动，会自动启动 Dispatcher：

```bash
# 启动所有服务（包括 Dispatcher）
./start.sh

# 自定义轮询间隔（环境变量）
DISPATCHER_INTERVAL=30 ./start.sh

# 停止所有服务
./stop.sh
```

## 配置

### 配置文件

位置：`config/pm-agent-dispatcher.json`

```json
{
  "projectAllowlist": [],
  "pollIntervalMs": 10000,
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
| `pollIntervalMs` | number | 10000 | 轮询间隔（毫秒），最小 1000 |
| `maxConcurrent` | number | 3 | 最大并发 subagent 数量，范围 1-10 |
| `backendUrl` | string | http://localhost:3000 | 后端 API 地址 |
| `tasksDir` | string | ./tasks | 任务数据目录 |
| `logsDir` | string | ./tmp/logs | 日志目录 |
| `promptLogFile` | string | ./tmp/logs/pm-prompts.log | Prompt 日志文件 |
| `dispatchRecordFile` | string | ./docs/internal/SUBAGENTS任务分发记录.md | 分发记录文件 |
| `pidFile` | string | ./tmp/pm-dispatcher.pid | PID 文件 |

### 全局约束配置

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `codeStyle` | string | 代码风格要求 |
| `commitStyle` | string | 提交信息格式 |
| `testRequired` | boolean | 是否要求编写测试 |
| `docRequired` | boolean | 是否要求更新文档 |
| `timeoutMinutes` | number | 任务超时时间（分钟） |
| `defaultModel` | string | 默认使用的模型 |

## 命令行参数

```bash
node scripts/pm-agent-dispatcher.mjs [选项]

选项:
  --watch, -w          以常驻模式运行（默认）
  --once, -o           执行一次调度后退出
  --interval, -i <秒>  轮询间隔，默认 10 秒（范围: 1-3600）
  --config, -c <文件>  使用指定配置文件
  --pidfile, -p <文件> 指定 PID 文件路径
  --help, -h           显示帮助信息
```

## 调参指南

### 轮询间隔

- **快速响应**: 设置为 5-10 秒，适合开发调试
- **标准配置**: 10-30 秒，平衡性能和响应
- **节能模式**: 60 秒，减少资源消耗

调整方式：

```bash
# 方式 1: 命令行参数
node scripts/pm-agent-dispatcher.mjs --watch --interval 30

# 方式 2: 环境变量（通过 start.sh 启动时）
DISPATCHER_INTERVAL=30 ./start.sh

# 方式 3: 配置文件
# 编辑 config/pm-agent-dispatcher.json，修改 pollIntervalMs
```

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

## 日志查看

### 调度日志 (pm-dispatcher.log)

记录调度器的运行状态：

```bash
tail -f tmp/logs/pm-dispatcher.log
```

输出示例：
```
[2026-03-13T14:30:00.000Z] [INFO] 启动 PM-Agent-Dispatcher (watch 模式)
[2026-03-13T14:30:00.000Z] [INFO] 配置: 轮询间隔=10000ms (10s), 最大并发=3
[2026-03-13T14:30:00.000Z] [INFO] PID: 12345
[2026-03-13T14:30:00.100Z] [INFO] 开始调度检查...
[2026-03-13T14:30:00.200Z] [INFO] 发现 2 个待分配任务
[2026-03-13T14:30:01.500Z] [INFO] ✓ 任务 VIS-029 已分配给 agent:main:subagent:xxx
```

### Prompt 日志 (pm-prompts.log)

记录生成的 Prompt，便于回溯：

```bash
cat tmp/logs/pm-prompts.log
```

### 标准输出日志 (pm-dispatcher.out)

Node.js 进程的标准输出和错误输出：

```bash
tail -f tmp/logs/pm-dispatcher.out
```

### PID 文件

查看当前运行的 Dispatcher PID：

```bash
cat tmp/pm-dispatcher.pid
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
│     └── 使用 OpenClaw Gateway RPC                            │
│     └── 创建 subagent session                                │
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

## 故障排查

### 问题：任务没有被分配

检查清单：
1. 任务状态是否为 `in-progress`？
2. 任务的 `claimedBy` 是否为空？
3. 调度器是否在运行？`cat tmp/pm-dispatcher.pid && ps -p $(cat tmp/pm-dispatcher.pid)`
4. 是否达到并发上限？
5. 项目是否在 `projectAllowlist` 中？
6. 查看调度日志：`tail -f tmp/logs/pm-dispatcher.log`

### 问题：Subagent 创建失败

检查清单：
1. Gateway 是否运行？`openclaw gateway status`
2. Gateway Token 是否正确配置？
3. 后端服务是否运行？`curl http://localhost:3000/api/tasks/projects`
4. 查看错误日志：`tail -f tmp/logs/pm-dispatcher.log`

### 问题：Dispatcher 无法启动

检查清单：
1. Node.js 版本是否 >= 18？`node --version`
2. 后端服务是否健康？`curl http://localhost:3000/health`
3. 日志目录是否可写？`ls -la tmp/logs`
4. 查看错误输出：`tail -f tmp/logs/pm-dispatcher.out`

### 问题：Dispatcher 进程意外退出

检查清单：
1. 查看最后的日志：`tail -20 tmp/logs/pm-dispatcher.log`
2. 检查系统日志：`dmesg | grep -i kill`
3. 检查是否被 OOM killer 杀掉：`dmesg | grep -i oom`
4. 重启服务：`./stop.sh && ./start.sh`

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
- [用户指南](./USAGE.md)
- [架构设计](./ARCHITECTURE.md)
- [OpenClaw 集成](./OPENCLAW_INTEGRATION.md)

---

*此文档由 PM-Agent-Dispatcher 自动生成并维护*