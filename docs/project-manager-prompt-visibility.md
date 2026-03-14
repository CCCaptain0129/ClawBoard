# 项目管理 Agent Prompt 可见性方案

## 目标

让用户能够看到项目管理 Agent 分配给 subagent 的完整 prompt，避免任务跑偏，提高透明度。

## 当前状态分析

### 现有流程

1. **Prompt 生成**：`pm-agent-dispatcher.mjs` 的 `generatePrompt()` 函数根据任务信息生成完整的 8 段式 prompt
2. **Prompt 发送**：通过 Gateway RPC 的 `agent` 方法将 prompt 作为 `message` 发送给 subagent
3. **Prompt 记录**：
   - 完整 prompt 记录到 `tmp/logs/pm-prompts.log`
   - 分发记录到 `docs/internal/SUBAGENTS任务分发记录.md`（但只记录前 500 字符，被截断）

### 存在的问题

- ✗ 用户在群组中只能看到任务标题和简短描述
- ✗ 实际发送给 subagent 的完整 prompt 存储在本地日志文件中，用户无法直接访问
- ✗ 任务分发记录中的 prompt 被截断了（`.slice(0, 500)`），看不到完整内容
- ✗ 用户无法判断 subagent 是否理解了任务意图，难以把控方向

## 解决方案

### 方案概述

在 **subagent 完成任务后**，将完整的 prompt 返回给用户，让用户能够看到 subagent 收到的完整指令。

### 实现方式

#### 方案 A：通过飞书消息发送完整 Prompt（推荐）

**优点**：
- ✅ 用户可以直接在群组中看到完整的 prompt
- ✅ 透明度最高，信息即时可得
- ✅ 便于用户审查 subagent 的执行方向

**缺点**：
- ⚠️ 长的 prompt 可能会发送多条消息（需要处理飞书消息长度限制）
- ⚠️ 会增加一些 token 消耗（仅在任务完成后发送一次）

**实现步骤**：

1. **修改 `pm-agent-dispatcher.mjs`**：
   - 在 `recordDispatch()` 中，记录完整的 prompt（而不是截断的）
   - 添加一个新的通知函数 `notifyPromptCompletion(task, subagentId, prompt, result)`
   - 当 subagent 完成时，调用此函数发送消息

2. **集成到 SubagentMonitorService**：
   - 在 subagent 完成后，从 `pm-prompts.log` 中读取完整的 prompt
   - 通过飞书消息发送给用户

**消息格式示例**：

```markdown
## ✅ Subagent 完成任务：VIS-002

**任务标题**：显示群组名称而不是 ID 号
**Subagent ID**：agent:main:subagent:5dabfdfe-3159-4465-94c7-92300f607577
**执行时间**：23 分钟

<details>
<summary>📋 查看完整 Prompt（点击展开）</summary>

# 任务: 显示群组名称而不是 ID 号...

[完整的 prompt 内容]

</details>

**执行结果**：[subagent 的输出摘要]
```

#### 方案 B：在任务分发记录中存储完整 Prompt（可选补充）

**优点**：
- ✅ 用户可以随时查阅历史任务的完整 prompt
- ✅ 不依赖消息发送，持久化存储
- ✅ 易于维护和审计

**缺点**：
- ⚠️ 需要用户主动去查看文件
- ⚠️ 文件会变得很大

**实现步骤**：

1. **修改 `recordDispatch()` 函数**：
   - 移除 `.slice(0, 500)` 截断逻辑
   - 将完整的 prompt 写入记录文件

2. **可选：优化记录格式**：
   - 使用 `<details>` 标签折叠 prompt，避免文件过长
   - 添加指向记录文件的快捷方式

**记录格式示例**：

```markdown
### 2026/3/14 00:06:38 创建 Subagent (PM-Agent-Dispatcher)

**Subagent ID**: `agent:main:subagent:5dabfdfe-3159-4465-94c7-92300f607577`
**类型**: Dev Agent
**任务**: VIS-002 - 显示群组名称而不是 ID 号

<details>
<summary>📋 查看完整 Prompt</summary>

\`\`\`
# 任务: 显示群组名称而不是 ID 号...
[完整的 prompt 内容]
\`\`\`

</details>

**返回结果**: ...
```

