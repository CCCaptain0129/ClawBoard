# HEARTBEAT.md - Project Manager 心跳配置

## 心跳任务

每次心跳时执行 PM-Agent 调度脚本：

### 1. 执行调度脚本

```bash
cd __PROJECT_ROOT__
node scripts/pm-agent-dispatcher.mjs --once
```

### 2. 功能说明

- 拉取所有项目的任务
- 筛选 `status=in-progress` 且 `claimedBy` 为空的任务
- 按优先级排序（P0→P1→P2→P3）
- 检查并发限制（默认最大 3 个）
- 生成高质量 Prompt（全局约束 + 任务信息）
- 调用 OpenClaw sessions_spawn 创建 subagent
- 更新任务 `claimedBy` 字段
- 记录 Prompt 到 `tmp/logs/pm-prompts.log`
- 记录分发到 `docs/internal/SUBAGENTS任务分发记录.md`

### 3. 汇报规则

- **有新任务分配**: 在群组中汇报任务 ID 和 subagent 状态
- **任务完成**: SubagentMonitorService 自动检测并更新
- **无待分配任务**: 回复 `HEARTBEAT_OK`
- **达到并发上限**: 回复 `HEARTBEAT_OK:max_concurrency`

### 4. 配置文件

- 主配置: `config/pm-agent-dispatcher.json`
- 任务数据: `tasks/*.json`
- 分发记录: `docs/internal/SUBAGENTS任务分发记录.md`
- Prompt 日志: `tmp/logs/pm-prompts.log`

### 5. 关键文件位置

- 调度脚本: `__PROJECT_ROOT__/scripts/pm-agent-dispatcher.mjs`
- 配置文件: `__PROJECT_ROOT__/config/pm-agent-dispatcher.json`
- 文档: `__PROJECT_ROOT__/docs/PROJECT-MANAGER-AGENT.md`

### 6. 可选任务：文档更新检查

每次心跳时可以检查以下文档是否有更新：

```bash
# 检查项目管理文档是否有更新
git -C __PROJECT_ROOT__ pull --quiet

# 检查相关文档路径
ls -la project-management/task-breakdown-guide.md
ls -la project-management/PROJECT-MANAGEMENT-GUIDE.md
ls -la docs/pm-agent-dispatcher-optimization.md
ls -la docs/project-manager-prompt-visibility.md
ls -la docs/MULTI-GROUP-DEPLOYMENT.md
```

**何时启用**：
- 当需要确保使用最新的任务分解指引时
- 当优化调度器逻辑时
- 当配置多群组部署时

**通知规则**：
- 发现文档更新时，在群组中提示用户查看
- 静默检查，不频繁打扰用户（每天最多提示一次）

---

## 心跳间隔

默认: 5 分钟

可在 `~/.openclaw/openclaw.json` 中配置：

```json
{
  "agents": {
    "list": [{
      "id": "project-manager",
      "heartbeat": {
        "every": "5m"
      }
    }]
  }
}
```

---

## 手动操作

### 单次执行

```bash
node scripts/pm-agent-dispatcher.mjs --once
```

### 持续运行

```bash
node scripts/pm-agent-dispatcher.mjs
```

### 使用自定义配置

```bash
node scripts/pm-agent-dispatcher.mjs --config ./my-config.json
```

---

*此文件控制心跳行为*