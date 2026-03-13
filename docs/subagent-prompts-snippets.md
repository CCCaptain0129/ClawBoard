# Subagent Prompts Snippets

> 从 SUBAGENTS任务分发记录.md 中提取的"生成的 Prompt"片段（截断版本），按任务ID归档。
> 更新时间: 2026-03-14

---

## PMW-013: 创建安装脚本

**Subagent ID**: `agent:main:subagent:1773413494806`
**分配时间**: 2026-03-13T14:51:34.817Z
**来源**: SUBAGENTS任务分发记录.md

### 生成的 Prompt (截断)

```
# 任务: 创建安装脚本

## 基本信息
- **任务 ID**: PMW-013
- **所属项目**: OpenClaw 项目管理自动工作流 (pm-workflow-automation)
- **优先级**: P1
- **标签**: 阶段 4：一键复用安装

## 任务描述
创建安装脚本

## 全局约束

### 代码规范
- TypeScript/Node.js，遵循项目现有代码风格
- 使用现有项目结构和模式
- 保持代码简洁、可读性强

### 提交规范
- 使用 conventional commits 格式：feat/fix/docs/style/refactor/test/chore
- 提交信息简洁明了，说明做了什么

### 测试要求
- 本次任务不强制要求测试

### 文档要求
- 更新相关文档（如 README、API 文档等）

### 超时设置
- 任务执行时间不超过 30 分钟
- 如果预计超时，请在任务开始时说明

## 执行指南

1. **理解任务**: 仔细阅读任务描述，明确目标
2. **分析代码**: 理解现有代码结构和依赖关系
3...
```

---

## PMW-038: 查看todo任务中哪些已经完成了

**Subagent ID**: `agent:main:subagent:1773415024294`
**分配时间**: 2026-03-13T15:17:04.309Z
**来源**: SUBAGENTS任务分发记录.md

### 生成的 Prompt (截断)

```
# 任务: 查看todo任务中哪些已经完成了

## 基本信息
- **任务 ID**: PMW-038
- **所属项目**: OpenClaw 项目管理自动工作流 (pm-workflow-automation)
- **优先级**: P0
- **标签**: 阶段 7：后续优化（待定）

## 任务描述
查看todo任务中哪些已经完成了

## 全局约束

### 代码规范
- TypeScript/Node.js，遵循项目现有代码风格
- 使用现有项目结构和模式
- 保持代码简洁、可读性强

### 提交规范
- 使用 conventional commits 格式：feat/fix/docs/style/refactor/test/chore
- 提交信息简洁明了，说明做了什么

### 测试要求
- 本次任务不强制要求测试

### 文档要求
- 更新相关文档（如 README、API 文档等）

### 超时设置
- 任务执行时间不超过 30 分钟
- 如果预计超时，请在任务开始时说明

## 执行指南

1. **理解任务**: 仔细阅读任务描述，明确目标
2. **分...
```

---

## PMW-014: 创建配置向导

**Subagent ID**: `agent:main:subagent:1773415025314`
**分配时间**: 2026-03-13T15:17:05.325Z
**来源**: SUBAGENTS任务分发记录.md

### 生成的 Prompt (截断)

```
# 任务: 创建配置向导

## 基本信息
- **任务 ID**: PMW-014
- **所属项目**: OpenClaw 项目管理自动工作流 (pm-workflow-automation)
- **优先级**: P1
- **标签**: 阶段 4：一键复用安装

## 任务描述
创建配置向导

## 全局约束

### 代码规范
- TypeScript/Node.js，遵循项目现有代码风格
- 使用现有项目结构和模式
- 保持代码简洁、可读性强

### 提交规范
- 使用 conventional commits 格式：feat/fix/docs/style/refactor/test/chore
- 提交信息简洁明了，说明做了什么

### 测试要求
- 本次任务不强制要求测试

### 文档要求
- 更新相关文档（如 README、API 文档等）

### 超时设置
- 任务执行时间不超过 30 分钟
- 如果预计超时，请在任务开始时说明

## 执行指南

1. **理解任务**: 仔细阅读任务描述，明确目标
2. **分析代码**: 理解现有代码结构和依赖关系
3...
```

---

## PMW-TEST-001: 测试 Dispatcher Subagent 创建

**Subagent ID**: `agent:main:subagent:510d64bf-6877-4610-86de-21a4f5c8ce37`
**分配时间**: 2026-03-13T15:33:00.790Z
**来源**: SUBAGENTS任务分发记录.md

### 生成的 Prompt (截断)

```
# 任务: 测试 Dispatcher Subagent 创建

## 基本信息
- **任务 ID**: PMW-TEST-001
- **所属项目**: OpenClaw 项目管理自动工作流 (pm-workflow-automation)
- **优先级**: P1
- **标签**: 测试

## 任务描述
这是一个测试任务，用于验证 pm-agent-dispatcher.mjs 能否正确创建 subagent。测试点：1) sessions.json 中出现 subagent session 2) claimedBy 写入真实 sessionKey 3) label 包含 taskId

## 全局约束

### 代码规范
- TypeScript/Node.js，遵循项目现有代码风格
- 使用现有项目结构和模式
- 保持代码简洁、可读性强

### 提交规范
- 使用 conventional commits 格式：feat/fix/docs/style/refactor/test/chore
- 提交信息简洁明了，说明做了什么

### 测试要求
- 本次任务不强制...
```

---

## PMW-040: 修复bug：前端"新增任务"表单填写了任务描述，但是json文件中descritption为null