#### 方案 C：提供 Prompt 查询命令（辅助功能）

**优点**：
- ✅ 按需查看，不主动打扰
- ✅ 用户可以在任何时候查看历史任务的 prompt
- ✅ 灵活性高

**缺点**：
- ⚠️ 需要用户主动查询
- ⚠️ 增加了交互复杂度

**实现步骤**：

1. **创建 Prompt 查询脚本**：
   - `scripts/query-prompt.mjs --task VIS-002`
   - 从 `pm-prompts.log` 中提取指定任务的完整 prompt
   - 通过飞书消息返回给用户

2. **集成到项目文档**：
   - 在 `USAGE.md` 中添加使用说明
   - 提供快捷命令示例

### 综合推荐方案

**采用 方案 A + 方案 B 的组合**：

1. **主要方式（方案 A）**：subagent 完成后自动发送完整 prompt 到群组
2. **补充方式（方案 B）**：在任务分发记录中存储完整 prompt（使用 `<details>` 折叠）
3. **可选增强（方案 C）**：提供命令行查询工具，方便用户主动查看

## 代码修改建议

### 1. 修改 `pm-agent-dispatcher.mjs`

#### 1.1 修改 `recordDispatch()` 函数

**当前代码**（第 448-485 行）：
```javascript
const entry = `
### ${timestamp} 创建 Subagent (PM-Agent-Dispatcher)

**Subagent ID**: \`${subagentId}\`
**类型**: Dev Agent
**任务**: ${task.id} - ${task.title}
**项目**: ${project.name} (${project.id})
**分配时间**: ${new Date().toISOString()}
**优先级**: ${task.priority || 'P2'}

**任务描述**:
${task.description ? '- ' + task.description.split('\n').join('\n- ') : '- 无详细描述'}

**生成的 Prompt**:
\`\`\`
${prompt.slice(0, 500)}...
\`\`\`

**返回结果**:
- 等待 Subagent 完成中...

**释放时间**: -
**状态**: 🔄 进行中

`;
```

**修改为**：
```javascript
const entry = `
### ${timestamp} 创建 Subagent (PM-Agent-Dispatcher)

**Subagent ID**: \`${subagentId}\`
**类型**: Dev Agent
**任务**: ${task.id} - ${task.title}
**项目**: ${project.name} (${project.id})
**分配时间**: ${new Date().toISOString()}
**优先级**: ${task.priority || 'P2'}

**任务描述**:
${task.description ? '- ' + task.description.split('\n').join('\n- ') : '- 无详细描述'}

<details>
<summary>📋 查看完整 Prompt（${prompt.length} 字符）</summary>

\`\`\`
${prompt}
\`\`\`

</details>

**返回结果**:
- 等待 Subagent 完成中...

**释放时间**: -
**状态**: 🔄 进行中

`;
```

#### 1.2 添加 Prompt 通知函数

在 `pm-agent-dispatcher.mjs` 中添加新函数：

```javascript
/**
 * 通知用户 subagent 已完成，并返回完整的 prompt
 * 此函数应在 SubagentMonitorService 中调用
 */
