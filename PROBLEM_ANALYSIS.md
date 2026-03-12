# OpenClaw 可视化项目 - 问题分析

## 当前问题

### VIS-001: 检查获取的 Agent 状态是否准确 ✅ 已修复

**现状：**
- 主 Agent 显示为 `idle`（16小时前有活动）
- 飞书群组显示为 `stopped`（9天前无活动）
- 所有 Agent 都不是真正的 "running" 状态

**问题：**
1. `updatedAt` 是会话配置的最后更新时间，不是真实的运行状态
2. 缺少 `lastRun` 字段（最后一次运行时间）
3. 无法区分 Agent 是否真的在后台工作

**根本原因：**
- 代码错误地使用 `updatedAt` 字段来判断 Agent 状态
- 真实的消息时间戳存储在 `sessionFile` 的 jsonl 文件中
- 没有读取 sessionFile 的最后消息时间戳

**修复方案：**
- 添加 `getLastMessageTimestamp()` 方法读取 sessionFile 的最后一条记录
- 优先使用真实的最后消息时间判断状态
- 保留 `updatedAt` 字段用于显示"配置更新"信息
- 区分 `lastActive`（最后消息时间）和 `updatedAt`（配置更新时间）

**状态判断规则（修复后）：**
- `running`: 1小时内有消息活动或有活跃连接
- `idle`: 1小时 - 7天内有消息活动
- `stopped`: 7天以上无消息活动

**相关文件：**
- src/backend/src/services/agentMonitor.ts - Agent 监控服务（已修复）

---

### VIS-002: 显示群组名称而不是 ID 号

**现状：**
- 显示：`feishu:g-oc_0754a493527ed8a4b28bd0dff802de`
- 显示：`feishu:g-oc_2647837964c3cc31f6beb38fc43058d4`
- 显示：`feishu:g-oc_49db5e0b3f3ab28b88d251cd1f59a807`

**问题：**
1. `displayName` 是自动生成的格式（`feishu:g-xxx`），不是真实名称
2. 用户无法识别这些 ID
3. 缺少真实的群组名称信息

**可能的数据源：**
1. 飞书 API：`/getGroupInfo` 获取群组名称
2. OpenClaw API：如果有存储群组名称
3. 缓存或配置文件

**解决方案：**
1. 调用飞书 API 获取群组名称
2. 在 OpenClaw 中缓存群组名称
3. 在 sessions.json 中存储群组名称

---

### VIS-003: 用户可读性优化，减少困惑

**当前 AgentCard 显示的信息：**
- 📊 名称（ID 字符串）
- 🟢/🔴 状态标签
- 💬 最近活动（"16小时前" / "9天前"）
- 📊 今日统计
  - 消息：574
  - Token：57.4K
  - 效率：2%
- ⚙️ 详细信息（可折叠）

**用户困惑点：**
1. "消息"：实际上不是消息数，是 Token/100，不准确
2. "Token"：普通用户不理解 Token 是什么
3. "效率"：百分比是什么意思？
4. "效率 2%"：太低，正常吗？
5. "最近活动"：最后活动时间是做什么？

**优化建议：**
1. 简化统计信息
2. 使用更直观的指标
3. 添加解释性提示
4. 减少技术术语

---

## 需要的信息

### 1. OpenClaw Gateway API
- 确认是否有 Agent 实时状态 API
- 确认是否有 WebSocket 推送
- 获取 API 文档

### 2. 飞书 API
- 群组 ID 查询群组名称
- API 文档和认证方式

### 3. OpenClaw 配置
- 是否有群组名称缓存
- 是否有 Agent 状态监控
- 配置文件位置

---

## 待解决的问题

1. 如何获取真实的 Agent 运行状态？
2. 如何获取真实的飞书群组名称？
3. 如何让用户理解 Token、效率等技术指标？

---

*记录时间: 2026-03-11 13:22*