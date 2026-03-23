#!/usr/bin/env node
/**
 * pm-agent-dispatcher.mjs - Project Manager Agent 任务调度脚本
 *
 * === 模块概述 ===
 *
 * 本脚本是 OpenClaw 的任务调度触发器,负责按周期触发后端统一调度入口。
 * 任务筛选和派发决策统一由后端 execution 服务处理，避免多套规则冲突。
 *
 * === 核心功能 ===
 *
 * 1. 项目发现: 拉取可调度项目列表（API 优先）
 * 2. 调度触发: 调用 /api/execution/projects/:id/dispatch-once
 * 3. 并发控制: 在触发前检查全局并发上限
 * 4. 日志记录: 记录触发结果和后端返回原因，便于审计
 *
 * === 使用场景 ===
 *
 * - 看板系统自动分配任务给 AI 助手
 * - 多项目并行开发,需要统一调度
 * - 任务执行过程可追溯,需要完整的日志记录
 * - 限制并发数量,避免资源耗尽
 *
 * === 核心概念 ===
 *
 * - **任务 (Task)**: 看板中的待办事项,包含 id, title, description, priority, labels
 * - **项目 (Project)**: 任务所属的项目,包含 id, name, description
 * - **Subagent**: 由本调度器创建的子 Agent,负责执行具体任务
 * - **Prompt**: 传递给 subagent 的任务说明,采用 8 段式结构化格式
 * - **Gateway RPC**: OpenClaw 的远程调用接口,用于创建和管理 sessions
 *
 * === 工作流程 ===
 *
 * 1. 启动调度器 (watch 模式)
 * 2. 定期轮询任务 (默认 10 秒)
 * 3. 检查并发限制 (maxConcurrent)
 * 4. 逐项目触发 dispatch-once
 * 5. 后端返回是否派发及原因
 * 6. 记录触发结果
 *
 * === 配置说明 ===
 *
 * - PROJECT_ALLOWLIST: 允许调度的项目 ID 列表 (空 = 所有项目)
 * - POLL_INTERVAL_MS: 轮询间隔,默认 10000ms (10 秒)
 * - MAX_CONCURRENT: 最大并发 subagent 数量,默认 3
 * - BACKEND_URL: 后端 API 地址,默认 http://localhost:3000
 * - TASKS_DIR: 任务数据目录,默认 tasks/
 * - LOGS_DIR: 日志目录,默认 tmp/logs/
 * - PROMPT_LOG_FILE: Prompt 日志文件,默认 tmp/logs/pm-prompts.log
 * - DISPATCH_RECORD_FILE: 分发记录文件,默认 docs/internal/SUBAGENTS任务分发记录.md
 * - PID_FILE: PID 文件,默认 tmp/pm-dispatcher.pid
 *
 * === 全局约束 ===
 *
 * - CODE_STYLE: 代码风格 (TypeScript/Node.js,遵循项目现有代码风格)
 * - COMMIT_STYLE: 提交规范 (conventional commits: feat/fix/docs/...)
 * - TEST_REQUIRED: 是否强制要求测试 (默认 false)
 * - DOC_REQUIRED: 是否强制要求文档 (默认 true)
 * - TIMEOUT_MINUTES: 超时设置,默认 30 分钟
 * - DEFAULT_MODEL: 默认模型,默认 bailian/glm-4.7
 *
 * === 命令行用法 ===
 *
 *   # 常驻模式,每 10 秒轮询一次
 *   node pm-agent-dispatcher.mjs --watch
 *
 *   # 常驻模式,每 30 秒轮询一次
 *   node pm-agent-dispatcher.mjs --watch --interval 30
 *
 *   # 单次执行
 *   node pm-agent-dispatcher.mjs --once
 *
 *   # 使用自定义配置
 *   node pm-agent-dispatcher.mjs --config ./my-config.json
 *
 *   # 指定 PID 文件
 *   node pm-agent-dispatcher.mjs --pidfile /var/run/pm-dispatcher.pid
 *
 * === 主要函数列表 ===
 *
 * 【配置与 CLI】
 * - parseArgs() - 解析命令行参数
 * - printHelp() - 打印帮助信息
 *
 * 【工具函数】
 * - log(message, level) - 日志记录,同时输出到控制台和文件
 * - sleep(ms) - 异步延迟
 * - writePidFile() - 写入 PID 文件
 * - removePidFile() - 删除 PID 文件
 *
 * 【Prompt 生成】
 * - parseStructuredFields(description) - 解析任务描述中的结构化字段 (Pointers, Acceptance, Out-of-scope)
 * - generatePrompt(task, project, constraints) - 生成 8 段式高质量任务 prompt
 * - logPrompt(taskId, prompt, subagentId) - 记录生成的 prompt 到日志文件
 *
 * 【任务管理】
 * - getProjects() - 获取所有项目 (API 优先,回退到文件)
 * - getProjectTasks(projectId) - 获取项目的任务列表 (API 优先,回退到文件)
 * - findTasksToDispatch() - 查找需要分配的任务 (status=in-progress 且 claimedBy/assignee 为空)
 * - getRunningSubagentCount() - 获取运行中的 subagent 数量 (通过 sessions.json)
 *
 * 【Gateway RPC】
 * - callGatewayRPC(method, params) - 调用 OpenClaw Gateway RPC 方法 (使用 openclaw CLI)
 * - spawnSubagent(task, project, prompt) - 通过 Gateway 创建并启动 subagent
 * - updateTaskStatus(projectId, taskId, updates) - 通过后端 API 更新任务状态
 * - recordDispatch(task, project, subagentId, prompt) - 记录分发到 SUBAGENTS任务分发记录.md
 *
 * 【主调度循环】
 * - dispatchOnce() - 执行一次完整的调度流程 (发现 -> 筛选 -> 生成 prompt -> 创建 agent -> 更新状态)
 * - startDispatcher() - 启动调度循环 (watch 模式)
 * - stopDispatcher() - 停止调度循环 (优雅退出)
 *
 * 【主入口】
 * - main() - 主函数,初始化配置并启动调度器
 *
 * === 8 段式 Prompt 模板 ===
 *
 * 1. Goal (目标) - 核心功能目标
 * 2. Context (上下文) - 任务 ID、项目、优先级、标签、执行时间限制
 * 3. Pointers (入口指针) - 相关文件/模块列表
 * 4. Deliverables (交付物) - 具体要交付的东西 (功能、测试、文档)
 * 5. Acceptance (验收标准) - 如何判断任务完成
 * 6. Out-of-scope (范围外) - 明确不做什么
 * 7. Steps (执行步骤) - 6 步工作流 (理解 -> 定位 -> 方案 -> 编码 -> 验证 -> 提交)
 * 8. Commit (提交规范) - conventional commits 格式要求
 *
 * === 日志文件 ===
 *
 * - 调度日志: tmp/logs/pm-dispatcher.log (调度器运行日志)
 * - Prompt 日志: tmp/logs/pm-prompts.log (每个任务的完整 prompt)
 * - 分发记录: docs/internal/SUBAGENTS任务分发记录.md (任务分发历史)
 * - PID 文件: tmp/pm-dispatcher.pid (进程 ID,用于监控和停止)
 *
 * === 并发控制 ===
 *
 * - 最多同时运行 MAX_CONCURRENT 个 subagent (默认 3)
 * - 通过读取 sessions.json 获取运行中的 subagent 数量
 * - 超过上限时跳过分配,等待下次轮询
 * - 任务按优先级排序 (P0 > P1 > P2 > P3)
 *
 * === 优雅退出 ===
 *
 * - 支持 SIGINT (Ctrl+C) 和 SIGTERM 信号
 * - 停止调度循环
 * - 删除 PID 文件
 * - 等待 1 秒后退出
 *
 * === 优化方向 ===
 *
 * 详见 docs/pm-agent-dispatcher-optimization.md
 * - 8 段式 Prompt 模板的设计思路
 * - 如何让 subagent 专注小任务
 * - 减少 tokens 消耗的策略
 * - 避免任务跑偏的方法
 * - 未来改进计划
 *
 * === 相关文档 ===
 *
 * - docs/pm-agent-dispatcher-optimization.md - 优化思路和设计决策
 * - docs/internal/SUBAGENTS任务分发记录.md - 任务分发历史记录
 *
 * === 维护者 ===
 *
 * 本脚本是 OpenClaw 可视化项目的核心组件,维护者需要理解:
 * - OpenClaw Gateway RPC 的工作原理
 * - Prompt 工程和 8 段式模板的设计理念
 * - 任务调度和并发控制的最佳实践
 * - 日志记录和调试技巧
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ============================================================
// 配置
// ============================================================

const DEFAULT_CONFIG = {
  // 允许调度的项目 ID 列表（空 = 所有项目）
  projectAllowlist: [],
  
  // 轮询间隔（毫秒）- 默认 10 秒
  pollIntervalMs: 10000,
  
  // 最大并发 subagent 数量
  maxConcurrent: 3,
  
  // 后端 API 地址
  backendUrl: 'http://localhost:3000',
  
  // 任务数据目录
  tasksDir: path.resolve(PROJECT_ROOT, 'tasks'),
  
  // 日志目录
  logsDir: path.resolve(PROJECT_ROOT, 'tmp/logs'),
  
  // Prompt 日志文件
  promptLogFile: path.resolve(PROJECT_ROOT, 'tmp/logs/pm-prompts.log'),
  
  // 分发记录文件
  dispatchRecordFile: path.resolve(PROJECT_ROOT, 'docs/internal/SUBAGENTS任务分发记录.md'),
  
  // PID 文件
  pidFile: path.resolve(PROJECT_ROOT, 'tmp/pm-dispatcher.pid'),
  
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
let boardAccessTokenCache = null;

// 运行状态
let isRunning = false;
let intervalId = null;
let isShuttingDown = false;

// 调度触发过程中，避免并发重入
let isDispatching = false;

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

function readBoardAccessToken() {
  if (boardAccessTokenCache) {
    return boardAccessTokenCache;
  }

  if (process.env.BOARD_ACCESS_TOKEN && process.env.BOARD_ACCESS_TOKEN.trim()) {
    boardAccessTokenCache = process.env.BOARD_ACCESS_TOKEN.trim();
    return boardAccessTokenCache;
  }

  const envPath = path.join(PROJECT_ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    return '';
  }

  try {
    const raw = fs.readFileSync(envPath, 'utf-8');
    const line = raw.split('\n').find((item) => item.startsWith('BOARD_ACCESS_TOKEN='));
    if (!line) {
      return '';
    }
    const token = line.slice('BOARD_ACCESS_TOKEN='.length).trim();
    boardAccessTokenCache = token;
    return token;
  } catch {
    return '';
  }
}

function createApiHeaders(extraHeaders = {}) {
  const token = readBoardAccessToken();
  if (!token) {
    return extraHeaders;
  }
  return {
    ...extraHeaders,
    'x-access-token': token
  };
}

/**
 * 写入 PID 文件
 */
