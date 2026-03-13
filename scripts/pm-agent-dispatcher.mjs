#!/usr/bin/env node
/**
 * pm-agent-dispatcher.mjs - Project Manager Agent 任务调度脚本
 * 
 * 功能：
 * 1. 监控 tasks JSON（通过 API 或直接读文件）
 * 2. 发现 status=in-progress 且 claimedBy 为空的任务
 * 3. 生成高质量 prompt（全局约束 + 任务信息）
 * 4. 调用 OpenClaw Gateway RPC 创建 subagent
 * 5. 通过后端 API 更新任务状态
 * 6. 记录生成的 prompt 到日志文件
 * 
 * 配置：
 * - PROJECT_ALLOWLIST: 允许调度的项目 ID 列表
 * - POLL_INTERVAL_MS: 轮询间隔（毫秒）
 * - MAX_CONCURRENT: 最大并发 subagent 数量
 * 
 * 用法：
 *   node pm-agent-dispatcher.mjs [--once] [--config config.json]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// 配置
// ============================================================

const DEFAULT_CONFIG = {
  // 允许调度的项目 ID 列表（空 = 所有项目）
  projectAllowlist: [],
  
  // 轮询间隔（毫秒）- 默认 30 秒
  pollIntervalMs: 30000,
  
  // 最大并发 subagent 数量
  maxConcurrent: 3,
  
  // 后端 API 地址
  backendUrl: 'http://localhost:3000',
  
  // 任务数据目录
  tasksDir: path.resolve(__dirname, '../tasks'),
  
  // 日志目录
  logsDir: path.resolve(__dirname, '../tmp/logs'),
  
  // Prompt 日志文件
  promptLogFile: path.resolve(__dirname, '../tmp/logs/pm-prompts.log'),
  
  // 分发记录文件
  dispatchRecordFile: path.resolve(__dirname, '../docs/internal/SUBAGENTS任务分发记录.md'),
  
  // 全局约束模板
  globalConstraints: {
    // 代码风格
    codeStyle: 'TypeScript/Node.js，遵循项目现有代码风格',
    
    // 提交规范
    commitStyle: '使用 conventional commits 格式：feat/fix/docs/style/refactor/test/chore',
    
    // 测试要求
    testRequired: false,
    
    // 文档要求
    docRequired: true,
    
    // 超时设置
    timeoutMinutes: 30,
    
    // 默认模型
    defaultModel: 'bailian/glm-4.7'
  }
};

// 运行时配置
let config = { ...DEFAULT_CONFIG };

// 运行状态
let isRunning = false;
let intervalId = null;

// 已处理的任务（避免重复处理）
const processedTasks = new Set();

// ============================================================
// 工具函数
// ============================================================

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}\n`;
  console.log(`[${level}] ${message}`);
  
  // 写入日志文件
  try {
    fs.mkdirSync(config.logsDir, { recursive: true });
    fs.appendFileSync(path.join(config.logsDir, 'pm-dispatcher.log'), logMessage);
  } catch (e) {
    // 忽略日志写入错误
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// Prompt 生成器
// ============================================================

/**
 * 生成高质量的任务 prompt
 */
