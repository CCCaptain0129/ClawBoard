# 开发流程与最佳实践

> OpenClaw Visualization 开发过程中总结的开发流程和最佳实践

---

## 📚 目录

1. [开发流程](#开发流程)
2. [最佳实践](#最佳实践)
3. [代码规范](#代码规范)
4. [测试规范](#测试规范)
5. [文档规范](#文档规范)
6. [Git 工作流](#git-工作流)
7. [常见错误](#常见错误)

---

## 开发流程

### 标准开发流程

```
1. 需求分析
   ↓
2. 技术方案设计
   ↓
3. 编写代码
   ↓
4. 本地测试
   ↓
5. 提交代码 (commit)
   ↓
6. 推送到 GitHub (push)
   ↓
7. 更新文档
   ↓
8. 继续下一个功能
```

### 详细步骤

#### 1. 需求分析
- 明确功能需求
- 识别技术挑战
- 评估工作量

#### 2. 技术方案设计
- 选择技术栈
- 设计架构
- 制定实现步骤

#### 3. 编写代码
- 遵循代码规范
- 添加必要的注释
- 保持代码简洁

#### 4. 本地测试
- 功能测试
- 边界测试
- 错误处理测试

#### 5. 提交代码
```bash
git add -A
git commit -m "feat: xxx"  # 或 fix/docs/chore
git push
```

#### 6. 更新文档
- 更新 README.md
- 更新相关文档
- 更新 CHANGELOG.md（内部）

#### 7. 继续下一个功能
- 回到步骤 1

---

## 最佳实践

### 1. 小步快跑

**原则：**
- 将大功能拆分成小任务
- 每完成一个小任务就测试、提交
- 避免长时间未提交

**示例：**
```
❌ 不推荐：
编写 500 行代码 → 测试 → 提交

✅ 推荐：
编写 50 行代码 → 测试 → 提交
编写 50 行代码 → 测试 → 提交
...
```

### 2. 频繁提交

**原则：**
- 每完成一个功能就提交
- 提交信息清晰明了
- 不要堆积大量更改

**提交信息格式：**
```bash
feat: 新增功能
fix: 修复 Bug
docs: 更新文档
chore: 杂项（配置、依赖等）
style: 代码格式调整
refactor: 重构
test: 测试相关
```

**示例：**
```bash
# 好的提交信息
feat: 添加任务拖拽功能
fix: 修复 WebSocket 连接问题
docs: 更新 README.md 添加部署说明
chore: 更新依赖版本

# 不好的提交信息
update
fix bug
xxx
```

### 3. 及时推送

**原则：**
- commit 后立即 push
- 避免本地堆积大量提交
- 保持与 GitHub 同步

### 4. 保持文档同步

**原则：**
- 代码变更后立即更新文档
- 文档包含最新信息
- 删除过时文档

### 5. 使用 MEMORY.md

**原则：**
- 重要决策立即写入 MEMORY.md
- 配置信息写入 MEMORY.md
- 问题解决方案写入 MEMORY.md

---

## 代码规范

### 命名规范

#### 文件命名
```
✅ PascalCase:  class 文件
   AgentService.ts
   WebSocketHandler.ts

✅ camelCase:  普通文件
   agentService.ts
   webSocketHandler.ts

✅ kebab-case:  配置文件
   .env.production
   package.json
```

#### 变量命名
```typescript
✅ camelCase
const agentService = new AgentService();
const lastActiveTime = Date.now();

❌ snake_case
const agent_service = new AgentService();
const last_active_time = Date.now();
```

#### 常量命名
```typescript
✅ UPPER_SNAKE_CASE
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000;

❌ camelCase
const maxReconnectAttempts = 5;
```

### 代码结构

```typescript
// 1. 导入
import { Agent } from '../types/agents';
import * as fs from 'fs';

// 2. 常量
const MAX_RETRIES = 3;

// 3. 类/函数
export class AgentService {
  // 私有属性
  private path: string;
  
  // 公开方法
  public async getAllAgents(): Promise<Agent[]> {
    // 实现
  }
  
  // 私有方法
  private transformToAgent(key: string): Agent {
    // 实现
  }
}
```

### 注释规范

```typescript
/**
 * 获取所有 Agent
 * @returns Agent 数组
 */
async getAllAgents(): Promise<Agent[]> {
  // 实现
}

// 单行注释
// 简要说明
```

---

## 测试规范

### 测试流程

1. **单元测试**（如果需要）
   - 测试单个函数
   - 测试边界条件

2. **集成测试**
   - 测试模块间交互
   - 测试 API 接口

3. **手动测试**
   - 功能测试
   - UI 测试
   - 错误处理测试

### 测试要点

- ✅ 正常流程
- ✅ 异常流程
- ✅ 边界条件
- ✅ 性能测试

---

## 文档规范

### README.md

**必需内容：**
- 项目简介
- 功能特性
- 快速开始
- 技术栈
- 项目结构
- API 文档
- 常见问题

### 代码注释

**何时添加注释：**
- 复杂的逻辑
- 重要的决策
- 潜在的问题
- 需要优化的地方

**示例：**
```typescript
// 注意：sessions.json 只包含配置，不包含实时状态
// 我们基于 updatedAt 推测活跃程度
const status = this.calculateStatus(session.updatedAt);
```

### CHANGELOG.md

**格式：**
```markdown
## [版本号] - YYYY-MM-DD

### 新增
- 新功能 1
- 新功能 2

### 修复
- 修复 Bug 1
- 修复 Bug 2

### 变更
- 变更 1
- 变更 2
```

---

## Git 工作流

### 分支策略

```
main          ← 主分支，稳定版本
  ↓
develop       ← 开发分支，日常开发
  ↓
feature/xxx   ← 功能分支
  ↓
fix/xxx       ← 修复分支
  ↓
合并回 develop → 合并回 main
```

### Commit 规范

**格式：**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型：**
- feat: 新功能
- fix: Bug 修复
- docs: 文档更新
- style: 代码格式
- refactor: 重构
- test: 测试
- chore: 杂项

**示例：**
```
feat(backend): 添加批量创建任务 API

- 新增 POST /api/tasks/projects/:id/tasks/batch
- 支持一次创建多个任务
- 添加输入验证

Closes #123
```

### Push 规范

```bash
# 每次提交后立即 push
git add -A
git commit -m "feat: xxx"
git push

# 不要堆积大量提交
```

---

## 常见错误

### 1. 提交信息不清楚

**错误示例：**
```bash
git commit -m "update"
git commit -m "fix"
```

**正确示例：**
```bash
git commit -m "feat: 添加任务拖拽功能"
git commit -m "fix: 修复 WebSocket 连接超时问题"
```

### 2. 堆积大量提交

**错误示例：**
```bash
# 完成多个功能后一次性提交
git add -A
git commit -m "feat: 完成多个功能"
```

**正确示例：**
```bash
# 每完成一个功能就提交
git add -A && git commit -m "feat: 功能1" && git push
git add -A && git commit -m "feat: 功能2" && git push
```

### 3. 忘记更新文档

**错误示例：**
```bash
# 添加新 API 后，忘记更新 API 文档
```

**正确示例：**
```bash
# 添加新 API 后，立即更新 README.md
git add -A && git commit -m "feat: 添加新 API" && git push
git add README.md && git commit -m "docs: 更新 API 文档" && git push
```

### 4. 忘记测试

**错误示例：**
```bash
# 编写代码后直接提交
```

**正确示例：**
```bash
# 编写代码 → 测试 → 提交
npm test
git add -A && git commit -m "feat: xxx" && git push
```

### 5. 代码格式不一致

**错误示例：**
```typescript
// 文件中有多种代码风格
const a = 1
const b = 2;
const c = 3;
```

**正确示例：**
```typescript
// 统一使用相同的代码风格
const a = 1;
const b = 2;
const c = 3;
```

---

## 工具推荐

### 代码格式化
- Prettier
- ESLint

### Git 工具
- GitHub Desktop
- SourceTree
- GitKraken

### IDE
- VS Code
- WebStorm

---

## 总结

### 核心原则

1. **小步快跑**
   - 拆分成小任务
   - 频繁测试
   - 频繁提交

2. **及时同步**
   - commit 后立即 push
   - 代码变更后更新文档
   - 重要决策写入 MEMORY.md

3. **保持清晰**
   - 清晰的提交信息
   - 清晰的代码结构
   - 清晰的文档

### 检查清单

每次提交前检查：
- [ ] 代码已测试
- [ ] 提交信息清晰
- [ ] 文档已更新
- [ ] MEMORY.md 已更新（如需要）
- [ ] 没有敏感信息
- [ ] 代码已格式化

---

*版本: 1.0.0*  
*更新日期: 2026-03-11*