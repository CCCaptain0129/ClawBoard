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
- `scripts/heartbeat-loop.mjs` - 心跳脚本
- `docs/internal/SUBAGENTS任务分发记录.md` - 分发记录

## 配置位置

- OpenClaw 主配置: `~/.openclaw/openclaw.json`
- 后端配置: `__PROJECT_ROOT__/src/backend/config/openclaw.json`

## 注意事项

- 不要修改 `tasks/*.json` 文件，使用 API 操作
- 心跳脚本在项目根目录下运行
- 敏感配置存储在 `openclaw.json`，权限 600

---
*此文件由安装脚本生成，可手动编辑*