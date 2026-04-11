/**
 * Task 数据模型
 */

import { v4 as uuidv4 } from 'uuid';

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export interface TaskResourceQuota {
  cpu?: string;
  memory?: string;
  timeout?: number;
}

export interface Task {
  id: string;
  stageId: string;
  name: string;
  type: string; // e.g., 'git/checkout', 'npm/run'
  sequence: number;
  status: TaskStatus;
  config: Record<string, unknown>;
  parameters: Record<string, unknown>;
  resourceQuota?: TaskResourceQuota;
  retryCount: number;
  maxRetries: number;
  timeoutSeconds: number;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  result?: Record<string, unknown>;
  log?: string;
  error?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface TaskCreateInput {
  stageId: string;
  name: string;
  type: string;
  sequence: number;
  config?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  resourceQuota?: TaskResourceQuota;
  maxRetries?: number;
  timeoutSeconds?: number;
}

export function createTask(input: TaskCreateInput): Task {
  const now = new Date();
  return {
    id: uuidv4(),
    stageId: input.stageId,
    name: input.name,
    type: input.type,
    sequence: input.sequence,
    status: TaskStatus.PENDING,
    config: input.config || {},
    parameters: input.parameters || {},
    resourceQuota: input.resourceQuota,
    retryCount: 0,
    maxRetries: input.maxRetries || 0,
    timeoutSeconds: input.timeoutSeconds || 600,
    createdAt: now,
  };
}

export function startTask(task: Task): Task {
  return {
    ...task,
    status: TaskStatus.RUNNING,
    startedAt: new Date(),
    updatedAt: new Date(),
  };
}

export function completeTask(task: Task, result?: Record<string, unknown>): Task {
  const now = new Date();
  const startedAt = task.startedAt || task.createdAt;
  return {
    ...task,
    status: TaskStatus.SUCCESS,
    completedAt: now,
    durationMs: now.getTime() - startedAt.getTime(),
    result,
    updatedAt: now,
  };
}

export function failTask(task: Task, error: string, log?: string): Task {
  const now = new Date();
  const startedAt = task.startedAt || task.createdAt;
  return {
    ...task,
    status: TaskStatus.FAILED,
    completedAt: now,
    durationMs: now.getTime() - startedAt.getTime(),
    error,
    log: log || task.log,
    updatedAt: now,
  };
}

export function appendTaskLog(task: Task, logLine: string): Task {
  return {
    ...task,
    log: task.log ? `${task.log}\n${logLine}` : logLine,
    updatedAt: new Date(),
  };
}

export function canRetryTask(task: Task): boolean {
  return task.status === TaskStatus.FAILED && task.retryCount < task.maxRetries;
}

export function incrementTaskRetry(task: Task): Task {
  return {
    ...task,
    retryCount: task.retryCount + 1,
    status: TaskStatus.PENDING,
    startedAt: undefined,
    completedAt: undefined,
    durationMs: undefined,
    error: undefined,
    updatedAt: new Date(),
  };
}
