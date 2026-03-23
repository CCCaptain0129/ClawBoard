import * as fs from 'fs';
import * as path from 'path';

function readEnvFileValue(key: string, envPath: string): string | null {
  if (!fs.existsSync(envPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    const line = content
      .split(/\r?\n/)
      .find((item) => item.startsWith(`${key}=`));
    if (!line) {
      return null;
    }
    const raw = line.slice(key.length + 1).trim();
    return raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

function isWorkspaceRoot(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'src/backend/package.json'))
    && fs.existsSync(path.join(dir, 'src/frontend/package.json'))
    && fs.existsSync(path.join(dir, 'tasks'));
}

function getWorkspaceRootFromEnv(): string | null {
  const raw = process.env.OPENCLAW_VIS_WORKSPACE_ROOT || process.env.WORKSPACE_ROOT;
  if (!raw) {
    return null;
  }
  const resolved = path.resolve(raw.trim());
  return isWorkspaceRoot(resolved) ? resolved : null;
}

export function getWorkspaceRoot(startDir: string = process.cwd()): string {
  const envRoot = getWorkspaceRootFromEnv();
  if (envRoot) {
    return envRoot;
  }

  let current = path.resolve(startDir);

  while (true) {
    if (isWorkspaceRoot(current)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startDir, '../..');
    }
    current = parent;
  }
}

export function getTasksRoot(): string {
  const workspaceRoot = getWorkspaceRoot();
  const raw = process.env.OPENCLAW_VIS_TASKS_ROOT
    || readEnvFileValue('OPENCLAW_VIS_TASKS_ROOT', path.join(workspaceRoot, '.env'));
  if (!raw || !raw.trim()) {
    return path.join(workspaceRoot, 'tasks');
  }

  const trimmed = raw.trim();
  return path.isAbsolute(trimmed)
    ? path.resolve(trimmed)
    : path.resolve(workspaceRoot, trimmed);
}

export function getProjectExecutionConfigPath(): string {
  return process.env.PROJECT_EXECUTION_CONFIG_PATH
    || path.join(getTasksRoot(), 'project-execution-config.json');
}

function getProjectsParentDir(): string {
  return path.dirname(getWorkspaceRoot());
}

function findSiblingProjectDir(projectSuffix: string): string | null {
  const parentDir = getProjectsParentDir();

  try {
    const entries = fs.readdirSync(parentDir, { withFileTypes: true });
    const match = entries.find((entry) => entry.isDirectory() && entry.name.endsWith(projectSuffix));
    return match ? path.join(parentDir, match.name) : null;
  } catch {
    return null;
  }
}

export function getProjectRoot(projectId: string): string {
  const workspaceRoot = getWorkspaceRoot();
  const workspaceProjectId = path.basename(workspaceRoot);

  if (projectId === workspaceProjectId) {
    return process.env[`PROJECT_ROOT_${projectId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`]
      || workspaceRoot;
  }

  return process.env[`PROJECT_ROOT_${projectId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`]
    || findSiblingProjectDir(projectId)
    || path.join(getProjectsParentDir(), projectId);
}

export function getSubagentRecordingPath(): string {
  return process.env.SUBAGENT_RECORDING_PATH
    || path.join(getWorkspaceRoot(), 'docs/internal/SUBAGENTS任务分发记录.md');
}

export function getOpenClawSessionsPath(): string {
  return process.env.OPENCLAW_SESSIONS_PATH
    || path.join(process.env.HOME || '', '.openclaw/agents/main/sessions/sessions.json');
}