function generatePrompt(task, project, constraints) {
  const { id, title, description, priority, labels } = task;
  const { name: projectName, id: projectId } = project;
  
  // 构建标签信息
  const labelInfo = labels?.length ? labels.join(', ') : '无';
  
  // 构建完整 prompt
  const prompt = `
# 任务: ${title}

## 基本信息
- **任务 ID**: ${id}
- **所属项目**: ${projectName} (${projectId})
- **优先级**: ${priority || 'P2'}
- **标签**: ${labelInfo}

## 任务描述
${description || title}

## 全局约束

### 代码规范
- ${constraints.codeStyle}
- 使用现有项目结构和模式
- 保持代码简洁、可读性强

### 提交规范
- ${constraints.commitStyle}
- 提交信息简洁明了，说明做了什么

### 测试要求
${constraints.testRequired ? '- 编写或更新相关测试用例' : '- 本次任务不强制要求测试'}

### 文档要求
${constraints.docRequired ? '- 更新相关文档（如 README、API 文档等）' : '- 本次任务不强制要求文档更新'}

### 超时设置
- 任务执行时间不超过 ${constraints.timeoutMinutes} 分钟
- 如果预计超时，请在任务开始时说明

## 执行指南

1. **理解任务**: 仔细阅读任务描述，明确目标
2. **分析代码**: 理解现有代码结构和依赖关系
3. **实施方案**: 制定清晰的实施步骤
4. **编写代码**: 按照方案实现功能
5. **自我验证**: 测试实现是否正确
6. **提交变更**: 完成后提交代码并推送

## 注意事项

- 不要修改无关的代码
- 保持向后兼容性
- 如果发现问题或需要澄清，请及时反馈

## 完成标准

- [ ] 功能实现完整
- [ ] 代码符合规范
- [ ] 无明显 bug
- [ ] 提交信息规范

---
*此 prompt 由 PM-Agent-Dispatcher 自动生成*
*生成时间: ${new Date().toISOString()}*
`;

  return prompt.trim();
}

/**
 * 记录生成的 prompt 到日志文件
 */
function logPrompt(taskId, prompt, subagentId) {
  try {
    const logEntry = `
${'='.repeat(80)}
时间: ${new Date().toISOString()}
任务 ID: ${taskId}
Subagent ID: ${subagentId}
${'='.repeat(80)}

${prompt}

`;
    
    fs.mkdirSync(path.dirname(config.promptLogFile), { recursive: true });
    fs.appendFileSync(config.promptLogFile, logEntry);
    log(`Prompt 已记录到: ${config.promptLogFile}`);
  } catch (e) {
    log(`记录 prompt 失败: ${e.message}`, 'ERROR');
  }
}

// ============================================================
// 任务管理
// ============================================================

/**
 * 获取所有项目
 */
async function getProjects() {
  try {
    // 首先尝试 API
    const response = await fetch(`${config.backendUrl}/api/tasks/projects`);
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    log(`API 获取项目失败，尝试读取文件: ${e.message}`, 'WARN');
  }
  
  // 回退到读取文件
  try {
    const projectsFile = path.join(config.tasksDir, 'projects.json');
    const content = fs.readFileSync(projectsFile, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    log(`读取项目文件失败: ${e.message}`, 'ERROR');
    return [];
  }
}

/**
 * 获取项目的任务列表
 */
async function getProjectTasks(projectId) {
  try {
    // 首先尝试 API
    const response = await fetch(`${config.backendUrl}/api/tasks/projects/${projectId}/tasks`);
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    log(`API 获取任务失败，尝试读取文件: ${e.message}`, 'WARN');
  }
  
  // 回退到读取文件
  try {
    const tasksFile = path.join(config.tasksDir, `${projectId}-tasks.json`);
    const content = fs.readFileSync(tasksFile, 'utf-8');
    const data = JSON.parse(content);
    return data.tasks || [];
  } catch (e) {
    log(`读取任务文件失败: ${e.message}`, 'ERROR');
    return [];
  }
}

/**
 * 查找需要分配的任务
 * 条件：status=in-progress 且 claimedBy 为空
 */
async function findTasksToDispatch() {
  const projects = await getProjects();
  const tasksToDispatch = [];
  
  for (const project of projects) {
    // 检查项目是否在白名单中
    if (config.projectAllowlist.length > 0 && 
        !config.projectAllowlist.includes(project.id)) {
      continue;
    }
    
    const tasks = await getProjectTasks(project.id);
    
    for (const task of tasks) {
      // 筛选条件：status=in-progress 且 claimedBy 为空
      if (task.status === 'in-progress' && !task.claimedBy) {
        // 检查是否已处理过
        if (processedTasks.has(task.id)) {
          continue;
        }
        
        tasksToDispatch.push({ task, project });
      }
    }
  }
  
  return tasksToDispatch;
}

/**
 * 获取运行中的 subagent 数量
 */
async function getRunningSubagentCount() {
  try {
    // 读取 sessions.json
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const sessionsFile = path.join(homeDir, '.openclaw/agents/main/sessions/sessions.json');
    const content = fs.readFileSync(sessionsFile, 'utf-8');
    const sessions = JSON.parse(content);
    
    // 计算运行中的 subagent 数量
    let count = 0;
    for (const [key, session] of Object.entries(sessions)) {
      if (key.startsWith('agent:main:subagent:')) {
        // 检查是否仍在运行（最近 5 分钟有更新）
        const lastUpdate = session.updatedAt || 0;
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        if (lastUpdate > fiveMinutesAgo) {
          count++;
        }
      }
    }
    
    return count;
  } catch (e) {
    log(`获取 subagent 状态失败: ${e.message}`, 'WARN');
    return 0;
  }
}

// ============================================================
// Gateway RPC 调用
// ============================================================

/**
 * 调用 OpenClaw Gateway RPC 方法
 * 使用 openclaw CLI 的 gateway call 命令，无需手动处理 token
 */
async function callGatewayRPC(method, params) {
  return new Promise((resolve, reject) => {
    const paramsJson = JSON.stringify(params);
    const args = ['gateway', 'call', method, '--json', '--params', paramsJson];
    
    log(`调用 Gateway RPC: ${method}`, 'DEBUG');
    
    const child = spawn('openclaw', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          reject(new Error(`解析响应失败: ${e.message}`));
        }
      } else {
        reject(new Error(`Gateway call failed (code ${code}): ${stderr || stdout}`));
      }
    });
    
    child.on('error', (e) => {
      reject(new Error(`启动 openclaw CLI 失败: ${e.message}`));
    });
    
    // 30秒超时
    setTimeout(() => {
      child.kill();
      reject(new Error('Gateway call timeout'));
    }, 30000);
  });
}

