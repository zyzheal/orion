/**
 * Saga 分布式事务 - 类型定义
 *
 * 定义 Saga 模式所需的核心类型
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Saga 步骤状态
 */
export enum SagaStepStatus {
  PENDING = 'pending',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  COMPENSATING = 'compensating',
  COMPENSATED = 'compensated',
  FAILED = 'failed',
  COMPENSATION_FAILED = 'compensation_failed',
}

/**
 * Saga 事务状态
 */
export enum SagaStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  COMPENSATING = 'compensating',
  COMPENSATED = 'compensated',
  FAILED = 'failed',
}

/**
 * Saga 步骤定义
 */
export interface SagaStep<TInput = unknown, TOutput = unknown> {
  /** 步骤名称 */
  name: string;
  /** 步骤顺序 */
  sequence: number;
  /** 执行函数 */
  execute: (input: TInput, context: SagaContext) => Promise<TOutput>;
  /** 补偿函数 */
  compensate: (input: TInput, output: TOutput, context: SagaContext) => Promise<void>;
  /** 重试配置 */
  retryConfig?: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    multiplier: number;
  };
  /** 超时时间（毫秒） */
  timeoutMs?: number;
}

/**
 * Saga 步骤执行记录
 */
export interface SagaStepExecution<TOutput = unknown> {
  /** 步骤名称 */
  stepName: string;
  /** 步骤顺序 */
  sequence: number;
  /** 执行状态 */
  status: SagaStepStatus;
  /** 执行输出 */
  output?: TOutput;
  /** 错误信息 */
  error?: string;
  /** 开始时间 */
  startedAt?: Date;
  /** 完成时间 */
  completedAt?: Date;
  /** 重试次数 */
  retryCount: number;
  /** 补偿开始时间 */
  compensationStartedAt?: Date;
  /** 补偿完成时间 */
  compensationCompletedAt?: Date;
}

/**
 * Saga 上下文
 */
export interface SagaContext {
  /** 事务 ID */
  transactionId: string;
  /** 请求 ID（幂等性标识） */
  requestId: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
  /** 元数据 */
  metadata: Record<string, unknown>;
  /** 步骤执行记录 */
  stepExecutions: SagaStepExecution[];
  /** 当前步骤索引 */
  currentStepIndex: number;
}

/**
 * Saga 定义
 */
export interface SagaDefinition<TInput = unknown, TOutput = unknown> {
  /** Saga 名称 */
  name: string;
  /** 步骤列表 */
  steps: SagaStep<TInput, unknown>[];
  /** 最终处理器（所有步骤完成后调用） */
  finalize?: (input: TInput, context: SagaContext) => Promise<TOutput>;
}

/**
 * Saga 事务选项
 */
export interface SagaOptions {
  /** 请求 ID（用于幂等性检查） */
  requestId?: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
  /** 是否启用自动恢复 */
  enableRecovery?: boolean;
  /** 事务超时时间（毫秒） */
  timeoutMs?: number;
}

/**
 * 创建 Saga 上下文
 */
export function createSagaContext(requestId?: string, metadata?: Record<string, unknown>): SagaContext {
  const now = new Date();
  return {
    transactionId: uuidv4(),
    requestId: requestId || uuidv4(),
    createdAt: now,
    updatedAt: now,
    metadata: metadata || {},
    stepExecutions: [],
    currentStepIndex: -1,
  };
}

/**
 * 创建步骤执行记录
 */
export function createStepExecution(stepName: string, sequence: number): SagaStepExecution {
  return {
    stepName,
    sequence,
    status: SagaStepStatus.PENDING,
    retryCount: 0,
  };
}

/**
 * Saga 错误类型
 */
export class SagaError extends Error {
  constructor(
    message: string,
    public readonly transactionId: string,
    public readonly stepName?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SagaError';
  }
}

/**
 * 步骤执行错误
 */
export class SagaStepError extends SagaError {
  constructor(
    transactionId: string,
    stepName: string,
    public readonly stepOutput: unknown,
    cause?: Error
  ) {
    super(
      `Step '${stepName}' failed: ${cause?.message || 'Unknown error'}`,
      transactionId,
      stepName,
      cause
    );
    this.name = 'SagaStepError';
  }
}

/**
 * 补偿错误
 */
export class SagaCompensationError extends SagaError {
  constructor(
    transactionId: string,
    stepName: string,
    cause?: Error
  ) {
    super(
      `Compensation for step '${stepName}' failed: ${cause?.message || 'Unknown error'}`,
      transactionId,
      stepName,
      cause
    );
    this.name = 'SagaCompensationError';
  }
}