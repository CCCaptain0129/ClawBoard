# JSON-First 数据流架构

> **版本**: 1.0.0  
> **更新日期**: 2026-03-13  
> **状态**: 已实施

---

## 1. 概述

JSON-First 架构是 OpenClaw Visualization 项目的核心数据流设计，将 JSON 文件作为任务的**唯一真源（Single Source of Truth）**，而 Markdown 文档仅作为辅助视图。

### 1.1 设计目标

1. **数据一致性**: 避免多源同步导致的数据冲突
2. **操作简单**: 前端直接操作 JSON，无需复杂同步逻辑
3. **安全删除**: 只允许删除 todo 状态的任务，防止误删运行中/已完成的任务
4. **进度可追溯**: 手动生成进度文档，确保数据稳定

---

## 2. 数据流架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                            前端 (React)                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ 新增任务      │  │ 删除任务      │  │ 生成进度文档              │   │
│  │ (写 JSON)    │  │ (仅 todo)    │  │ (手动触发)               │   │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬──────────────┘   │
│         │                 │                      │                   │
│         │ POST /api/tasks │ DELETE /api/tasks    │ POST /api/sync   │
│         │                 │ (status==todo only)  │ /progress-to-doc │
└─────────┼─────────────────┼──────────────────────┼──────────────────┘
          │                 │                      │
          ▼                 ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        后端 (Express)                                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    TaskService                                │   │
│  │  - createTask() → 写入 JSON                                   │   │
│  │  - deleteTask() → 校验 status==todo → 删除                    │   │
│  │  - updateTask() → 更新 JSON + 触发进度同步                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                 │                                    │
│                                 ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                ProgressToDocService                           │   │
│  │  - syncProgressToDoc() → 生成 04-进度跟踪.md                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      数据存储 (JSON)                                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  tasks/{projectId}-tasks.json  ← 唯一真源                      │   │
│  │  {                                                            │   │
│  │    "id": "pm-workflow-automation",                            │   │
│  │    "tasks": [                                                 │   │
│  │      { "id": "PMW-001", "status": "todo", ... },              │   │
│  │      { "id": "PMW-002", "status": "in-progress", ... }        │   │
│  │    ]                                                          │   │
│  │  }                                                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. 文档角色定义

### 3.1 03-任务分解.md (taskDoc)

- **角色**: 初始化源（可选）
- **用途**: 仅在项目初始化时从文档解析任务生成 JSON
- **触发方式**: 手动 API 调用 `POST /api/sync/safe/from-doc/:projectId`
- **监听状态**: **禁用** - 文件变更不会自动同步到看板

### 3.2 04-进度跟踪.md (progressDoc)

- **角色**: 进度视图（只读视图）
- **用途**: 查看项目整体进度统计，不直接编辑
- **生成方式**: 手动触发 `POST /api/sync/progress-to-doc/:projectId`
- **更新时机**: 用户点击"生成进度文档"按钮

### 3.3 JSON 文件 (唯一真源)

- **角色**: 数据存储
- **路径**: `tasks/{projectId}-tasks.json`
- **操作**:
  - 新增任务 → 直接写 JSON
  - 更新任务 → 直接更新 JSON
  - 删除任务 → 校验 status 后删除 JSON

---

## 4. API 端点

### 4.1 任务操作

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/tasks/projects/:id/tasks` | GET | 获取项目任务列表 |
| `/api/tasks/projects/:id/tasks` | POST | 新增任务（写 JSON） |
| `/api/tasks/projects/:id/tasks/:taskId` | PUT | 更新任务 |
| `/api/tasks/projects/:id/tasks/:taskId` | DELETE | 删除任务（仅 todo） |

### 4.2 同步操作

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/sync/safe/from-doc/:projectId` | POST | 从 03 文档初始化 JSON |
| `/api/sync/progress-to-doc/:projectId` | POST | 生成 04 进度文档 |

---

## 5. 删除任务规则

### 5.1 状态校验

```typescript
async deleteTask(projectId: string, taskId: string) {
  const task = await getTask(projectId, taskId);
  
  // 只允许删除 todo 状态的任务
  if (task.status !== 'todo') {
    return {
      success: false,
      error: `Cannot delete task with status "${task.status}". Only "todo" tasks can be deleted.`
    };
  }
  
  // 执行删除
  await removeTask(projectId, taskId);
  return { success: true };
}
```

### 5.2 前端按钮显示

- **todo 状态**: 显示"删除"按钮
- **in-progress 状态**: 隐藏"删除"按钮
- **done 状态**: 隐藏"删除"按钮

---

## 6. FileWatcherService 配置

### 6.1 默认配置

```typescript
const DEFAULT_OPTIONS: FileWatcherOptions = {
  debounceMs: 1000,
  ignoreInitial: true,
  watchTaskDoc: false,  // 禁用 taskDoc 自动同步
};
```

### 6.2 启用监听（不推荐）

如需启用 taskDoc 自动同步（不推荐），可在初始化时设置：

```typescript
const fileWatcherService = new FileWatcherService(
  safeSyncService,
  wsServer,
  progressOrchestrator,
  { watchTaskDoc: true }  // 启用监听
);
```

---

## 7. 迁移指南

### 7.1 从文档优先迁移到 JSON 优先

1. **停止 FileWatcherService 对 taskDoc 的监听**
2. **前端改为直接操作 JSON**
3. **删除任务时添加状态校验**
4. **进度文档改为手动生成**

### 7.2 初始化新项目

1. 创建 `tasks/{projectId}-tasks.json`
2. 手动调用 `POST /api/sync/safe/from-doc/:projectId` 从文档初始化（如有）
3. 之后所有操作都通过 JSON API

---

## 8. 验收清单

- [x] 修改 03 文档不再影响看板
- [x] 看板新增任务立即生效
- [x] 看板删除 todo 任务立即生效
- [x] 删除 in-progress/done 任务返回 400 错误
- [x] 点击"生成进度文档"按钮成功生成 04 文档

---

## 9. 相关文件

- 后端服务:
  - `src/backend/src/services/taskService.ts` - 任务 CRUD
  - `src/backend/src/services/fileWatcherService.ts` - 文件监听（已禁用 taskDoc）
  - `src/backend/src/services/progressToDocService.ts` - 进度文档生成
  - `src/backend/src/routes/tasks.ts` - 任务 API 路由
  - `src/backend/src/routes/sync.ts` - 同步 API 路由

- 前端组件:
  - `src/frontend/src/components/KanbanBoard.tsx` - 看板主组件
  - `src/frontend/src/components/TaskCard.tsx` - 任务卡片（含删除按钮）
  - `src/frontend/src/services/taskService.ts` - 前端 API 服务

---

*文档版本: 1.0.0*  
*最后更新: 2026-03-13*