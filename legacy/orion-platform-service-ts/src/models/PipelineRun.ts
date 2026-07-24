/**
 * PipelineRun 数据模型
 */

import { v4 as uuidv4 } from 'uuid';

export enum PipelineRunStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum TriggerType {
  MANUAL = 'manual',
  API = 'api',
  EVENT = 'event',
  SCHEDULE = 'schedule',
}

export interface PipelineRunContext {
  git?: {
    ref?: string;
    sha?: string;
    repo?: string;
  };
  event?: {
    type?: string;
    payload?: Record<string, unknown>;
  };
  [key: string]: unknown;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  pipelineVersion: string;
  triggerType: TriggerType;
  triggerBy?: string;
  status: PipelineRunStatus;
  /** Target deployment environment name (e.g., 'development', 'staging', 'production') */
  environment?: string;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  context: PipelineRunContext;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineRunCreateInput {
  pipelineId: string;
  pipelineVersion: string;
  triggerType: TriggerType;
  triggerBy?: string;
  /** Target deployment environment name */
  environment?: string;
  context?: PipelineRunContext;
}

export interface PipelineRunFilter {
  pipelineId?: string;
  status?: PipelineRunStatus | PipelineRunStatus[];
  triggerType?: TriggerType;
  limit?: number;
  offset?: number;
}

export function createPipelineRun(input: PipelineRunCreateInput): PipelineRun {
  const now = new Date();
  return {
    id: uuidv4(),
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
    startedAt: new Date(),
    updatedAt: new Date(),
  };
}

export function completePipelineRun(run: PipelineRun, status: PipelineRunStatus.SUCCESS | PipelineRunStatus.FAILED): PipelineRun {
  const now = new Date();
  const startedAt = run.startedAt || run.createdAt;
  return {
    ...run,
    status,
    completedAt: now,
    durationMs: now.getTime() - startedAt.getTime(),
    updatedAt: now,
  };
}

export function cancelPipelineRun(run: PipelineRun): PipelineRun {
  const now = new Date();
  return {
    ...run,
    status: PipelineRunStatus.CANCELLED,
    completedAt: now,
    durationMs: run.startedAt ? now.getTime() - run.startedAt.getTime() : 0,
    updatedAt: now,
  };
}
