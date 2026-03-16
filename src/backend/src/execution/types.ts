export type ExecutionMode = 'manual' | 'semi-auto' | 'auto';

export type AgentType = 'general' | 'dev' | 'test' | 'debug';

export interface ProjectExecutionConfig {
  projectId: string;
  leadAgent: string | null;
  autoDispatchEnabled: boolean;
  executionMode: ExecutionMode;
  maxConcurrentSubagents: number;
  planningDoc?: string;
  taskDoc?: string;
  progressDoc?: string;
}

export interface ProjectExecutionConfigFile {
  projects: ProjectExecutionConfig[];
}

export interface TaskExecutionPacket {
  projectId: string;
  taskId: string;
  taskTitle: string;
  taskGoal: string;
  projectSummary: string;
  hardConstraints: string[];
  taskContextSummary: string;
  sourceOfTruthDocs: string[];
  sourceOfTruthFiles: string[];
  fallbackInstructions: string[];
  constraints: string[];
  acceptanceCriteria: string[];
  expectedDeliverables: string[];
  outputLocation: string | null;
  handoffNotes: string | null;
}

export interface TaskSelectionResult {
  taskId: string | null;
  reason: string;
}
