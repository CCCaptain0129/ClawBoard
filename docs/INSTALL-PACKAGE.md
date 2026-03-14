# PM-Workflow-Automation 完整安装指南

> 让新用户在 15 分钟内完成 PM-Workflow-Automation 全栈部署

## 目录

- [概述](#概述)
- [快速开始](#快速开始)
- [环境要求](#环境要求)
- [安装步骤](#安装步骤)
- [配置说明](#配置说明)
- [验证安装](#验证安装)
- [常见问题](#常见问题)
- [卸载与回滚](#卸载与回滚)

---

## 概述

PM-Workflow-Automation 包含以下组件：

| 组件 | 说明 | 默认端口 |
|------|------|----------|
| 可视化看板前端 | Vite + React | 5173 |
| 可视化看板后端 | Express + WebSocket | 3000/3001 |
| Project-Manager Agent | 任务调度 Agent | - |
| OpenClaw Gateway | 通信网关 | 18789 |

### 安装包内容

```
pm-workflow-automation/
├── install-full.sh      # 完整安装脚本
├── install.sh           # 基础安装脚本
├── start.sh / stop.sh   # 启动/停止脚本
├── verify.sh            # 验证脚本
├── skills-lock.json     # Skills 版本锁定
├── templates/           # Agent 模板文件
│   ├── AGENTS.md
│   ├── SOUL.md
│   ├── TOOLS.md
│   ├── HEARTBEAT.md
│   └── USER.md
├── scripts/             # 功能脚本
│   ├── heartbeat-loop.mjs
│   └── sync-tasks.mjs
├── tasks/               # 任务数据
├── docs/                # 文档
│   ├── templates/
│   └── internal/
└── src/                 # 源代码
    ├── backend/
    └── frontend/
```

---

## 快速开始

如果你已熟悉环境，直接运行：

```bash
# 1. 克隆项目
git clone https://github.com/CCCaptain0129/OpenClaw_Visualization.git
cd OpenClaw_Visualization

# 2. 完整安装
./install-full.sh

# 3. 启动服务
./start.sh

# 4. 访问应用
open http://localhost:5173
```

---

## 环境要求

### 必需

| 软件 | 最低版本 | 推荐版本 | 检查命令 |
|------|---------|---------|---------|
| Node.js | 18.x | 20.x LTS | `node --version` |
| npm | 8.x | 10.x | `npm --version` |

### 推荐

| 软件 | 用途 | 安装命令 |
|------|------|---------|
| OpenClaw CLI | Agent 管理 | `npm install -g openclaw` |
| ClawHub | Skills 管理 | `npm install -g clawhub` |
| jq | JSON 处理 | `brew install jq` (macOS) |

### 操作系统支持

- ✅ macOS (Intel / Apple Silicon)
- ✅ Linux (Ubuntu, Debian, CentOS)
- ✅ Windows (Git Bash / WSL)

---

## 安装步骤

### 步骤 1: 准备环境

#### 安装 Node.js

**macOS (Homebrew)**
```bash
brew install node
```

**Linux (Ubuntu/Debian)**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Windows**
访问 https://nodejs.org/ 下载安装

#### 安装 OpenClaw CLI

```bash
npm install -g openclaw

# 初始化
openclaw init

# 启动 Gateway
openclaw gateway start
```

### 步骤 2: 获取代码

```bash
git clone https://github.com/CCCaptain0129/OpenClaw_Visualization.git
cd OpenClaw_Visualization
```

### 步骤 3: 运行安装脚本

```bash
chmod +x install-full.sh
./install-full.sh
```

安装脚本会依次执行：

1. **环境检查** - 验证 Node.js、npm、OpenClaw CLI
2. **配置向导** - 引导填写 Feishu App ID/Secret、Gateway Token
3. **保存配置** - 生成 openclaw.json（权限 600）
4. **安装依赖** - 后端和前端 npm 依赖
5. **安装 Skills** - 从 skills-lock.json 安装
6. **生成结构** - 创建 Agent workspace、任务目录
7. **配置绑定** - 更新 ~/.openclaw/openclaw.json
8. **验证安装** - 检查各项配置

### 步骤 4: 配置群组绑定（可选）

如果配置了群组 ID，执行：

```bash
openclaw bind feishu --group <GROUP_ID> --agent project-manager
```

### 步骤 5: 启动服务

```bash
./start.sh
```

### 步骤 6: 验证

```bash
./verify.sh
```

---

## 配置说明

### 后端配置 (src/backend/config/openclaw.json)

```json
{
  "gateway": {
    "url": "ws://127.0.0.1:18789",
    "token": "<GATEWAY_TOKEN>"
  },
  "feishu": {
    "appId": "cli_xxx",
    "appSecret": "xxx"
  },
  "server": {
    "port": 3000,
    "wsPort": 3001
  }
}
```

### Agent 配置 (~/.openclaw/openclaw.json)

```json
{
  "agents": {
    "list": [{
      "id": "project-manager",
      "name": "project-manager",
      "workspace": "~/.openclaw/project-manager-workspace",
      "heartbeat": {
        "every": "5m"
      }
    }]
  },
  "bindings": [{
    "agentId": "project-manager",
    "match": {
      "channel": "feishu",
      "accountId": "chat",
      "group": "<GROUP_ID>"
    }
  }]
}
```

### 配置项说明

| 配置项 | 必需 | 说明 | 获取方式 |
|--------|------|------|----------|
| gateway.token | 是 | Gateway Token | `openclaw gateway status` |
| feishu.appId | 是 | 飞书应用 ID | 飞书开放平台 |
| feishu.appSecret | 是 | 飞书应用密钥 | 飞书开放平台 |
| binding.group | 否 | 绑定群组 ID | 群组 URL 或 API |

---

## 验证安装

### 使用验证脚本

```bash
# 完整验证
./verify.sh

# 快速检查
./verify.sh --quick
```

### 验证清单

| 检查项 | 命令 |
|--------|------|
| Node.js 版本 | `node --version` (>= 18) |
| Gateway 运行 | `openclaw gateway status` |
| 后端服务 | `curl http://localhost:3000/health` |
| 前端服务 | `curl http://localhost:5173` |
| WebSocket | `lsof -i :3001` |
| 配置文件 | `cat src/backend/config/openclaw.json` |
| Agent workspace | `ls ~/.openclaw/agents/project-manager/` |

---

## 常见问题

### Q: Node.js 版本过低？

```bash
# 使用 nvm
nvm install 20
nvm use 20
```

### Q: Gateway 未启动？

```bash
openclaw gateway start
```

### Q: 端口被占用？

```bash
# 查看占用进程
lsof -i :3000

# 停止服务
./stop.sh
```

### Q: 配置文件权限问题？

```bash
chmod 600 src/backend/config/openclaw.json
chmod 600 ~/.openclaw/openclaw.json
```

### Q: Skills 安装失败？

```bash
# 手动安装
clawhub install github
clawhub install summarize
clawhub install weather

# 或使用 openclaw
openclaw skill install github
```

### Q: 重新配置？

```bash
./install-full.sh --reconfigure
```

---

## 卸载与回滚

### 停止服务

```bash
./stop.sh
```

### 卸载

```bash
# 保留配置
rm -rf node_modules src/*/node_modules tmp/*

# 完全卸载
rm -rf ~/.openclaw/agents/project-manager
rm -rf ~/.openclaw/project-manager-workspace
rm -rf <项目目录>
```

### 恢复配置

配置文件备份位于：
- `src/backend/config/openclaw.json.bak.<timestamp>`
- `~/.openclaw/openclaw.json.bak.<timestamp>`

---

## 15分钟验收步骤

### 步骤 1: 环境准备 (5分钟)

```bash
# 检查环境
node --version  # >= 18
npm --version   # >= 8

# 安装 OpenClaw CLI (如未安装)
npm install -g openclaw
openclaw init
openclaw gateway start
```

### 步骤 2: 安装 (5分钟)

```bash
git clone https://github.com/CCCaptain0129/OpenClaw_Visualization.git
cd OpenClaw_Visualization
./install-full.sh
```

按提示输入：
- Gateway Token
- 飞书 App ID
- 飞书 App Secret
- 群组 ID (可选)

### 步骤 3: 启动验证 (5分钟)

```bash
# 启动服务
./start.sh

# 等待启动 (约 10 秒)
sleep 10

# 验证
./verify.sh

# 访问
open http://localhost:5173
```

### 验收标准

- [ ] 后端健康检查返回 `{"status":"ok"}`
- [ ] 前端页面正常显示
- [ ] WebSocket 连接正常
- [ ] Project-Manager workspace 已创建
- [ ] 配置文件权限为 600

---

## 安装后文档

完成安装后，您可以使用以下文档来深入了解系统的各个功能和使用方法：

### 📋 项目管理文档

| 文档 | 路径 | 说明 |
|------|------|------|
| **任务分解指引** | `project-management/task-breakdown-guide.md` | 如何使用 8 段式模板创建高质量任务 |
| **Dispatcher 优化思路** | `docs/pm-agent-dispatcher-optimization.md` | 任务调度器的设计原理和优化历程 |
| **Prompt 可见性方案** | `docs/project-manager-prompt-visibility.md` | 如何查看 subagent 收到的完整任务指令 |

### 🏗️ 技术架构文档

| 文档 | 路径 | 说明 |
|------|------|------|
| **架构设计** | `docs/ARCHITECTURE.md` | 系统架构、组件关系和数据流 |
| **内部文档** | `docs/internal/` | Subagent 分发记录、调试日志等 |

### 🚀 部署指南

| 文档 | 路径 | 说明 |
|------|------|------|
| **多群组部署指南** | `docs/MULTI-GROUP-DEPLOYMENT.md` | 如何在多个飞书群组中使用项目管理自动化 |

### 快速开始指南

**对于新用户**，建议按以下顺序阅读：

1. 📖 首先阅读 [用户指南](./USER_GUIDE.md) - 学习基本的看板操作
2. 📋 阅读 [任务分解指引](../project-management/task-breakdown-guide.md) - 了解如何编写高质量任务
3. 🚀 根据需要阅读 [多群组部署指南](./MULTI-GROUP-DEPLOYMENT.md) - 如果需要在多个群组中使用

**对于开发者**，建议阅读：

1. 🏗️ [架构设计](./ARCHITECTURE.md) - 了解系统整体架构
2. 📋 [Dispatcher 优化思路](./pm-agent-dispatcher-optimization.md) - 理解任务调度器的设计
3. 📋 [Prompt 可见性方案](./project-manager-prompt-visibility.md) - 了解任务分配机制

### 文档索引

按用途分类的完整文档列表：

**项目管理**
- 任务分解指引：了解如何创建和分配任务
- Dispatcher 优化思路：理解任务调度和分配机制

**技术实现**
- 架构设计：了解系统架构和组件关系
- Prompt 可见性方案：了解 subagent 任务可见性

**部署运维**
- 多群组部署指南：在多个群组中部署和使用
- 内部文档：查看任务分发记录和调试日志

---

## 下一步

- 📖 [用户指南](./USER_GUIDE.md) - 使用任务看板
- 🏗️ [架构设计](./docs/ARCHITECTURE.md) - 了解系统架构
- 🤖 [Agent 配置](#配置说明) - 自定义 Agent 行为

## 获取帮助

- GitHub Issues: https://github.com/CCCaptain0129/OpenClaw_Visualization/issues
- 查看 README.md 了解更多功能