function writePidFile() {
  try {
    const pidDir = path.dirname(config.pidFile);
    if (!fs.existsSync(pidDir)) {
      fs.mkdirSync(pidDir, { recursive: true });
    }
    fs.writeFileSync(config.pidFile, process.pid.toString());
    log(`PID 文件已写入: ${config.pidFile} (PID: ${process.pid})`);
  } catch (e) {
    log(`写入 PID 文件失败: ${e.message}`, 'WARN');
  }
}

/**
 * 删除 PID 文件
 */
function removePidFile() {
  try {
    if (fs.existsSync(config.pidFile)) {
      fs.unlinkSync(config.pidFile);
      log(`PID 文件已删除: ${config.pidFile}`);
    }
  } catch (e) {
    // 忽略删除错误
  }
}

// ============================================================
// Prompt 生成器
// ============================================================

/**
 * 解析任务描述中的结构化字段
 * 支持的字段：Pointers、Acceptance、Out-of-scope
 */
function parseStructuredFields(description) {
  const fields = {
    pointers: [],
    acceptance: [],
    outOfScope: [],
    rawDescription: description
  };

  if (!description) return fields;

  // 匹配 Pointers: xxx 格式
  const pointersMatch = description.match(/Pointers:\s*([^\n]+)/i);
  if (pointersMatch) {
    fields.pointers = pointersMatch[1]
      .split(/[,;，；]/)
      .map(p => p.trim())
      .filter(p => p);
    fields.rawDescription = fields.rawDescription.replace(pointersMatch[0], '').trim();
  }

  // 匹配 Acceptance: xxx 格式（支持多行）
  const acceptanceMatch = description.match(/Acceptance:\s*([\s\S]*?)(?=\n(?:Out-of-scope|Pointers|$))/i);
  if (acceptanceMatch) {
    fields.acceptance = acceptanceMatch[1]
      .split(/[\n-]/)
      .map(a => a.trim())
      .filter(a => a && !a.startsWith('Acceptance'));
    fields.rawDescription = fields.rawDescription.replace(acceptanceMatch[0], '').trim();
  }

  // 匹配 Out-of-scope: xxx 格式
  const outOfScopeMatch = description.match(/Out-of-scope:\s*([^\n]+)/i);
  if (outOfScopeMatch) {
    fields.outOfScope = outOfScopeMatch[1]
      .split(/[,;，；]/)
      .map(o => o.trim())
      .filter(o => o);
    fields.rawDescription = fields.rawDescription.replace(outOfScopeMatch[0], '').trim();
  }

  return fields;
}

