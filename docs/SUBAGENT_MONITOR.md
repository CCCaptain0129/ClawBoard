# SubagentMonitorService 使用说明

## 概述

`SubagentMonitorService` 是一个监控服务，用于自动检测和补齐已完成的 Subagent 任务状态。它解决了"Subagent 已结束但任务仍显示 in-progress"的问题。

## 核心功能

1. **定期检查**：每 30 秒检查一次 `SUBAGENTS任务分发记录.md` 中仍标记为"进行中"的 Subagent
2. **状态检测**：结合 OpenClaw sessions store 判断 Subagent 是否已结束
3. **自动补齐**：若检测到 Subagent 已结束，自动调用 `SubagentManager.markSubagentComplete` 更新任务状态
4. **幂等性保证**：避免重复处理已完成的 Subagent
5. **误判防护**：使用 2 分钟阈值避免误判仍在运行的 Subagent

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                  SubagentMonitorService                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  每 30 秒执行一次检查                                         │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  1. 读取 SUBAGENTS任务分发记录.md                    │    │
│  │     → 提取所有状态为 🔄 进行中 的 subagentId        │    │
│  └─────────────────────────────────────────────────────┘    │
│                              ↓                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  2. 检查每个 subagent 的状态                         │    │
│  │     a. 读取 sessions.json                           │    │
│  │     b. 查找对应 session                             │    │
│  │     c. 检查最后更新时间                             │    │
│  │     d. 判断是否 >= 2 分钟无更新                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                              ↓                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  3. 标记已完成的 subagent                           │    │
│  │     a. 跳过已处理的（幂等性）                        │    │
│  │     b. 调用 markSubagentComplete()                  │    │
│  │     c. 更新任务状态为 done/todo                     │    │
│  │     d. 清空 claimedBy 字段                          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 配置选项

```typescript
const monitorService = new SubagentMonitorService({
  sessionsJsonPath: '/Users/ot/.openclaw/agents/main/sessions/sessions.json',  // sessions.json 路径
  recordingPath: '/path/to/SUBAGENTS任务分发记录.md',                          // 记录文件路径
  intervalMs: 30000,                                                            // 轮询间隔（默认 30 秒）
  completionThresholdMs: 120000                                                 // 完成阈值（默认 2 分钟）
});
```

## 使用方法

### 1. 启动监控服务

```typescript
import { SubagentMonitorService } from './services/subagentMonitor';

const monitorService = new SubagentMonitorService();
monitorService.start();
```

### 2. 停止监控服务

```typescript
monitorService.stop();
```

### 3. 获取当前进行中的 Subagent 状态

```typescript
const statuses = await monitorService.getInProgressSubagentStatuses();

for (const status of statuses) {
  console.log(`Subagent ID: ${status.subagentId}`);
  console.log(`任务 ID: ${status.taskId}`);
  console.log(`最后更新: ${status.lastUpdateTimestamp}`);
  console.log(`可能已完成: ${status.isLikelyFinished}`);
}
```

## 判定逻辑

Subagent 被判定为"可能已完成"的条件：

1. **Session 不存在**：在 `sessions.json` 中找不到对应的 session
2. **Session 超时**：Session 存在但最后更新时间 >= 2 分钟前

### 阈值设置

- **默认阈值**：2 分钟（120,000 毫秒）
- **推荐值**：
  - 快速响应：1 分钟（适合测试环境）
  - 稳定运行：2-3 分钟（适合生产环境）
  - 长时任务：5-10 分钟（适合复杂任务）

## 幂等性保证

为避免重复处理，`SubagentMonitorService` 使用内存缓存记录已处理的 Subagent：

```typescript
private processedSubagents: Set<string> = new Set();
```

- 每次检测到已完成的 Subagent 后，将其添加到缓存
- 后续检查时跳过缓存的 Subagent
- 可通过 `clearProcessedCache()` 清空缓存（用于测试）

## 测试方法

### 自动化测试脚本

运行测试脚本：

```bash
node tests/test-subagent-monitor.mjs
```

