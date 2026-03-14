# Subagent Prompts Index

> Subagent Prompt 语料库索引，按任务ID/时间/来源列出。
> 更新时间: 2026-03-14

---

## 按任务ID索引

| 任务ID | 任务名称 | 优先级 | 调度次数 | 来源文件 |
|--------|----------|--------|----------|----------|
| PMW-010 | 增强看板任务展示（可选增强） | P2 | 1 | pm-prompts.log, 任务分发记录.md |
| PMW-013 | 创建安装脚本 | P1 | 1 | pm-prompts.log, 任务分发记录.md |
| PMW-014 | 创建配置向导 | P1 | 1 | pm-prompts.log, 任务分发记录.md |
| PMW-038 | 查看todo任务中哪些已经完成了 | P0 | 1 | pm-prompts.log, 任务分发记录.md |
| PMW-040 | 修复bug：前端"新增任务"表单填写了任务描述，但是json文件中descritption为null | P0 | 2 | pm-prompts.log, 任务分发记录.md |
| PMW-TEST-001 | 测试 Dispatcher Subagent 创建 | P1 | 1 | pm-prompts.log, 任务分发记录.md |
| VIS-002 | 显示群组名称而不是 ID 号 | P1 | 1 | pm-prompts.log, 任务分发记录.md |

---

## 按时间索引

| 时间 (UTC+8) | 任务ID | Subagent ID | 状态 |
|--------------|--------|-------------|------|
| 2026-03-13 22:51:34 | PMW-013 | agent:main:subagent:1773413494806 | ✅ 成功 |
| 2026-03-13 23:17:04 | PMW-038 | agent:main:subagent:1773415024294 | ✅ 成功 |
| 2026-03-13 23:17:05 | PMW-014 | agent:main:subagent:1773415025314 | ✅ 成功 |
| 2026-03-13 23:33:00 | PMW-TEST-001 | agent:main:subagent:510d64bf-6877-4610-86de-21a4f5c8ce37 | ✅ 成功 |
| 2026-03-13 23:54:07 | PMW-040 | agent:main:subagent:0e12b78c-2b4f-4b92-8b19-b351dfbafaf6 | ✅ 成功 |
| 2026-03-14 00:06:38 | VIS-002 | agent:main:subagent:5dabfdfe-3159-4465-94c7-92300f607577 | ✅ 成功 |
| 2026-03-14 00:08:56 | PMW-010 | agent:main:subagent:27edf72f-9112-47f3-857e-8289d458839c | ✅ 成功 |
| 2026-03-14 00:33:52 | PMW-040 | agent:main:subagent:3cdbfdf2-045f-4c62-b409-8110e345ebf0 | ✅ 成功 |

---

## 按来源索引

### 来源 1: pm-prompts.log

完整 prompt 日志，由 PM-Agent-Dispatcher 写入。

| 条目 | 任务ID | 时间 |
|------|--------|------|
| 1 | PMW-013 | 2026-03-13T14:51:34.807Z |
| 2 | PMW-038 | 2026-03-13T15:17:04.298Z |
| 3 | PMW-014 | 2026-03-13T15:17:05.319Z |
| 4 | PMW-TEST-001 | 2026-03-13T15:33:00.775Z |
| 5 | PMW-040 | 2026-03-13T15:54:07.402Z |
| 6 | VIS-002 | 2026-03-13T16:06:38.083Z |
| 7 | PMW-010 | 2026-03-13T16:08:56.651Z |
| 8 | PMW-040 | 2026-03-13T16:33:52.511Z |

**文件路径**: `projects/openclaw-visualization/tmp/logs/pm-prompts.log`

### 来源 2: SUBAGENTS任务分发记录.md

任务分发历史记录，包含截断的 prompt 片段。

**文件路径**: `projects/openclaw-visualization/docs/internal/SUBAGENTS任务分发记录.md`

### 来源 3: OpenClaw sessions_history

⚠️ 从 OpenClaw sessions.json 中未能提取到 spawn 时的 user prompt 内容。sessions.json 仅包含 session 元数据，实际的 prompt 内容存储在 session .jsonl 文件中，需要进一步解析。

**尝试的文件路径**:
- `/Users/ot/.openclaw/agents/main/sessions/sessions.json`
- `/Users/ot/.openclaw/agents/project-manager/sessions/sessions.json`

---

## 按项目索引

| 项目 | 任务数 | 任务ID列表 |
|------|--------|------------|
| pm-workflow-automation | 6 | PMW-010, PMW-013, PMW-014, PMW-038, PMW-040, PMW-TEST-001 |
| openclaw-visualization | 1 | VIS-002 |

---

## 文件清单

| 文件 | 描述 | 路径 |
|------|------|------|
| subagent-prompts-corpus.md | 完整 prompt 语料库 | `docs/subagent-prompts-corpus.md` |
| subagent-prompts-snippets.md | 截断 prompt 片段 | `docs/subagent-prompts-snippets.md` |
| subagent-prompts-index.md | 本索引文件 | `docs/subagent-prompts-index.md` |

---

## 统计摘要

- **总调度次数**: 8
- **唯一任务数**: 7
- **时间范围**: 2026-03-13 22:51 ~ 2026-03-14 00:33 (约 2 小时)
- **成功率**: 100% (8/8)
- **主要来源**: PM-Agent-Dispatcher 自动生成

---

*本文档由自动化脚本生成*
*生成时间: 2026-03-14T00:44*