/**
 * 生成高质量的任务 prompt（8 段式最佳实践模板）
 * 模板：Goal / Context / Pointers / Deliverables / Acceptance / Out-of-scope / Steps / Commit
 */
function generatePrompt(task, project, constraints) {
  const { id, title, description, priority, labels } = task;
  const { name: projectName, id: projectId, description: projectDesc } = project;
  
  // 解析结构化字段
  const fields = parseStructuredFields(description);
  
  // 构建标签信息
  const labelInfo = labels?.length ? labels.join(', ') : '无';

  // 构建完整 prompt
  const prompt = `# ${title}

## Goal（目标）
${fields.rawDescription || '实现本任务的核心功能目标。'}

## Context（上下文）
- **任务 ID**: ${id}
- **所属项目**: ${projectName} (${projectId})
- **项目简介**: ${projectDesc || '无'}
- **优先级**: ${priority || 'P2'}
- **标签**: ${labelInfo}
- **执行时间限制**: ${constraints.timeoutMinutes} 分钟

## Pointers（入口指针）
以下文件/模块是本次任务的主要入口：
${fields.pointers.length > 0 
  ? fields.pointers.map(p => `- ${p}`).join('\n')
  : `- 未提供具体入口，请根据任务目标自主查找相关代码`
}

## Deliverables（交付物）
- [ ] 功能实现完整
- [ ] 代码符合项目规范
- [ ] ${constraints.testRequired ? '包含相关测试用例' : '本次任务不强制要求测试'}
- [ ] ${constraints.docRequired ? '更新相关文档' : '本次任务不强制要求文档更新'}

## Acceptance（验收标准）
${fields.acceptance.length > 0
  ? fields.acceptance.map(a => `- ${a}`).join('\n')
  : `- 功能按预期工作
- 无明显 bug
- 代码可以正常运行
- 提交信息符合规范`
}

## Out-of-scope（范围外）
${fields.outOfScope.length > 0
  ? fields.outOfScope.map(o => `- ${o}`).join('\n')
  : `- 不要修改无关的代码
- 不要进行不必要的重构
- 不要引入新的依赖（除非任务明确要求）`
}

## Steps（执行步骤）
1. **理解任务**: 仔细阅读任务目标，明确要做什么
2. **定位代码**: 使用 Pointers 提供的入口，理解现有代码结构
3. **制定方案**: 思考实现方案，考虑边界情况
4. **编写代码**: 按照方案实现功能
5. **自我验证**: 运行代码，验证是否满足验收标准
6. **提交变更**: 完成后提交代码并推送

## Commit（提交规范）
- 使用 conventional commits 格式：\`feat/fix/docs/style/refactor/test/chore: 简短描述\`
- 提交信息简洁明了，说明做了什么
- 示例：\`feat: 实现 XX 功能\` 或 \`fix: 修复 XX bug\`

## Completion Signal（完成信号）
在回复末尾必须输出以下代码块（字段名保持一致）：
\`\`\`completion_signal
task_id: ${id}
status: done | blocked
summary: <一句话总结>
deliverables: <逗号分隔的产物路径或结果>
next_step: <若 blocked，写阻塞点和建议下一步；若 done，写 N/A>
\`\`\`

---
*此 prompt 由 PM-Agent-Dispatcher 自动生成*
*生成时间: ${new Date().toISOString()}*
`;

  return prompt.trim();
}

