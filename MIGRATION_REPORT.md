# 任务ID迁移完成报告

## 执行时间
2026-03-12 09:33

## 问题描述
TASK-001 到 TASK-006 在 openclaw-visualization 和 openclaw-integration 两个项目中重复，导致任务ID冲突。

## 解决方案
采用项目前缀方案：`{项目前缀}-{序号}`

- openclaw-visualization → VIS-001, VIS-002, ...
- openclaw-integration → INT-001, INT-002, ...
- example-project-1 → EXA-001, EXA-002, ...
- example-project-2 → EXB-001, EXB-002, ...

## 执行步骤

### 1. 类型定义更新
- ✅ 更新 `src/backend/src/types/tasks.ts`，在 Project 接口中添加 `taskPrefix` 字段
- ✅ 更新 `src/frontend/src/components/KanbanBoard.tsx`，添加 `taskPrefix` 字段

### 2. 项目配置更新
- ✅ 更新 `tasks/projects.json`，为每个项目添加 `taskPrefix` 字段

### 3. 后端服务更新
- ✅ 更新 `src/backend/src/services/taskService.ts`：
  - `createTask` 方法现在使用项目前缀生成任务ID
  - 添加 `getNextTaskNumber` 方法，自动计算下一个序号

### 4. 迁移脚本
- ✅ 创建 `migrate-task-ids.mjs`：
  - 自动扫描所有项目
  - 按创建时间排序任务
  - 生成新任务ID（带项目前缀）
  - 更新 JSON 文件
  - 批量更新 Markdown 文件中的任务ID引用

### 5. 执行迁移
- ✅ 运行迁移脚本
- ✅ 4 个项目全部迁移成功
- ✅ 44 个任务ID更新
- ✅ 108 个 Markdown 文件更新

### 6. 编译验证
- ✅ 修复 TypeScript 编译错误
- ✅ 后端编译通过（无错误）
- ✅ 前端类型定义同步

### 7. 功能验证
- ✅ 验证所有任务ID都使用正确的前缀
- ✅ 验证每个项目内无重复ID
- ✅ 验证任务ID生成逻辑正常（测试下一个ID生成）

## 迁移结果

| 项目 | 旧前缀 | 新前缀 | 任务数 | 状态 |
|------|--------|--------|--------|------|
| OpenClaw 可视化 | TASK | VIS | 29 | ✅ 完成 |
| OpenClaw 集成 | TASK | INT | 9 | ✅ 完成 |
| 示例项目 A | TASK | EXA | 3 | ✅ 完成 |
| 示例项目 B | TASK | EXB | 3 | ✅ 完成 |

**总计：4 个项目，44 个任务，108 个 Markdown 文件**

## 新任务ID示例

### openclaw-visualization (VIS)
- TASK-014 → VIS-001
- TASK-015 → VIS-002
- TASK-001 → VIS-004
- ... 共 29 个任务

### openclaw-integration (INT)
- TASK-001 → INT-001
- TASK-002 → INT-002
- ... 共 9 个任务

## 功能增强

### taskService.ts 改进
```typescript
async createTask(projectId: string, task: Partial<Task>): Promise<Task> {
  const project = await this.getProjectById(projectId);
  const prefix = project.taskPrefix || 'TASK';
  const existingTaskIds = tasks.map(t => t.id);
  const nextNumber = this.getNextTaskNumber(prefix, existingTaskIds);
  const taskId = `${prefix}-${nextNumber.toString().padStart(3, '0')}`;
  // ...
}
```

### 自动序号计算
- 自动分析现有任务ID
- 找出最大序号
- 生成下一个可用序号
- 支持跨序号情况（如 VIS-001, VIS-005 → 下一个是 VIS-006）

## 后续建议

1. **测试验证**
   - 启动后端服务
   - 创建新任务，验证ID生成正确
   - 查看前端看板，确认显示正常

2. **文档更新**
   - 更新开发文档，说明任务ID命名规范
   - 添加迁移脚本说明

3. **提交代码**
   ```bash
   git add -A
   git commit -m "feat: 添加任务ID项目前缀支持，修复任务ID冲突问题"
   git push origin main
   ```

## 备份说明
迁移脚本执行前未创建备份，但 Git 可以追踪所有变更。如需回滚：
```bash
git reset --hard <commit-hash-before-migration>
```

## 问题排查

如发现任何问题：
1. 检查 `tasks/projects.json` 中的 `taskPrefix` 字段
2. 检查 `src/backend/src/types/tasks.ts` 中的 Project 接口
3. 运行验证脚本检查任务ID前缀匹配