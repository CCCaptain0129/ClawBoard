# JSON-First 架构验收步骤

## 验收环境

- 后端: `http://localhost:3000`
- 前端: `http://localhost:5173`
- 项目: `pm-workflow-automation` 或 `openclaw-visualization`

---

## 验收清单

### 1. 修改 03 文档不再影响看板

**步骤:**
1. 启动后端服务: `cd src/backend && npm run dev`
2. 打开看板页面，记录当前任务数量
3. 修改 `pm-workflow-automation/docs/03-任务分解.md`:
   - 添加一个新任务
   - 或修改现有任务的标题
4. 等待 5 秒
5. 刷新看板页面

**预期结果:**
- 看板任务数量不变
- 新添加的任务不会出现
- 修改的内容不会同步

**验证点:** FileWatcherService 不再监听 taskDoc 变更

---

### 2. 看板新增任务立即生效

**步骤:**
1. 打开看板页面，选择一个项目
2. 点击"新增任务"按钮
3. 填写任务信息并提交
4. 观察看板变化

**预期结果:**
- 新任务立即显示在"待处理"列
- 任务状态为 todo
- 无需刷新页面

**API 验证:**
```bash
curl -X POST http://localhost:3000/api/tasks/projects/pm-workflow-automation/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "测试任务", "description": "验证JSON-first"}'
```

---

### 3. 删除 todo 任务成功

**步骤:**
1. 找到一个 status="todo" 的任务
2. 点击任务卡片上的"删除"按钮
3. 确认删除
4. 观察看板变化

**预期结果:**
- 任务从看板消失
- 显示删除成功提示

**API 验证:**
```bash
# 先创建一个 todo 任务，然后删除
curl -X DELETE http://localhost:3000/api/tasks/projects/pm-workflow-automation/tasks/PMW-XXX
```

---

### 4. 删除非 todo 任务失败

**步骤:**
1. 找到一个 status="in-progress" 或 "done" 的任务
2. 观察任务卡片上是否有"删除"按钮

**预期结果:**
- "删除"按钮不显示（todo 以外的状态隐藏删除按钮）

**API 验证:**
```bash
# 尝试删除 in-progress 任务，应返回 400
curl -X DELETE http://localhost:3000/api/tasks/projects/pm-workflow-automation/tasks/PMW-XXX
```

**预期响应:**
```json
{
  "success": false,
  "error": "Cannot delete task with status \"in-progress\". Only \"todo\" tasks can be deleted.",
  "hint": "Only tasks with status \"todo\" can be deleted..."
}
```

---

### 5. 生成 04 进度文档成功

**步骤:**
1. 打开看板页面，选择项目
2. 点击"生成进度文档"按钮
3. 等待生成完成
4. 查看提示信息

**预期结果:**
- 显示成功提示，包含生成路径
- 进度文档已更新

**API 验证:**
```bash
curl -X POST http://localhost:3000/api/sync/progress-to-doc/pm-workflow-automation
```

**预期响应:**
```json
{
  "success": true,
  "projectId": "pm-workflow-automation",
  "progress": { ... },
  "updatedSections": ["进度统计", "任务分布"],
  "message": "..."
}
```

---

## 快速验证脚本

```bash
#!/bin/bash

echo "=== JSON-First 架构验证 ==="

# 1. 检查 FileWatcher 状态
echo -e "\n1. FileWatcher 状态:"
curl -s http://localhost:3000/api/file-watcher/status | jq .

# 2. 创建测试任务
echo -e "\n2. 创建测试任务:"
curl -s -X POST http://localhost:3000/api/tasks/projects/pm-workflow-automation/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "JSON-First 测试任务", "priority": "P3"}' | jq .

# 3. 获取任务列表
echo -e "\n3. 获取任务列表:"
curl -s http://localhost:3000/api/tasks/projects/pm-workflow-automation/tasks | jq 'length'

# 4. 生成进度文档
echo -e "\n4. 生成进度文档:"
curl -s -X POST http://localhost:3000/api/sync/progress-to-doc/pm-workflow-automation | jq '.success'

echo -e "\n=== 验证完成 ==="
```

---

## 常见问题

### Q: 修改 03 文档后看板没有变化？

**A:** 这是预期行为。JSON-First 架构下，03 文档不再自动同步到看板。如需从文档初始化，请使用：
```bash
curl -X POST http://localhost:3000/api/sync/safe/from-doc/pm-workflow-automation
```

### Q: 为什么删除按钮不显示？

**A:** 删除按钮只在 status="todo" 的任务上显示。in-progress 和 done 状态的任务不能删除。

### Q: 如何手动触发进度文档更新？

**A:** 点击看板页面上的"生成进度文档"按钮，或调用 API：
```bash
curl -X POST http://localhost:3000/api/sync/progress-to-doc/{projectId}
```

---

*文档版本: 1.0.0*  
*更新日期: 2026-03-13*