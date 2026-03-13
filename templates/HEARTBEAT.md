# HEARTBEAT.md - Project Manager 心跳配置

## 心跳任务

每次心跳时执行以下操作：

### 1. 检查待办任务

```bash
cd __PROJECT_ROOT__/scripts
node heartbeat-loop.mjs
```

### 2. 功能说明

- 拉取 pm-workflow-automation 项目的 todo 任务
- 按优先级排序（P0→P1→P2→P3）
- 限制并发 subagent 数量 = 3
- 对高优先级任务调用 `/api/tasks/subagent/create`
- 记录到 `docs/internal/SUBAGENTS任务分发记录.md`

### 3. 汇报规则

- **有新任务分配**: 在群组中汇报任务 ID 和 subagent 状态
- **任务完成**: 简要汇报结果
- **无待办任务**: 回复 `HEARTBEAT_OK`

### 4. 脚本位置

- 心跳脚本: `__PROJECT_ROOT__/scripts/heartbeat-loop.mjs`
- 任务数据: `__PROJECT_ROOT__/tasks/pm-workflow-automation-tasks.json`
- 分发记录: `__PROJECT_ROOT__/docs/internal/SUBAGENTS任务分发记录.md`

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

*此文件控制心跳行为*