function notifyPromptCompletion(task, project, subagentId, prompt, result) {
  try {
    const message = `## ✅ Subagent 完成任务：${task.id}

**任务标题**：${task.title}
**Subagent ID**：\`${subagentId}\`
**项目**：${project.name}

<details>
<summary>📋 查看完整 Prompt（${prompt.length} 字符，点击展开）</summary>

\`\`\`
${prompt}
\`\`\`

</details>

**执行结果**：
${result.summary || '任务已完成'}

---
*如需查看详细日志，请查看：\`tmp/logs/pm-prompts.log\`*
`;

    // 记录到日志文件（供后续查询）
    const logEntry = `
${'='.repeat(80)}
PROMPT 完成通知
时间: ${new Date().toISOString()}
任务: ${task.id} - ${task.title}
Subagent: ${subagentId}
${'='.repeat(80)}

${message}

`;

    fs.mkdirSync(path.dirname(config.promptLogFile), { recursive: true });
    fs.appendFileSync(config.promptLogFile, logEntry);

    // TODO: 集成到飞书消息发送
    // 需要调用飞书 API 发送消息到指定群组
    log(`Prompt 完成通知已生成（待发送到飞书）`);

    return { success: true, message };
  } catch (e) {
    log(`生成 prompt 完成通知失败: ${e.message}`, 'ERROR');
    return { success: false, error: e.message };
  }
}
```

### 2. 修改 `SubagentMonitorService`（如果存在）

在 SubagentMonitorService 中，当检测到 subagent 完成时：

```javascript
// 伪代码示例
async function onSubagentComplete(subagentId, task) {
  // 从 pm-prompts.log 中提取完整的 prompt
  const prompt = await extractPromptFromLog(task.id, subagentId);

  // 获取项目信息
  const project = await getProjectInfo(task.projectId);

  // 通知用户
  notifyPromptCompletion(task, project, subagentId, prompt, {
    summary: subagentResult.summary
  });
}
```

### 3. 创建 Prompt 查询工具（可选）

创建 `scripts/query-prompt.mjs`：

```javascript
#!/usr/bin/env node
/**
 * query-prompt.mjs - 查询任务的完整 prompt
 * 
 * 用法：
 *   node query-prompt.mjs --task VIS-002
 *   node query-prompt.mjs --subagent agent:main:subagent:xxx
 *   node query-prompt.mjs --all
 */

import fs from 'fs';
import path from 'path';

const PROMPT_LOG_FILE = 'tmp/logs/pm-prompts.log';

function extractPrompt(taskId, subagentId) {
  // 读取日志文件
  const content = fs.readFileSync(PROMPT_LOG_FILE, 'utf-8');

  // 提取指定任务的 prompt
  const regex = new RegExp(
    `任务 ID: ${taskId}[^=]*=+([^=]*=+)+([^=]*=+)?`,
    's'
  );
  const match = content.match(regex);

  if (match) {
    return match[0];
  }

  return null;
}

// CLI 入口
const args = process.argv.slice(2);
const taskId = args.find(a => a.startsWith('--task '))?.split(' ')[1];
const subagentId = args.find(a => a.startsWith('--subagent '))?.split(' ')[1];

if (taskId) {
  const prompt = extractPrompt(taskId);
  if (prompt) {
    console.log(prompt);
  } else {
    console.error(`未找到任务 ${taskId} 的 prompt`);
    process.exit(1);
  }
} else {
  console.error('请指定 --task <taskId>');
  process.exit(1);
}
```

## 验收标准

- [x] 方案可行，用户能够看到 subagent 的完整 prompt
- [x] 不增加过多的 tokens 消耗（仅在任务完成后发送一次）
- [x] 实现方式清晰，易于维护
- [ ] 代码修改已完成
- [ ] 用户能够收到完整的 prompt 通知
- [ ] 任务分发记录中包含完整的 prompt

## 后续优化方向

1. **智能截断**：对于特别长的 prompt，只发送关键部分（Goal、Context、Acceptance）
2. **Prompt 总结**：使用 AI 总结 prompt 的核心要点，减少消息长度
3. **用户配置**：允许用户配置是否需要接收完整 prompt 通知
4. **历史查询**：提供便捷的查询接口，按任务 ID、日期等查询历史 prompt

## 相关文档

- `scripts/pm-agent-dispatcher.mjs` - PM Agent Dispatcher 源代码
- `docs/internal/SUBAGENTS任务分发记录.md` - 任务分发记录
- `tmp/logs/pm-prompts.log` - Prompt 日志文件

## 更新记录

- 2026-03-14：创建本文档，定义 prompt 可见性方案