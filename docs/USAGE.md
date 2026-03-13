# OpenClaw Visualization 启动脚本使用说明

## 概述

`start.sh` 是 OpenClaw Visualization 项目的一键启动脚本，它能够自动启动前端和后端服务，并确保不会出现多个实例同时运行的问题。

## 主要特性

- ✅ **单实例保障**：确保不会出现多个后端或前端实例同时运行
- ✅ **智能停止旧实例**：优先使用 pidfile 判断并停止旧进程，兜底使用命令行模式匹配
- ✅ **温和 kill + 强制 kill**：先尝试温和停止进程，超时后强制停止
- ✅ **健康检查**：启动后自动检查服务是否正常
- ✅ **日志管理**：stdout/stderr 定向到 tmp 目录下的日志文件
- ✅ **幂等性**：多次运行脚本不会堆积进程

## 使用方法

### 启动服务

```bash
cd /Users/ot/.openclaw/workspace/projects/openclaw-visualization
./start.sh
```

### 以守护进程模式启动

```bash
./start.sh --daemon
```

守护进程模式会自动监控服务状态，异常时自动重启。

### 停止服务

```bash
./stop.sh
```

## 工作原理

### 1. 启动后端服务

1. **停止旧实例**：
   - 优先使用 `tmp/backend.pid` 判断并停止旧进程
   - 兜底：按命令行模式匹配 `ts-node src/index.ts` 进程并逐个 kill
   - 温和 kill（等待 5 秒）后仍存活则 `kill -9`

2. **检查端口**：
   - 再次检查端口 3000 和 3001 是否被占用
   - 如果仍被占用，强制停止占用进程

3. **启动新实例**：
   - 执行 `npm run dev`（实际是 `ts-node src/index.ts`）
   - 将 stdout/stderr 重定向到 `tmp/backend.log`
   - 将 PID 写入 `tmp/backend.pid`

4. **健康检查**：
   - 等待最多 20 秒（10 次重试，每次 2 秒）
   - 检查 `http://localhost:3000/health` 是否可访问
   - 如果失败，清理 PID 文件并退出

### 2. 启动前端服务

流程与后端类似，但会自动检测 Vite 使用的实际端口（可能是 5173、5174 等）。

## 文件说明

| 文件 | 说明 |
|------|------|
| `tmp/backend.pid` | 后端进程 PID |
| `tmp/frontend.pid` | 前端进程 PID |
| `tmp/frontend.port` | 前端实际使用的端口 |
| `tmp/backend.log` | 后端日志 |
| `tmp/frontend.log` | 前端日志 |
| `tmp/daemon.log` | 守护进程日志（仅守护模式） |
| `tmp/restart-history.log` | 重启历史记录（仅守护模式） |

## 常见问题

### Q: 为什么会出现多个实例？

A: 可能的原因：
- 手动多次执行 `npm run dev`
- 之前崩溃的进程没有正确停止
- PID 文件丢失但进程仍在运行

### Q: 如何确认只有一个实例在运行？

A: 检查 PID 文件和进程：
```bash
cat tmp/backend.pid
ps -p $(cat tmp/backend.pid)
```

### Q: 启动失败怎么办？

A: 查看日志文件：
```bash
tail -f tmp/backend.log
tail -f tmp/frontend.log
```

### Q: 如何强制清理所有进程？

A: 执行停止脚本：
```bash
./stop.sh
```

## 开发体验

脚本不会破坏现有开发体验：
- 仍然可以手动运行 `npm run dev`
- 仍然可以使用 `ts-node src/index.ts`
- 脚本会自动检测并清理手动启动的进程
- 支持热重载（nodemon）

## 验收步骤

### 1. 基础启动测试

```bash
# 清理所有旧进程
./stop.sh

# 启动服务
./start.sh

# 检查后端 PID 文件
cat tmp/backend.pid
ps -p $(cat tmp/backend.pid)

# 检查后端健康状态
curl http://localhost:3000/health

# 检查前端
curl http://localhost:5173
```

### 2. 多次启动测试

```bash
# 第一次启动
./start.sh

# 第二次启动（应该自动停止第一个）
./start.sh

# 检查是否只有一个后端进程
ps aux | grep "ts-node src/index.ts" | grep -v grep

# 应该只看到一个进程
```

### 3. 03→04 链路测试

```bash
# 确保服务正常
curl http://localhost:3000/health

# 模拟后端崩溃
kill -9 $(cat tmp/backend.pid)

# 重新启动（应该能正常启动）
./start.sh

# 再次检查健康状态
curl http://localhost:3000/health
```

### 4. 停止测试

```bash
# 启动服务
./start.sh

# 停止服务
./stop.sh

# 检查进程是否已清理
ps aux | grep "ts-node src/index.ts" | grep -v grep
ps aux | grep "vite" | grep -v grep

# 应该没有输出
```

### 5. 日志检查

```bash
# 启动服务
./start.sh

# 检查后端日志
tail tmp/backend.log

# 检查前端日志
tail tmp/frontend.log

# 停止服务
./stop.sh
```

## 技术细节

### 进程匹配模式

后端进程匹配：`pgrep -f "ts-node.*src/index.ts"`
前端进程匹配：`pgrep -f "vite.*--port"`

### 温和 kill 策略

```bash
kill $pid           # 发送 SIGTERM 信号
sleep 5             # 等待 5 秒
if ps -p $pid; then
    kill -9 $pid    # 强制杀死进程
fi
```

### 健康检查策略

```bash
retries=0
while [ $retries -lt 10 ]; do
    if curl -s --max-time 5 "http://localhost:3000/health"; then
        return 0  # 成功
    fi
    sleep 2
    retries=$((retries + 1))
done
return 1  # 失败
```

## 版本历史

- **v2.0** (2026-03-13): 重构停止逻辑，确保单实例运行
- **v1.0** (2026-03-11): 初始版本