/**
 * 通过 OpenClaw Gateway RPC 创建 subagent
 * 
 * 流程：
 * 1. 使用 sessions.patch 创建 session entry
 * 2. 使用 agent 方法启动 subagent 执行
 * 
 * 优势：
 * - 不需要手动处理 Gateway token
 * - 使用 openclaw CLI 统一处理认证
 * - 支持本地 Gateway 运行
 */
async function spawnSubagent(task, project, prompt) {
  const taskId = task.id;
  const subagentLabel = `${taskId}-${Date.now().toString(36)}`;
  const childSessionKey = `agent:main:subagent:${randomUUID()}`;
  
  log(`准备创建 subagent: ${childSessionKey} (label: ${subagentLabel})`);
  
  try {
    // 步骤 1: 使用 sessions.patch 创建 session entry
    // 这会创建一个 subagent session 并返回 sessionId
    log(`步骤 1: 创建 session entry (${childSessionKey})`);
    
    const patchResult = await callGatewayRPC('sessions.patch', {
      key: childSessionKey,
      spawnDepth: 1  // 子 session 深度
    });
    
    if (!patchResult.ok) {
      throw new Error(patchResult.error || 'sessions.patch failed');
    }
    
    log(`Session entry 已创建: sessionId=${patchResult.entry?.sessionId}`);
    
    // 步骤 2: 设置模型
    const model = config.globalConstraints.defaultModel;
    log(`步骤 2: 设置模型 ${model}`);
    
    try {
      await callGatewayRPC('sessions.patch', {
        key: childSessionKey,
        model: model
      });
    } catch (e) {
      log(`设置模型失败（继续）: ${e.message}`, 'WARN');
    }
    
    // 步骤 3: 构建 subagent task message
    const childTaskMessage = `[Subagent Context] You are running as a subagent (depth 1/1). Results auto-announce to your requester; do not busy-poll for status.

[Subagent Task]: ${prompt}`;
    
    // 步骤 4: 使用 agent 方法启动 subagent
    log(`步骤 3: 启动 subagent 执行`);
    
    const idempotencyKey = randomUUID();
    const agentResult = await callGatewayRPC('agent', {
      message: childTaskMessage,
      sessionKey: childSessionKey,
      deliver: false,
      label: subagentLabel,
      spawnedBy: 'pm-agent-dispatcher',
      idempotencyKey: idempotencyKey
    });
    
    if (!agentResult.ok && !agentResult.runId) {
      // 如果 agent 调用失败，清理 session
      try {
        await callGatewayRPC('sessions.delete', {
          key: childSessionKey,
          emitLifecycleHooks: false
        });
      } catch (cleanupErr) {
        log(`清理失败 session 失败: ${cleanupErr.message}`, 'WARN');
      }
      
      throw new Error(agentResult.error || 'agent RPC failed');
    }
    
    const runId = agentResult.runId || randomUUID();
    log(`Subagent 已启动: runId=${runId}`);
    
    return {
      success: true,
      subagentId: childSessionKey,
      sessionKey: childSessionKey,
      runId: runId,
      label: subagentLabel
    };
    
  } catch (e) {
    log(`创建 subagent 失败: ${e.message}`, 'ERROR');
    return { 
      success: false, 
      error: e.message 
    };
  }
}

