# OpenClaw Visualization 安装指南

> 让新用户在 15 分钟内启动可视化看板后端/前端

## 目录

- [快速开始](#快速开始)
- [环境要求](#环境要求)
- [安装步骤](#安装步骤)
- [配置说明](#配置说明)
- [启动服务](#启动服务)
- [验证服务](#验证服务)
- [常见问题](#常见问题)

---

## 快速开始

如果你已经熟悉 Node.js 环境，可以直接运行：

```bash
# 1. 克隆项目
git clone https://github.com/CCCaptain0129/OpenClaw_Visualization.git
cd OpenClaw_Visualization

# 2. 一键安装
./install.sh

# 3. 配置 Gateway Token（如果需要）
vim src/backend/config/openclaw.json

# 4. 启动服务
./start.sh

# 5. 访问应用
open http://localhost:5173
```

---

## 环境要求

### 必需

| 软件 | 最低版本 | 推荐版本 | 检查命令 |
|------|---------|---------|---------|
| Node.js | 18.x | 20.x LTS | `node --version` |
| npm | 8.x | 10.x | `npm --version` |

### 可选

| 软件 | 用途 |
|------|------|
| Git | 克隆项目、版本控制 |
| OpenClaw | 连接 OpenClaw Gateway（完整功能） |

### 操作系统支持

- ✅ macOS (Intel / Apple Silicon)
- ✅ Linux (Ubuntu, Debian, CentOS 等)
- ✅ Windows (使用 Git Bash 或 WSL)

---

## 安装步骤

### 步骤 1：安装 Node.js

#### macOS (Homebrew)

```bash
# 安装 Node.js
brew install node

# 验证安装
node --version   # 应显示 v18.x 或更高
npm --version    # 应显示 8.x 或更高
```

#### Linux (Ubuntu/Debian)

```bash
# 使用 NodeSource 安装 Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

#### Linux (CentOS/RHEL)

```bash
# 使用 NodeSource 安装 Node.js 20.x
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# 验证安装
node --version
npm --version
```

#### Windows

1. 访问 [Node.js 官网](https://nodejs.org/)
2. 下载 LTS 版本安装包
3. 运行安装程序
4. 打开 PowerShell 或 Git Bash 验证：
   ```powershell
   node --version
   npm --version
   ```

### 步骤 2：获取项目

```bash
# 克隆项目
git clone https://github.com/CCCaptain0129/OpenClaw_Visualization.git

# 进入项目目录
cd OpenClaw_Visualization
```

### 步骤 3：运行安装脚本

```bash
# 赋予执行权限
chmod +x install.sh

# 运行安装脚本
./install.sh
```

安装脚本会自动：
- ✅ 检查 Node.js/npm 版本
- ✅ 创建 `tmp/` 临时目录
- ✅ 检查/创建配置文件
- ✅ 安装后端依赖
- ✅ 安装前端依赖

### 安装脚本选项

```bash
# 仅检查环境（不安装依赖）
./install.sh --check-only

# 跳过依赖安装
./install.sh --skip-deps

# 显示帮助
./install.sh --help
```

---

## 配置说明

### 配置文件位置

```
src/backend/config/openclaw.json
```

### 配置项说明

| 配置项 | 必需 | 说明 |
|--------|------|------|
| `gateway.url` | 是 | OpenClaw Gateway WebSocket 地址 |
| `gateway.token` | 是 | Gateway Token |
| `feishu.appId` | 否 | 飞书应用 ID |
| `feishu.appSecret` | 否 | 飞书应用密钥 |

### 获取 Gateway Token

1. **启动 OpenClaw Gateway**
   ```bash
   # 检查 Gateway 状态
   openclaw gateway status
   
   # 如果未启动，启动 Gateway
   openclaw gateway start
   ```

2. **获取 Token**
   ```bash
   openclaw gateway status
   ```
   
   输出示例：
   ```
   Gateway Status: running
   Gateway URL: ws://127.0.0.1:18789
   Gateway Token: abc123def456...  ← 复制这个
   ```

3. **编辑配置文件**
   ```bash
   vim src/backend/config/openclaw.json
   ```
   
   ```json
   {
     "gateway": {
       "url": "ws://127.0.0.1:18789",
       "token": "your-gateway-token-here"  ← 粘贴 Token
     }
   }
   ```

### 配置优先级

```
环境变量 > 配置文件 > 默认值
```

**使用环境变量（可选）：**

```bash
export OPENCLAW_GATEWAY_URL="ws://127.0.0.1:18789"
export OPENCLAW_GATEWAY_TOKEN="your-gateway-token-here"
```

---

## 启动服务

### 普通模式（推荐开发）

```bash
# macOS/Linux
./start.sh

# Windows
start.bat
```

### 守护进程模式（推荐生产）

服务在后台运行，崩溃自动重启：

```bash
# macOS/Linux
./start.sh --daemon

# Windows
start.bat --daemon
```

### 启动后输出

```
==========================================
🎉 OpenClaw Visualization 已启动！
==========================================

📱 访问地址:
   前端: http://localhost:5173
   后端: http://localhost:3000
   WebSocket: ws://localhost:3001

📝 查看日志:
   后端: tail -f tmp/backend.log
   前端: tail -f tmp/frontend.log

🛑 停止服务: ./stop.sh
==========================================
```

### 停止服务

```bash
# macOS/Linux
./stop.sh

# Windows
stop.bat
```

---

## 验证服务

### 使用验证脚本

```bash
# 标准验证
./verify.sh

# 快速检查（仅端口）
./verify.sh --quick

# 完整检查（包含 API 端点）
./verify.sh --full
```

### 验证输出示例

```
╔══════════════════════════════════════════════════════════╗
║  OpenClaw Visualization 服务验证                         ║
╚══════════════════════════════════════════════════════════╝

[CHECK] 检查后端服务进程...
[✓] 后端服务正在运行 (PID: 12345, 进程: node)

[CHECK] 检查端口 3000 (后端 HTTP)...
[✓] 端口 3000 已被监听 (PID: 12345)

[CHECK] 验证后端健康检查...
[✓] 后端健康检查通过

═════════════════════════════════════════════════════════
服务状态摘要
═════════════════════════════════════════════════════════

  后端服务:     ✓ 正常
  前端服务:     ✓ 正常
  WebSocket:    ✓ 正常

✓ 所有服务运行正常！

  访问地址: http://localhost:5173
  后端 API: http://localhost:3000
```

### 手动验证

```bash
# 检查后端健康
curl http://localhost:3000/health
# 期望输出: {"status":"ok","timestamp":"..."}

# 检查文件监听服务
curl http://localhost:3000/api/file-watcher/status

# 检查同步锁服务
curl http://localhost:3000/api/sync-lock/status

# 检查前端
curl http://localhost:5173
# 期望输出: HTML 内容
```

---

## 常见问题

### Q: Node.js 版本过低怎么办？

**A:** 升级 Node.js 到 18 或更高版本：

```bash
# 使用 nvm
nvm install 20
nvm use 20

# 或使用 Homebrew (macOS)
brew upgrade node
```

### Q: 端口被占用怎么办？

**A:** 使用 stop.sh 停止旧实例：

```bash
./stop.sh
./start.sh
```

或手动查找并停止：

```bash
# macOS/Linux
lsof -i :3000
kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Q: 安装依赖失败？

**A:** 尝试以下方法：

```bash
# 清除 npm 缓存
npm cache clean --force

# 删除 node_modules 重新安装
rm -rf src/backend/node_modules src/frontend/node_modules
./install.sh

# 使用国内镜像（中国大陆）
npm config set registry https://registry.npmmirror.com
```

### Q: 无法连接 OpenClaw Gateway？

**A:** 检查以下几点：

1. OpenClaw Gateway 是否已启动：
   ```bash
   openclaw gateway status
   ```

2. Gateway Token 是否正确配置：
   ```bash
   cat src/backend/config/openclaw.json
   ```

3. 网络连接是否正常：
   ```bash
   curl http://127.0.0.1:18789
   ```

### Q: 前端显示空白页？

**A:** 检查：

1. 后端服务是否正常运行：
   ```bash
   curl http://localhost:3000/health
   ```

2. 查看浏览器控制台错误

3. 查看后端日志：
   ```bash
   tail -f tmp/backend.log
   ```

### Q: Windows 下脚本无法执行？

**A:** 使用以下方法：

1. **Git Bash**（推荐）
   ```bash
   # 在 Git Bash 中执行
   ./install.sh
   ./start.sh
   ```

2. **WSL (Windows Subsystem for Linux)**
   ```bash
   # 在 WSL 中执行
   ./install.sh
   ./start.sh
   ```

3. **使用 .bat 文件**
   ```cmd
   install.bat
   start.bat
   ```

---

## 下一步

- 📖 [用户指南](./USER_GUIDE.md) - 学习如何使用任务看板
- 🏗️ [架构设计](./docs/ARCHITECTURE.md) - 了解系统架构
- 🚀 [部署指南](./docs/DEPLOY.md) - 生产环境部署

## 获取帮助

- GitHub Issues: https://github.com/CCCaptain0129/OpenClaw_Visualization/issues
- 查看 README.md 了解更多功能