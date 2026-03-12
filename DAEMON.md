# OpenClaw Visualization 守护进程文档

## 概述

守护进程系统提供了持续运行模式，确保后端和前端服务在崩溃后能够自动重启，保持服务的稳定性。

## 文件结构

```
openclaw-visualization/
├── watch.sh / watch.bat              # 监控脚本
├── daemon-start.sh / daemon-start.bat  # 守护进程启动脚本
├── daemon-stop.sh / daemon-stop.bat    # 守护进程停止脚本
├── start.sh / start.bat              # 服务启动脚本（已有）
├── stop.sh / stop.bat                # 服务停止脚本（已有）
└── tmp/
    ├── watch.pid                     # 监控脚本进程 PID
    ├── watch.log                     # 监控脚本运行日志
    ├── restart-history.log           # 服务重启历史记录
    ├── backend.pid                   # 后端服务进程 PID
    ├── frontend.pid                  # 前端服务进程 PID
    └── frontend.port                 # 前端服务实际端口
```

## 快速开始

### macOS/Linux

```bash
# 启动守护进程
./daemon-start.sh

# 停止守护进程
./daemon-stop.sh
```

### Windows

```cmd
REM 启动守护进程
daemon-start.bat

REM 停止守护进程
daemon-stop.bat
```

## 详细说明

### 1. 守护进程启动 (`daemon-start.sh`)

守护进程启动脚本会：

1. 检查监控脚本是否已在运行（防止重复启动）
2. 调用 `start.sh` 启动后端和前端服务
3. 使用 `nohup` 在后台启动监控脚本 `watch.sh`
4. 记录监控脚本的 PID 到 `tmp/watch.pid`

### 2. 监控脚本 (`watch.sh`)

监控脚本负责：

- 每隔一定时间（默认 30 秒）检查后端和前端服务状态
- 通过检查进程 PID 文件和健康检查端点确认服务状态
- 如果服务停止，自动调用 `start.sh` 重新启动
- 记录重启历史到 `tmp/restart-history.log`
- 支持重启次数限制，防止无限重启循环

### 3. 守护进程停止 (`daemon-stop.sh`)

守护进程停止脚本会：

1. 停止监控脚本
2. 调用 `stop.sh` 停止后端和前端服务
3. 清理所有 PID 文件

## 配置选项

可以通过创建 `tmp/watch.conf` 文件来自定义监控脚本的行为：

```bash
# 检查间隔（秒），默认 30 秒
CHECK_INTERVAL=30

# 最大重启次数，0 表示无限制，默认 10 次
MAX_RESTART_COUNT=10

# 重启计数窗口（秒），默认 3600 秒（1小时）
RESTART_WINDOW=3600

# 健康检查超时（秒），默认 5 秒
HEALTH_CHECK_TIMEOUT=5
```

创建配置文件示例：

```bash
# macOS/Linux
cat > tmp/watch.conf << EOF
CHECK_INTERVAL=60
MAX_RESTART_COUNT=5
RESTART_WINDOW=1800
EOF
```

```cmd
REM Windows
echo CHECK_INTERVAL=60 > tmp\watch.conf
echo MAX_RESTART_COUNT=5 >> tmp\watch.conf
echo RESTART_WINDOW=1800 >> tmp\watch.conf
```

## 日志文件

### 监控日志 (`tmp/watch.log`)

记录监控脚本的运行状态，包括：

- 监控脚本启动
- 检查间隔和配置
- 服务状态检查结果
- 重启操作记录

查看监控日志：

```bash
# macOS/Linux
tail -f tmp/watch.log

# Windows
type tmp\watch.log
```

### 重启历史 (`tmp/restart-history.log`)

记录所有服务重启操作，格式：

```
[2024-03-12 14:30:25] 后端服务 - 自动重启
[2024-03-12 14:35:10] 前端服务 - 自动重启
[2024-03-12 15:20:05] 后端服务 - 重启失败
```

查看重启历史：

```bash
# macOS/Linux
tail -f tmp/restart-history.log

# Windows
type tmp\restart-history.log
```

### 守护进程日志 (`tmp/daemon.log`)

记录守护进程启动脚本的输出。

查看守护进程日志：

```bash
# macOS/Linux
tail -f tmp/daemon.log

# Windows
type tmp\daemon.log
```

## 服务健康检查

监控脚本使用健康检查端点来确认服务状态：

- **后端服务**: `http://localhost:3000/health`
- **前端服务**: `http://localhost:5173`（或实际使用的端口）

如果健康检查失败，监控脚本会尝试重启服务。

## 重启机制

### 重启流程

1. 监控脚本发现服务停止或健康检查失败
2. 检查重启次数是否达到限制
3. 停止可能残留的进程
4. 清理端口占用
5. 调用服务启动命令
6. 等待服务启动
7. 执行健康检查确认重启成功

### 重启限制

为了防止服务无限重启循环，监控脚本支持重启次数限制：

- 在指定的时间窗口内（默认 1 小时）
- 如果重启次数达到上限（默认 10 次）
- 停止自动重启，等待手动干预

当重启次数达到上限时，需要：

1. 检查服务日志找出崩溃原因
2. 修复问题
3. 清理 `tmp/restart-history.log` 重置计数
4. 手动重启服务或守护进程

## 常用命令

### 查看进程状态

```bash
# 查看监控脚本 PID
cat tmp/watch.pid

# 查看后端服务 PID
cat tmp/backend.pid

# 查看前端服务 PID
cat tmp/frontend.pid

# 查看前端实际端口
cat tmp/frontend.port
```

### 手动管理服务