/**
 * 优先从后端获取结构化执行上下文和推荐 prompt。
 * 如果接口不可用，再回退到本地模板生成。
 */
async function generateExecutionPrompt(task, project, constraints) {
  try {
    const response = await fetch(
      `${config.backendUrl}/api/execution/projects/${project.id}/tasks/${task.id}/context`,
      { headers: createApiHeaders() }
    );

    if (response.ok) {
      const result = await response.json();
      if (result?.prompt) {
        return result.prompt;
      }
    }
  } catch (e) {
    log(`获取执行上下文失败，回退到本地 prompt 模板: ${e.message}`, 'WARN');
  }

  return generatePrompt(task, project, constraints);
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
    const response = await fetch(`${config.backendUrl}/api/tasks/projects`, {
      headers: createApiHeaders()
    });
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
    const response = await fetch(`${config.backendUrl}/api/tasks/projects/${projectId}/tasks`, {
      headers: createApiHeaders()
    });
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
 * 触发后端统一调度入口（单项目单次）
 */
async function triggerProjectDispatch(projectId, forceAutoDispatch = true) {
  try {
    const response = await fetch(
      `${config.backendUrl}/api/execution/projects/${projectId}/dispatch-once`,
      {
        method: 'POST',
        headers: createApiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ forceAutoDispatch })
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return {
        ok: false,
        dispatched: false,
        reason: `HTTP ${response.status}: ${text || 'dispatch-once failed'}`
      };
    }

    const result = await response.json();
    return {
      ok: true,
      dispatched: Boolean(result?.dispatched),
      taskId: result?.taskId || null,
      subagentId: result?.subagentId || null,
      reason: result?.reason || ''
    };
  } catch (e) {
    return {
      ok: false,
      dispatched: false,
      reason: `调用 dispatch-once 异常: ${e.message}`
    };
  }
}

