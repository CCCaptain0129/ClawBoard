# Subagent 看板绑定指南

## 问题背景

当 main agent 使用 `sessions_spawn` 创建 subagent 执行开发任务时，看板任务不会自动进入 in-progress 状态，导致看板 in-progress 列为空。

## 解决方案

增强 `SubagentMonitorService` 以自动检测 OpenClaw sessions.json 中的新 subagent 会话，从 label 中解析任务 ID，自动注册并更新任务状态。

## 使用方法

### 1. Label 命名规范

在创建 subagent 时，**必须在 label 中包含任务 ID**：

```
# 推荐格式
<TASK-ID>-<简短描述>[-glm5]

# 示例
PMW-033-fix-kanban-binding-glm5
VIS-012-improve-ui
INT-005-add-api-endpoint
```

**支持的任务 ID 格式：**
- `PMW-001` - PMW 项目任务
- `VIS-012` - 可视化项目任务
- `INT-005` - 集成项目任务
- `TASK-TEST-001` - 复合格式任务

### 2. 自动绑定流程

当 SubagentMonitorService 检测到新的 subagent 会话时：

1. 从 label 解析任务 ID
2. 查找任务所在项目
3. 更新任务状态为 `in-progress`
4. 设置 `claimedBy` 为 subagent ID
5. 写入 `SUBAGENTS任务分发记录.md`

### 3. 自动完成流程

当 subagent 会话结束（>=2分钟无更新）时：

1. 自动调用 `SubagentManager.markSubagentComplete`
2. 更新任务状态为 `done`
3. 清空 `claimedBy` 字段
4. 更新记录文件

## 验证方法

### 1. 创建带任务 ID 的 subagent

```bash
# 在 main agent 中，使用包含任务 ID 的 label
sessions_spawn --label "PMW-033-fix-kanban-binding-glm5" "修复看板绑定问题"
```

### 2. 检查看板

打开看板页面，确认：
- 任务出现在 in-progress 列
- 任务卡片显示 claimedBy

### 3. 等待 subagent 完成

subagent 完成后，确认：
- 任务自动移动到 done 列
- claimedBy 字段被清空

## 错误排查

### Q: 任务没有出现在 in-progress 列

**可能原因：**
1. Label 中不包含任务 ID
2. 任务 ID 格式不正确
3. 任务不存在于任何项目中

**解决方法：**
1. 确保 label 以任务 ID 开头，如 `PMW-033-xxx`
2. 检查任务 ID 是否存在于对应项目的任务文件中

### Q: 任务完成后没有自动变 done

**可能原因：**
1. SubagentMonitorService 未运行
2. 网络或服务问题

**解决方法：**
1. 检查后端服务日志
2. 手动调用 `/api/tasks/subagent/complete`

## 技术细节

### SubagentMonitorService 新增功能

- `detectAndRegisterNewSubagents()`: 检测新的 subagent 会话
- `parseTaskIdFromLabel()`: 从 label 解析任务 ID
- `registerSubagent()`: 注册 subagent 并更新任务状态

### 配置项

```typescript
{
  sessionsJsonPath: '/Users/ot/.openclaw/agents/main/sessions/sessions.json',
  recordingPath: '/Users/ot/.openclaw/workspace/projects/openclaw-visualization/docs/internal/SUBAGENTS任务分发记录.md',
  intervalMs: 30000,  // 检查间隔 30 秒
  completionThresholdMs: 120000  // 完成判定阈值 2 分钟
}
```

## 更新日志

- 2026-03-13: 初始实现，支持从 label 自动解析任务 ID