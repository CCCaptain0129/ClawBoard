# OpenClaw Agent 可视化监控平台 - 产品需求文档

---

## 1. 项目概述

### 1.1 背景

OpenClaw 是一个强大的 AI Agent 系统，支持多个 Agent 并发运行。目前缺乏一个统一的可视化界面来监控和管理这些 Agent 的运行状态。用户需要通过命令行或日志文件来了解 Agent 的执行情况，效率较低且不够直观。

### 1.2 目标

构建一个 Web 可视化监控平台，实时展示所有 OpenClaw Agent 的运行状态、任务进度和性能指标，提供便捷的管理和监控能力。

### 1.3 成功指标

- ✅ 支持同时监控 10+ 个 Agent 的实时状态
- ✅ 状态更新延迟 < 1 秒（WebSocket）
- ✅ 前端页面加载时间 < 2 秒
- ✅ 支持任务历史记录查询
- ✅ 支持错误日志查看和筛选

---

## 2. 用户角色与使用场景

### 2.1 目标用户

**主要用户：Agent 开发者和运维人员**

- 需要实时监控多个 Agent 的运行状态
- 需要了解每个 Agent 正在执行的任务
- 需要查看 Agent 的错误日志和性能指标
- 需要快速定位问题和调试

**次要用户：普通用户**

- 查看 Agent 的运行状态概览
- 了解系统的整体健康状况

### 2.2 使用场景

**场景 1：实时监控**
- 用户打开可视化页面，看到所有 Agent 的状态列表
- 页面自动更新，实时反映 Agent 状态变化
- 用户可以点击某个 Agent 查看详细信息

**场景 2：问题排查**
- 某个 Agent 出现错误，用户点击查看错误日志
- 用户可以通过时间、关键词筛选日志
- 用户可以下载错误日志用于分析

**场景 3：性能分析**
- 用户查看 Agent 的 CPU/内存使用情况
- 发现某个 Agent 性能异常，进行优化

---

## 3. 功能需求

### 3.1 核心功能（P1 - MVP 必须实现）

- [ ] **Agent 列表展示**
  - 显示所有注册的 Agent
  - 展示 Agent 基本信息：名称、ID、状态（运行中/空闲/错误）
  - 支持按状态筛选 Agent

- [ ] **Agent 状态实时更新**
  - 使用 WebSocket 推送状态变更
  - 状态包括：运行中、空闲、错误、停止
  - 显示当前正在执行的任务名称

- [ ] **任务进度显示**
  - 显示 Agent 当前任务
  - 显示任务进度百分比（如果支持）
  - 显示任务开始时间

- [ ] **错误日志查看**
  - 显示 Agent 的错误日志
  - 支持按时间筛选
  - 支持关键词搜索

### 3.2 重要功能（P2 - 第一版迭代）

- [ ] **Agent 详情页**
  - 显示 Agent 完整信息
  - 显示任务历史记录
  - 显示性能指标（CPU、内存使用）

- [ ] **任务历史记录**
  - 显示 Agent 完成的任务列表
  - 支持分页查看
  - 支持按状态筛选

- [ ] **性能监控**
  - 显示 CPU 使用率
  - 显示内存使用量
  - 提供性能趋势图表

### 3.3 可选功能（P3 - 未来版本）

- [ ] **Agent 控制**
  - 启动/停止 Agent
  - 重启 Agent
  - 配置 Agent 参数

- [ ] **告警通知**
  - Agent 错误时发送通知
  - 性能异常时告警

- [ ] **多用户支持**
  - 用户登录和权限管理
  - 不同角色查看不同级别的信息

---

## 4. 非功能需求

### 4.1 性能要求

- 页面首次加载时间 < 2 秒
- WebSocket 连接建立时间 < 1 秒
- 状态更新延迟 < 1 秒
- 支持同时监控 10+ 个 Agent

### 4.2 可用性

- 系统可用性 > 99%
- 支持主流浏览器（Chrome、Firefox、Safari、Edge）
- 响应式设计，支持桌面和移动端

### 4.3 安全性

