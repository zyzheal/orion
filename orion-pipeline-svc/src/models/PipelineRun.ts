/**
 * PipelineRun domain models
 */

export enum TriggerType {
  MANUAL = 'manual',
  SCHEDULE = 'schedule',
  WEBHOOK = 'webhook',
  EVENT = 'event',
  API = 'api',
}

export enum PipelineRunStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

export enum StageStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  pipelineVersion: string;
  triggerType: TriggerType;
  triggerBy?: string;
  environment?: string;
  status: PipelineRunStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  context: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineRunCreateInput {
  pipelineId: string;
  pipelineVersion: string;
  triggerType: TriggerType;
  triggerBy?: string;
  environment?: string;
  context?: Record<string, unknown>;
}

export interface PipelineRunFilter {
  pipelineId?: string;
  status?: PipelineRunStatus | PipelineRunStatus[];
  triggerType?: TriggerType;
  limit?: number;
  offset?: number;
}

export interface Stage {
  id: string;
  runId: string;
  name: string;
  sequence: number;
  status: StageStatus;
  dependsOn: string[];
  timeoutSeconds: number;
  retryCount: number;
  maxRetries: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  stageId: string;
  name: string;
  type: string;
  sequence: number;
  status: TaskStatus;
  config: Record<string, unknown>;
  parameters: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  timeoutSeconds: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  result?: Record<string, unknown>;
  error?: string;
  log?: string;
  createdAt: string;
}

/**
 * Create a new PipelineRun record (in-memory fallback)
 */
export function createPipelineRun(input: PipelineRunCreateInput): PipelineRun {
  const now = new Date().toISOString();
  return {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    pipelineId: input.pipelineId,
    pipelineVersion: input.pipelineVersion,
    triggerType: input.triggerType,
    triggerBy: input.triggerBy,
    environment: input.environment,
    status: PipelineRunStatus.PENDING,
    context: input.context || {},
    createdAt: now,
    updatedAt: now,
  };
}

export function startPipelineRun(run: PipelineRun): PipelineRun {
  return {
    ...run,
    status: PipelineRunStatus.RUNNING,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function completePipelineRun(run: PipelineRun, status: PipelineRunStatus.SUCCESS | PipelineRunStatus.FAILED): PipelineRun {
  const completedAt = new Date();
  const startedAt = run.startedAt ? new Date(run.startedAt) : new Date();
  return {
    ...run,
    status,
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    updatedAt: completedAt.toISOString(),
  };
}

export function cancelPipelineRun(run: PipelineRun): PipelineRun {
  return {
    ...run,
    status: PipelineRunStatus.CANCELLED,
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
