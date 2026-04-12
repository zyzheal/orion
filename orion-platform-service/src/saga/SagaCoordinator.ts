/**
 * Saga 协调器 - 分布式事务编排引擎
 *
 * 功能：
 * - 开始事务 (beginTransaction)
 * - 执行步骤 (executeStep)
 * - 补偿操作 (compensate)
 * - 完成事务 (commit/rollback)
 * - 事务状态跟踪
 */

import {
  SagaStatus,
  SagaContext,
  SagaStep,
  SagaStepStatus,
  SagaDefinition,
  SagaOptions,
  SagaError,
  SagaStepError,
  SagaCompensationError,
  createSagaContext,
  createStepExecution,
  SagaStepExecution,
} from './types';
import { TransactionLog } from './TransactionLog';
import { IdempotencyChecker } from './IdempotencyChecker';
import { RedisCache } from '../services/redis-cache';

/**
 * Saga 协调器选项
 */
export interface SagaCoordinatorOptions {
  /** Redis 缓存服务 */
  redis?: RedisCache;
  /** 事务日志 */
  transactionLog?: TransactionLog;
  /** 幂等性检查器 */
  idempotencyChecker?: IdempotencyChecker;
  /** 默认重试配置 */
  defaultRetryConfig?: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    multiplier: number;
  };
  /** 默认超时时间（毫秒） */
  defaultTimeoutMs?: number;
}

/**
 * 默认重试配置
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  multiplier: 2,
};

/**
 * 默认超时时间：30 分钟
 */
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * 执行结果
 */
export interface SagaExecutionResult<TOutput = unknown> {
  /** 是否成功 */
  success: boolean;
  /** 输出结果 */
  output?: TOutput;
  /** 错误信息 */
  error?: string;
  /** 事务 ID */
  transactionId: string;
  /** 请求 ID */
  requestId: string;
  /** 状态 */
  status: SagaStatus;
  /** 执行时间（毫秒） */
  durationMs: number;
}

/**
 * Saga 协调器
 */
export class SagaCoordinator {
  private transactionLog: TransactionLog;
  private idempotencyChecker: IdempotencyChecker;
  private defaultRetryConfig: typeof DEFAULT_RETRY_CONFIG;
  private defaultTimeoutMs: number;
  private runningTransactions = new Map<string, NodeJS.Timeout>();

  constructor(options: SagaCoordinatorOptions = {}) {
    this.transactionLog = options.transactionLog || new TransactionLog();
    this.idempotencyChecker = options.idempotencyChecker || new IdempotencyChecker({ redis: options.redis });
    this.defaultRetryConfig = options.defaultRetryConfig || DEFAULT_RETRY_CONFIG;
    this.defaultTimeoutMs = options.defaultTimeoutMs || DEFAULT_TIMEOUT_MS;
  }

