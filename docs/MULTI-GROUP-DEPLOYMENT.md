# 多群组部署指南

> 如何在多个飞书群组中使用 OpenClaw 项目管理自动化流程和可视化看板

## 目录

- [概述](#概述)
- [架构说明](#架构说明)
- [部署模式](#部署模式)
- [快速开始](#快速开始)
- [详细配置](#详细配置)
- [验证步骤](#验证步骤)
- [常见问题](#常见问题)

---

## 概述

### 支持的部署模式

OpenClaw 项目管理系统支持以下部署模式：

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| **单群组模式** | 一个项目对应一个飞书群组 | 个人项目、小团队 |
| **多群组模式** | 一个项目支持多个群组 | 大团队、跨部门协作 |
| **多项目模式** | 多个独立项目，各自绑定群组 | 多条业务线、多项目并行 |

### 核心概念

- **项目 (Project)**: 包含任务、看板、配置的独立工作区
- **群组 (Group)**: 飞书群组，用于任务讨论和 Agent 交互
- **绑定 (Binding)**: 项目与群组的关联关系
- **Agent**: OpenClaw AI 助手，负责任务调度和自动化

---

## 架构说明

### 单群组架构

```
┌─────────────┐
│  飞书群组 A  │
└──────┬──────┘
       │
       │ 绑定
       │
┌──────▼──────────────┐
│  Project-Manager    │
│  Agent (workspace)  │
└──────┬──────────────┘
       │
       │ 管理
       │
┌──────▼──────────────┐
│  可视化看板后端      │
│  + 任务 JSON        │
└──────┬──────────────┘
       │
       │ 提供
       │
┌──────▼──────────────┐
│  可视化看板前端      │
│  (http://localhost) │
└─────────────────────┘
```

### 多群组架构

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  飞书群组 A  │  │  飞书群组 B  │  │  飞书群组 C  │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                 │                 │
       │ 绑定             │ 绑定             │ 绑定
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │
              ┌──────────▼──────────┐
              │  Project-Manager    │
              │  Agent (workspace)  │
              └──────────┬──────────┘
                         │
                         │ 管理
                         │
              ┌──────────▼──────────┐
              │  可视化看板后端      │
              │  + 任务 JSON        │
              └──────────┬──────────┘
                         │
                         │ 提供
                         │
              ┌──────────▼──────────┐
              │  可视化看板前端      │
              │  (http://localhost) │
              └─────────────────────┘
```

**关键特点**：
- 一个 Project-Manager Agent 可以管理多个群组
- 每个群组可以有独立的任务数据（可选）
- 看板可以同时显示多个群组的任务（可选）

---

## 部署模式

### 模式 1: 单群组模式（推荐新用户）

#### 特点
- ✅ 配置简单
- ✅ 快速上手
- ✅ 资源占用少

#### 适用场景
- 个人项目管理
- 小团队协作
- 试用阶段

#### 配置步骤

1. **安装项目**
   ```bash
   git clone https://github.com/CCCaptain0129/OpenClaw_Visualization.git
   cd OpenClaw_Visualization
   ./install-full.sh
   ```

2. **配置群组**
   安装时会提示输入群组 ID：
   ```
   请输入要绑定的飞书群组 ID: oc_xxxxxxxxxx
   ```

3. **启动服务**
   ```bash
   ./start.sh
   ```

4. **访问看板**
   ```
   http://localhost:5173
   ```

---

### 模式 2: 多群组模式

#### 特点
- ✅ 一个 Agent 管理多个群组
- ✅ 集中维护
- ✅ 成本较低

#### 适用场景
- 大团队多个项目组
- 跨部门协作
- 需要统一管理的场景

#### 配置步骤

1. **安装项目**
   ```bash
   git clone https://github.com/CCCaptain0129/OpenClaw_Visualization.git
   cd OpenClaw_Visualization
   ./install-full.sh
   ```

2. **编辑 OpenClaw 配置**
   ```bash
   vim ~/.openclaw/openclaw.json
   ```

3. **添加多个群组绑定**
   ```json
   {
     "agents": {
       "list": [{
         "id": "project-manager",
         "name": "project-manager",
         "workspace": "~/.openclaw/project-manager-workspace"
       }]
     },
     "bindings": [
       {
         "agentId": "project-manager",
         "match": {
           "channel": "feishu",
           "accountId": "chat",
           "group": "oc_first_group_id"
         }
       },
       {
         "agentId": "project-manager",
         "match": {
           "channel": "feishu",
           "accountId": "chat",
           "group": "oc_second_group_id"
         }
       },
       {
         "agentId": "project-manager",
         "match": {
           "channel": "feishu",
           "accountId": "chat",
           "group": "oc_third_group_id"
         }
       }
     ]
   }
   ```

4. **重启 OpenClaw**
   ```bash
   openclaw stop
   openclaw start
   ```

5. **验证绑定**
   ```bash
   openclaw bindings list
   ```

6. **访问看板**
   ```
   http://localhost:5173
   ```

---

### 模式 3: 多项目模式

#### 特点
- ✅ 每个项目独立管理
- ✅ 数据隔离
- ✅ 灵活性高

#### 适用场景
- 多条业务线
- 不同团队独立运作
- 需要数据隔离的场景

#### 配置步骤

**项目 A 配置**

1. **创建项目目录**
   ```bash
   mkdir -p ~/projects/project-a
   cd ~/projects/project-a
   ```

2. **克隆代码**
   ```bash
   git clone https://github.com/CCCaptain0129/OpenClaw_Visualization.git
   cd OpenClaw_Visualization
   ```

3. **修改端口配置**
   ```bash
   vim src/backend/config/openclaw.json
   ```
   ```json
   {
     "server": {
       "port": 3000,
       "wsPort": 3001,
       "frontendPort": 5173
     }
   }
   ```

4. **安装并启动**
   ```bash
   ./install-full.sh
   ./start.sh
   ```

5. **配置群组绑定**
   ```bash
   openclaw bind feishu --group oc_project_a_group --agent project-manager
   ```

**项目 B 配置**

1. **创建项目目录**
   ```bash
   mkdir -p ~/projects/project-b
   cd ~/projects/project-b
   ```

2. **克隆代码**
   ```bash
   git clone https://github.com/CCCaptain0129/OpenClaw_Visualization.git
   cd OpenClaw_Visualization
   ```

3. **修改端口配置**（避免冲突）
   ```bash
   vim src/backend/config/openclaw.json
   ```
   ```json
   {
     "server": {
       "port": 3010,
       "wsPort": 3011,
       "frontendPort": 5183
     }
   }
   ```

4. **安装并启动**
   ```bash
   ./install-full.sh
   ./start.sh
   ```

5. **配置群组绑定**
   ```bash
   openclaw bind feishu --group oc_project_b_group --agent project-manager
   ```

---

## 快速开始

### 场景：为一个新的群组启用项目管理

#### 前提条件

- ✅ 已安装 OpenClaw CLI
- ✅ 已运行 `openclaw gateway start`
- ✅ 已安装可视化看板项目
- ✅ 拥有飞书群组 ID

#### 步骤

1. **获取群组 ID**
   - 在飞书中打开目标群组
   - 复制 URL 中的群组 ID（格式：`oc_xxxxxxxxxx`）

2. **绑定群组**
   ```bash
   # 方法 1：使用 CLI
   openclaw bind feishu \
     --group oc_xxxxxxxxxx \
     --agent project-manager \
     --channel chat

   # 方法 2：编辑配置文件
   vim ~/.openclaw/openclaw.json
   ```

3. **重启 OpenClaw**
   ```bash
   openclaw stop
   openclaw start
   ```

4. **验证绑定**
   ```bash
   openclaw bindings list
   ```

5. **测试**
   - 在飞书群组中发送消息给 Project-Manager Agent
   - 尝试创建任务

---

## 详细配置

### 获取飞书群组 ID

#### 方法 1：从 URL 获取

1. 在飞书中打开群组
2. 复制 URL：`https://open.feishu.cn/client/xxx/wiki/oc_xxxxxxxxxx`
3. 群组 ID 是 `oc_xxxxxxxxxx` 部分

#### 方法 2：使用飞书 API

```bash
curl "https://open.feishu.cn/open-apis/bot/v3/channels" \
  -H "Authorization: Bearer ${APP_ACCESS_TOKEN}"
```

### 配置飞书应用权限

需要在飞书开放平台配置以下权限：

| 权限 | 说明 |
|------|------|
| `im:message` | 发送消息 |
| `im:chat` | 读取群组信息 |
| `im:group_at_msg` | 接收群组 @ 消息 |

### 多群组任务数据隔离

#### 方案 1：共享数据（默认）

所有群组使用同一个任务数据：

```
tasks/
├── pm-workflow-automation-tasks.json  # 所有群组共享
└── openclaw-visualization-tasks.json
```

#### 方案 2：独立数据（推荐）

每个群组使用独立的任务数据：

```
tasks/
├── group-a/
│   └── tasks.json
├── group-b/
│   └── tasks.json
└── group-c/
    └── tasks.json
```

**配置方式**：

编辑 `src/backend/config/openclaw.json`：

```json
{
  "tasks": {
    "dataDir": "tasks/groups",
    "isolation": "per-group"
  }
}
```

---

## 验证步骤

### 检查列表

#### 1. 检查 OpenClaw 状态

```bash
openclaw status
```

期望输出：
```
OpenClaw Status: running
Gateway: connected
Agents: 1 running
Bindings: 3 active
```

#### 2. 检查群组绑定

```bash
openclaw bindings list
```

期望输出：
```
Bindings:
- project-manager -> feishu:chat:group:oc_first_group_id
- project-manager -> feishu:chat:group:oc_second_group_id
- project-manager -> feishu:chat:group:oc_third_group_id
```

#### 3. 检查 Agent Workspace

```bash
ls ~/.openclaw/agents/project-manager/
```

期望输出：
```
sessions/  skills/  workspace/
```

#### 4. 检查后端服务

```bash
curl http://localhost:3000/health
```

期望输出：
```json
{
  "status": "ok",
  "timestamp": "2026-03-14T09:00:00.000Z"
}
```

#### 5. 测试群组通信

在飞书群组中发送消息：

```
@Project-Manager 帮我创建一个新任务
```

期望结果：
- Agent 回复确认消息
- 任务创建成功
- 看板中显示新任务

---

## 常见问题

### Q: 一个 Agent 可以绑定多少个群组？

**A:** 理论上无限制，但建议不超过 10 个，以保持性能。

### Q: 如何查看当前绑定的所有群组？

**A:** 运行：
```bash
openclaw bindings list
```

### Q: 如何解绑群组？

**A:** 编辑 `~/.openclaw/openclaw.json`，删除对应绑定，然后重启：
```bash
openclaw stop
openclaw start
```

### Q: 多个群组的任务会互相干扰吗？

**A:** 不会。每个群组的消息是独立的，Agent 会根据消息来源处理对应的任务。

### Q: 如何在不同群组中使用不同的 Agent？

**A:** 配置多个 Agent，分别绑定到不同群组：

```json
{
  "agents": {
    "list": [
      {"id": "pm-team-a", "name": "PM Team A"},
      {"id": "pm-team-b", "name": "PM Team B"}
    ]
  },
  "bindings": [
    {"agentId": "pm-team-a", "match": {"group": "oc_group_a"}},
    {"agentId": "pm-team-b", "match": {"group": "oc_group_b"}}
  ]
}
```

### Q: 端口冲突怎么办？

**A:** 修改 `src/backend/config/openclaw.json` 中的端口配置：

```json
{
  "server": {
    "port": 3010,
    "wsPort": 3011,
    "frontendPort": 5183
  }
}
```

### Q: 如何备份多群组数据？

**A:** 定期备份 `tasks/` 目录：

```bash
# 备份所有任务数据
tar -czf tasks-backup-$(date +%Y%m%d).tar.gz tasks/

# 备份到远程
scp tasks-backup-*.tar.gz user@remote:/backup/
```

### Q: 如何迁移群组数据？

**A:** 1. 导出任务 JSON，2. 修改群组 ID，3. 重新导入

---

## 高级配置

### 自定义 Agent 行为

编辑 `~/.openclaw/agents/project-manager/SOUL.md`：

```markdown
# SOUL.md - PM Agent 配置

- **Group**: 项目管理团队
- **Tone**: 专业、高效、友好
- **Language**: 中文
- **Timezone**: Asia/Shanghai

## 群组特定行为

### 群组 A (产品团队)
- 关注产品规划、需求分析
- 使用产品术语

### 群组 B (研发团队)
- 关注技术实现、代码质量
- 使用技术术语
```

### 自定义任务模板

创建 `tasks/templates/task-template.json`：

```json
{
  "status": "todo",
  "priority": "P2",
  "labels": [],
  "assignee": null,
  "claimedBy": null,
  "createdAt": "${timestamp}",
  "updatedAt": "${timestamp}"
}
```

### 自定义健康检查

编辑 `scripts/health-check.mjs`：

```javascript
export async function checkHealth() {
  const checks = [
    checkGateway(),
    checkBackend(),
    checkFrontend(),
    checkBindings(),
    checkAgents()
  ];

  return Promise.all(checks);
}
```

---

## 监控与维护

### 日志查看

```bash
# 查看后端日志
tail -f tmp/backend.log

# 查看 Agent 日志
tail -f ~/.openclaw/agents/project-manager/sessions/sessions.log

# 查看 Gateway 日志
openclaw logs --gateway
```

### 性能监控

```bash
# 查看系统资源
htop

# 查看 OpenClaw 性能
openclaw status --verbose
```

### 定期维护

建议每月执行：

```bash
# 1. 备份数据
./scripts/backup.sh

# 2. 清理旧日志
./scripts/cleanup-logs.sh --days 30

# 3. 更新依赖
npm update

# 4. 重启服务
./stop.sh && ./start.sh
```

---

## 安全建议

### 配置文件权限

```bash
chmod 600 ~/.openclaw/openclaw.json
chmod 600 src/backend/config/openclaw.json
```

### 网络隔离

- 后端 API 不要暴露到公网
- 使用反向代理（Nginx）添加认证
- 启用 HTTPS

### 访问控制

- 限制飞书应用权限
- 使用群组 @ 提及触发（避免误触发）
- 定期审计绑定列表

---

## 故障排查

### 群组无法接收消息

**检查清单**：
- [ ] Gateway 是否运行：`openclaw gateway status`
- [ ] 绑定是否正确：`openclaw bindings list`
- [ ] 飞书应用权限是否配置
- [ ] 群组 ID 是否正确

### 任务不显示

**检查清单**：
- [ ] 后端服务是否运行：`curl http://localhost:3000/health`
- [ ] 任务 JSON 是否存在：`ls tasks/`
- [ ] 前端是否能连接后端：打开浏览器控制台

### Agent 无响应

**检查清单**：
- [ ] Agent 是否运行：`openclaw agents list`
- [ ] 会话是否正常：`openclaw sessions list`
- [ ] 心跳是否配置：检查 `HEARTBEAT.md`

---

## 最佳实践

### 1. 命名规范

- 群组名称：`[项目名]-[团队]-项目管理`
- 任务 ID：`[项目前缀]-[序号]`（如 `PMW-001`）
- Agent ID：`[项目]-[角色]`（如 `project-manager`）

### 2. 文档管理

- 每个群组维护独立的 README
- 记录重要决策和变更
- 定期更新文档

### 3. 任务管理

- 使用 8 段式模板创建任务
- 保持任务描述简洁清晰
- 及时更新任务状态

### 4. 沟通规范

- 使用 @ 提及触发 Agent
- 明确指定任务目标
- 提供必要的上下文

---

## 相关文档

- [安装指南](./INSTALL.md)
- [安装包指南](./INSTALL-PACKAGE.md)
- [任务分解指引](../project-management/task-breakdown-guide.md)
- [OpenClaw 文档](https://docs.openclaw.ai)

---

## 获取帮助

- GitHub Issues: https://github.com/CCCaptain0129/OpenClaw_Visualization/issues
- 飞书群：oc_0754a493527ed8a4b28bd0dffdf802de
- 邮箱：support@openclaw.ai

---

*最后更新: 2026-03-14*