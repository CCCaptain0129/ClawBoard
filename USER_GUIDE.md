# 用户指南

> OpenClaw Visualization 完整使用手册

---

## 📚 目录

1. [快速开始](#快速开始)
2. [项目概览](#项目概览)
3. [创建项目](#创建项目)
4. [创建任务](#创建任务)
5. [更新进度](#更新进度)
6. [命令行工具](#命令行工具)
7. [最佳实践](#最佳实践)
8. [常见问题](#常见问题)

---

## 🚀 快速开始

### 安装依赖

```bash
# 后端
cd src/backend
npm install

# 前端
cd ../frontend
npm install
```

### 启动服务

```bash
# 启动后端（端口 3000 / 3001）
cd src/backend
npm run dev

# 启动前端（端口 5173）
cd src/frontend
npm run dev
```

### 访问应用

- 前端：http://localhost:5173
- 后端 API：http://localhost:3000
- WebSocket：ws://localhost:3001

### 5 分钟上手

```bash
# 1. 查看所有项目进度
./task-cli progress

# 2. 创建新项目
./task-cli create-project \
  --id my-project \
  --name "我的项目" \
  --icon "🎯"

# 3. 创建任务
./task-cli create-task \
  --project my-project \
  --title "第一个任务" \
  --priority P1

# 4. 更新任务状态
./task-cli update TASK-001 --status done

# 5. 刷新浏览器看板页面
```

---

## 📊 项目概览

OpenClaw Visualization 是一个实时监控和管理 OpenClaw Agent 的可视化平台，包含：

### 核心功能

| 功能 | 说明 |
|------|------|
| Agent 监控 | 实时展示所有 Agent 状态、Token 使用统计 |
| 任务看板 | Trello 风格三列布局（待处理、进行中、已完成） |
| 多项目支持 | 支持多个项目，用颜色和图标区分 |
| 双向同步 | Markdown ↔ JSON 双向同步 |
| 实时更新 | WebSocket 实时更新任务状态 |

### 技术栈

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS
- **后端**：Node.js + Express + TypeScript + WebSocket
- **存储**：JSON 文件 + Markdown 文件

---

## 📁 创建项目

### 方式一：使用命令行工具（推荐）

```bash
./task-cli create-project \
  --id project-id \
  --name "项目名称" \
  --description "项目描述" \
  --color "#3B82F6" \
  --icon "🎯"
```

### 方式二：手动创建

编辑 `tasks/projects.json`：

```json
[
  {
    "id": "my-project",
    "name": "我的项目",
    "description": "项目描述",
    "status": "active",
    "leadAgent": null,
    "color": "#3B82F6",
    "icon": "🎯",
    "createdAt": "2026-03-11T00:00:00.000Z",
    "updatedAt": "2026-03-11T00:00:00.000Z"
  }
]
```

然后创建任务文件 `tasks/my-project-tasks.json`：

```json
{
  "id": "my-project",
  "name": "我的项目",
  "description": "项目描述",
  "status": "active",
  "color": "#3B82F6",
  "icon": "🎯",
  "createdAt": "2026-03-11T00:00:00.000Z",
  "updatedAt": "2026-03-11T00:00:00.000Z",
  "tasks": []
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 项目唯一标识（小写字母、数字、连字符） |
| `name` | string | ✅ | 项目显示名称 |
| `description` | string | ✅ | 项目描述 |
| `color` | string | ✅ | 主题颜色（HEX 格式） |
| `icon` | string | ✅ | 项目图标（Emoji） |

### 推荐配色

| 颜色 | HEX | 用途 |
|------|-----|------|
| 蓝色 | `#3B82F6` | 通用项目 |
| 绿色 | `#10B981` | 成功/完成 |
| 橙色 | `#F59E0B` | 进行中 |
| 紫色 | `#8B5CF6` | 重要项目 |
| 红色 | `#EF4444` | 紧急项目 |

### 推荐图标

```
开发类：💻 ⚙️ 🔧 🚀
设计类：🎨 🖼️ 🎯 ✨
数据类：📊 📈 📉 📋
移动端：📱 📲 📦
网页类：🌐 🔗 🖥️
```

---

## 📝 创建任务

### 方式一：使用命令行工具（推荐）

```bash
./task-cli create-task \
  --project openclaw-visualization \
  --title "实现新功能" \
  --description "功能详细描述" \
  --priority P1 \
  --labels frontend,feature \
  --assignee @username
```

### 方式二：通过 Markdown 创建

创建 `tasks/{project-id}-TASKS.md`：

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
```

然后同步：

```bash
./task-cli sync --from-markdown project-id
```

### 方式三：直接编辑 JSON

编辑 `tasks/{project-id}-tasks.json`：

```json
{
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

### 任务字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 任务唯一标识（如 TASK-001） |
| `title` | string | ✅ | 任务标题 |
| `description` | string | ✅ | 任务描述 |
| `status` | string | ✅ | `todo` / `in-progress` / `done` |
| `priority` | string | ✅ | `P1` / `P2` / `P3` |
| `labels` | array | ✅ | 标签数组 |
| `assignee` | string | ❌ | 负责人（@username） |

### 优先级说明

| 优先级 | 含义 | 使用场景 |
|--------|------|----------|
| P1 | 高优先级 | 阻塞性问题、核心功能、紧急 bug |
| P2 | 中优先级 | 常规功能、优化任务、一般 bug |
| P3 | 低优先级 | 文档、测试、非紧急任务 |

### 标签命名规范

**按领域：**
```
frontend, backend, mobile, devops, design, docs, test
```

**按类型：**
```
feature, bugfix, refactor, optimization, hotfix
```

**按模块：**
```
auth, database, api, ui, components, utils
```

**组合示例：**
```json
["frontend", "feature", "ui", "auth"]
["backend", "bugfix", "api"]
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

### 任务示例

#### Bug 修复
```json
{
  "id": "TASK-100",
  "title": "修复用户登录后头像不显示的问题",
  "description": "用户登录成功后，右上角头像位置显示空白",
  "status": "todo",
  "priority": "P1",
  "labels": ["frontend", "bugfix", "auth", "ui"],
  "assignee": "@john",
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
  "description": "支持在不同状态列之间拖拽任务",
  "status": "in-progress",
  "priority": "P2",
  "labels": ["frontend", "feature", "ui", "kanban"],
  "assignee": "@alice",
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

### 方式二：使用命令行工具

```bash
# 更新任务状态
./task-cli update TASK-001 --status done

# 更新负责人
./task-cli update TASK-001 --assignee @john
```

### 方式三：通过 API 更新

```bash
# 更新任务状态
curl -X PUT http://localhost:3000/api/tasks/projects/{project-id}/tasks/{task-id} \
  -H "Content-Type: application/json" \
  -d '{"status": "in-progress"}'

# 更新多个字段
curl -X PUT http://localhost:3000/api/tasks/projects/{project-id}/tasks/{task-id} \
  -H "Content-Type: application/json" \
  -d '{
    "status": "done",
    "assignee": "@john",
    "labels": ["frontend", "feature", "completed"]
  }'
```

### 方式四：直接编辑 JSON

编辑 `tasks/{project-id}-tasks.json`：

```json
{
  "tasks": [
    {
      "id": "TASK-001",
      "title": "任务标题",
      "status": "done",  // 修改这里
      "updatedAt": "2026-03-11T12:00:00.000Z",  // 更新时间戳
      ...
    }
  ]
}
```

### 状态流转

```
待处理 (todo)
    ↓ 点击"开始 →"
进行中 (in-progress)
    ↓ 点击"完成 ✓"
已完成 (done)
```

---

## 💻 命令行工具

### 查看帮助

```bash
./task-cli help
```

### 常用命令

#### 创建项目

```bash
./task-cli create-project \
  --id my-project \
  --name "我的项目" \
  --description "项目描述" \
  --color "#3B82F6" \
  --icon "🎯"
```

#### 创建任务

```bash
./task-cli create-task \
  --project openclaw-visualization \
  --title "任务标题" \
  --description "任务描述" \
  --priority P1 \
  --labels frontend,feature \
  --assignee @username
```

#### 更新任务

```bash
# 更新状态
./task-cli update TASK-001 --status done

# 更新负责人
./task-cli update TASK-001 --assignee @john
```

#### 列出任务

```bash
# 列出所有项目
./task-cli list

# 列出项目的所有任务
./task-cli list --project openclaw-visualization

# 列出待处理的任务
./task-cli list --project openclaw-visualization --status todo
```

#### 查看进度

```bash
# 查看所有项目进度
./task-cli progress

# 查看单个项目进度
./task-cli progress --project openclaw-visualization
```

#### 同步 Markdown

```bash
# Markdown → JSON
./task-cli sync --from-markdown openclaw-visualization

# JSON → Markdown
./task-cli sync --to-markdown openclaw-visualization
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

**差：** 优化加载速度

**好：** 优化首页加载速度
- 当前性能：加载时间 2.5s
- 目标性能：加载时间 < 1s
- 优化方案：启用 CDN、代码分割、图片懒加载
- 验收标准：Lighthouse 性能分数 > 90

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

| 优先级 | 使用场景 |
|--------|----------|
| P1 | 阻塞性问题、核心功能 |
| P2 | 常规功能、优化 |
| P3 | 文档、非紧急 |

### 5. 定期同步

- 每日更新任务状态
- 每周同步 Markdown 和 JSON
- 及时更新项目描述和进度

---

## ❓ 常见问题

### Q1: 项目不显示在看板上？

**解决方法：**
1. 检查 `projects.json` 文件格式是否正确
2. 确保项目 ID 唯一
3. 刷新浏览器页面
4. 检查后端服务是否运行

```bash
# 检查后端服务
curl http://localhost:3000/api/tasks/projects
```

### Q2: 任务不显示？

**解决方法：**
1. 检查任务文件名：`{project-id}-tasks.json`
2. 检查文件格式是否正确（JSON 格式）
3. 确保任务数组不为空

```bash
# 检查任务 API
curl http://localhost:3000/api/tasks/projects/{project-id}/tasks
```

### Q3: 更新任务状态后不生效？

**解决方法：**
1. 检查后端服务是否运行
2. 查看浏览器控制台是否有错误
3. 手动调用 API 测试

```bash
# 测试更新 API
curl -X PUT http://localhost:3000/api/tasks/projects/{project-id}/tasks/{task-id} \
  -H "Content-Type: application/json" \
  -d '{"status": "in-progress"}'
```

### Q4: WebSocket 连接失败？

**解决方法：**
1. 检查 WebSocket 服务是否运行（端口 3001）
2. 检查浏览器是否支持 WebSocket
3. 查看浏览器控制台错误

### Q5: 如何删除项目或任务？

当前版本不支持删除，可以通过以下方式：
1. 编辑 JSON 文件手动删除
2. 将状态改为 `archived`（项目）或 `done`（任务）

---

## 🔗 相关链接

- GitHub: https://github.com/CCCaptain0129/OpenClaw_Visualization
- API 文档: 见 README.md

---

*版本: 1.0.0*  
*更新日期: 2026-03-11*