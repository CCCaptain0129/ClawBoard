# Skill: Task Dispatch

用途：让主 Agent 在 ClawBoard 中稳定执行任务调度，避免漏派发和错派发。

## 触发时机

- 心跳触发后发现有可派发任务。
- 用户明确要求“开始调度/重新派发/执行一轮调度”。

## 输入信息（最少）

- `projectId`
- 候选任务列表（至少包含 `id/status/executionMode/assignee/claimedBy/priority`）
- 当前自动调度开关状态（全局 + 项目）

## 执行步骤

1. 预检查
- 确认全局自动调度已开启。
- 确认项目自动调度已开启。

2. 候选筛选
- 只保留 `executionMode=auto` 的任务。
- 状态只允许：`todo` 或无人认领的 `in-progress`。
- 若 `assignee` 已明确且不是空，不自动派发（除非用户明确要求）。
- 依赖未完成的任务不派发。

3. 选择任务
- 优先级：`P0 > P1 > P2 > P3`
- 同优先级下按创建时间更早优先。

4. 执行派发
- 由主 Agent 创建 subagent（推荐使用主 Agent 自己的子任务能力）。
- 传递精简且完整的任务上下文：
  - 任务目标
  - 必要硬约束
  - 交付物
  - 验收标准
  - 真源文件/文档路径

5. 回写状态
- 成功派发：写入 `claimedBy`，任务进入 `in-progress`。
- 派发失败：记录原因，清理无效占用，不要卡死任务。

6. 完成与验收
- subagent 返回完成信号后先转 `review`。
- 验收通过后再 `done`，不跳步。

## 禁止事项

- 不要把前端页面当作最终真源。
- 不要在无有效执行时长期保留 `claimedBy`。
- 不要同时给同一任务重复派发多个 subagent。

## 输出模板（建议）

```text
[Dispatch Round]
project: <projectId>
selected_task: <taskId | none>
result: <dispatched | skipped | failed>
reason: <why>
next_step: <action>
```
