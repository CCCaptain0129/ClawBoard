# MEMORY 使用规范

> workspace 中 MEMORY.md 的使用规范和最佳实践

---

## 📚 目录

1. [MEMORY.md 概述](#memorymd-概述)
2. [何时使用 MEMORY](#何时使用-memory)
3. [MEMORY.md 结构](#memorymd-结构)
4. [写入规范](#写入规范)
5. [检索规范](#检索规范)
6. [最佳实践](#最佳实践)
7. [常见问题](#常见问题)

---

## MEMORY.md 概述

### 什么是 MEMORY.md

`workspace/MEMORY.md` 是项目级记忆文件，用于存储：
- 重要决策和结论
- 项目架构和技术选型
- 关键配置和参数
- 常用命令和操作流程
- 遇到的问题和解决方案

### 为什么需要 MEMORY.md

**会话重启后保留记忆：**
- OpenClaw 每次会话都会"失忆"
- MEMORY.md 作为持久化记忆，让 Agent 跨会话保留信息
- 每次会话开始时读取 MEMORY.md

**与 PROJECTS 中的 MEMORY 区别：**
- `workspace/MEMORY.md`：全局/工作区级记忆
- `projects/xxx/MEMORY.md`：项目级记忆（如果需要）

---

## 何时使用 MEMORY

### 必须写入 MEMORY 的场景

1. **重要决策**
   - 技术选型（如：选择 React 而不是 Vue）
   - 架构设计决策（如：使用 REST API 而不是 GraphQL）
   - 工具/框架选择（如：使用 TypeScript 而不是 JavaScript）

2. **配置信息**
   - 服务端口配置
   - 环境变量说明
   - 文件路径和结构
   - API 端点和认证信息

3. **关键参数**
   - 超时时间阈值
   - 重试次数
   - 数据库连接池大小
   - 缓存策略

4. **操作流程**
   - 常用命令序列
   - 部署步骤
   - 测试流程
   - 故障排查步骤

5. **问题和解决方案**
   - 遇到的 Bug 和解决方法
   - 性能问题和优化方案
   - 兼容性问题和 Workaround

### 不需要写入 MEMORY 的场景

- 临时调试信息
- 一次性操作
- 已在代码中清晰注释的内容
- 短期使用的配置

---

## MEMORY.md 结构

### 推荐结构

```markdown
# MEMORY.md - 项目记忆

## 项目信息
- 项目名称：xxx
- 项目路径：xxx
- 创建时间：xxx
- 状态：xxx

## 技术栈
- 前端：xxx
- 后端：xxx
- 数据库：xxx

## 架构设计
- 整体架构：xxx
- 模块划分：xxx

## 配置说明
- 服务端口：xxx
- 环境变量：xxx

## 关键决策
- 决策 1：xxx
- 决策 2：xxx

## 常用命令
- 启动服务：xxx
- 部署：xxx

## 问题记录
- 问题 1：xxx
- 问题 2：xxx
```

### 示例

```markdown
# MEMORY.md - OpenClaw Visualization

## 项目信息
- 项目名称：OpenClaw Visualization
- 项目路径：/Users/ot/.openclaw/workspace/projects/openclaw-visualization
- 创建时间：2026-03-10
- 状态：开发中

## 技术栈
- 前端：React 18 + TypeScript + Vite + Tailwind CSS
- 后端：Node.js + Express + TypeScript + WebSocket
- 数据存储：JSON 文件 + Markdown 文件

## 架构设计
- 前后端分离
- WebSocket 实时通信
- Markdown ↔ JSON 双向同步

## 配置说明
- 后端 HTTP 端口：3000
- 后端 WebSocket 端口：3001
- 前端 Vite 端口：5173
- OpenClaw Gateway 端口：18789

## 关键决策
- 选择 REST API 作为 OpenClaw 集成方式（而不是 WebSocket 或 CLI）
- 使用 JSON 文件存储任务数据（简单直接，无需数据库）
- 每次会话启动时同步 Markdown 到 JSON

## 常用命令
- 启动项目：./start.sh
- 停止项目：./stop.sh
- 创建项目：./task-cli create-project --id xxx --name "xxx"
- 创建任务：./task-cli create-task --project xxx --title "xxx"

## 问题记录
- 2026-03-11：Agent 监控状态全部显示为 stopped
  - 原因：sessions.json 只包含配置，不包含实时状态
  - 解决方案：调整状态判断阈值，running: <5分钟, idle: 默认, stopped: >24小时
```

---

## 写入规范

### 格式要求

1. **使用 Markdown 格式**
2. **清晰的标题层级**
3. **代码块使用 ```language ... ```
4. **列表使用 - 或 1.**
5. **重点内容使用 **bold** 或 `code``

### 内容要求

1. **简洁明了**
   - 每个条目 1-2 句话
   - 避免冗长的描述

2. **可操作**
   - 包含具体的命令、配置、参数
   - 避免模糊的描述

3. **结构化**
   - 使用标题分组
   - 使用列表列举
   - 保持一致的格式

4. **时间戳**
   - 问题记录包含日期
   - 决策记录包含日期

### 写入时机

1. **决策时立即写入**
   ```javascript
   // 决策：使用 REST API
   updateMemory(`
   ## 关键决策
   - 2026-03-11：选择 REST API 作为 OpenClaw 集成方式
     - 原因：标准化接口，易于扩展
   `);
   ```

2. **解决问题后立即写入**
   ```javascript
   // 问题：WebSocket 连接失败
   updateMemory(`
   ## 问题记录
   - 2026-03-11：WebSocket 连接失败
     - 原因：端口配置错误
     - 解决方案：修改端口为 3001
   `);
   ```

3. **重要配置变更后写入**
   ```javascript
   // 配置：新增 API 端点
   updateMemory(`
   ## API 端点
   - POST /api/tasks/projects/:id/tasks/batch - 批量创建任务
   - GET /api/tasks/projects/:id/progress - 查询项目进度
   `);
   ```

---

## 检索规范

### 使用 memory_search

```javascript
// 搜索配置信息
const results = await memory_search('配置 端口');

// 搜索问题
const results = await memory_search('WebSocket 连接');

// 搜索决策
const results = await memory_search('技术选型');
```

### 使用 memory_get

```javascript
// 获取 MEMORY.md 的特定部分
const memory = await memory_get('MEMORY.md', 1, 50);

// 获取每日记录
const daily = await memory_get('memory/2026-03-11.md', 1, 100);
```

### 检索技巧

1. **使用关键词**
   - "端口" 而不是 "port"
   - "配置" 而不是 "config"

2. **使用自然语言**
   - "如何启动服务"
   - "WebSocket 连接失败"

3. **组合搜索**
   - "配置 端口"
   - "问题 WebSocket"

---

## 最佳实践

### 1. 定期整理

```markdown
## 最近更新
- 2026-03-11：添加 OpenClaw 集成方案
- 2026-03-10：完成任务看板 MVP
- 2026-03-09：创建项目
```

### 2. 使用二级标题

```markdown
## 技术栈         ✅ 好
### 技术栈       ❌ 太深
技术栈           ❌ 太浅
```

### 3. 分组记录

```markdown
## 配置说明
### 服务配置
- 端口：xxx
- 超时：xxx

### 环境变量
- API_KEY：xxx
- DB_URL：xxx
```

### 4. 避免重复

```markdown
## 问题记录
- 问题：WebSocket 连接失败         ✅ 记录一次即可
- 问题：WebSocket 连接失败         ❌ 不要重复
```

### 5. 使用代码块

```markdown
## 常用命令
```bash
# 启动服务
./start.sh

# 创建项目
./task-cli create-project --id xxx
```
```

### 6. 保持更新

```markdown
## 服务端口（已废弃）
- 后端：3000                           ❌ 旧信息

## 服务端口
- 后端 HTTP：3000                       ✅ 新信息
- 后端 WebSocket：3001
```

---

## 常见问题

### Q1: MEMORY.md 太大怎么办？

**解决方案：**
1. 删除过时的信息
2. 将历史问题归档到 `memory/archive/`
3. 保持最近 3-6 个月的信息

### Q2: 如何决定是否写入 MEMORY？

**判断标准：**
- 这个信息对未来的会话有帮助吗？
- 如果是，写入 MEMORY
- 如果不是，不需要写入

### Q3: daily notes 和 MEMORY.md 的区别？

- **daily notes**（`memory/YYYY-MM-DD.md`）：详细记录当天的工作日志
- **MEMORY.md**：提取 daily notes 中的重要信息，形成长期记忆

### Q4: 如何从 daily notes 提取到 MEMORY？

```javascript
// 定期（如每周）从 daily notes 提取重要信息到 MEMORY
// 只保留重要的决策、配置、问题
```

### Q5: MEMORY.md 的权限管理？

- MEMORY.md 应该是只读的（除了 Agent）
- 用户不应该手动编辑 MEMORY.md
- Agent 有权读取和写入 MEMORY.md

---

## 示例

### 完整示例

```markdown
# MEMORY.md - OpenClaw Visualization

## 项目信息
- 项目名称：OpenClaw Visualization
- 项目路径：/Users/ot/.openclaw/workspace/projects/openclaw-visualization
- 创建时间：2026-03-10
- 状态：开发中
- GitHub：https://github.com/CCCaptain0129/OpenClaw_Visualization

## 技术栈
- 前端：React 18 + TypeScript + Vite + Tailwind CSS
- 后端：Node.js + Express + TypeScript + WebSocket
- 数据存储：JSON 文件 + Markdown 文件
- 命令行工具：Bash

## 架构设计
- 前后端分离
- WebSocket 实时通信
- Markdown ↔ JSON 双向同步
- 多项目支持（颜色和图标区分）

## 配置说明
### 服务端口
- 后端 HTTP：3000
- 后端 WebSocket：3001
- 前端 Vite：5173
- OpenClaw Gateway：18789

### 文件路径
- 项目配置：`tasks/projects.json`
- 任务数据：`tasks/{project-id}-tasks.json`
- 任务文档：`tasks/{project-id}-TASKS.md`
- 后端代码：`src/backend/`
- 前端代码：`src/frontend/`

## 关键决策
### 2026-03-11：选择 REST API 作为 OpenClaw 集成方式
- **原因**：标准化接口，易于扩展，支持远程调用
- **替代方案**：WebSocket（复杂）、CLI（性能开销）
- **配置**：API 地址 http://localhost:3000

### 2026-03-11：使用 JSON 文件存储任务数据
- **原因**：简单直接，无需数据库
- **替代方案**：数据库（复杂）、内存（不持久化）
- **配置**：存储在 `tasks/` 目录

### 2026-03-10：选择 Tailwind CSS 而不是 CSS-in-JS
- **原因**：更灵活，性能更好
- **替代方案**：Styled Components（复杂）

## 常用命令
### 项目管理
```bash
# 启动项目
./start.sh

# 停止项目
./stop.sh
```

### 任务管理
```bash
# 创建项目
./task-cli create-project --id xxx --name "xxx" --color "#3B82F6" --icon "🎯"

# 创建任务
./task-cli create-task --project xxx --title "xxx" --priority P1 --labels frontend,feature

# 更新任务状态
./task-cli update VIS-004 --status done

# 查看项目进度
./task-cli progress --project xxx

# 列出任务
./task-cli list --project xxx
```

### Git 操作
```bash
# 提交代码
git add -A
git commit -m "feat: xxx"
git push

# 查看状态
git status
git log --oneline -5
```

## 问题记录
### 2026-03-11：Agent 监控状态全部显示为 stopped
- **原因**：`sessions.json` 只包含配置和历史，不包含实时运行状态
- **解决方案**：调整状态判断阈值
  - running: < 5 分钟
  - idle: 默认状态
  - stopped: > 24 小时
- **数据源**：`~/.openclaw/agents/main/sessions/sessions.json`

### 2026-03-10：WebSocket 连接失败
- **原因**：端口配置错误
- **解决方案**：修改 WebSocket 端口为 3001
- **文件**：`src/backend/src/index.ts`

### 2026-03-10：任务同步失败
- **原因**：文件权限问题
- **解决方案**：确保 `tasks/` 目录有写入权限
- **命令**：`chmod 755 tasks/`

## 开发流程
1. 规划功能
2. 编写代码
3. 测试功能
4. 提交代码：`git add -A && git commit -m "xxx" && git push`
5. 更新文档
6. 继续下一个功能

## 注意事项
- 每次 commit 前先测试
- 提交信息清晰（feat/fix/docs/chore）
- 保持文档和代码同步
- 定期更新 MEMORY.md
```

---

*版本: 1.0.0*  
*更新日期: 2026-03-11*