import * as fs from 'fs';
import { getProjectExecutionConfigPath } from '../config/paths';
import { Project } from '../types/tasks';
import {
  ExecutionMode,
  ProjectExecutionConfig,
  ProjectExecutionConfigFile,
} from './types';

// Legacy compatibility default: keep a value for config shape, but this field no longer gates auto dispatch.
const DEFAULT_EXECUTION_MODE: ExecutionMode = 'auto';
const DEFAULT_MAX_CONCURRENT_SUBAGENTS = 3;

export class ProjectConfigService {
  private configPath: string;

  constructor(configPath: string = getProjectExecutionConfigPath()) {
    this.configPath = configPath;
  }

  getConfigPath(): string {
    return this.configPath;
  }

  getAllConfigs(): ProjectExecutionConfig[] {
    return this.loadConfigFile().projects;
  }

  getConfigByProjectId(projectId: string): ProjectExecutionConfig | null {
    return this.getAllConfigs().find((config) => config.projectId === projectId) || null;
  }

  getEffectiveConfig(project: Project): ProjectExecutionConfig {
    const config = this.getConfigByProjectId(project.id);

    return {
      projectId: project.id,
      leadAgent: config?.leadAgent ?? project.leadAgent ?? null,
      autoDispatchEnabled: config?.autoDispatchEnabled ?? false,
      executionMode: config?.executionMode ?? DEFAULT_EXECUTION_MODE,
      maxConcurrentSubagents: config?.maxConcurrentSubagents ?? DEFAULT_MAX_CONCURRENT_SUBAGENTS,
      planningDoc: config?.planningDoc,
      taskDoc: config?.taskDoc,
      progressDoc: config?.progressDoc,
    };
  }

  private loadConfigFile(): ProjectExecutionConfigFile {
    if (!fs.existsSync(this.configPath)) {
      return { projects: [] };
    }

    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ProjectExecutionConfigFile>;
      const projects = Array.isArray(parsed.projects) ? parsed.projects : [];

      return {
        projects: projects
          .filter((project) => typeof project?.projectId === 'string' && project.projectId.trim().length > 0)
          .map((project) => this.normalizeConfig(project as Partial<ProjectExecutionConfig> & { projectId: string })),
      };
    } catch (error) {
      console.error(
        `[ProjectConfigService] Failed to load execution config from ${this.configPath}:`,
        error
      );
      return { projects: [] };
    }
  }

  private normalizeConfig(project: Partial<ProjectExecutionConfig> & { projectId: string }): ProjectExecutionConfig {
    return {
      projectId: project.projectId,
      leadAgent: project.leadAgent ?? null,
      autoDispatchEnabled: project.autoDispatchEnabled ?? false,
      executionMode: this.normalizeExecutionMode(project.executionMode),
      maxConcurrentSubagents:
        typeof project.maxConcurrentSubagents === 'number' && project.maxConcurrentSubagents > 0
          ? project.maxConcurrentSubagents
          : DEFAULT_MAX_CONCURRENT_SUBAGENTS,
      planningDoc: this.normalizeOptionalString(project.planningDoc),
      taskDoc: this.normalizeOptionalString(project.taskDoc),
      progressDoc: this.normalizeOptionalString(project.progressDoc),
    };
  }

  private normalizeExecutionMode(mode: ProjectExecutionConfig['executionMode'] | undefined): ExecutionMode {
    if (mode === 'manual' || mode === 'semi-auto' || mode === 'auto') {
      return mode;
    }

    return DEFAULT_EXECUTION_MODE;
  }

  private normalizeOptionalString(value: string | undefined): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
}
