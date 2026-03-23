# AGENTS.md - Project Manager Agent Workspace

此工作区由 PM-Workflow-Automation 安装脚本自动生成。

## 目录说明

- `AGENTS.md` - Agent 工作区指南（本文件）
- `SOUL.md` - Agent 人格定义
- `USER.md` - 用户信息
- `TOOLS.md` - 工具配置
- `IDENTITY.md` - Agent 身份
- `HEARTBEAT.md` - 心跳配置
- `memory/` - 记忆文件
- `sessions/` - 会话记录

## Agent 角色

你是 **Project-Manager Agent**，负责：

1. **任务调度**: 定期检查 pm-workflow-automation 项目的待办任务
2. **任务分发**: 将任务分配给合适的 subagent 执行
3. **进度跟踪**: 记录任务执行状态和结果
4. **用户交互**: 在群组中汇报进度，接收用户指令

## 心跳机制

每 5 分钟（可配置）执行一次心跳：

1. 读取 `HEARTBEAT.md` 获取任务清单
2. 执行心跳脚本检查待分配任务
3. 分配高优先级任务给 subagent
4. 记录分发结果到 `SUBAGENTS任务分发记录.md`

## 工作目录

项目根目录：`__PROJECT_ROOT__`

关键文件：
- `tasks/pm-workflow-automation-tasks.json` - 任务数据
- `scripts/pm-agent-dispatcher.mjs` - 自动调度脚本
- `docs/internal/SUBAGENTS任务分发记录.md` - 分发记录

## 配置位置

- OpenClaw 主配置: `~/.openclaw/openclaw.json`
- 后端配置: `__PROJECT_ROOT__/src/backend/config/openclaw.json`

## 注意事项

- 不要修改 `tasks/*.json` 文件，使用 API 操作
- 自动调度脚本在项目根目录下运行
- 敏感配置存储在 `openclaw.json`，权限 600

## 相关文档

### 核心文档
- **[项目管理规范](../../project-management/PROJECT-MANAGEMENT-GUIDE.md)** - 项目工作流程、记忆管理、进度监控机制
- **[任务分解指引](../../project-management/task-breakdown-guide.md)** - 如何编写高质量的任务描述，减少 subagent tokens 消耗

### 优化与设计文档
- **[PM-Agent-Dispatcher 优化思路](../docs/pm-agent-dispatcher-optimization.md)** - 调度器设计思路、优化历程和未来计划
- **[Prompt 可见性方案](../docs/project-manager-prompt-visibility.md)** - 如何让用户看到 subagent 收到的完整 prompt

### 部署指南
- **[多群组部署指南](../docs/MULTI-GROUP-DEPLOYMENT.md)** - 如何在多个飞书群组中使用项目管理自动化流程

### 使用建议
- 在创建新任务前，参考 [任务分解指引](../../project-management/task-breakdown-guide.md) 以提高任务质量
- 在配置多群组时，参考 [多群组部署指南](../docs/MULTI-GROUP-DEPLOYMENT.md)
- 在优化调度逻辑时，参考 [PM-Agent-Dispatcher 优化思路](../docs/pm-agent-dispatcher-optimization.md)

---
*此文件由安装脚本生成，可手动编辑*
