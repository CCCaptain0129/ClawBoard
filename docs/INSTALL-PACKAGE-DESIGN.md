# PM-Workflow-Automation 可复用安装包设计文档

> **版本**: v1.0-draft  
> **创建日期**: 2026-03-13  
> **状态**: 设计草案

---

## 目录

1. [概述](#1-概述)
2. [安装包清单 (Artifacts)](#2-安装包清单-artifacts)
3. [安装流程设计](#3-安装流程设计)
4. [配置策略](#4-配置策略)
5. [兼容性设计](#5-兼容性设计)
6. [验收标准](#6-验收标准)
7. [附录](#7-附录)

---

## 1. 概述

### 1.1 背景

pm-workflow-automation 是一个完整的项目管理自动化方案，包含：

- **可视化看板** (openclaw-visualization): 前后端服务，任务/项目管理
- **Project-Manager Agent**: 独立 Agent，心跳调度，任务分发
- **同步服务**: Markdown ↔ JSON 双向同步
- **文档模板**: 项目文档、任务记录、规范文件
- **Skills**: 可安装的 Agent 技能模块

目前已有的 `install.sh` / `verify.sh` 仅覆盖可视化看板部分，需要扩展到整个方案的一键安装。

### 1.2 目标

- **一键安装**: 新用户在干净机器上 15 分钟内完成全部部署
- **配置向导**: 引导用户填写必要配置，自动处理可选配置
- **跨平台**: 支持 macOS / Linux / Windows
- **幂等执行**: 可重复运行安装脚本，不会破坏已有数据
- **可回滚**: 提供卸载/回滚机制

### 1.3 架构概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PM-Workflow-Automation                       │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │   看板前端      │  │   看板后端      │  │  Project-Manager    │ │
│  │   (Vite/React)  │  │   (Express)     │  │     Agent           │ │
│  │   :5173         │  │   :3000/:3001   │  │  (独立 workspace)   │ │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘ │
│           │                    │                      │            │
│           └────────────────────┼──────────────────────┘            │
│                                │                                   │
│  ┌─────────────────────────────┴─────────────────────────────────┐ │
│  │                    OpenClaw Gateway                            │ │
│  │                    (WebSocket :18789)                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  数据层: tasks/*.json, docs/, scripts/, openclaw.json          ││
│  └────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 安装包清单 (Artifacts)

### 2.1 代码仓库

| 组件 | 来源 | 目标路径 | 说明 |
|------|------|----------|------|
| openclaw-visualization | GitHub 仓库 | `$PROJECT_ROOT/` | 看板前后端代码 |
| project-manager workspace | 打包模板 | `~/.openclaw/project-manager-workspace/` | Agent 独立 workspace |
| scripts/ | 内置目录 | `$PROJECT_ROOT/scripts/` | 心跳循环、同步脚本 |

**仓库结构**:
```
pm-workflow-automation/
├── src/
│   ├── backend/           # 看板后端 (Express)
│   ├── frontend/          # 看板前端 (Vite/React)
│   └── ...
├── tasks/                 # 任务数据
│   ├── projects.json      # 项目列表
│   ├── pm-workflow-automation-tasks.json
│   └── example-*.json     # 示例数据
├── docs/
│   ├── templates/         # 文档模板
│   ├── internal/          # 内部文档
│   └── *.md               # 用户文档
├── scripts/
│   ├── heartbeat-loop.mjs # 心跳循环脚本
│   └── sync-tasks.mjs     # 任务同步脚本
├── install.sh             # 主安装脚本
├── verify.sh              # 验证脚本
├── start.sh               # 启动脚本
├── stop.sh                # 停止脚本
└── uninstall.sh           # 卸载脚本
```

### 2.2 前后端服务

| 服务 | 默认端口 | 启动方式 | 依赖 |
|------|----------|----------|------|
| 看板后端 HTTP | 3000 | `node src/backend/index.js` | Node.js 18+ |
| 看板后端 WebSocket | 3001 | 同上 | - |
| 看板前端 | 5173 | `npm run dev` (Vite) | Node.js 18+ |
| OpenClaw Gateway | 18789 | `openclaw gateway start` | OpenClaw CLI |

### 2.3 Tasks 初始数据

| 文件 | 内容 | 说明 |
|------|------|------|
| `projects.json` | 项目列表 | 包含 openclaw-visualization、pm-workflow-automation 等初始项目 |
| `*-tasks.json` | 任务数据 | 每个项目一个 JSON 文件，包含任务列表 |
| `*-TASKS.md` | Markdown 格式 | 可选，用于 Markdown ↔ JSON 双向同步 |

**示例数据**:
- `example-project-1-tasks.json` - 示例项目 A
- `example-project-2-tasks.json` - 示例项目 B
- `openclaw-visualization-tasks.json` - 可视化项目任务
- `pm-workflow-automation-tasks.json` - PM 自动化任务

### 2.4 文档模板

```
docs/templates/
├── PROJECT-TEMPLATE.md      # 项目文档模板
├── TASK-RECORD-TEMPLATE.md  # 任务记录模板
├── SUBAGENT-RECORD.md       # Subagent 分发记录模板
└── WORKFLOW-GUIDE.md        # 工作流指南
```

### 2.5 Agents 配置

#### 2.5.1 OpenClaw 主配置 (`~/.openclaw/openclaw.json`)

需要注入的配置项：

```json
{
  "agents": {
    "list": [
      {
        "id": "project-manager",
        "name": "project-manager",
        "workspace": "~/.openclaw/project-manager-workspace",
        "agentDir": "~/.openclaw/agents/project-manager/agent",
        "heartbeat": {
          "every": "5m"
        },
        "groupChat": {
          "mentionPatterns": ["@PM", "@pm", "@project-manager"]
        }
      }
    ]
  },
  "bindings": [
    {
      "agentId": "project-manager",
      "match": {
        "channel": "feishu",
        "accountId": "chat",
        "group": "<GROUP_ID>"
      }
    }
  ]
}
```

#### 2.5.2 Project-Manager Workspace 文件

```
~/.openclaw/agents/project-manager/
├── AGENTS.md            # Agent 工作区指南
├── SOUL.md              # Agent 人格定义
├── USER.md              # 用户信息 (运行时填充)
├── TOOLS.md             # 工具配置
├── IDENTITY.md          # Agent 身份
├── HEARTBEAT.md         # 心跳配置
├── .openclaw/
│   └── workspace-state.json
├── agent/
│   ├── auth-profiles.json
│   └── models.json
├── sessions/            # 会话记录 (运行时创建)
└── memory/              # 记忆文件 (运行时创建)
```

#### 2.5.3 HEARTBEAT.md 模板

```markdown
# HEARTBEAT.md

# PMW 心跳任务

每次 heartbeat 时：
1. 运行心跳循环脚本
2. 检查任务分发结果
3. 如果有新任务分配，报告给用户

脚本位置：$PROJECT_ROOT/scripts/heartbeat-loop.mjs

命令：
\`\`\`bash
cd $PROJECT_ROOT/scripts
node heartbeat-loop.mjs
\`\`\`

功能：
- 拉取 pm-workflow-automation 项目的 todo 任务
- 按优先级排序（P0→P1→P2→P3）
- 限制并发=3
- 对 top N 任务调用 /api/tasks/subagent/create
- 记录到 SUBAGENTS任务分发记录.md
```

### 2.6 Skills 安装/版本锁定

#### 2.6.1 Skills 清单文件 (`skills-lock.json`)

```json
{
  "version": "1.0",
  "skills": [
    {
      "slug": "github",
      "version": "latest",
      "source": "clawhub"
    },
    {
      "slug": "summarize",
      "version": "latest",
      "source": "clawhub"
    },
    {
      "slug": "weather",
      "version": "latest",
      "source": "clawhub"
    }
  ]
}
```

#### 2.6.2 Skills 安装脚本

```bash
# 安装所有 skills
install_skills() {
  if command -v clawhub &> /dev/null; then
    clawhub install github
    clawhub install summarize
    clawhub install weather
  else
    print_warning "ClawHub 未安装，跳过 skills 安装"
  fi
}
```

### 2.7 示例 openclaw.json

**后端配置** (`src/backend/config/openclaw.json`):

```json
{
  "$schema": "./openclaw.schema.json",
  "gateway": {
    "url": "ws://127.0.0.1:18789",
    "token": "<GATEWAY_TOKEN>"
  },
  "feishu": {
    "appId": "<FEISHU_APP_ID>",
    "appSecret": "<FEISHU_APP_SECRET>"
  }
}
```

### 2.8 Feishu 配置项

| 配置项 | 必需 | 说明 | 获取方式 |
|--------|------|------|----------|
| `feishu.appId` | 是 | 飞书应用 ID | 飞书开放平台创建应用获取 |
| `feishu.appSecret` | 是 | 飞书应用密钥 | 同上 |
| `binding.group` | 是 | 绑定的群组 ID | 飞书群组 URL 或 API 获取 |

### 2.9 启动脚本

| 脚本 | 功能 | 说明 |
|------|------|------|
| `start.sh` | 启动所有服务 | 后端、前端、检查 Gateway |
| `stop.sh` | 停止所有服务 | 清理 PID 文件 |
| `verify.sh` | 验证服务状态 | 检查端口、健康检查 |
| `status.sh` | 查看服务状态 | 显示各服务运行状态 |
| `logs.sh` | 查看日志 | tail -f 组合 |
| `uninstall.sh` | 卸载 | 可选保留数据 |

---

## 3. 安装流程设计

### 3.1 流程概览

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              安装流程                                       │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐│
│  │ Preflight│ → │ Pull/    │ → │ 配置     │ → │ Install  │ → │ Generate ││
│  │ 依赖检查 │   │ Clone    │   │ 向导     │   │ Skills   │   │ 目录结构 ││
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘│
│        │              │              │              │              │      │
│        ▼              ▼              ▼              ▼              ▼      │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐│
│  │ 绑定     │ → │ 启动     │ → │ Verify   │ → │ 完成     │            ││
│  │ 群组     │   │ 服务     │   │ 验证     │   │          │            ││
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘            ││
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 阶段详解

#### Phase 1: Preflight (依赖检查)

**目标**: 验证系统环境满足最低要求

```bash
preflight_check() {
  # 1. 操作系统检测
  detect_os  # macOS / Linux / Windows
  
  # 2. Node.js 版本检查 (>= 18)
  check_nodejs
  
  # 3. npm 版本检查 (>= 8)
  check_npm
  
  # 4. Git 检查 (可选，用于 clone)
  check_git
  
  # 5. OpenClaw CLI 检查
  check_openclaw_cli
  
  # 6. OpenClaw Gateway 状态
  check_gateway_status
  
  # 7. 端口占用检查
  check_ports 3000 3001 5173 18789
  
  # 8. 磁盘空间检查 (>= 500MB)
  check_disk_space
}
```

**检查项清单**:

| 检查项 | 最低要求 | 失败处理 |
|--------|----------|----------|
| Node.js | v18+ | 提示安装，退出 |
| npm | v8+ | 警告，继续 |
| Git | 任意版本 | 警告，跳过 clone |
| OpenClaw CLI | 已安装 | 提示安装，退出 |
| Gateway | 运行中 | 提示启动 |
| 端口 | 未占用 | 提示停止占用进程 |
| 磁盘空间 | >= 500MB | 警告，继续 |

#### Phase 2: Pull/Clone (代码获取)

```bash
pull_code() {
  # 方式一：从 GitHub clone
  if [ "$INSTALL_MODE" = "github" ]; then
    git clone https://github.com/CCCaptain0129/OpenClaw_Visualization.git "$PROJECT_ROOT"
  fi
  
  # 方式二：从本地 tarball 解压
  if [ "$INSTALL_MODE" = "tarball" ]; then
    tar -xzf "$TARBALL_PATH" -C "$PROJECT_ROOT"
  fi
  
  # 方式三：使用已有目录
  if [ "$INSTALL_MODE" = "existing" ]; then
    print_info "使用现有目录: $PROJECT_ROOT"
  fi
}
```

#### Phase 3: 配置向导 (交互式)

```bash
config_wizard() {
  print_header "配置向导"
  
  # ===== 必须配置 =====
  
  # 1. Gateway Token
  GATEWAY_TOKEN=$(openclaw gateway status | grep "Token:" | awk '{print $2}')
  if [ -z "$GATEWAY_TOKEN" ]; then
    read -p "请输入 Gateway Token: " GATEWAY_TOKEN
  fi
  
  # 2. Feishu App ID
  read -p "请输入飞书 App ID (cli_xxx): " FEISHU_APP_ID
  while [ -z "$FEISHU_APP_ID" ]; do
    print_error "飞书 App ID 为必填项"
    read -p "请输入飞书 App ID: " FEISHU_APP_ID
  done
  
  # 3. Feishu App Secret
  read -s -p "请输入飞书 App Secret: " FEISHU_APP_SECRET
  echo
  while [ -z "$FEISHU_APP_SECRET" ]; do
    print_error "飞书 App Secret 为必填项"
    read -s -p "请输入飞书 App Secret: " FEISHU_APP_SECRET
  done
  
  # 4. 绑定群组
  read -p "请输入绑定的飞书群组 ID (留跳过): " GROUP_ID
  
  # ===== 可选配置 (有默认值) =====
  
  # 5. 后端端口
  read -p "后端端口 [默认 3000]: " BACKEND_PORT
  BACKEND_PORT=${BACKEND_PORT:-3000}
  
  # 6. 前端端口
  read -p "前端端口 [默认 5173]: " FRONTEND_PORT
  FRONTEND_PORT=${FRONTEND_PORT:-5173}
  
  # 7. 心跳间隔
  read -p "心跳间隔 [默认 5m]: " HEARTBEAT_INTERVAL
  HEARTBEAT_INTERVAL=${HEARTBEAT_INTERVAL:-5m}
  
  # 保存配置
  save_config
}
```

**配置优先级**:

| 配置项 | 优先级 | 默认值 | 存储 |
|--------|--------|--------|------|
| Gateway Token | 必需 | 从 `openclaw gateway status` 获取 | `openclaw.json` |
| Feishu App ID | 必需 | 无 | `openclaw.json` |
| Feishu App Secret | 必需 | 无 | `openclaw.json` |
| 群组 ID | 必需 | 无 | `~/.openclaw/openclaw.json` |
| 后端端口 | 可选 | 3000 | 环境变量 |
| 前端端口 | 可选 | 5173 | 环境变量 |
| 心跳间隔 | 可选 | 5m | `~/.openclaw/openclaw.json` |

#### Phase 4: Install Skills

```bash
install_skills() {
  print_step "安装 Skills..."
  
  # 检查 ClawHub
  if ! command -v clawhub &> /dev/null; then
    print_warning "ClawHub 未安装，跳过 skills 安装"
    print_info "可稍后运行: clawhub install <skill-name>"
    return 0
  fi
  
  # 从 skills-lock.json 读取
  local skills_file="$PROJECT_ROOT/skills-lock.json"
  if [ -f "$skills_file" ]; then
    local skills=$(jq -r '.skills[].slug' "$skills_file")
    for skill in $skills; do
      print_info "安装 skill: $skill"
      clawhub install "$skill" --no-input
    done
  fi
  
  print_success "Skills 安装完成"
}
```

#### Phase 5: Generate 目录结构

```bash
generate_structure() {
  print_step "生成目录结构..."
  
  # 1. 创建临时目录
  mkdir -p "$PROJECT_ROOT/tmp/logs"
  touch "$PROJECT_ROOT/tmp/.gitkeep"
  
  # 2. 创建 tasks 目录
  mkdir -p "$PROJECT_ROOT/tasks"
  
  # 3. 创建 project-manager workspace
  local pm_workspace="$HOME/.openclaw/project-manager-workspace"
  mkdir -p "$pm_workspace"
  
  # 4. 创建 project-manager agent 目录
  local pm_agent="$HOME/.openclaw/agents/project-manager"
  mkdir -p "$pm_agent"/{agent,sessions,memory,.openclaw}
  
  # 5. 复制模板文件
  cp "$PROJECT_ROOT/templates/AGENTS.md" "$pm_agent/"
  cp "$PROJECT_ROOT/templates/SOUL.md" "$pm_agent/"
  cp "$PROJECT_ROOT/templates/TOOLS.md" "$pm_agent/"
  cp "$PROJECT_ROOT/templates/IDENTITY.md" "$pm_agent/"
  
  # 6. 生成 HEARTBEAT.md (替换路径变量)
  sed "s|\$PROJECT_ROOT|$PROJECT_ROOT|g" \
    "$PROJECT_ROOT/templates/HEARTBEAT.md" > "$pm_agent/HEARTBEAT.md"
  
  # 7. 生成 USER.md
  cat > "$pm_agent/USER.md" << EOF
# USER.md

- **Name:** $USER_NAME
- **Timezone:** $(cat /etc/timezone 2>/dev/null || echo "Asia/Shanghai")
EOF
  
  print_success "目录结构生成完成"
}
```

#### Phase 6: 绑定群组

```bash
bind_group() {
  print_step "绑定飞书群组..."
  
  if [ -z "$GROUP_ID" ]; then
    print_warning "未配置群组 ID，跳过绑定"
    print_info "可稍后手动配置 ~/.openclaw/openclaw.json"
    return 0
  fi
  
  # 更新 openclaw.json
  local openclaw_config="$HOME/.openclaw/openclaw.json"
  
  if [ -f "$openclaw_config" ]; then
    # 使用 jq 添加 binding
    jq --arg group "$GROUP_ID" '
      .bindings += [{
        "agentId": "project-manager",
        "match": {
          "channel": "feishu",
          "accountId": "chat",
          "group": $group
        }
      }]
    ' "$openclaw_config" > "${openclaw_config}.tmp"
    mv "${openclaw_config}.tmp" "$openclaw_config"
    
    print_success "群组绑定完成: $GROUP_ID"
  else
    print_warning "openclaw.json 不存在，请先运行 openclaw init"
  fi
}
```

#### Phase 7: 启动服务

```bash
start_services() {
  print_step "启动服务..."
  
  # 1. 确保 Gateway 运行
  if ! openclaw gateway status | grep -q "running"; then
    print_info "启动 OpenClaw Gateway..."
    openclaw gateway start
    sleep 3
  fi
  
  # 2. 安装依赖 (如果尚未安装)
  install_dependencies
  
  # 3. 启动后端
  print_info "启动后端服务..."
  cd "$PROJECT_ROOT/src/backend"
  nohup node index.js > "$PROJECT_ROOT/tmp/backend.log" 2>&1 &
  echo $! > "$PROJECT_ROOT/tmp/backend.pid"
  
  # 4. 等待后端启动
  sleep 5
  
  # 5. 启动前端
  print_info "启动前端服务..."
  cd "$PROJECT_ROOT/src/frontend"
  nohup npm run dev > "$PROJECT_ROOT/tmp/frontend.log" 2>&1 &
  echo $! > "$PROJECT_ROOT/tmp/frontend.pid"
  
  # 6. 等待前端启动
  sleep 3
  
  print_success "服务启动完成"
}
```

#### Phase 8: Verify 验证

```bash
verify_installation() {
  print_step "验证安装..."
  
  local errors=0
  
  # 1. 检查 Gateway
  if openclaw gateway status | grep -q "running"; then
    print_success "Gateway 运行正常"
  else
    print_error "Gateway 未运行"
    ((errors++))
  fi
  
  # 2. 检查后端健康
  if curl -s "http://localhost:$BACKEND_PORT/health" | grep -q '"status":"ok"'; then
    print_success "后端服务正常"
  else
    print_error "后端服务异常"
    ((errors++))
  fi
  
  # 3. 检查前端
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$FRONTEND_PORT" | grep -q "200"; then
    print_success "前端服务正常"
  else
    print_error "前端服务异常"
    ((errors++))
  fi
  
  # 4. 检查 WebSocket
  if lsof -i :3001 | grep -q LISTEN; then
    print_success "WebSocket 端口正常"
  else
    print_error "WebSocket 端口未监听"
    ((errors++))
  fi
  
  # 5. 检查配置文件
  if [ -f "$PROJECT_ROOT/src/backend/config/openclaw.json" ]; then
    print_success "配置文件存在"
  else
    print_error "配置文件缺失"
    ((errors++))
  fi
  
  # 6. 检查 project-manager workspace
  if [ -f "$HOME/.openclaw/agents/project-manager/HEARTBEAT.md" ]; then
    print_success "Project-Manager workspace 配置完成"
  else
    print_error "Project-Manager workspace 配置缺失"
    ((errors++))
  fi
  
  # 结果
  if [ $errors -eq 0 ]; then
    print_success "所有检查通过！安装成功！"
    return 0
  else
    print_error "发现 $errors 个问题，请检查日志"
    return 1
  fi
}
```

### 3.3 完整安装脚本骨架

```bash
#!/bin/bash
# install-full.sh - PM-Workflow-Automation 完整安装脚本

set -e

# ===== 全局变量 =====
PROJECT_ROOT="${PROJECT_ROOT:-$HOME/.openclaw/workspace/projects/pm-workflow-automation}"
INSTALL_MODE="${INSTALL_MODE:-github}"  # github | tarball | existing

# ===== 颜色定义 =====
# ... (同现有 install.sh)

# ===== 主流程 =====
main() {
  print_header
  
  # Phase 1: Preflight
  preflight_check
  echo ""
  
  # Phase 2: Pull/Clone
  pull_code
  echo ""
  
  # Phase 3: 配置向导
  config_wizard
  echo ""
  
  # Phase 4: Install Skills
  install_skills
  echo ""
  
  # Phase 5: Generate 目录结构
  generate_structure
  echo ""
  
  # Phase 6: 绑定群组
  bind_group
  echo ""
  
  # Phase 7: 启动服务
  start_services
  echo ""
  
  # Phase 8: Verify
  verify_installation
  echo ""
  
  # 显示完成信息
  show_completion_message
}

main "$@"
```

---

## 4. 配置策略

### 4.1 配置分类

#### 4.1.1 必须交互配置 (无默认值)

| 配置项 | 配置文件 | 说明 |
|--------|----------|------|
| `feishu.appId` | `src/backend/config/openclaw.json` | 飞书应用 ID，从开放平台获取 |
| `feishu.appSecret` | `src/backend/config/openclaw.json` | 飞书应用密钥，敏感信息 |
| `binding.group` | `~/.openclaw/openclaw.json` | 绑定的飞书群组 ID |

#### 4.1.2 可自动获取配置

| 配置项 | 来源 | 说明 |
|--------|------|------|
| `gateway.token` | `openclaw gateway status` | 自动读取 Gateway Token |
| `gateway.url` | 默认值 | `ws://127.0.0.1:18789` |

#### 4.1.3 有默认值配置 (可跳过)

| 配置项 | 默认值 | 配置方式 |
|--------|--------|----------|
| 后端端口 | 3000 | 环境变量 `BACKEND_PORT` |
| 前端端口 | 5173 | 环境变量 `FRONTEND_PORT` |
| WebSocket 端口 | 3001 | 后端配置 |
| 心跳间隔 | 5m | `~/.openclaw/openclaw.json` |
| 项目根目录 | `~/.openclaw/workspace/projects/pm-workflow-automation` | 环境变量 `PROJECT_ROOT` |

### 4.2 配置存储策略

#### 4.2.1 敏感信息处理

```bash
# 敏感配置存储
store_sensitive_config() {
  local key=$1
  local value=$2
  
  # 方案一：存储在配置文件中 (权限 600)
  chmod 600 "$CONFIG_FILE"
  
  # 方案二：存储在环境变量中
  echo "export $key='$value'" >> ~/.openclaw/.env
  
  # 方案三：使用系统 Keychain (macOS)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    security add-generic-password -a "$USER" -s "openclaw-$key" -w "$value"
  fi
}
```

#### 4.2.2 配置文件权限

```bash
# 设置配置文件权限
set_config_permissions() {
  # 敏感配置文件
  chmod 600 "$PROJECT_ROOT/src/backend/config/openclaw.json"
  chmod 600 "$HOME/.openclaw/openclaw.json"
  
  # Agent 目录
  chmod 700 "$HOME/.openclaw/agents"
  chmod 700 "$HOME/.openclaw/agents/project-manager"
}
```

### 4.3 配置验证

```bash
validate_config() {
  local config_file="$PROJECT_ROOT/src/backend/config/openclaw.json"
  
  # 验证 JSON 格式
  if ! jq empty "$config_file" 2>/dev/null; then
    print_error "配置文件 JSON 格式错误"
    return 1
  fi
  
  # 验证必要字段
  local has_app_id=$(jq -r '.feishu.appId' "$config_file")
  local has_app_secret=$(jq -r '.feishu.appSecret' "$config_file")
  local has_gateway_token=$(jq -r '.gateway.token' "$config_file")
  
  if [ "$has_app_id" = "null" ] || [ "$has_app_id" = "" ]; then
    print_error "缺少 feishu.appId 配置"
    return 1
  fi
  
  if [ "$has_app_secret" = "null" ] || [ "$has_app_secret" = "" ]; then
    print_error "缺少 feishu.appSecret 配置"
    return 1
  fi
  
  if [ "$has_gateway_token" = "null" ] || [ "$has_gateway_token" = "your-gateway-token-here" ]; then
    print_error "缺少有效的 gateway.token 配置"
    return 1
  fi
  
  print_success "配置验证通过"
  return 0
}
```

---

## 5. 兼容性设计

### 5.1 操作系统支持

| 操作系统 | 支持级别 | 注意事项 |
|----------|----------|----------|
| macOS (Intel) | 完全支持 | 推荐使用 Homebrew 安装依赖 |
| macOS (Apple Silicon) | 完全支持 | 同上 |
| Linux (Ubuntu/Debian) | 完全支持 | 使用 apt 安装依赖 |
| Linux (CentOS/RHEL) | 基本支持 | 使用 yum/dnf 安装依赖 |
| Windows 10/11 | 通过 WSL2 | 需要 WSL2 + Ubuntu |
| Windows (原生) | 通过 Git Bash | 部分功能受限 |

### 5.2 跨平台脚本策略

```bash
# 检测操作系统
detect_os() {
  case "$OSTYPE" in
    darwin*)  echo "macos" ;;
    linux*)   echo "linux" ;;
    msys*|cygwin*) echo "windows" ;;
    *)        echo "unknown" ;;
  esac
}

# 跨平台命令
get_listen_ports_cmd() {
  local os=$(detect_os)
  case "$os" in
    macos)  echo "lsof -i -P -n | grep LISTEN" ;;
    linux)  echo "ss -tlnp" ;;
    windows) echo "netstat -ano | findstr LISTENING" ;;
  esac
}
```

### 5.3 Windows 支持

#### 5.3.1 批处理脚本 (`install.bat`)

```batch
@echo off
REM PM-Workflow-Automation 安装脚本 (Windows)

echo ============================================================
echo   PM-Workflow-Automation 安装向导 (Windows)
echo ============================================================
echo.

REM 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js 未安装
    echo 请从 https://nodejs.org/ 下载安装
    exit /b 1
)

REM 检查 npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm 未安装
    exit /b 1
)

echo [INFO] Node.js 版本:
node --version
echo.

REM 安装依赖
echo [STEP] 安装后端依赖...
cd src\backend
call npm install --silent
cd ..\..

echo [STEP] 安装前端依赖...
cd src\frontend
call npm install --silent
cd ..\..

echo.
echo [SUCCESS] 安装完成！
echo.
echo 下一步:
echo   1. 编辑 src\backend\config\openclaw.json
echo   2. 运行 start.bat 启动服务
echo.
```

#### 5.3.2 PowerShell 脚本 (`install.ps1`)

```powershell
# PM-Workflow-Automation 安装脚本 (PowerShell)

param(
    [switch]$SkipDeps,
    [switch]$Help
)

# 检查 Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js 未安装" -ForegroundColor Red
    Write-Host "请从 https://nodejs.org/ 下载安装"
    exit 1
}

# ... 继续安装逻辑
```

### 5.4 开发/生产模式

```bash
# 模式检测
detect_mode() {
  if [ -f "$PROJECT_ROOT/.development" ]; then
    echo "development"
  else
    echo "production"
  fi
}

# 开发模式配置
setup_dev_mode() {
  touch "$PROJECT_ROOT/.development"
  
  # 启用详细日志
  export LOG_LEVEL=debug
  
  # 禁用缓存
  export DISABLE_CACHE=true
  
  # 前端开发服务器
  export VITE_DEV=true
}

# 生产模式配置
setup_prod_mode() {
  rm -f "$PROJECT_ROOT/.development"
  
  # 标准日志
  export LOG_LEVEL=info
  
  # 构建前端
  cd "$PROJECT_ROOT/src/frontend"
  npm run build
}
```

### 5.5 幂等性设计

```bash
# 幂等安装检查
idempotent_check() {
  # 1. 检查是否已安装
  if [ -f "$PROJECT_ROOT/.installed" ]; then
    print_info "检测到已有安装"
    
    # 读取安装版本
    local installed_version=$(cat "$PROJECT_ROOT/.installed")
    print_info "已安装版本: $installed_version"
    
    read -p "是否重新安装？[y/N]: " reinstall
    if [[ ! "$reinstall" =~ ^[Yy]$ ]]; then
      print_info "跳过安装"
      return 0
    fi
  fi
  
  # 2. 备份现有配置
  if [ -f "$PROJECT_ROOT/src/backend/config/openclaw.json" ]; then
    print_info "备份现有配置..."
    cp "$PROJECT_ROOT/src/backend/config/openclaw.json" \
       "$PROJECT_ROOT/src/backend/config/openclaw.json.bak.$(date +%Y%m%d%H%M%S)"
  fi
  
  # 3. 继续安装
  return 1
}

# 安装完成标记
mark_installed() {
  echo "$VERSION" > "$PROJECT_ROOT/.installed"
  date -Iseconds >> "$PROJECT_ROOT/.installed"
}
```

---

## 6. 验收标准

### 6.1 时间要求

| 阶段 | 目标时间 | 说明 |
|------|----------|------|
| Preflight | < 30s | 环境检查 |
| Pull/Clone | < 2min | 网络依赖 |
| 配置向导 | < 3min | 用户输入时间 |
| Install Skills | < 2min | 网络依赖 |
| Generate 结构 | < 30s | 本地操作 |
| 启动服务 | < 3min | 依赖安装时间 |
| Verify | < 1min | 验证检查 |
| **总计** | **< 15min** | 正常情况下 |

### 6.2 功能验收清单

```bash
# verify.sh 完整验收
verify_all() {
  echo "========================================="
  echo "  PM-Workflow-Automation 验收测试"
  echo "========================================="
  echo ""
  
  local passed=0
  local failed=0
  
  # 1. 环境检查
  check "Node.js 版本 >= 18" "node --version | grep -qE 'v(1[89]|[2-9][0-9])'"
  check "npm 可用" "npm --version"
  check "OpenClaw CLI 可用" "openclaw --version"
  
  # 2. Gateway 检查
  check "Gateway 运行中" "openclaw gateway status | grep -q running"
  check "Gateway 端口 18789" "lsof -i :18789 | grep -q LISTEN"
  
  # 3. 后端检查
  check "后端端口 3000" "lsof -i :3000 | grep -q LISTEN"
  check "后端健康检查" "curl -s localhost:3000/health | grep -q ok"
  check "后端 API 响应" "curl -s localhost:3000/api/projects"
  
  # 4. 前端检查
  check "前端端口 5173" "lsof -i :5173 | grep -q LISTEN"
  check "前端页面加载" "curl -s -o /dev/null -w '%{http_code}' localhost:5173 | grep -q 200"
  
  # 5. WebSocket 检查
  check "WebSocket 端口 3001" "lsof -i :3001 | grep -q LISTEN"
  
  # 6. 配置检查
  check "openclaw.json 存在" "test -f src/backend/config/openclaw.json"
  check "配置文件有效" "jq empty src/backend/config/openclaw.json"
  check "Gateway Token 已配置" "jq -r '.gateway.token' src/backend/config/openclaw.json | grep -qv your-gateway"
  check "Feishu App ID 已配置" "jq -r '.feishu.appId' src/backend/config/openclaw.json | grep -qv null"
  
  # 7. Project-Manager 检查
  check "PM workspace 存在" "test -d ~/.openclaw/project-manager-workspace"
  check "PM agent 目录存在" "test -d ~/.openclaw/agents/project-manager"
  check "PM HEARTBEAT.md 存在" "test -f ~/.openclaw/agents/project-manager/HEARTBEAT.md"
  
  # 8. 数据检查
  check "tasks 目录存在" "test -d tasks"
  check "projects.json 存在" "test -f tasks/projects.json"
  
  # 结果
  echo ""
  echo "========================================="
  echo "  结果: 通过 $passed / 总计 $((passed + failed))"
  echo "========================================="
  
  if [ $failed -eq 0 ]; then
    echo ""
    echo "✅ 所有验收测试通过！"
    return 0
  else
    echo ""
    echo "❌ 存在失败项，请检查上方错误信息"
    return 1
  fi
}

check() {
  local description=$1
  local command=$2
  
  printf "  %-40s " "$description"
  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((passed++))
  else
    echo -e "${RED}✗ FAIL${NC}"
    ((failed++))
  fi
}
```

### 6.3 一键验证命令

```bash
# 快速验证
./verify.sh --quick

# 完整验证
./verify.sh --full

# 仅检查配置
./verify.sh --config-only

# 输出 JSON 格式
./verify.sh --json
```

### 6.4 回滚/卸载策略

#### 6.4.1 卸载脚本 (`uninstall.sh`)

```bash
#!/bin/bash
# uninstall.sh - PM-Workflow-Automation 卸载脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_step() {
  echo -e "${CYAN}[STEP]${NC} $1"
}

# 卸载选项
UNINSTALL_MODE="${1:-soft}"  # soft | full | keep-config

uninstall() {
  print_warning "即将卸载 PM-Workflow-Automation"
  echo ""
  echo "卸载模式: $UNINSTALL_MODE"
  echo ""
  echo "  soft      - 保留配置和数据，仅停止服务"
  echo "  full      - 完全卸载，删除所有文件"
  echo "  keep-config - 保留配置文件，删除其他"
  echo ""
  
  read -p "确认卸载？[y/N]: " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "取消卸载"
    exit 0
  fi
  
  # 1. 停止服务
  print_step "停止服务..."
  if [ -f "./stop.sh" ]; then
    ./stop.sh
  fi
  
  # 2. 根据模式处理
  case "$UNINSTALL_MODE" in
    soft)
      print_step "软卸载：保留配置和数据"
      # 仅删除临时文件
      rm -rf tmp/*
      rm -f .installed
      ;;
      
    full)
      print_step "完全卸载：删除所有文件"
      # 备份配置
      if [ -f "src/backend/config/openclaw.json" ]; then
        cp "src/backend/config/openclaw.json" \
           "/tmp/openclaw.json.bak.$(date +%Y%m%d%H%M%S)"
        echo "配置已备份到 /tmp/"
      fi
      
      # 删除项目目录
      cd ..
      rm -rf pm-workflow-automation
      
      # 删除 project-manager workspace
      rm -rf ~/.openclaw/project-manager-workspace
      rm -rf ~/.openclaw/agents/project-manager
      ;;
      
    keep-config)
      print_step "保留配置卸载"
      # 保留配置文件
      mv src/backend/config/openclaw.json /tmp/openclaw.json.bak
      
      # 删除其他
      rm -rf src/backend/node_modules
      rm -rf src/frontend/node_modules
      rm -rf tmp/*
      rm -rf tasks/*.json
      ;;
  esac
  
  echo ""
  echo -e "${GREEN}卸载完成${NC}"
}

uninstall
```

#### 6.4.2 回滚策略

```bash
# 回滚到上一版本
rollback() {
  local backup_dir="$PROJECT_ROOT/.backups"
  local latest_backup=$(ls -t "$backup_dir" | head -1)
  
  if [ -z "$latest_backup" ]; then
    print_error "没有找到备份"
    return 1
  fi
  
  print_info "将回滚到: $latest_backup"
  read -p "确认回滚？[y/N]: " confirm
  
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    # 停止服务
    ./stop.sh
    
    # 恢复备份
    cp -r "$backup_dir/$latest_backup/src/backend/config/openclaw.json" \
          "$PROJECT_ROOT/src/backend/config/"
    
    # 重新启动
    ./start.sh
    
    print_success "回滚完成"
  fi
}
```

---

## 7. 附录

### 7.1 文件清单

```
pm-workflow-automation/
├── install.sh                 # 主安装脚本 (macOS/Linux)
├── install.bat                # Windows 安装脚本
├── install.ps1                # PowerShell 安装脚本
├── verify.sh                  # 验证脚本
├── start.sh                   # 启动脚本
├── stop.sh                    # 停止脚本
├── status.sh                  # 状态查看
├── uninstall.sh               # 卸载脚本
├── rollback.sh                # 回滚脚本
│
├── skills-lock.json           # Skills 版本锁定
├── package-lock.json          # 项目依赖锁定
│
├── src/
│   ├── backend/
│   │   ├── index.js
│   │   ├── package.json
│   │   └── config/
│   │       ├── openclaw.json.example
│   │       └── openclaw.schema.json
│   └── frontend/
│       ├── package.json
│       └── ...
│
├── tasks/
│   ├── projects.json
│   ├── pm-workflow-automation-tasks.json
│   └── ...
│
├── scripts/
│   ├── heartbeat-loop.mjs
│   └── sync-tasks.mjs
│
├── docs/
│   ├── INSTALL.md
│   ├── USAGE.md
│   ├── templates/
│   └── internal/
│
├── templates/
│   ├── AGENTS.md
│   ├── SOUL.md
│   ├── TOOLS.md
│   ├── IDENTITY.md
│   ├── USER.md
│   └── HEARTBEAT.md
│
└── tmp/                       # 运行时目录 (不纳入版本控制)
    ├── .gitkeep
    ├── logs/
    ├── backend.pid
    ├── frontend.pid
    └── .installed
```

### 7.2 环境变量参考

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PROJECT_ROOT` | `~/.openclaw/workspace/projects/pm-workflow-automation` | 项目根目录 |
| `BACKEND_PORT` | 3000 | 后端 HTTP 端口 |
| `FRONTEND_PORT` | 5173 | 前端开发服务器端口 |
| `WS_PORT` | 3001 | WebSocket 端口 |
| `GATEWAY_URL` | `ws://127.0.0.1:18789` | Gateway WebSocket 地址 |
| `LOG_LEVEL` | info | 日志级别 |
| `NODE_ENV` | development | 运行模式 |

### 7.3 错误码参考

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| E001 | Node.js 版本过低 | 升级 Node.js 到 18+ |
| E002 | npm 未安装 | 安装 Node.js (包含 npm) |
| E003 | OpenClaw CLI 未安装 | `npm install -g openclaw` |
| E004 | Gateway 未运行 | `openclaw gateway start` |
| E005 | 端口被占用 | 停止占用进程或更改端口 |
| E006 | 配置文件缺失 | 运行配置向导 |
| E007 | Feishu 配置无效 | 检查 App ID/Secret |
| E008 | 权限不足 | 检查文件/目录权限 |
| E009 | 网络连接失败 | 检查网络连接 |
| E010 | 磁盘空间不足 | 清理磁盘空间 |

### 7.4 常见问题 (FAQ)

**Q: 安装过程中断，如何恢复？**
A: 重新运行 `install.sh`，脚本会检测已完成的步骤并跳过。

**Q: 如何更新到新版本？**
A: 运行 `./install.sh --update`，会保留配置并更新代码。

**Q: 如何查看详细日志？**
A: 运行 `./logs.sh` 或查看 `tmp/logs/` 目录。

**Q: 如何重新配置？**
A: 运行 `./install.sh --reconfigure`，会重新运行配置向导。

**Q: 支持离线安装吗？**
A: 支持。使用 `--offline` 参数，需提前下载依赖包。

---

## 变更历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| v1.0-draft | 2026-03-13 | 初始草案 |

---

> **文档状态**: 草案  
> **下一步**: 评审后进入实施阶段