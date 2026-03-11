# 项目和任务管理完整指南

> 从创建到完成，全流程操作手册

---

## 📚 目录

1. [快速开始](#快速开始)
2. [创建项目](#创建项目)
3. [创建任务](#创建任务)
4. [更新进度](#更新进度)
5. [最佳实践](#最佳实践)
6. [自动化建议](#自动化建议)
7. [故障排查](#故障排查)

---

## 🚀 快速开始

### 最简流程

```bash
1. 在 projects.json 添加项目配置
2. 创建 {project-id}-tasks.json 文件
3. 添加任务到文件
4. 刷新看板页面
```

### 5 分钟上手示例

```json
// 步骤 1: tasks/projects.json
[
  {
    "id": "my-project",
    "name": "我的项目",
    "description": "项目描述",
    "status": "active",
    "color": "#3B82F6",
    "icon": "🎯",
    "createdAt": "2026-03-11T00:00:00.000Z",
    "updatedAt": "2026-03-11T00:00:00.000Z"
  }
]
```

```json
// 步骤 2: tasks/my-project-tasks.json
{
  "id": "my-project",
  "name": "我的项目",
  "description": "项目描述",
  "status": "active",
  "color": "#3B82F6",
  "icon": "🎯",
  "createdAt": "2026-03-11T00:00:00.000Z",
  "updatedAt": "2026-03-11T00:00:00.000Z",
  "tasks": [
    {
      "id": "TASK-001",
      "title": "第一个任务",
      "description": "任务描述",
      "status": "todo",
      "priority": "P1",
      "labels": ["backend", "feature"],
      "assignee": null,
      "claimedBy": null,
      "dueDate": null,
      "createdAt": "2026-03-11T00:00:00.000Z",
      "updatedAt": "2026-03-11T00:00:00.000Z",
      "comments": []
    }
  ]
}
```

完成！刷新看板页面即可看到新项目和任务。

---

## 📁 创建项目

### 步骤 1: 编辑 projects.json

位置：`tasks/projects.json`

```json
{
  "id": "project-id",
  "name": "项目名称",
  "description": "项目描述（1-2 句话）",
  "status": "active",
  "leadAgent": null,
  "color": "#3B82F6",
  "icon": "🎯",
  "createdAt": "2026-03-11T00:00:00.000Z",
  "updatedAt": "2026-03-11T00:00:00.000Z"
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `id` | string | ✅ | 项目唯一标识 | `my-project` |
| `name` | string | ✅ | 项目显示名称 | `我的项目` |
| `description` | string | ✅ | 项目描述 | `这是一个示例项目` |
| `status` | string | ✅ | 项目状态 | `active` / `archived` |
| `leadAgent` | string | ❌ | 项目负责人 | `@username` |
| `color` | string | ✅ | 主题颜色 | `#3B82F6` (HEX) |
| `icon` | string | ✅ | 项目图标 | `🎯` (Emoji) |
| `createdAt` | string | ✅ | 创建时间 | ISO 8601 格式 |
| `updatedAt` | string | ✅ | 更新时间 | ISO 8601 格式 |

### 项目 ID 规则

- 使用小写字母、数字、连字符
- 建议格式：`{团队名}-{项目名}` 或 `{类别}-{项目名}`
- 示例：
  - `openclaw-visualization`
  - `frontend-dashboard`
  - `mobile-app-ios`

### 颜色选择

推荐配色：

```javascript
{
  蓝色: "#3B82F6",  // 通用项目
  绿色: "#10B981",  // 成功/完成
  橙色: "#F59E0B",  // 进行中
  紫色: "#8B5CF6",  // 重要项目
  粉色: "#EC4899",  // 设计类
  青色: "#06B6D4",  // 开发类
  红色: "#EF4444",  // 紧急项目
  灰色: "#6B7280",  // 归档项目
}
```

### 图标选择

按类别推荐：

```
开发类：💻 ⚙️ 🔧 🚀
设计类：🎨 🖼️ 🎯 ✨
数据类：📊 📈 📉 📋
移动端：📱 📲 📦
网页类：🌐 🔗 🖥️
工具类：🛠️ ⚡ 🔌
文档类：📝 📚 📖
测试类：🧪 ✅ ❌
```

### 完整示例

```json
{
  "id": "ecommerce-platform",
  "name": "电商平台",
  "description": "全栈电商平台开发项目",
  "status": "active",
  "leadAgent": "@john",
  "color": "#8B5CF6",
  "icon": "🛒",
  "createdAt": "2026-03-11T00:00:00.000Z",
  "updatedAt": "2026-03-11T00:00:00.000Z"
}
```

---

## 📝 创建任务

### 方式一：直接编辑 JSON

#### 步骤 1: 创建任务文件

位置：`tasks/{project-id}-tasks.json`

#### 步骤 2: 填充任务数据

```json
{
  "id": "project-id",
  "name": "项目名称",
  "description": "项目描述",
  "status": "active",
  "color": "#3B82F6",
  "icon": "🎯",
  "createdAt": "2026-03-11T00:00:00.000Z",
  "updatedAt": "2026-03-11T00:00:00.000Z",
  "tasks": [
    {
      "id": "TASK-001",
      "title": "任务标题",
      "description": "任务描述",
      "status": "todo",
      "priority": "P1",
      "labels": ["frontend", "feature"],
      "assignee": null,
      "claimedBy": null,
      "dueDate": null,
      "createdAt": "2026-03-11T00:00:00.000Z",
      "updatedAt": "2026-03-11T00:00:00.000Z",
      "comments": []
    }
  ]
}
```

#### 任务字段说明

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `id` | string | ✅ | 任务唯一标识 | `TASK-001` |
| `title` | string | ✅ | 任务标题 | `实现登录功能` |
| `description` | string | ✅ | 任务描述 | `详细的任务说明` |
| `status` | string | ✅ | 任务状态 | `todo` / `in-progress` / `done` |
| `priority` | string | ✅ | 优先级 | `P1` / `P2` / `P3` |
| `labels` | array | ✅ | 任务标签 | `["frontend", "feature"]` |
| `assignee` | string | ❌ | 负责人 | `@john` 或 `null` |
| `claimedBy` | string | ❌ | 认领者 | `null` |
| `dueDate` | string | ❌ | 截止日期 | ISO 8601 格式 |
| `createdAt` | string | ✅ | 创建时间 | ISO 8601 格式 |
| `updatedAt` | string | ✅ | 更新时间 | ISO 8601 格式 |
| `comments` | array | ❌ | 评论数组 | `[]` |

### 方式二：通过 Markdown 创建（推荐）

#### 步骤 1: 创建 Markdown 文件

创建 `tasks/{project-id}-TASKS.md` 文件：

```markdown
# 项目名称

> 项目描述

## 统计

- **任务总数**: 0
- **待处理**: 0
- **进行中**: 0
- **已完成**: 0
- **进度**: 0% (0/0)

## 阶段 1：项目启动

### 任务列表

-  **TASK-100** `P1` `backend` `feature`
  - 状态: 待处理
  - 描述: 设计数据库结构
  - 负责人: @john

-  **TASK-101** `P1` `backend` `feature`
  - 状态: 待处理
  - 描述: 实现 API 接口
  - 负责人: @alice

-  **TASK-102** `P2` `frontend` `feature`
  - 状态: 待处理
  - 描述: 创建登录页面
  - 负责人: @bob
```

#### 步骤 2: 同步到 JSON

在浏览器中：
1. 切换到对应项目
2. 点击"同步到 Markdown"按钮

或者使用 API：

```bash
curl -X POST http://localhost:3000/api/sync/from-markdown/{project-id}
```

### 任务编号规则

建议使用分段编号：

```
TASK-001 ~ TASK-099  : 项目初始化
TASK-100 ~ TASK-199  : 后端开发
TASK-200 ~ TASK-299  : 前端开发
TASK-300 ~ TASK-399  : 测试阶段
TASK-400 ~ TASK-499  : 部署上线
```

### 标签命名规范

**按领域：**
```
frontend, backend, mobile, devops, design, docs, test, security
```

**按类型：**
```
feature, bugfix, refactor, optimization, hotfix, performance, accessibility
```

**按模块：**
```
auth, database, api, ui, components, utils, config
```

**组合示例：**
```json
["frontend", "feature", "ui", "auth"]
["backend", "bugfix", "api"]
["devops", "optimization", "database"]
```

### 完整任务示例

#### Bug 修复
```json
{
  "id": "TASK-100",
  "title": "修复用户登录后头像不显示的问题",
  "description": "用户登录成功后，右上角头像位置显示空白，需要检查头像加载逻辑和错误处理",
  "status": "todo",
  "priority": "P1",
  "labels": ["frontend", "bugfix", "auth", "ui"],
  "assignee": "@john",
  "claimedBy": null,
  "dueDate": "2026-03-15T23:59:59.000Z",
  "createdAt": "2026-03-11T00:00:00.000Z",
  "updatedAt": "2026-03-11T00:00:00.000Z",
  "comments": []
}
```

#### 功能开发
```json
{
  "id": "TASK-101",
  "title": "实现任务拖拽功能",
  "description": "支持在不同状态列之间拖拽任务，拖拽完成后自动更新任务状态并同步到后端",
  "status": "in-progress",
  "priority": "P2",
  "labels": ["frontend", "feature", "ui", "kanban"],
  "assignee": "@alice",
  "claimedBy": null,
  "dueDate": null,
  "createdAt": "2026-03-11T00:00:00.000Z",
  "updatedAt": "2026-03-11T00:00:00.000Z",
  "comments": []
}
```

#### 性能优化
```json
{
  "id": "TASK-102",
  "title": "优化首页加载速度",
  "description": "当前首页加载时间约 2.5s，目标优化到 < 1s。需要分析性能瓶颈并优化",
  "status": "todo",
  "priority": "P2",
  "labels": ["frontend", "optimization", "performance"],
  "assignee": "@bob",
  "claimedBy": null,
  "dueDate": "2026-03-20T23:59:59.000Z",
  "createdAt": "2026-03-11T00:00:00.000Z",
  "updatedAt": "2026-03-11T00:00:00.000Z",
  "comments": []
}
```

---

## 🔄 更新进度

### 方式一：通过看板界面（推荐）

1. 打开浏览器访问 http://localhost:5173
2. 点击"任务看板"Tab
3. 切换到对应项目
4. 点击任务卡片上的按钮：
   - "开始 →"：将任务从"待处理"移到"进行中"
   - "完成 ✓"：将任务从"进行中"移到"已完成"

### 方式二：通过 API 更新

#### 更新任务状态

```bash
curl -X PUT http://localhost:3000/api/tasks/projects/{project-id}/tasks/{task-id} \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in-progress"
  }'
```

#### 更新多个字段

```bash
curl -X PUT http://localhost:3000/api/tasks/projects/{project-id}/tasks/{task-id} \
  -H "Content-Type: application/json" \
  -d '{
    "status": "done",
    "assignee": "@john",
    "labels": ["frontend", "feature", "completed"]
  }'
```

### 方式三：直接编辑 JSON

编辑 `tasks/{project-id}-tasks.json` 文件：

```json
{
  "tasks": [
    {
      "id": "TASK-001",
      "title": "任务标题",
      "status": "done",  // 修改这里
      "updatedAt": "2026-03-11T12:00:00.000Z",  // 更新时间戳
      "priority": "P1",
      "labels": ["frontend", "feature"],
      ...
    }
  ]
}
```

### 方式四：通过 Markdown 更新

编辑 `tasks/{project-id}-TASKS.md` 文件：

```markdown
-  **TASK-001** `P1` `frontend` `feature`
  - 状态: 已完成  // 修改这里
  - 描述: 任务描述
  - 负责人: @john
```

然后同步：

```bash
curl -X POST http://localhost:3000/api/sync/from-markdown/{project-id}
```

### 状态流转图

```
待处理 (todo)
    ↓ 点击"开始 →"
进行中 (in-progress)
    ↓ 点击"完成 ✓"
已完成 (done)
```

### 批量更新进度

#### 场景：完成多个任务

```bash
#!/bin/bash
# 批量完成任务

tasks=("TASK-001" "TASK-002" "TASK-003")
project="openclaw-visualization"

for task in "${tasks[@]}"; do
  curl -X PUT "http://localhost:3000/api/tasks/projects/$project/tasks/$task" \
    -H "Content-Type: application/json" \
    -d '{"status": "done"}'
  echo "✅ $task 已完成"
done
```

#### 场景：重置所有任务状态

```bash
#!/bin/bash
# 将所有进行中的任务重置为待处理

project="openclaw-visualization"

curl -s "http://localhost:3000/api/tasks/projects/$project/tasks" | \
  jq -r '.[] | select(.status == "in-progress") | .id' | \
  while read -r task; do
    curl -X PUT "http://localhost:3000/api/tasks/projects/$project/tasks/$task" \
      -H "Content-Type: application/json" \
      -d '{"status": "todo"}'
    echo "🔄 $task 已重置"
  done
```

### 进度追踪

#### 查看项目进度

```bash
curl -s http://localhost:3000/api/tasks/projects/{project-id}/tasks | jq '
{
  total: length,
  todo: [.[] | select(.status == "todo")] | length,
  inProgress: [.[] | select(.status == "in-progress")] | length,
  done: [.[] | select(.status == "done")] | length,
  progress: (([.[] | select(.status == "done")] | length / length) * 100 | floor)
}
'
```

#### 查看所有项目进度

```bash
curl -s http://localhost:3000/api/tasks/projects | jq -r '.[].id' | \
  while read -r project; do
    echo "📊 $project"
    curl -s "http://localhost:3000/api/tasks/projects/$project/tasks" | jq '
    {
      total: length,
      todo: [.[] | select(.status == "todo")] | length,
      inProgress: [.[] | select(.status == "in-progress")] | length,
      done: [.[] | select(.status == "done")] | length
    }
    '
    echo "---"
  done
```

---

## 💡 最佳实践

### 1. 任务粒度

✅ 好的粒度：
- 在 1-3 天内可以完成
- 有明确的验收标准
- 可以独立测试

❌ 不好的粒度：
- "开发后端"（太笼统）
- "修复所有 bug"（无法量化）

### 2. 任务描述

包含信息：
- 要做什么（做什么）
- 为什么做（为什么）
- 怎么做（怎么做）
- 验收标准（什么时候算完成）

示例：
```
差：优化加载速度

好：优化首页加载速度
- 当前性能：加载时间 2.5s
- 目标性能：加载时间 < 1s
- 优化方案：启用 CDN、代码分割、图片懒加载
- 验收标准：Lighthouse 性能分数 > 90
```

### 3. 标签使用

✅ 推荐：
```
frontend, feature, ui           // 清晰的领域和类型
backend, bugfix, database        // 具体的模块
devops, optimization, ci/cd      // 明确的流程
```

❌ 不推荐：
```
todo, task, work, important, urgent  // 太泛泛
feature-bugfix-design-ui             // 语义冲突
super-important-must-do              // 情绪化
```

### 4. 优先级设置

| 优先级 | 使用场景 | 示例 |
|--------|----------|------|
| P1 | 阻塞性问题、核心功能 | 生产崩溃、登录失效 |
| P2 | 常规功能、优化 | 新功能开发、性能优化 |
| P3 | 文档、非紧急 | 文档更新、代码整理 |

### 5. 负责人分配

- 明确指定负责人，避免"未分配"
- 尽量避免一人分配过多任务
- 优先分配给有相关经验的人

### 6. 定期同步

- 每日更新任务状态
- 每周同步 Markdown 和 JSON
- 及时更新项目描述和进度

---

## 🤖 自动化建议

### 1. Git Hook 自动同步

```bash
# .git/hooks/post-commit
#!/bin/bash

# 自动同步 Markdown 到 JSON
for task_file in tasks/*-TASKS.md; do
  project_id=$(basename "$task_file" "-TASKS.md")
  curl -X POST "http://localhost:3000/api/sync/from-markdown/$project_id"
done
```

### 2. 定时任务自动提醒

```javascript
// 每天早上 9 点检查逾期任务
const schedule = require('node-schedule');

schedule.scheduleJob('0 9 * * *', async () => {
  const tasks = await fetchTasks();
  const overdue = tasks.filter(t => 
    t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done'
  );
  
  if (overdue.length > 0) {
    sendNotification(`⚠️ 有 ${overdue.length} 个任务已逾期`);
  }
});
```

### 3. 自动分配任务

根据标签和技能自动分配：

```javascript
function autoAssignTask(task) {
  const assigneeMap = {
    'frontend': '@alice',
    'backend': '@bob',
    'design': '@charlie',
    'devops': '@david'
  };
  
  for (const label of task.labels) {
    if (assigneeMap[label]) {
      task.assignee = assigneeMap[label];
      return task;
    }
  }
  
  return task;
}
```

### 4. 进度报告自动生成

```javascript
function generateProgressReport(projectId) {
  const tasks = await fetchTasks(projectId);
  const report = {
    project: projectId,
    date: new Date().toISOString(),
    summary: {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'done').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      pending: tasks.filter(t => t.status === 'todo').length,
      progress: Math.round(
        tasks.filter(t => t.status === 'done').length / tasks.length * 100
      )
    },
    overdue: tasks.filter(t => 
      t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done'
    ),
    highPriority: tasks.filter(t => t.priority === 'P1' && t.status !== 'done')
  };
  
  return report;
}
```

### 5. 自动创建任务模板

```javascript
function createFeatureTemplate(title, description) {
  return {
    id: `TASK-${Date.now()}`,
    title: title,
    description: description,
    status: 'todo',
    priority: 'P2',
    labels: ['feature'],
    assignee: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    comments: []
  };
}
```

### 6. WebSocket 实时通知

```javascript
// 任务状态变化时推送通知
ws.on('message', (data) => {
  if (data.type === 'TASK_UPDATE') {
    const task = data.task;
    if (task.status === 'done') {
      showNotification(`🎉 ${task.title} 已完成！`);
    }
  }
});
```

### 7. 命令行工具

```bash
# 快速创建任务
./task-cli create \
  --project openclaw-visualization \
  --title "实现新功能" \
  --priority P1 \
  --labels frontend,feature \
  --assignee @alice

# 快速更新状态
./task-cli update TASK-001 --status done

# 查看任务列表
./task-cli list --project openclaw-visualization --status todo
```

### 8. 集成 GitHub Issues

```javascript
// 自动同步 GitHub Issues 到任务看板
async function syncGitHubIssues(projectId, owner, repo) {
  const issues = await fetchGitHubIssues(owner, repo);
  
  for (const issue of issues) {
    const task = {
      id: `GH-${issue.number}`,
      title: issue.title,
      description: issue.body,
      status: issue.state === 'closed' ? 'done' : 'todo',
      priority: issue.labels.some(l => l.name.includes('bug')) ? 'P1' : 'P2',
      labels: issue.labels.map(l => l.name),
      assignee: issue.assignee ? `@${issue.assignee.login}` : null,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      comments: []
    };
    
    await createTask(projectId, task);
  }
}
```

---

## 🔧 故障排查

### 问题 1: 项目不显示在看板上

**症状：** 在 `projects.json` 中添加了项目，但看板上没有显示

**解决方案：**
1. 检查 `projects.json` 文件格式是否正确（JSON 格式）
2. 确保项目 ID 唯一
3. 刷新浏览器页面
4. 检查后端服务是否运行

```bash
# 检查后端服务
curl http://localhost:3000/api/tasks/projects
```

### 问题 2: 任务不显示

**症状：** 项目显示正常，但任务列表为空

**解决方案：**
1. 检查任务文件名是否正确：`{project-id}-tasks.json`
2. 检查文件格式是否正确（JSON 格式）
3. 确保任务数组不为空
4. 检查后端日志是否有错误

```bash
# 检查任务 API
curl http://localhost:3000/api/tasks/projects/{project-id}/tasks
```

### 问题 3: 更新任务状态后不生效

**症状：** 点击"开始"或"完成"按钮后，状态没有改变

**解决方案：**
1. 检查后端服务是否运行
2. 检查网络连接
3. 查看浏览器控制台是否有错误
4. 手动调用 API 测试

```bash
# 测试更新 API
curl -X PUT http://localhost:3000/api/tasks/projects/{project-id}/tasks/{task-id} \
  -H "Content-Type: application/json" \
  -d '{"status": "in-progress"}'
```

### 问题 4: Markdown 同步失败

**症状：** 同步到 Markdown 或从 Markdown 同步失败

**解决方案：**
1. 检查 Markdown 文件格式是否正确
2. 确保任务格式符合规范
3. 检查文件权限
4. 查看后端日志

```bash
# 测试同步 API
curl -X POST http://localhost:3000/api/sync/to-markdown/{project-id}
```

### 问题 5: WebSocket 连接失败

**症状：** 实时更新不工作

**解决方案：**
1. 检查 WebSocket 服务是否运行（端口 3001）
2. 检查浏览器是否支持 WebSocket
3. 检查网络连接
4. 查看浏览器控制台错误

---

## 📞 获取帮助

### 查看文档

- [完整使用说明与模板](./TASK_TEMPLATE.md)
- [快速参考](./TASK_QUICK_REF.md)
- [项目 README](./README.md)

### 检查日志

```bash
# 后端日志
tail -f /tmp/backend.log

# 前端日志
tail -f /tmp/frontend.log
```

### API 测试

```bash
# 健康检查
curl http://localhost:3000/health

# 获取所有项目
curl http://localhost:3000/api/tasks/projects

# 获取项目任务
curl http://localhost:3000/api/tasks/projects/{project-id}/tasks
```

---

*版本: 1.0.0*  
*更新日期: 2026-03-11*