# PMW-019 测试用例

## 概述

本目录包含 OpenClaw 可视化监控平台核心闭环的测试用例，覆盖以下功能：

- **SafeSyncService** (PMW-023): 安全同步服务
- **ProgressOrchestrator** (PMW-029): 进度编排服务（含去抖）
- **SyncLockService** (PMW-030): 防回环锁机制
- **FileWatcherService** (PMW-030): 文件监听服务（pause/resume）
- **PMW-032 集成测试**: 03 → 04 自动刷新

## 快速开始

### 运行所有测试

```bash
cd src/backend
npm test
```

### 运行特定测试文件

```bash
npm test -- tests/syncLockService.test.ts
```

### 监听模式

```bash
npm run test:watch
```

### 生成覆盖率报告

```bash
npm run test:coverage
```

## 测试文件说明

### 1. syncLockService.test.ts

测试 PMW-030 防回环锁机制：

- `acquire` - 获取锁
- `release` - 释放锁
- `isHeld` - 检查锁状态
- 超时机制
- 锁状态查询

### 2. safeSyncService.test.ts

测试 PMW-023 安全同步服务：

- 任务文档解析
- 运行态字段保护（in-progress/done 状态）
- 任务合并逻辑
- 新任务添加

### 3. progressOrchestrator.test.ts

测试 PMW-029 进度编排服务：

- 去抖机制（1秒内多次更新合并）
- 进度同步触发
- WebSocket 广播
- 锁机制集成

### 4. fileWatcherService.test.ts

测试 PMW-030 文件监听服务：

- start/stop 生命周期
- pause/resume 机制
- 嵌套 pause/resume 支持
- 文件变更监听

### 5. pmw032-integration.test.ts

PMW-032 集成测试：

- 03 变更触发 04 刷新
- 防回环机制验证
- ProgressToDocService 调用

## 验收步骤

```bash
# 1. 进入后端目录
cd src/backend

# 2. 安装依赖（如果还没有）
npm install

# 3. 运行测试
npm test

# 预期结果：
# ✓ tests/syncLockService.test.ts (X tests)
# ✓ tests/safeSyncService.test.ts (X tests)
# ✓ tests/progressOrchestrator.test.ts (X tests)
# ✓ tests/fileWatcherService.test.ts (X tests)
# ✓ tests/pmw032-integration.test.ts (X tests)
# 
# Test Files  X passed
# Tests       X passed
```

## 测试工具

- **vitest**: 测试框架
- **MockTaskService**: 模拟任务服务
- **MockProgressToDocService**: 模拟进度同步服务
- **MockWebSocketServer**: 模拟 WebSocket 服务器
- **createTempDir/cleanupTempDir**: 临时目录管理

## 注意事项

1. 测试使用临时目录，运行后自动清理
2. 文件监听测试需要等待去抖时间（约 100-500ms）
3. 部分测试依赖系统时间，可能需要调整超时

## 覆盖的关键用例

### SafeSyncService
- ✅ 成功解析任务文档
- ✅ 保护 in-progress 状态任务
- ✅ 保护 done 状态任务
- ✅ 允许更新 todo 状态任务
- ✅ 添加新任务

### ProgressOrchestrator
- ✅ 去抖：多次快速调用合并为一次
- ✅ 立即执行模式
- ✅ 锁机制防并发
- ✅ 错误处理

### SyncLockService
- ✅ 获取/释放锁
- ✅ 超时自动失效
- ✅ 锁状态查询
- ✅ 强制释放

### FileWatcherService
- ✅ pause/resume 机制
- ✅ 嵌套 pause/resume
- ✅ 暂停时忽略文件变更
- ✅ 手动同步

### PMW-032 集成
- ✅ 03 变更触发 04 刷新
- ✅ 04 变更不触发自身刷新
- ✅ 防回环机制生效