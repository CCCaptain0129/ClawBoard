# 迁移后文件变更清单

## 新增文件
- `migrate-task-ids.mjs` - 任务ID迁移脚本
- `MIGRATION_REPORT.md` - 迁移完成报告
- `MIGRATION_CHANGES.md` - 本文件

## 修改的文件

### 类型定义
1. `src/backend/src/types/tasks.ts`
   - Project 接口添加 `taskPrefix` 字段

2. `src/frontend/src/components/KanbanBoard.tsx`
   - Project 接口添加 `taskPrefix` 字段

### 项目配置
3. `tasks/projects.json`
   - 为每个项目添加 `taskPrefix` 字段
   - openclaw-visualization: "VIS"
   - openclaw-integration: "INT"
   - example-project-1: "EXA"
   - example-project-2: "EXB"

### 后端服务
4. `src/backend/src/services/taskService.ts`
   - 修改 `createTask` 方法，使用项目前缀生成任务ID
   - 添加 `getNextTaskNumber` 私有方法

5. `src/backend/src/sync/markdownToJSON.ts`
   - 更新 Project 对象创建，包含 `color`, `icon`, `taskPrefix` 字段

6. `src/backend/src/config/config.ts`
   - 修复 TypeScript 类型错误
   - feishu.appId 和 feishu.appSecret 改为必填（提供默认空字符串）

7. `src/backend/src/services/feishuService.ts`
   - 修复 TypeScript 类型错误（appSecret 非空断言）

8. `src/backend/src/websocket/openClawClient.ts`
   - 修复 TypeScript 类型错误（gatewayUrl 和 token 提供默认值）

### 任务数据文件
9. `tasks/openclaw-visualization-tasks.json`
   - 29 个任务ID从 TASK-xxx 更新为 VIS-xxx

10. `tasks/openclaw-integration-tasks.json`
    - 9 个任务ID从 TASK-xxx 更新为 INT-xxx

11. `tasks/example-project-1-tasks.json`
    - 3 个任务ID从 TASK-xxx 更新为 EXA-xxx

12. `tasks/example-project-2-tasks.json`
    - 3 个任务ID从 TASK-xxx 更新为 EXB-xxx

### Markdown 文件（108 个）
包括但不限于：
- `tasks/openclaw-visualization-TASKS.md`
- `tasks/openclaw-integration-TASKS.md`
- `tasks/example-project-1-TASKS.md`
- `README.md`
- `PROGRESS.md`
- `USER_GUIDE.md`
- `docs/*.md` (多个文档)
- `docs/internal/*.md` (多个内部文档)
- `TASK-*.md` (多个任务相关文档)

## 统计数据
- 新增文件: 3
- 修改文件: 111+ (108 Markdown + 8 代码/配置 + 4 数据)
- 任务ID更新: 44
- 项目数: 4