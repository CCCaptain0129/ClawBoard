# OpenClaw 集成指南

> 如何在 OpenClaw 中使用任务看板 API

---

## 📚 目录

1. [API 概览](#api-概览)
2. [项目 API](#项目-api)
3. [任务 API](#任务-api)
4. [OpenClaw 集成示例](#openclaw-集成示例)
5. [最佳实践](#最佳实践)

---

## API 概览

### 基础信息

- **API 地址:** `http://localhost:3000/api/tasks`
- **内容类型:** `application/json`
- **认证方式:** 暂无认证（本地开发环境）

### 响应格式

**成功响应:**
```json
{
  "success": true,
  "data": {...}
}
```

**错误响应:**
```json
{
  "error": "错误信息"
}
```

---

## 项目 API

### 1. 获取所有项目

```http
GET /api/tasks/projects
```

**响应:**
```json
[
  {
    "id": "openclaw-visualization",
    "name": "OpenClaw 可视化",
    "description": "",
    "status": "active",
    "color": "#3B82F6",
    "icon": "📊",
    "createdAt": "2026-03-11T00:00:00.000Z",
    "updatedAt": "2026-03-11T00:00:00.000Z"
  }
]
```

### 2. 创建项目

```http
POST /api/tasks/projects
Content-Type: application/json

{
  "id": "my-project",
  "name": "我的项目",
  "description": "项目描述",
  "color": "#3B82F6",
  "icon": "🎯",
  "status": "active"
}
```

**参数说明:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 项目唯一标识（小写字母、数字、连字符） |
| `name` | string | ✅ | 项目显示名称 |
| `description` | string | ❌ | 项目描述 |
| `color` | string | ❌ | 主题颜色（HEX 格式，如 #3B82F6） |
| `icon` | string | ❌ | 项目图标（Emoji） |
| `status` | string | ❌ | 项目状态（active/archived） |

**推荐颜色:**
- `#3B82F6` - 蓝色（通用）
- `#10B981` - 绿色（成功）
- `#F59E0B` - 橙色（进行中）
- `#8B5CF6` - 紫色（重要）
- `#EF4444` - 红色（紧急）

---

## 任务 API

### 1. 获取项目任务

```http
GET /api/tasks/projects/{projectId}/tasks
```

**响应:**
```json
[
  {
    "id": "VIS-004",
    "title": "任务标题",
    "description": "任务描述",
    "status": "todo",
    "priority": "P1",
    "labels": ["frontend", "feature"],
    "assignee": "@username",
    "createdAt": "2026-03-11T00:00:00.000Z",
    "updatedAt": "2026-03-11T00:00:00.000Z"
  }
]
```

### 2. 创建任务

```http
POST /api/tasks/projects/{projectId}/tasks
Content-Type: application/json

{
  "id": "VIS-004",
  "title": "任务标题",
  "description": "任务描述",
  "status": "todo",
  "priority": "P1",
  "labels": ["frontend", "feature"],
  "assignee": "@username"
}
```

**参数说明:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ❌ | 任务唯一标识（如 VIS-004） |
| `title` | string | ✅ | 任务标题 |
| `description` | string | ❌ | 任务描述 |
| `status` | string | ❌ | 状态：`todo`/`in-progress`/`done` |
| `priority` | string | ❌ | 优先级：`P1`/`P2`/`P3` |
| `labels` | array | ❌ | 标签数组 |
| `assignee` | string | ❌ | 负责人（@username） |

### 3. 批量创建任务

```http
POST /api/tasks/projects/{projectId}/tasks/batch
Content-Type: application/json

{
  "tasks": [
    {
      "id": "VIS-004",
      "title": "任务1",
      "status": "todo",
      "priority": "P1",
      "labels": ["frontend"]
    },
    {
      "id": "VIS-005",
      "title": "任务2",
      "status": "todo",
      "priority": "P2",
      "labels": ["backend"]
    }
  ]
}
```

**响应:**
```json
{
  "success": true,
  "count": 2,
  "tasks": [...]
}
```

### 4. 更新任务

```http
PUT /api/tasks/projects/{projectId}/tasks/{taskId}
Content-Type: application/json

{
  "status": "in-progress",
  "assignee": "@username",
  "labels": ["frontend", "bugfix"]
}
```

### 5. 批量更新任务

```http
PUT /api/tasks/projects/{projectId}/tasks/batch
Content-Type: application/json

{
  "taskIds": ["VIS-004", "VIS-005"],
  "status": "done"
}
```

**响应:**
```json
{
  "success": true,
  "count": 2,
  "tasks": [...]
}
```

### 6. 查询项目进度

```http
GET /api/tasks/projects/{projectId}/progress
```

**响应:**
```json
{
  "projectId": "my-project",
  "projectName": "我的项目",
  "total": 10,
  "completed": 3,
  "inProgress": 2,
  "todo": 5,
  "progress": 30,
  "taskCountByStatus": {
    "done": 3,
    "in-progress": 2,
    "todo": 5
  }
}
```

---

## OpenClaw 集成示例

### 示例 1：创建项目

在 OpenClaw 中调用：

```javascript
// 创建项目
await fetch('http://localhost:3000/api/tasks/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'my-project',
    name: '我的项目',
    description: '项目描述',
    color: '#3B82F6',
    icon: '🎯'
  })
});
```

### 示例 2：批量创建任务

在 OpenClaw 中调用：

```javascript
// 批量创建任务
const tasks = [
  {
    id: 'VIS-004',
    title: '设计数据库结构',
    status: 'todo',
    priority: 'P1',
    labels: ['backend', 'database']
  },
  {
    id: 'VIS-005',
    title: '实现登录 API',
    status: 'todo',
    priority: 'P1',
    labels: ['backend', 'api']
  },
  {
    id: 'VIS-006',
    title: '创建登录页面',
    status: 'todo',
    priority: 'P2',
    labels: ['frontend', 'ui']
  }
];

await fetch('http://localhost:3000/api/tasks/projects/my-project/tasks/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tasks })
});
```

### 示例 3：更新任务状态

在 OpenClaw 中调用：

```javascript
// 更新任务状态
await fetch('http://localhost:3000/api/tasks/projects/my-project/tasks/VIS-004', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'in-progress',
    assignee: '@john'
  })
});
```

### 示例 4：查询进度

在 OpenClaw 中调用：

```javascript
// 查询项目进度
const response = await fetch('http://localhost:3000/api/tasks/projects/my-project/progress');
const data = await response.json();

console.log(`项目进度: ${data.progress}% (${data.completed}/${data.total})`);
console.log(`进行中: ${data.inProgress} 个任务`);
```

---

## 最佳实践

### 1. 任务 ID 规范

建议使用分段的 ID：

```
VIS-004 ~ TASK-099  : 项目初始化
EXA-001 ~ TASK-199  : 后端开发
EXB-001 ~ TASK-299  : 前端开发
TASK-300 ~ TASK-399  : 测试阶段
TASK-400 ~ TASK-499  : 部署上线
```

### 2. 优先级分配

| 优先级 | 使用场景 |
|--------|----------|
| P1 | 阻塞性问题、核心功能、紧急 bug |
| P2 | 常规功能、优化任务、一般 bug |
| P3 | 文档、测试、非紧急任务 |

### 3. 标签命名

**按领域:**
```
frontend, backend, mobile, devops, design, docs, test, security
```

**按类型:**
```
feature, bugfix, refactor, optimization, hotfix
```

**按模块:**
```
auth, database, api, ui, components, utils
```

### 4. 错误处理

```javascript
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  
  if (data.error) {
    console.error('API error:', data.error);
    return null;
  }
  
  return data;
} catch (error) {
  console.error('Request failed:', error);
  return null;
}
```

---

## 注意事项

1. **服务依赖**
   - 需要后端服务运行（端口 3000）
   - API 地址可能根据环境不同而不同

2. **ID 冲突**
   - 任务 ID 必须唯一
   - 建议在 ID 中包含项目标识

3. **字段验证**
   - 确保必填字段不为空
   - 枚举值必须符合规范（status, priority）

4. **并发问题**
   - 避免同时更新同一任务
   - 考虑添加乐观锁

---

*版本: 1.0.0*  
*更新日期: 2026-03-11*