- 不暴露敏感信息（API密钥、密码等）
- WebSocket 连接需要认证（可选）
- 日志查看需要权限控制（可选）

### 4.4 兼容性

- 后端兼容 OpenClaw 现有数据结构
- 不影响 OpenClaw 核心功能运行

---

## 5. 技术路线

### 5.1 技术选型

**前端**
- 框架：React 18 + TypeScript
- 构建工具：Vite
- 状态管理：Zustand（轻量级）
- UI 组件：shadcn/ui + Tailwind CSS
- 图表库：Recharts（性能监控图表）
- WebSocket 原生 API

**后端**
- 运行时：Node.js 18+
- 框架：Express
- WebSocket：ws 库
- 数据源：OpenClaw 数据库 / API

**理由：**
- React 生态成熟，组件丰富
- TypeScript 提供类型安全
- Vite 开发体验好，构建快速
- shadcn/ui 提供现代化的 UI 组件
- Zustand 比 Redux 更简单，适合中小型项目

### 5.2 架构设计

详细架构见 [ARCHITECTURE.md](ARCHITECTURE.md)

**简要描述：**

```
┌─────────────┐     WebSocket      ┌─────────────┐
│   前端页面   │ ◄────────────────► │   后端服务   │
│  (React)    │                     │  (Express)  │
└─────────────┘                     └─────────────┘
                                            │
                                            │ 轮询/订阅
                                            ▼
                                   ┌─────────────┐
                                   │ OpenClaw    │
                                   │ 数据/状态    │
                                   └─────────────┘
```

- 前端通过 WebSocket 连接后端服务
- 后端定期从 OpenClaw 获取 Agent 状态
- 状态变更时通过 WebSocket 推送给前端

### 5.3 数据流

1. 后端启动时连接 OpenClaw 数据源
2. 后端定期轮询 Agent 状态（间隔 1-5 秒）
3. 状态变更时通过 WebSocket 推送给所有连接的前端
4. 前端接收到更新后刷新界面

---

## 6. 里程碑与时间线

### 阶段 1：需求与设计（Week 1）
- [ ] 完成需求分析
- [ ] 完成技术选型
- [ ] 完成架构设计
- [ ] 创建项目结构

### 阶段 2：环境搭建（Week 1）
- [ ] 初始化前后端项目
- [ ] 配置开发环境
- [ ] 配置代码规范工具
- [ ] 搭建基础 UI 框架

### 阶段 3：核心功能开发（Week 2-3）
- [ ] 实现数据接入模块
- [ ] 实现 WebSocket 服务
- [ ] 开发 Agent 列表组件
- [ ] 开发状态实时更新
- [ ] 开发任务进度显示

### 阶段 4：错误日志（Week 3）
- [ ] 实现错误日志查看
- [ ] 实现日志筛选和搜索
- [ ] 实现日志下载功能

### 阶段 5：测试与优化（Week 4）
- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 性能优化
- [ ] 修复 Bug

### 阶段 6：部署（Week 4）
- [ ] 准备生产环境配置
- [ ] 部署到服务器
- [ ] 监控和日志配置

---

## 9. 任务看板系统需求

### 9.1 背景

OpenClaw 项目采用 `TASKS.md` 文档进行任务管理，但缺乏可视化的任务看板。需要开发一个任务看板系统，实现：

1. **可视化展示**：Trello 风格的三列任务看板（待处理、进行中、已完成）
2. **数据同步**：TASKS.md（Markdown）与 JSON 文件的双向同步
3. **Agent 交互**：Agent 可以领取任务、更新状态、报告完成
4. **多项目支持**：支持多个项目的任务管理，统一展示

### 9.2 数据架构设计

#### 文件结构
```
projects/项目名称/
├── TASKS.md              # Markdown 格式的任务文档（主数据源）
├── tasks/                # JSON 数据（自动生成）
│   ├── projects.json    # 项目列表
│   └── {projectId}-tasks.json  # 任务数据
├── scripts/              # 同步脚本（可选）
│   ├── sync-md-to-json.ts   # Markdown → JSON
│   └── sync-json-to-md.ts   # JSON → Markdown
└── docs/
    ├── PRD.md
    └── PROGRESS.md
```

