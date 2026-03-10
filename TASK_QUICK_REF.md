# 🚀 任务创建快速参考

## 基础模板

```markdown
-  **TASK-{序号}** `{优先级}` `{标签1}` `{标签2}`
  - 状态: {状态}
  - 描述: {任务描述}
  - 负责人: {负责人}
```

## 优先级

| P1 | P2 | P3 |
|----|----|----|
| 阻塞性问题 | 常规功能 | 文档测试 |
| 核心功能 | 优化任务 | 非紧急 |
| 紧急 bug | 一般 bug | 代码整理 |

## 状态

- `待处理` → 点击"开始 →" → `进行中` → 点击"完成 ✓" → `已完成`

## 常用标签

**领域：** `frontend` `backend` `devops` `docs` `test` `design`
**类型：** `feature` `bugfix` `refactor` `optimization` `hotfix`

## 示例

### Bug 修复
```markdown
-  **TASK-100** `P1` `frontend` `bugfix`
  - 状态: 待处理
  - 描述: 修复登录后头像无法显示的问题
  - 负责人: @john
```

### 功能开发
```markdown
-  **TASK-101** `P2` `backend` `feature`
  - 状态: 待处理
  - 描述: 实现任务搜索功能
  - 负责人: @alice
```

### 文档任务
```markdown
-  **TASK-102** `P3` `docs` `api`
  - 状态: 待处理
  - 描述: 更新 API 文档
  - 负责人: @alice
```

## 编号规则

```
TASK-{3位数字}
```

按阶段分配：
- TASK-001 ~ TASK-099: 阶段 1
- TASK-100 ~ TASK-199: 阶段 2
- TASK-200 ~ TASK-299: 阶段 3

---

💡 **提示**：创建任务后，点击"同步到 Markdown"按钮即可在看板中看到！