测试内容：
1. 获取所有进行中的 Subagent 状态
2. 执行一次检查并验证自动完成功能
3. 验证幂等性（不重复处理）
4. 启动监控服务并运行 10 秒

### 手动测试步骤

1. **创建测试 Subagent**

```bash
# 在 Feishu 群组中触发创建 Subagent
/subagent create TASK-TEST-001
```

2. **检查 Subagent 状态**

```typescript
const statuses = await monitorService.getInProgressSubagentStatuses();
console.log(statuses);
```

3. **等待 Subagent 完成**

等待 2 分钟让 Subagent 完成

4. **验证自动完成**

```bash
# 查看记录文件
cat docs/internal/SUBAGENTS任务分发记录.md
```

应该看到状态更新为：
```markdown
**释放时间**: 2026-03-13 10:30
**状态**: ✅ 成功（自动检测）

**返回结果**:
- Subagent 已自动检测完成
```

## 集成到后端服务

`SubagentMonitorService` 已集成到 `src/backend/src/index.ts`：

```typescript
import { SubagentMonitorService } from './services/subagentMonitor';

// 创建实例
const subagentMonitorService = new SubagentMonitorService();

// 启动服务
subagentMonitorService.start();
console.log('🔍 Subagent monitor service started');

// 停止服务（在 SIGTERM 处理中）
process.on('SIGTERM', () => {
  subagentMonitorService.stop();
  // ... 其他清理工作
});
```

## 日志输出

监控服务会输出详细的日志：

```
[SubagentMonitorService] Starting...
  - Interval: 30000ms
  - Completion threshold: 120000ms
  - Recording file: /path/to/SUBAGENTS任务分发记录.md
[SubagentMonitorService] Checking for completed subagents...
[SubagentMonitorService] Found 16 in-progress subagents
[SubagentMonitorService] Subagent agent:main:subagent:xxx: {
  exists: false,
  lastUpdate: null,
  minutesSinceUpdate: null,
  isLikelyFinished: true
}
[SubagentMonitorService] Found 5 completed subagents
[SubagentMonitorService] Marking subagent agent:main:subagent:xxx as complete...
[SubagentMonitorService] ✓ Subagent agent:main:subagent:xxx marked as complete
```

## 故障排查

### 问题：Subagent 没有被自动完成

**可能原因**：
1. Session 仍在更新（最后更新时间 < 2 分钟）
2. Session 在 sessions.json 中不存在但记录文件中已标记为完成
3. 正则表达式匹配失败

**排查步骤**：
1. 检查 sessions.json 中是否存在对应 session
2. 检查最后更新时间是否 >= 2 分钟
3. 查看日志中的 `isLikelyFinished` 状态

### 问题：Subagent 被误判为已完成

**可能原因**：
1. 阈值设置过短
2. Subagent 执行时间较长但无更新

**解决方案**：
1. 增加完成阈值（如改为 5 分钟）
2. 在 Subagent 中添加心跳更新机制

### 问题：重复处理已完成的 Subagent

**可能原因**：
1. 服务重启后缓存被清空
2. 记录文件中的状态未正确更新

**解决方案**：
1. 检查记录文件中的状态是否正确更新
2. 在启动时从记录文件读取已完成状态并初始化缓存

## 未来改进

1. **持久化缓存**：将已处理的 Subagent ID 保存到文件，服务重启后恢复
2. **智能阈值**：根据任务类型动态调整完成阈值
3. **心跳机制**：要求 Subagent 定期发送心跳，更准确地判断状态
4. **结果回传**：Subagent 完成后主动推送结果，而非被动轮询
5. **监控指标**：添加 Prometheus 指标，监控检测延迟、成功率等

## 相关文件

- `src/backend/src/services/subagentMonitor.ts` - 监控服务实现
- `src/backend/src/services/subagentManager.ts` - Subagent 管理器
- `docs/internal/SUBAGENTS任务分发记录.md` - Subagent 分发记录
- `tests/test-subagent-monitor.mjs` - 测试脚本
- `src/backend/src/index.ts` - 后端服务入口