#### 数据流
```
┌─────────────┐
│  TASKS.md  │ ← 人工编辑（主数据源）
└──────┬──────┘
       │
       ├───────────────────┐
       │                   │
       ▼                   ▼
┌─────────────────┐  ┌─────────────┐
│  Markdown      │  │  JSON API   │
│  → JSON 工具   │  │  看板更新    │
└────────┬────────┘  │  → Markdown  │
         │           └──────┬───────┘
         ▼                  │
┌─────────────┐             │
│ JSON 文件   │ ←────────────┘
└─────────────┘   看板数据源
```

### 9.3 功能需求

#### 9.3.1 核心功能（P1 - MVP）

**数据同步**
- [ ] **Markdown → JSON 解析**
  - 解析 TASKS.md 文档格式
  - 提取任务信息（ID、标题、描述、优先级、状态、标签）
  - 生成 JSON 文件
  - 支持阶段分组

- [ ] **JSON → Markdown 生成**
  - 从 JSON 生成 TASKS.md
  - 保持格式一致性
  - 支持自动生成任务 ID（VIS-004, VIS-005...）

- [ ] **双向同步**
  - Markdown 变化 → 自动同步到 JSON
  - 看板操作 → 自动同步到 Markdown
  - Agent 操作 → 自动同步到 Markdown

**任务看板界面**
- [ ] **三列布局**
  - 待处理（📋）
  - 进行中（🚧）
  - 已完成（✅）

- [ ] **任务卡片**
  - 显示任务标题（不显示 TASK-XXX）
  - 显示任务描述
  - 显示优先级徽章（P1/P2/P3）
  - 显示标签（后端、前端、docs 等）
  - 显示状态（待处理/进行中/已完成）
  - 显示领取者（如果有）
  - 显示阶段信息

- [ ] **多项目管理**
  - Tab 切换不同项目
  - 独立的数据文件
  - 统一的看板展示

- [ ] **统计数据**
  - 每列任务数量
  - 总任务数
  - 完成进度百分比

#### 9.3.2 Agent 交互（P1 - MVP）

**任务领取**
- Agent 调用 API: `POST /api/tasks/projects/:id/tasks/:taskId/claim`
- 后端更新 JSON（设置 claimedBy，更新状态为 in-progress）
- 后端同步到 Markdown（运行 JSON → Markdown 工具）
- WebSocket 广播任务更新

**任务完成**
- Agent 调用 API: `POST /api/tasks/projects/:id/tasks/:taskId`
- 请求体: `{ status: "done", completedAt: "2026-03-10T14:00:00Z" }`
- 后端更新 JSON（更新状态为 done，记录完成时间）
- 后端同步到 Markdown
- WebSocket 广播

**自动任务分配**
- 后端定时任务（每 60 秒）
- 检查所有待处理任务
- 自动分配给空闲 Agent
- 分配后自动同步到 Markdown
- WebSocket 广播

#### 9.3.3 API 接口

**项目管理**
```
GET    /api/tasks/projects                    # 获取所有项目
GET    /api/tasks/projects/:id                # 获取单个项目
POST   /api/tasks/projects                    # 创建项目
PUT    /api/tasks/projects/:id                # 更新项目
DELETE /api/tasks/projects/:id                # 删除项目
```

**任务管理**
```
GET    /api/tasks/projects/:id/tasks          # 获取项目所有任务
GET    /api/tasks/projects/:id/tasks/:taskId  # 获取单个任务
POST   /api/tasks/projects/:id/tasks          # 创建任务
PUT    /api/tasks/projects/:id/tasks/:taskId  # 更新任务
DELETE /api/tasks/projects/:id/tasks/:taskId  # 删除任务
```

**任务操作**
```
POST   /api/tasks/projects/:id/tasks/:taskId/claim     # 领取
POST   /api/tasks/projects/:id/tasks/:taskId/unclaim   # 放弃
POST   /api/tasks/projects/:id/tasks/:taskId/complete  # 完成
```

