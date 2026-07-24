/**
 * RunnerJob 数据模型 — 构建资源池 (GAP-CN-07)
 *
 * 追踪分配给 Runner 的任务执行情况。
 */

import { v4 as uuidv4 } from 'uuid';

export type RunnerJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface RunnerJob {
  id: string;
  runnerId: string;
  taskId: string;
  stageId?: string;
  runId?: string;
  tenantId: string;
  status: RunnerJobStatus;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface RunnerJobCreateInput {
  runnerId: string;
  taskId: string;
  stageId?: string;
  runId?: string;
  tenantId: string;
}

export function createRunnerJob(input: RunnerJobCreateInput): RunnerJob {
  const now = new Date();
  return {
    id: uuidv4(),
    runnerId: input.runnerId,
    taskId: input.taskId,
    stageId: input.stageId,
    runId: input.runId,
    tenantId: input.tenantId,
    status: 'pending',
    createdAt: now,
  };
}

export function startRunnerJob(job: RunnerJob): RunnerJob {
  return {
    ...job,
    status: 'running',
    startedAt: new Date(),
  };
}

export function completeRunnerJob(job: RunnerJob, result?: Record<string, unknown>): RunnerJob {
  return {
    ...job,
    status: 'completed',
    result,
    completedAt: new Date(),
  };
}

export function failRunnerJob(job: RunnerJob, error: string): RunnerJob {
  return {
    ...job,
    status: 'failed',
    error,
    completedAt: new Date(),
  };
}
