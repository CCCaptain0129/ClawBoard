# PMW-036: 新增任务写入03文档功能

## 概述

实现了"新增任务必须写入03文档"的前后端闭环功能，确保任务创建流程符合文档驱动的项目管理理念。

## 功能说明

### 后端实现

#### 1. 新增路由 `POST /api/task-doc/:projectId/tasks`

将任务以标准格式追加到项目的 `03-任务分解.md` 文档。

**请求体：**
```json
{
  "id": "PMW-036",           // 可选，若不提供则自动生成
  "title": "任务标题",        // 必填
  "description": "任务描述",  // 可选
  "priority": "P0",          // 可选，默认 P2
  "category": "temp",        // 可选，默认 temp（临时任务）
  "estimatedTime": "2小时",   // 可选
  "dependencies": ["PMW-001"] // 可选
}
```

**响应：**
```json
{
  "success": true,
  "taskId": "PMW-036",
  "taskDocPath": "/path/to/03-任务分解.md"
}
```

#### 2. 自动生成任务ID

- 从现有 03 文档解析最大任务编号
- 按项目 `taskPrefix` + 自增序号生成（如 PMW-036）
- 编号格式：三位数字补零（001, 002, ...）

#### 3. 任务写入位置

- 默认写入 `## 临时/其他任务` 区块
- 若区块不存在则自动创建
- 保留文档原有内容

#### 4. 触发链路

写入 03 后自动触发：
1. FileWatcher 检测文件变更
2. SafeSync 同步到看板 JSON
3. ProgressOrchestrator 更新 04 进度文档
4. WebSocket 广播任务创建事件

#### 5. pm-workflow-automation 项目限制

对于 `pm-workflow-automation` 项目，禁用直接 JSON 创建任务：
```
POST /api/tasks/projects/pm-workflow-automation/tasks
返回 400: {
  "error": "此项目禁止直接创建 JSON 任务，请使用新增任务功能（写入 03-任务分解.md）",
  "code": "USE_TASK_DOC_API"
}
```

### 前端实现

#### 1. 新增任务按钮

在看板页面顶部添加"新增任务"按钮，点击后弹出表单。

#### 2. 表单字段

- **任务标题**（必填）
- **任务描述**
- **优先级**：P0/P1/P2/P3
- **任务类别**：主线任务 / 临时任务
- **预计时间**
- **依赖任务**

#### 3. 成功反馈

- 调用 API 成功后自动刷新任务列表
- 高亮显示新创建的任务（3秒）
- 显示成功提示信息

## 验收步骤

### 1. 启动服务

```bash
# 后端
cd src/backend
npm run dev

# 前端
cd src/frontend
npm run dev
```

### 2. 在看板创建任务

1. 打开 http://localhost:5173
2. 在项目选择器中选择 `pm-workflow-automation`
3. 点击"新增任务"按钮
4. 填写任务标题（如："测试新功能"）
5. 选择优先级（如：P2）
6. 点击"创建任务"

### 3. 验证结果

1. **03 文档**：检查 `2026-03-13-pm-workflow-automation/docs/03-任务分解.md`
   - 应该在"临时/其他任务"区块看到新任务
   - 任务ID应为 `PMW-036`（或下一个序号）

2. **看板显示**：1-3秒内看板自动出现新任务
   - 在 todo 列看到新创建的任务
   - 任务卡片高亮显示

3. **04 文档**：检查 `2026-03-13-pm-workflow-automation/docs/04-进度跟踪.md`
   - 最后更新时间应刷新

## API 参考

### POST /api/task-doc/:projectId/tasks

创建任务并写入 03 文档。

**路径参数：**
- `projectId`: 项目ID（如 `pm-workflow-automation`）

**请求体：**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 否 | 任务ID，不填则自动生成 |
| title | string | 是 | 任务标题 |
| description | string | 否 | 任务描述 |
| priority | 'P0'\|'P1'\|'P2'\|'P3' | 否 | 优先级，默认 P2 |
| category | 'main'\|'temp' | 否 | 任务类别，默认 temp |
| estimatedTime | string | 否 | 预计时间 |
| dependencies | string[] | 否 | 依赖任务ID列表 |

**响应：**
| 状态码 | 说明 |
|--------|------|
| 200 | 创建成功 |
| 400 | 参数错误（缺少标题） |
| 404 | 项目未配置或文档不存在 |
| 500 | 服务器错误 |

## 技术细节

### 任务ID生成策略

```typescript
// 1. 从文档内容解析所有任务ID
const matches = content.match(/PREFIX-\d{3}/g);

// 2. 找到最大编号
let maxNumber = 0;
for (const id of matches) {
  const num = parseInt(id.split('-')[1], 10);
  if (num > maxNumber) maxNumber = num;
}

// 3. 生成新ID
const newId = `PREFIX-${(maxNumber + 1).toString().padStart(3, '0')}`;
```

### 文档插入逻辑

```typescript
// 1. 检查是否存在"临时/其他任务"区块
const tempSectionIndex = content.indexOf('## 临时/其他任务');

// 2. 若存在，插入到区块末尾
if (tempSectionIndex !== -1) {
  // 找到区块结束位置
  // 插入任务 Markdown
}

// 3. 若不存在，创建新区块
else {
  const newSection = `\n\n## 临时/其他任务\n\n${taskMarkdown}\n`;
  content = content.trimEnd() + newSection;
}
```

## 测试覆盖

新增测试文件：`src/backend/tests/taskDocRoutes.test.ts`

测试覆盖：
- ✅ 任务ID解析
- ✅ 任务ID生成
- ✅ 任务 Markdown 构建
- ✅ 文档插入
- ✅ 完整流程测试
- ✅ pm-workflow-automation 禁用验证

运行测试：
```bash
npm test -- tests/taskDocRoutes.test.ts
```

## 注意事项

1. **项目配置**：需要确保项目在 `SafeSyncService` 中正确配置了 `taskDoc` 路径

2. **文档格式**：任务 Markdown 需要符合项目规范
   ```markdown
   ### PREFIX-XXX `P0` 任务标题

   - 状态: 待处理
   - 描述: 任务描述
   - 领取者: (空)
   - 预计时间: 2小时
   - 依赖: (无)
   ```

3. **并发控制**：写入操作会触发文件监听，已有防回环机制

4. **错误处理**：
   - 项目未配置返回 404
   - 文档不存在返回 404
   - 参数错误返回 400

## 相关任务

- PMW-023: 安全同步服务
- PMW-029: 进度编排服务
- PMW-030: 防回环机制
- PMW-032: 03 → 04 自动刷新

---

*创建时间: 2026-03-13 20:45 GMT+8*
*创建者: Subagent (feature-create-task-via-doc-end2end-glm5)*