**同步接口**
```
POST   /api/tasks/sync/from-md              # Markdown → JSON
POST   /api/tasks/sync/to-md                # JSON → Markdown
POST   /api/tasks/sync/full                 # 双向同步
```

#### 9.3.4 可复用性设计（P2）

**CLI 工具**
```bash
npx openclaw-kanban create       # 创建项目
npx openclaw-kanban init          # 初始化
npx openclaw-kanban import        # MD → JSON
npx openclaw-kanban export        # JSON → MD
npx openclaw-kanban watch         # 监控服务
```

**新项目创建流程**
1. 创建项目目录
2. 创建 TASKS.md 模板
3. 初始化看板（自动生成 JSON）
4. 启动服务

### 9.4 TASKS.md 文档格式

#### 推荐格式
```markdown
# 项目名称 - 任务分解

## 项目信息
- **项目 ID**: openclaw-visualization
- **名称**: OpenClaw 可视化监控平台
- **负责人**: @Agent
- **状态**: 🚧 进行中

## 阶段 1

### 任务列表

-  **VIS-004** `P1` `docs` `done`
  - 状态: 已完成
  - 描述: 创建项目目录结构

-  **VIS-005** `P1` `backend` `todo`
  - 状态: 待处理
  - 描述: 初始化后端项目
  - 领取者: @Agent

## 统计
- **任务总数**: 10
- **待处理**: 3
- **进行中**: 1
- **已完成**: 6
```

#### 格式说明
- 任务 ID：自动生成（VIS-004, VIS-005...）
- 优先级：`P1`（高）、`P2`（中）、`P3`（低）
- 标签：`docs`、`backend`、`frontend` 等
- 状态：`todo`（待处理）、`in-progress`（进行中）、`done`（已完成）
- 领取者：`@Agent`、`@User` 等

### 9.5 技术实现

#### 数据模型
```typescript
interface Task {
  id: string;                    // VIS-004
  title: string;                  // 任务标题
  description: string;            // 任务描述
  status: 'todo' | 'in-progress' | 'done';
  priority: 'P1' | 'P2' | 'P3';
  labels: string[];               // 标签
  assignee: string | null;        // 分配给谁
  claimedBy: string | null;       // 领取者
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  comments: any[];
}

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  leadAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Stage {
  name: string;                   // 阶段名称
  week: string;
  tasks: Task[];
}
```

#### 同步机制
- **MarkdownToJSON**: 解析 TASKS.md，生成 JSON
- **JSONToMarkdown**: 从 JSON 生成 TASKS.md
- **SyncManager**: 统一管理同步
- **AgentTaskScheduler**: 定时任务调度器

#### WebSocket 协议
```typescript
// 任务更新
{
  type: 'TASK_UPDATE',
  projectId: string,
  task: Task
}

// Agent 更新
{
  type: 'AGENT_UPDATE',
  agents: Agent[]
}
```

---

## 10. 风险与依赖

### 风险

**风险 1：OpenClaw 数据源访问**
- 风险：可能没有公开的 API 获取 Agent 状态
- 缓解措施：直接读取数据库文件或日志文件，或扩展 OpenClaw 提供数据接口

**风险 2：WebSocket 连接稳定性**
- 风险：WebSocket 连接可能断开
- 缓解措施：实现自动重连机制

**风险 3：性能问题**
- 风险：大量 Agent 更新可能导致前端卡顿
- 缓解措施：使用虚拟滚动优化列表渲染，优化更新频率

### 依赖

**技术依赖**
- Node.js 18+
- OpenClaw 系统运行正常
- 数据库/日志文件可访问

**人员依赖**
- 前端开发能力
- 后端开发能力
- OpenClaw 系统了解

---

## 8. 待确认问题

- [ ] OpenClaw 是否有公开的 API 获取 Agent 状态？
- [ ] Agent 状态存储在哪里？数据库？日志文件？
- [ ] 是否需要用户认证？
- [ ] 部署环境是什么？（本地服务器？云服务器？）

---

*版本: 1.0.0*  
*最后更新: 2026-03-10*