/**
 * 更新任务状态
 */
async function updateTaskStatus(projectId, taskId, updates) {
  try {
    const response = await fetch(
      `${config.backendUrl}/api/tasks/projects/${projectId}/tasks/${taskId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      }
    );
    
    if (response.ok) {
      return await response.json();
    }
    throw new Error(`HTTP ${response.status}`);
  } catch (e) {
    log(`更新任务状态失败: ${e.message}`, 'ERROR');
    return null;
  }
}

/**
 * 记录分发到 SUBAGENTS任务分发记录.md
 */
function recordDispatch(task, project, subagentId, prompt) {
  try {
    const recordFile = config.dispatchRecordFile;
    const recordDir = path.dirname(recordFile);
    
    // 确保目录存在
    if (!fs.existsSync(recordDir)) {
      fs.mkdirSync(recordDir, { recursive: true });
    }
    
    // 如果文件不存在，创建表头
    if (!fs.existsSync(recordFile)) {
      const header = `# SUBAGENTS 任务分发记录

此文件记录任务分发给 subagent 的历史。

`;
      fs.writeFileSync(recordFile, header);
    }
    
    // 追加记录
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const entry = `
### ${timestamp} 创建 Subagent (PM-Agent-Dispatcher)

**Subagent ID**: \`${subagentId}\`
**类型**: Dev Agent
**任务**: ${task.id} - ${task.title}
**项目**: ${project.name} (${project.id})
**分配时间**: ${new Date().toISOString()}
**优先级**: ${task.priority || 'P2'}

**任务描述**:
${task.description ? '- ' + task.description.split('\n').join('\n- ') : '- 无详细描述'}

**生成的 Prompt**:
\`\`\`
${prompt.slice(0, 500)}...
\`\`\`

**返回结果**:
- 等待 Subagent 完成中...

**释放时间**: -
**状态**: 🔄 进行中

`;
    
    fs.appendFileSync(recordFile, entry);
    log(`分发记录已写入: ${recordFile}`);
  } catch (e) {
    log(`记录分发失败: ${e.message}`, 'ERROR');
  }
}

// ============================================================
// 主调度循环
// ============================================================

/**
 * 执行一次调度
 */
async function dispatchOnce() {
  log('开始调度检查...');
  
  // 1. 查找需要分配的任务
  const tasksToDispatch = await findTasksToDispatch();
  
  if (tasksToDispatch.length === 0) {
    log('没有需要分配的任务');
    return { dispatched: 0 };
  }
  
  log(`发现 ${tasksToDispatch.length} 个待分配任务`);
  
  // 2. 检查并发限制
  const runningCount = await getRunningSubagentCount();
  log(`当前运行中 subagent: ${runningCount}`);
  
  const availableSlots = config.maxConcurrent - runningCount;
  if (availableSlots <= 0) {
    log('已达到并发上限，跳过分配');
    return { dispatched: 0, reason: 'max_concurrency' };
  }
  
  // 3. 按优先级排序
  const priorityOrder = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
  tasksToDispatch.sort((a, b) => {
    const pa = priorityOrder[a.task.priority] ?? 99;
    const pb = priorityOrder[b.task.priority] ?? 99;
    return pa - pb;
  });
  
  // 4. 分配任务
  const tasksToProcess = tasksToDispatch.slice(0, availableSlots);
  let dispatchedCount = 0;
  
  for (const { task, project } of tasksToProcess) {
    log(`处理任务: ${task.id} [${task.priority || 'P2'}] ${task.title}`);
    
    try {
      // 生成 prompt
      const prompt = generatePrompt(task, project, config.globalConstraints);
      
      // 创建 subagent
      const spawnResult = await spawnSubagent(task, project, prompt);
      
      if (spawnResult.success) {
        const subagentId = spawnResult.subagentId;
        
        // 记录 prompt
        logPrompt(task.id, prompt, subagentId);
        
        // 更新任务状态
        await updateTaskStatus(project.id, task.id, {
          claimedBy: subagentId,
          updatedAt: new Date().toISOString()
        });
        
        // 记录分发
        recordDispatch(task, project, subagentId, prompt);
        
        // 标记为已处理
        processedTasks.add(task.id);
        
        dispatchedCount++;
        log(`✓ 任务 ${task.id} 已分配给 ${subagentId}`);
      } else {
        log(`✗ 任务 ${task.id} 分配失败: ${spawnResult.error}`, 'ERROR');
      }
    } catch (e) {
      log(`处理任务 ${task.id} 异常: ${e.message}`, 'ERROR');
    }
    
    // 间隔 1 秒
    await sleep(1000);
  }
  
  log(`本次调度完成，分配 ${dispatchedCount} 个任务`);
  return { dispatched: dispatchedCount };
}

/**
 * 启动调度循环
 */
async function startDispatcher() {
  if (isRunning) {
    log('调度器已在运行', 'WARN');
    return;
  }
  
  isRunning = true;
  log('启动 PM-Agent-Dispatcher');
  log(`配置: 轮询间隔=${config.pollIntervalMs}ms, 最大并发=${config.maxConcurrent}`);
  
  // 立即执行一次
  await dispatchOnce();
  
  // 启动定时器
  intervalId = setInterval(async () => {
    if (!isRunning) return;
    
    try {
      await dispatchOnce();
    } catch (e) {
      log(`调度异常: ${e.message}`, 'ERROR');
    }
  }, config.pollIntervalMs);
  
  log('调度器已启动');
}

/**
 * 停止调度循环
 */
function stopDispatcher() {
  if (!isRunning) return;
  
  isRunning = false;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  
  log('调度器已停止');
}

// ============================================================
// CLI 入口
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const onceMode = args.includes('--once');
  const configIndex = args.indexOf('--config');
  
  // 加载配置文件
  if (configIndex >= 0 && args[configIndex + 1]) {
    try {
      const configFile = args[configIndex + 1];
      const customConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      config = { ...DEFAULT_CONFIG, ...customConfig };
      log(`已加载配置: ${configFile}`);
    } catch (e) {
      log(`加载配置失败: ${e.message}`, 'ERROR');
    }
  }
  
  // 处理信号
  process.on('SIGINT', () => {
    log('收到 SIGINT，停止调度器');
    stopDispatcher();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    log('收到 SIGTERM，停止调度器');
    stopDispatcher();
    process.exit(0);
  });
  
  if (onceMode) {
    // 单次执行模式
    const result = await dispatchOnce();
    console.log(JSON.stringify(result));
    process.exit(result.dispatched > 0 ? 0 : 1);
  } else {
    // 持续运行模式
    await startDispatcher();
    
    // 保持进程运行
    process.stdin.resume();
  }
}

// 导出模块接口
export {
  startDispatcher,
  stopDispatcher,
  dispatchOnce,
  generatePrompt,
  findTasksToDispatch,
  config
};

// 运行
main().catch(e => {
  log(`启动失败: ${e.message}`, 'ERROR');
  process.exit(1);
});