# Project Manager Agent Templates

此目录包含 Project Manager Agent 的模板文件，由 PM-Workflow-Automation 安装脚本自动生成和管理。

## 目录结构

```
templates/
├── AGENTS.md          # Agent 工作区指南
├── SOUL.md            # Agent 人格定义
├── USER.md            # 用户信息
├── TOOLS.md           # 工具配置
├── IDENTITY.md        # Agent 身份
├── HEARTBEAT.md       # 心跳配置
└── README.md          # 本文件
```

## 文档说明

### AGENTS.md

Project Manager Agent 的工作区指南，包含：

- **目录说明** - 文件和文件夹的用途
- **Agent 角色** - Agent 的职责（任务调度、分发、跟踪）
- **心跳机制** - 定期检查和任务分配流程
- **工作目录** - 项目根目录和关键文件位置
- **配置位置** - OpenClaw 主配置和后端配置
- **注意事项** - 重要提醒（如不直接修改 JSON 文件）
- **相关文档** - 链接到项目管理规范、任务分解指引、优化文档等

### SOUL.md

Project Manager Agent 的"灵魂"文件，定义：

- Agent 的核心人格和行为准则
- 与用户交互的风格和语气
- 决策逻辑和边界

**注意**：此文件应保持稳定，不建议频繁修改。

### USER.md

用户信息模板，记录：

- 用户的基本信息（姓名、称呼、时区）
- 用户的偏好和习惯
- 项目背景和需求

**注意**：此文件由用户填写，包含个人特定信息。

### TOOLS.md

工具配置文件，记录：

- **OpenClaw CLI** - 常用命令和操作
- **心跳脚本** - 使用方法和参数
- **任务 API** - REST API 端点和使用示例
- **配置文件** - 后端和主配置的位置和格式
- **端口说明** - 各服务的端口映射
- **文档索引** - 相关文档的快速访问路径

### IDENTITY.md

Agent 身份模板，包含：

- Agent 名称
- 类型/生物形态
- 氛围/风格
- 签名 Emoji
- 头像路径

**注意**：此文件由用户填写，用于个性化 Agent。

### HEARTBEAT.md

心跳配置文件，定义：

- **心跳任务** - 每次心跳执行的脚本和功能
- **汇报规则** - 何时汇报、何时静默
- **配置文件** - 相关配置文件的位置
- **关键文件位置** - 调度脚本、配置、文档路径
- **可选任务** - 文档更新检查等扩展功能
- **心跳间隔** - 默认 5 分钟，可配置
- **手动操作** - 单次执行、持续运行、自定义配置

## 相关文档

### 核心文档

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

## 使用指南

### 首次使用

1. 阅读 `AGENTS.md` 了解 Agent 的角色和职责
2. 填写 `USER.md` 记录用户信息
3. 填写 `IDENTITY.md` 定义 Agent 身份
4. 阅读 `TOOLS.md` 了解可用工具和配置
5. 阅读 `HEARTBEAT.md` 配置心跳机制

### 日常使用

- **创建任务**：参考 [任务分解指引](../project-management/task-breakdown-guide.md)
- **查看调度逻辑**：参考 [Dispatcher 优化思路](../docs/pm-agent-dispatcher-optimization.md)
- **配置多群组**：参考 [多群组部署指南](../docs/MULTI-GROUP-DEPLOYMENT.md)
- **查看完整 Prompt**：参考 [Prompt 可见性方案](../docs/project-manager-prompt-visibility.md)

### 定期检查

建议定期（每周）检查以下文档是否有更新：

- `project-management/PROJECT-MANAGEMENT-GUIDE.md` - 项目管理规范更新
- `project-management/task-breakdown-guide.md` - 任务分解模板改进
- `docs/pm-agent-dispatcher-optimization.md` - 调度器优化
- `docs/MULTI-GROUP-DEPLOYMENT.md` - 部署指南更新

## 文件权限

- `AGENTS.md`、`TOOLS.md`、`HEARTBEAT.md` - 由安装脚本生成，可手动编辑
- `SOUL.md` - Agent 人格定义，应保持稳定
- `USER.md`、`IDENTITY.md` - 用户填写，包含个人信息

## 版本控制

**哪些文件应提交到 Git：**

- ✅ `AGENTS.md` - Agent 工作区指南
- ✅ `TOOLS.md` - 工具配置
- ✅ `HEARTBEAT.md` - 心跳配置
- ✅ `SOUL.md` - Agent 人格定义（初始版本）
- ✅ `README.md` - 本文件

**哪些文件不应提交到 Git：**

- ❌ `USER.md` - 包含用户个人信息
- ❌ `IDENTITY.md` - 用户个性化配置
- ❌ 包含敏感信息的配置文件

## 故障排查

### Agent 无响应

1. 检查心跳配置是否正确：`cat HEARTBEAT.md`
2. 检查调度脚本是否可执行：`ls -la scripts/pm-agent-dispatcher.mjs`
3. 检查 OpenClaw Gateway 状态：`openclaw gateway status`

### 任务不分配

1. 检查任务 JSON 文件是否存在：`ls tasks/*.json`
2. 检查任务状态是否为 `in-progress`
3. 查看调度日志：`tail -f tmp/logs/pm-dispatcher.log`

### 文档链接失效

1. 确认文档路径正确：`ls -la project-management/` 和 `ls -la docs/`
2. 检查文档是否存在：`cat project-management/PROJECT-MANAGEMENT-GUIDE.md`

## 更新记录

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| 1.0 | 2026-03-14 | 初始版本，添加模板文件和文档引用 |
| 1.1 | 2026-03-14 | 添加相关文档链接，更新 TOOLS.md 和 HEARTBEAT.md |

## 获取帮助

- **GitHub Issues**: https://github.com/CCCaptain0129/OpenClaw_Visualization/issues
- **飞书群**: oc_0754a493527ed8a4b28bd0dffdf802de

---

*最后更新: 2026-03-14*
*此文件由安装脚本生成，可手动编辑*