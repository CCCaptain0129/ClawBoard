import * as fs from 'fs';
import * as path from 'path';
import { getProjectRoot } from '../config/paths';
import { ProjectConfigService } from '../execution/projectConfigService';
import { Task } from '../types/tasks';

const MAX_SUMMARY_LENGTH = 240;
const MAX_FACTS = 6;
const MAX_HARD_CONSTRAINTS = 8;

export interface ProjectMemorySnapshot {
  projectId: string;
  planningSummary: string;
  hardConstraints: string[];
  relevantFacts: string[];
  relevantDocs: string[];
}

export class ProjectMemoryService {
  constructor(private projectConfigService: ProjectConfigService = new ProjectConfigService()) {}

  getProjectMemory(projectId: string, task?: Task): ProjectMemorySnapshot {
    const config = this.projectConfigService.getConfigByProjectId(projectId);
    const projectRoot = getProjectRoot(projectId);
    const relevantDocs: string[] = [];

    let planningSummary = '';
    let hardConstraints: string[] = [];
    if (config?.planningDoc) {
      const planningPath = path.join(projectRoot, config.planningDoc);
      const planningData = this.readPlanningData(planningPath);
      planningSummary = planningData.summary;
      hardConstraints = planningData.hardConstraints;
      if (planningSummary || hardConstraints.length > 0) {
        relevantDocs.push(config.planningDoc);
      }
    }

    if (config?.taskDoc) {
      const taskDocPath = path.join(projectRoot, config.taskDoc);
      if (fs.existsSync(taskDocPath)) {
        relevantDocs.push(config.taskDoc);
      }
    }

    const relevantFacts = this.buildRelevantFacts(task, planningSummary);

    return {
      projectId,
      planningSummary,
      hardConstraints,
      relevantFacts,
      relevantDocs,
    };
  }

  private readPlanningData(filePath: string): { summary: string; hardConstraints: string[] } {
    if (!fs.existsSync(filePath)) {
      return { summary: '', hardConstraints: [] };
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const sections = this.parseSections(content);
      const summary = this.buildSummary(sections);
      const hardConstraints = this.buildHardConstraints(sections);

      return {
        summary,
        hardConstraints,
      };
    } catch (error) {
      console.error(`[ProjectMemoryService] Failed to read planning doc ${filePath}:`, error);
      return { summary: '', hardConstraints: [] };
    }
  }

  private buildRelevantFacts(task: Task | undefined, planningSummary: string): string[] {
    const facts: string[] = [];

    if (task?.contextSummary) {
      facts.push(task.contextSummary);
    }

    if (task?.description && task.description !== task.title) {
      facts.push(task.description);
    }

    if (task?.dependencies && task.dependencies.length > 0) {
      facts.push(`依赖任务: ${task.dependencies.join(', ')}`);
    }

    if (task?.deliverables && task.deliverables.length > 0) {
      facts.push(`预期交付: ${task.deliverables.join(', ')}`);
    }

    if (task?.blockingReason) {
      facts.push(`当前阻塞: ${task.blockingReason}`);
    }

    if (planningSummary) {
      facts.push(`项目背景摘要: ${planningSummary.slice(0, 220).trim()}`);
    }

    return facts
      .map((fact) => fact.trim())
      .filter((fact, index, array) => fact.length > 0 && array.indexOf(fact) === index)
      .slice(0, MAX_FACTS);
  }

  private parseSections(content: string): Map<string, string[]> {
    const sections = new Map<string, string[]>();
    let currentHeading = '';

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      const headingMatch = line.match(/^##\s+(.+)$/);
      if (headingMatch) {
        currentHeading = headingMatch[1].trim();
        if (!sections.has(currentHeading)) {
          sections.set(currentHeading, []);
        }
        continue;
      }

      if (line.startsWith('#') || line.startsWith('```')) {
        continue;
      }

      if (!sections.has(currentHeading)) {
        sections.set(currentHeading, []);
      }

      sections.get(currentHeading)?.push(line.replace(/^-+\s*/, '').trim());
    }

    return sections;
  }

  private buildSummary(sections: Map<string, string[]>): string {
    const summarySource = [
      ...(sections.get('项目目标') || []),
      ...(sections.get('当前重点') || []),
    ]
      .filter(Boolean)
      .join(' ');

    return summarySource.slice(0, MAX_SUMMARY_LENGTH).trim();
  }

  private buildHardConstraints(sections: Map<string, string[]>): string[] {
    const constraints = [
      ...(sections.get('技术栈') || []).map((line) => `技术栈: ${line}`),
      ...(sections.get('关键接口') || []).map((line) => `接口: ${line}`),
      ...(sections.get('关键路径') || []).map((line) => `路径: ${line}`),
      ...(sections.get('关键约束') || []),
      ...(sections.get('验收原则') || []),
    ]
      .map((line) => line.trim())
      .filter((line, index, array) => line.length > 0 && array.indexOf(line) === index);

    return constraints.slice(0, MAX_HARD_CONSTRAINTS);
  }
}