/**
 * 查找需要分配的任务
 * 条件：status=in-progress 且 claimedBy 为空 且 assignee 为空
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
      const hasAssignee = typeof task.assignee === 'string' && task.assignee.trim().length > 0;

      // 筛选条件：status=in-progress 且 claimedBy 为空 且 assignee 为空
      if (task.status === 'in-progress' && !task.claimedBy && !hasAssignee) {
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
        headers: createApiHeaders({ 'Content-Type': 'application/json' }),
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
  if (isDispatching) {
    log('上一次调度仍在执行，跳过本轮');
    return { dispatched: 0, reason: 'in_progress' };
  }

  isDispatching = true;
  log('开始调度检查...');
  try {
    const projects = await getProjects();
    const targetProjects = projects.filter((project) => {
      if (!project?.id) {
        return false;
      }
      return config.projectAllowlist.length === 0 || config.projectAllowlist.includes(project.id);
    });

    if (targetProjects.length === 0) {
      log('没有可调度项目（请检查项目白名单）');
      return { dispatched: 0, projectsChecked: 0 };
    }

    const runningCount = await getRunningSubagentCount();
    const availableSlots = config.maxConcurrent - runningCount;
    log(`当前运行中 subagent: ${runningCount}，可用并发槽位: ${Math.max(availableSlots, 0)}`);
    if (availableSlots <= 0) {
      log('已达到并发上限，跳过本轮触发');
      return { dispatched: 0, projectsChecked: targetProjects.length, reason: 'max_concurrency' };
    }

    let dispatchedCount = 0;
    let checkedCount = 0;

    for (const project of targetProjects) {
      if (dispatchedCount >= availableSlots) {
        break;
      }

      checkedCount++;
      const result = await triggerProjectDispatch(project.id, true);
      if (result.ok && result.dispatched) {
        dispatchedCount++;
        log(`✓ 项目 ${project.id} 触发成功: task=${result.taskId || '-'} subagent=${result.subagentId || '-'} (${result.reason || 'dispatched'})`);
      } else {
        log(`- 项目 ${project.id} 未派发: ${result.reason || 'no-op'}`);
      }

      await sleep(200);
    }

    log(`本次调度完成，检查项目 ${checkedCount} 个，触发派发 ${dispatchedCount} 个`);
    return { dispatched: dispatchedCount, projectsChecked: checkedCount };
  } finally {
    isDispatching = false;
  }
}

/**
 * 启动调度循环（watch 模式）
 */