  /**
   * 执行 Saga
   */
  async execute<TInput, TOutput>(
    definition: SagaDefinition<TInput, TOutput>,
    input: TInput,
    options: SagaOptions = {}
  ): Promise<SagaExecutionResult<TOutput>> {
    const startTime = Date.now();
    const requestId = options.requestId || '';

    // 幂等性检查
    if (requestId) {
      const checkResult = await this.idempotencyChecker.check(requestId);
      if (!checkResult.canExecute) {
        return {
          success: checkResult.isProcessed && !checkResult.previousError,
          output: checkResult.previousResult as TOutput,
          error: checkResult.previousError,
          transactionId: '',
          requestId,
          status: checkResult.isProcessed ? SagaStatus.COMPLETED : SagaStatus.RUNNING,
          durationMs: Date.now() - startTime,
        };
      }
      await this.idempotencyChecker.markProcessing(requestId);
    }

    // 创建上下文
    const context = createSagaContext(requestId, options.metadata);

    // 创建事务日志
    await this.transactionLog.createTransaction(definition.name, input, context);

    // 更新状态为运行中
    await this.transactionLog.updateStatus(context.transactionId, SagaStatus.RUNNING);

    // 设置超时
    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;
    const timeoutId = setTimeout(() => {
      this.handleTimeout(context.transactionId);
    }, timeoutMs);
    this.runningTransactions.set(context.transactionId, timeoutId);

    try {
      // 按顺序执行步骤
      const stepOutputs = new Map<string, unknown>();

      for (let i = 0; i < definition.steps.length; i++) {
        const step = definition.steps[i];
        context.currentStepIndex = i;

        // 初始化步骤执行记录
        const stepExecution = createStepExecution(step.name, step.sequence);
        context.stepExecutions.push(stepExecution);

        try {
          // 记录步骤开始
          await this.transactionLog.recordStepStarted(context.transactionId, step.name, step.sequence);

          // 执行步骤（带重试）
          const output = await this.executeStepWithRetry(step, input, context);
          stepOutputs.set(step.name, output);

          // 记录步骤完成
          stepExecution.status = SagaStepStatus.COMPLETED;
          stepExecution.output = output;
          stepExecution.completedAt = new Date();
          await this.transactionLog.recordStepCompleted(context.transactionId, step.name, output);

        } catch (error) {
          // 记录步骤失败
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          stepExecution.status = SagaStepStatus.FAILED;
          stepExecution.error = errorMessage;
          stepExecution.completedAt = new Date();
          await this.transactionLog.recordStepFailed(context.transactionId, step.name, errorMessage);

          // 开始补偿
          await this.compensate(definition, input, stepOutputs, context);

          // 标记失败
          await this.transactionLog.updateStatus(
            context.transactionId,
            SagaStatus.COMPENSATED,
            undefined,
            errorMessage
          );

          // 幂等性标记失败
          if (requestId) {
            await this.idempotencyChecker.markFailed(requestId, errorMessage, context.transactionId);
          }

          // 清理超时
          this.clearTimeout(context.transactionId);

          return {
            success: false,
            error: errorMessage,
            transactionId: context.transactionId,
            requestId,
            status: SagaStatus.COMPENSATED,
            durationMs: Date.now() - startTime,
          };
        }
      }

      // 所有步骤完成，执行 finalize
      let finalOutput: TOutput;
      if (definition.finalize) {
        finalOutput = await definition.finalize(input, context);
      } else {
        finalOutput = undefined as TOutput;
      }

      // 标记成功
      await this.transactionLog.updateStatus(context.transactionId, SagaStatus.COMPLETED, finalOutput);

      // 幂等性标记完成
      if (requestId) {
        await this.idempotencyChecker.markCompleted(requestId, finalOutput, context.transactionId);
      }

      // 清理超时
      this.clearTimeout(context.transactionId);

      return {
        success: true,
        output: finalOutput,
        transactionId: context.transactionId,
        requestId,
        status: SagaStatus.COMPLETED,
        durationMs: Date.now() - startTime,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.transactionLog.updateStatus(
        context.transactionId,
        SagaStatus.FAILED,
        undefined,
        errorMessage
      );

      if (requestId) {
        await this.idempotencyChecker.markFailed(requestId, errorMessage, context.transactionId);
      }

      this.clearTimeout(context.transactionId);

      return {
        success: false,
        error: errorMessage,
        transactionId: context.transactionId,
        requestId,
        status: SagaStatus.FAILED,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 执行步骤（带重试）
   */
  private async executeStepWithRetry<TInput>(
    step: SagaStep<TInput, unknown>,
    input: TInput,
    context: SagaContext
  ): Promise<unknown> {
    const retryConfig = step.retryConfig || this.defaultRetryConfig;
    const { maxRetries, initialDelayMs, maxDelayMs, multiplier } = retryConfig;

    let lastError: Error | undefined;
    let delay = initialDelayMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 执行步骤（带超时）
        if (step.timeoutMs) {
          return await this.executeWithTimeout(step.execute, input, context, step.timeoutMs);
        }
        return await step.execute(input, context);

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // 更新重试计数
        if (attempt < maxRetries) {
          await this.transactionLog.incrementRetryCount(context.transactionId, step.name);
          await this.sleep(delay);
          delay = Math.min(delay * multiplier, maxDelayMs);
        }
      }
    }

    throw new SagaStepError(context.transactionId, step.name, undefined, lastError);
  }

  /**
   * 带超时执行
   */
  private async executeWithTimeout<TInput, TOutput>(
    fn: (input: TInput, context: SagaContext) => Promise<TOutput>,
    input: TInput,
    context: SagaContext,
    timeoutMs: number
  ): Promise<TOutput> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Step execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn(input, context)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * 补偿已完成的步骤
   */
  private async compensate<TInput, TOutput>(
    definition: SagaDefinition<TInput, TOutput>,
    input: TInput,
    stepOutputs: Map<string, unknown>,
    context: SagaContext
  ): Promise<void> {
    // 获取已完成步骤的执行记录（按逆序）
    const completedSteps = context.stepExecutions
      .filter(e => e.status === SagaStepStatus.COMPLETED)
      .sort((a, b) => b.sequence - a.sequence);

    for (const stepExecution of completedSteps) {
      const step = definition.steps.find(s => s.name === stepExecution.stepName);
      if (!step) continue;

      try {
        // 记录补偿开始
        await this.transactionLog.recordCompensationStarted(context.transactionId, step.name);

        // 执行补偿
        const output = stepOutputs.get(step.name);
        await step.compensate(input, output, context);

        // 记录补偿完成
        await this.transactionLog.recordCompensationCompleted(context.transactionId, step.name);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // 记录补偿失败
        await this.transactionLog.recordCompensationFailed(context.transactionId, step.name, errorMessage);

        throw new SagaCompensationError(context.transactionId, step.name, error instanceof Error ? error : undefined);
      }
    }
  }

  /**
   * 处理超时
   */
  private async handleTimeout(transactionId: string): Promise<void> {
    const entry = await this.transactionLog.getTransaction(transactionId);
    if (!entry || entry.status === SagaStatus.COMPLETED || entry.status === SagaStatus.COMPENSATED) {
      return;
    }

    await this.transactionLog.updateStatus(
      transactionId,
      SagaStatus.FAILED,
      undefined,
      'Transaction timed out'
    );
  }

  /**
   * 清理超时定时器
   */
  private clearTimeout(transactionId: string): void {
    const timeoutId = this.runningTransactions.get(transactionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.runningTransactions.delete(transactionId);
    }
  }

  /**
   * 睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取事务状态
   */
  async getTransactionStatus(transactionId: string): Promise<{
    status: SagaStatus;
    stepExecutions: SagaStepExecution[];
  } | null> {
    const entry = await this.transactionLog.getTransaction(transactionId);
    if (!entry) return null;

    return {
      status: entry.status,
      stepExecutions: entry.stepExecutions,
    };
  }

  /**
   * 获取事务日志
   */
  getTransactionLog(): TransactionLog {
    return this.transactionLog;
  }

  /**
   * 获取幂等性检查器
   */
  getIdempotencyChecker(): IdempotencyChecker {
    return this.idempotencyChecker;
  }
}