**Subagent ID**: `agent:main:subagent:0e12b78c-2b4f-4b92-8b19-b351dfbafaf6`
**分配时间**: 2026-03-13T15:54:07.418Z
**来源**: SUBAGENTS任务分发记录.md

### 生成的 Prompt (截断)

```
# 任务: 修复bug：前端"新增任务"表单填写了任务描述，但是json文件中descritption为null

## 基本信息
- **任务 ID**: PMW-040
- **所属项目**: OpenClaw 项目管理自动工作流 (pm-workflow-automation)
- **优先级**: P0
- **标签**: 阶段 7：后续优化（待定）

## 任务描述
修复bug：前端"新增任务"表单填写了任务描述，但是json文件中descritption为null

## 全局约束

### 代码规范
- TypeScript/Node.js，遵循项目现有代码风格
- 使用现有项目结构和模式
- 保持代码简洁、可读性强

### 提交规范
- 使用 conventional commits 格式：feat/fix/docs/style/refactor/test/chore
- 提交信息简洁明了，说明做了什么

### 测试要求
- 本次任务不强制要求测试

### 文档要求
- 更新相关文档（如 README、API 文档等）

### 超时设置
- 任务执行时间不超过 ...
```

---

## VIS-002: 显示群组名称而不是 ID 号

**Subagent ID**: `agent:main:subagent:5dabfdfe-3159-4465-94c7-92300f607577`
**分配时间**: 2026-03-13T16:06:38.097Z
**来源**: SUBAGENTS任务分发记录.md

### 生成的 Prompt (截断)

```
# 任务: 显示群组名称而不是 ID 号。Agent 卡片优先显示飞书群组的友好名称（如 OpenClaw 集成讨论组），而不是显示 ID 字符串（如 oc_0754a493527ed8a4b28bd0dffdf802de）。从 OpenClaw sessions 中获取真实的群组名称并显示。

## 基本信息
- **任务 ID**: VIS-002
- **所属项目**: OpenClaw 可视化 (openclaw-visualization)
- **优先级**: P1
- **标签**: 阶段 4：Agent 监控优化（P1 - 核心功能）

## 任务描述
显示群组名称而不是 ID 号。Agent 卡片优先显示飞书群组的友好名称（如 OpenClaw 集成讨论组），而不是显示 ID 字符串（如 oc_0754a493527ed8a4b28bd0dffdf802de）。从 OpenClaw sessions 中获取真实的群组名称并显示。

## 全局约束

### 代码规范
- TypeScript/Node.js，遵循项目现有代码风格
- 使用现有项目结构和模式
- 保持代...
```

---

## PMW-010: 增强看板任务展示（可选增强）

**Subagent ID**: `agent:main:subagent:27edf72f-9112-47f3-857e-8289d458839c`
**分配时间**: 2026-03-13T16:08:56.668Z
**来源**: SUBAGENTS任务分发记录.md

### 生成的 Prompt (截断)

```
# 任务: 增强看板任务展示（可选增强）

## 基本信息
- **任务 ID**: PMW-010
- **所属项目**: OpenClaw 项目管理自动工作流 (pm-workflow-automation)
- **优先级**: P2
- **标签**: 阶段 3：看板增强

## 任务描述
增强看板任务展示（可选增强）

## 全局约束

### 代码规范
- TypeScript/Node.js，遵循项目现有代码风格
- 使用现有项目结构和模式
- 保持代码简洁、可读性强

### 提交规范
- 使用 conventional commits 格式：feat/fix/docs/style/refactor/test/chore
- 提交信息简洁明了，说明做了什么

### 测试要求
- 本次任务不强制要求测试

### 文档要求
- 更新相关文档（如 README、API 文档等）

### 超时设置
- 任务执行时间不超过 30 分钟
- 如果预计超时，请在任务开始时说明

## 执行指南

1. **理解任务**: 仔细阅读任务描述，明确目标
2. **分析代码**: 理...
```

---

## PMW-040 (第二次调度): 修复bug：前端"新增任务"表单填写了任务描述，但是json文件中descritption为null

**Subagent ID**: `agent:main:subagent:3cdbfdf2-045f-4c62-b409-8110e345ebf0`
**分配时间**: 2026-03-13T16:33:52.528Z
**来源**: SUBAGENTS任务分发记录.md

### 生成的 Prompt (截断)

```
# 任务: 修复bug：前端"新增任务"表单填写了任务描述，但是json文件中descritption为null

## 基本信息
- **任务 ID**: PMW-040
- **所属项目**: OpenClaw 项目管理自动工作流 (pm-workflow-automation)
- **优先级**: P0
- **标签**: 阶段 7：后续优化（待定）

## 任务描述
修复bug：前端"新增任务"表单填写了任务描述，但是json文件中descritption为null

## 全局约束

### 代码规范
- TypeScript/Node.js，遵循项目现有代码风格
- 使用现有项目结构和模式
- 保持代码简洁、可读性强

### 提交规范
- 使用 conventional commits 格式：feat/fix/docs/style/refactor/test/chore
- 提交信息简洁明了，说明做了什么

### 测试要求
- 本次任务不强制要求测试

### 文档要求
- 更新相关文档（如 README、API 文档等）

### 超时设置
- 任务执行时间不超过 ...
```

---

## 备注

- 以上 prompt 片段均为截断版本，完整版本请参见 `subagent-prompts-corpus.md`
- 部分任务（如 PMW-040）存在多次调度记录，每个调度对应不同的 Subagent ID
- 截断发生在"执行指南"部分，不影响任务核心信息

---

*本文档由自动化脚本生成*
*生成时间: 2026-03-14T00:44*