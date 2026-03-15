import * as fs from 'fs';
import * as path from 'path';

function isWorkspaceRoot(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'src/backend/package.json'))
    && fs.existsSync(path.join(dir, 'src/frontend/package.json'))
    && fs.existsSync(path.join(dir, 'tasks'));
}

export function getWorkspaceRoot(startDir: string = process.cwd()): string {
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
  return path.join(getWorkspaceRoot(), 'tasks');
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
  if (projectId === 'openclaw-visualization') {
    return process.env.OPENCLAW_VISUALIZATION_ROOT || getWorkspaceRoot();
  }

  if (projectId === 'pm-workflow-automation') {
    return process.env.PM_WORKFLOW_AUTOMATION_ROOT
      || findSiblingProjectDir('pm-workflow-automation')
      || path.join(getProjectsParentDir(), 'pm-workflow-automation');
  }

  return process.env[`PROJECT_ROOT_${projectId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`]
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