async function startDispatcher() {
  if (isRunning) {
    log('调度器已在运行', 'WARN');
    return;
  }
  
  isRunning = true;
  
  // 写入 PID 文件
  writePidFile();
  
  log('启动 PM-Agent-Dispatcher (watch 模式)');
  log(`配置: 轮询间隔=${config.pollIntervalMs}ms (${config.pollIntervalMs/1000}s), 最大并发=${config.maxConcurrent}`);
  log(`PID: ${process.pid}`);
  log(`日志: ${config.logsDir}/pm-dispatcher.log`);
  if (!readBoardAccessToken()) {
    log('未检测到 BOARD_ACCESS_TOKEN，后端 API 可能返回 401（将回退为文件读取）。', 'WARN');
  }
  
  // 立即执行一次
  await dispatchOnce();
  
  // 启动定时器
  intervalId = setInterval(async () => {
    if (!isRunning || isShuttingDown) return;
    
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
  
  log('正在停止调度器...');
  isRunning = false;
  isShuttingDown = true;
  
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  
  // 删除 PID 文件
  removePidFile();
  
  log('调度器已停止');
}

// ============================================================
// CLI 入口
// ============================================================

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    watchMode: false,
    onceMode: false,
    interval: null,
    configFile: null,
    pidFile: null
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--watch':
      case '-w':
        result.watchMode = true;
        break;
        
      case '--once':
      case '-o':
        result.onceMode = true;
        break;
        
      case '--interval':
      case '-i':
        const intervalValue = args[++i];
        if (intervalValue) {
          const seconds = parseInt(intervalValue, 10);
          if (seconds >= 1 && seconds <= 3600) {
            result.interval = seconds * 1000; // 转换为毫秒
          } else {
            console.error(`错误: --interval 必须在 1-3600 秒之间，当前: ${intervalValue}`);
            process.exit(1);
          }
        } else {
          console.error('错误: --interval 需要一个数值参数');
          process.exit(1);
        }
        break;
        
      case '--config':
      case '-c':
        result.configFile = args[++i];
        if (!result.configFile) {
          console.error('错误: --config 需要一个文件路径参数');
          process.exit(1);
        }
        break;
        
      case '--pidfile':
      case '-p':
        result.pidFile = args[++i];
        if (!result.pidFile) {
          console.error('错误: --pidfile 需要一个文件路径参数');
          process.exit(1);
        }
        break;
        
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
        
      default:
        console.error(`错误: 未知参数 ${arg}`);
        printHelp();
        process.exit(1);
    }
  }
  
  // 如果没有指定任何模式，默认为 watch 模式
  if (!result.watchMode && !result.onceMode) {
    result.watchMode = true;
  }
  
  return result;
}

/**
 * 打印帮助信息
 */
function printHelp() {
  console.log(`
PM-Agent-Dispatcher - 任务调度器

用法:
  node pm-agent-dispatcher.mjs [选项]

选项:
  --watch, -w          以常驻模式运行（默认）
  --once, -o           执行一次调度后退出
  --interval, -i <秒>  轮询间隔，默认 10 秒（范围: 1-3600）
  --config, -c <文件>  使用指定配置文件
  --pidfile, -p <文件> 指定 PID 文件路径
  --help, -h           显示帮助信息

示例:
  # 常驻模式，每 10 秒轮询一次
  node pm-agent-dispatcher.mjs --watch
  
  # 常驻模式，每 30 秒轮询一次
  node pm-agent-dispatcher.mjs --watch --interval 30
  
  # 单次执行
  node pm-agent-dispatcher.mjs --once
  
  # 使用自定义配置
  node pm-agent-dispatcher.mjs --config ./my-config.json

日志:
  调度日志: tmp/logs/pm-dispatcher.log
  PID 文件: tmp/pm-dispatcher.pid
`);
}

async function main() {
  const cliOptions = parseArgs();
  
  // 加载配置文件
  if (cliOptions.configFile) {
    try {
      const configFile = path.resolve(cliOptions.configFile);
      const customConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      config = { ...DEFAULT_CONFIG, ...customConfig };
      log(`已加载配置: ${configFile}`);
    } catch (e) {
      log(`加载配置失败: ${e.message}`, 'ERROR');
    }
  }
  
  // 应用命令行参数
  if (cliOptions.interval !== null) {
    config.pollIntervalMs = cliOptions.interval;
  }
  
  if (cliOptions.pidFile) {
    config.pidFile = path.resolve(cliOptions.pidFile);
  }
  
  // 注册信号处理（优雅退出）
  const gracefulShutdown = (signal) => {
    if (isShuttingDown) return; // 防止重复处理
    
    log(`收到 ${signal}，正在优雅退出...`);
    stopDispatcher();
    
    // 给一些时间让资源清理
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  };
  
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  
  if (cliOptions.onceMode) {
    // 单次执行模式
    log('单次执行模式');
    const result = await dispatchOnce();
    console.log(JSON.stringify(result));
    process.exit(result.dispatched > 0 ? 0 : 0); // 总是返回 0，避免被误认为失败
  } else {
    // 常驻运行模式 (watch 模式)
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