```bash
# 手动启动服务
./start.sh

# 手动停止服务
./stop.sh

# 手动重启服务
./stop.sh && ./start.sh
```

### 查看服务日志

```bash
# 查看后端日志
tail -f tmp/backend.log

# 查看前端日志
tail -f tmp/frontend.log
```

## 故障排查

### 守护进程无法启动

**症状**: 运行 `daemon-start.sh` 后守护进程未启动

**解决方案**:

1. 检查脚本是否有执行权限：
   ```bash
   chmod +x daemon-start.sh watch.sh
   ```

2. 查看守护进程日志：
   ```bash
   cat tmp/daemon.log
   ```

3. 确认 `start.sh` 可以正常启动服务

### 监控脚本停止工作

**症状**: 服务崩溃后没有自动重启

**解决方案**:

1. 检查监控脚本是否在运行：
   ```bash
   cat tmp/watch.pid
   ps -p $(cat tmp/watch.pid)
   ```

2. 查看监控日志：
   ```bash
   cat tmp/watch.log
   ```

3. 如果监控脚本已停止，重新启动守护进程：
   ```bash
   ./daemon-stop.sh
   ./daemon-start.sh
   ```

### 服务频繁重启

**症状**: 服务不断崩溃和重启，`restart-history.log` 中有大量记录

**解决方案**:

1. 检查服务日志找出崩溃原因：
   ```bash
   tail -100 tmp/backend.log
   tail -100 tmp/frontend.log
   ```

2. 常见原因：
   - 端口被其他程序占用
   - 依赖缺失或版本不兼容
   - 内存不足
   - 代码错误

3. 修复问题后，清理重启历史：
   ```bash
   rm tmp/restart-history.log
   ```

4. 重启守护进程：
   ```bash
   ./daemon-stop.sh
   ./daemon-start.sh
   ```

### 达到重启限制

**症状**: 监控日志显示 "重启次数已达上限，停止自动重启"

**解决方案**:

1. 检查重启历史：
   ```bash
   cat tmp/restart-history.log
   ```

2. 找出服务崩溃的根本原因

3. 调整配置（如需要）：
   ```bash
   # 增加重启限制
   echo "MAX_RESTART_COUNT=20" >> tmp/watch.conf
   ```

4. 清理重启历史重置计数：
   ```bash
   rm tmp/restart-history.log
   ```

5. 重新启动守护进程：
   ```bash
   ./daemon-stop.sh
   ./daemon-start.sh
   ```

### 端口冲突

**症状**: 服务无法启动，日志显示端口已被占用

**解决方案**:

1. 查看端口占用情况：
   ```bash
   # macOS/Linux
   lsof -i :3000
   lsof -i :3001
   lsof -i :5173

   # Windows
   netstat -ano | findstr ":3000"
   netstat -ano | findstr ":3001"
   netstat -ano | findstr ":5173"
   ```

2. 停止占用端口的进程或选择其他端口

3. 清理所有服务后重新启动：
   ```bash
   ./stop.sh
   ./daemon-stop.sh
   ./daemon-start.sh
   ```

## 最佳实践

1. **生产环境使用守护进程**: 长期运行的服务应使用守护进程模式

2. **合理配置检查间隔**:
   - 开发环境: 10-30 秒（快速发现问题）
   - 生产环境: 30-60 秒（减少资源消耗）

3. **设置重启限制**: 避免服务无限重启循环

4. **定期检查日志**:
   - 每天查看 `restart-history.log` 了解服务稳定性
   - 定期清理日志文件避免占用过多磁盘空间

5. **监控磁盘空间**:
   - 日志文件会持续增长
   - 定期清理或设置日志轮转

6. **使用版本控制**: 定期备份配置文件

## 高级用法

### 自定义启动命令

如果需要使用自定义命令启动服务，可以修改 `start.sh` 或创建自己的启动脚本。

### 多环境配置

为不同环境创建不同的配置文件：

```bash
# 开发环境
cp tmp/watch.conf tmp/watch.dev.conf

# 生产环境
cp tmp/watch.conf tmp/watch.prod.conf
```

启动时选择配置：

```bash
# 使用开发配置
cp tmp/watch.dev.conf tmp/watch.conf
./daemon-start.sh

# 使用生产配置
cp tmp/watch.prod.conf tmp/watch.conf
./daemon-start.sh
```

### 集成到系统服务

可以将守护进程集成到系统服务管理器中：

#### systemd (Linux)

创建 `/etc/systemd/system/openclaw-visualization.service`:

```ini
[Unit]
Description=OpenClaw Visualization Daemon
After=network.target

[Service]
Type=forking
User=your-user
WorkingDirectory=/path/to/openclaw-visualization
ExecStart=/path/to/openclaw-visualization/daemon-start.sh
ExecStop=/path/to/openclaw-visualization/daemon-stop.sh
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl enable openclaw-visualization
sudo systemctl start openclaw-visualization
```

#### launchd (macOS)

创建 `~/Library/LaunchAgents/com.openclaw.visualization.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.visualization</string>
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/openclaw-visualization/daemon-start.sh</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/openclaw-visualization</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

加载服务：

```bash
launchctl load ~/Library/LaunchAgents/com.openclaw.visualization.plist
```

#### Windows 服务

使用 NSSM (Non-Sucking Service Manager) 或类似工具将守护进程注册为 Windows 服务。

## 技术支持

如果遇到问题：

1. 查看日志文件获取错误信息
2. 参考本文档的故障排查章节
3. 检查项目的 GitHub Issues

## 许可证

本项目遵循 MIT 许可证。