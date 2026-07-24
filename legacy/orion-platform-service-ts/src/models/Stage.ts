/**
 * Stage 数据模型
 */

import { v4 as uuidv4 } from 'uuid';

export enum StageStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export interface Stage {
  id: string;
  runId: string;
  name: string;
  sequence: number;
  status: StageStatus;
  dependsOn: string[]; // Stage names
  condition?: string; // if expression
  timeoutSeconds: number;
  retryCount: number;
  maxRetries: number;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  result?: Record<string, unknown>;
  error?: string;
  /**
   * Multi-target execution configuration (carried from PipelineStage YAML).
   * undefined = single-target stage (default behavior).
   */
  targets?: string[];
  executionMode?: 'oneshot' | 'grayScale';
  batchSize?: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface StageCreateInput {
  runId: string;
  name: string;
  sequence: number;
  dependsOn?: string[];
  condition?: string;
  timeoutSeconds?: number;
  maxRetries?: number;
}

export interface StageTask {
  name: string;
  uses: string;
  with?: Record<string, unknown>;
}

export function createStage(input: StageCreateInput): Stage {
  const now = new Date();
  return {
    id: uuidv4(),
    runId: input.runId,
    name: input.name,
    sequence: input.sequence,
    status: StageStatus.PENDING,
    dependsOn: input.dependsOn || [],
    condition: input.condition,
    timeoutSeconds: input.timeoutSeconds || 3600,
    retryCount: 0,
    maxRetries: input.maxRetries || 0,
    createdAt: now,
  };
}

export function startStage(stage: Stage): Stage {
  return {
    ...stage,
    status: StageStatus.RUNNING,
    startedAt: new Date(),
    updatedAt: new Date(),
  };
}

export function completeStage(stage: Stage, result?: Record<string, unknown>): Stage {
  const now = new Date();
  const startedAt = stage.startedAt || stage.createdAt;
  return {
    ...stage,
    status: StageStatus.SUCCESS,
    completedAt: now,
    durationMs: now.getTime() - startedAt.getTime(),
    result,
    updatedAt: now,
  };
}

export function failStage(stage: Stage, error: string): Stage {
  const now = new Date();
  const startedAt = stage.startedAt || stage.createdAt;
  return {
    ...stage,
    status: StageStatus.FAILED,
    completedAt: now,
    durationMs: now.getTime() - startedAt.getTime(),
    error,
    updatedAt: now,
  };
}

export function skipStage(stage: Stage): Stage {
  return {
    ...stage,
    status: StageStatus.SKIPPED,
    completedAt: new Date(),
    updatedAt: new Date(),
  };
}

export function canRetryStage(stage: Stage): boolean {
  return stage.status === StageStatus.FAILED && stage.retryCount < stage.maxRetries;
}

export function incrementStageRetry(stage: Stage): Stage {
  return {
    ...stage,
    retryCount: stage.retryCount + 1,
    status: StageStatus.PENDING,
    startedAt: undefined,
    completedAt: undefined,
    durationMs: undefined,
    error: undefined,
    updatedAt: new Date(),
  };
}
