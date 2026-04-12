/**
 * 事务日志 - Saga 事务状态持久化
 *
 * 提供：
 * - 事务状态记录
 * - 事务恢复支持
 * - 事务查询
 */

import {
  SagaStatus,
  SagaContext,
  SagaStepExecution,
  SagaStepStatus,
  createStepExecution,
} from './types';

/**
 * 事务日志条目
 */
export interface TransactionLogEntry {
  /** 事务 ID */
  transactionId: string;
  /** 请求 ID */
  requestId: string;
  /** Saga 名称 */
  sagaName: string;
  /** 事务状态 */
  status: SagaStatus;
  /** 输入数据（JSON 序列化） */
  input: unknown;
  /** 输出数据（JSON 序列化） */
  output?: unknown;
  /** 错误信息 */
  error?: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
  /** 完成时间 */
  completedAt?: Date;
  /** 步骤执行记录 */
  stepExecutions: SagaStepExecution[];
  /** 元数据 */
  metadata: Record<string, unknown>;
}

/**
 * 事务日志查询过滤器
 */
export interface TransactionLogFilter {
  transactionId?: string;
  requestId?: string;
  sagaName?: string;
  status?: SagaStatus | SagaStatus[];
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

/**
 * 事务日志存储接口
 */
export interface TransactionLogStorage {
  save(entry: TransactionLogEntry): Promise<void>;
  get(transactionId: string): Promise<TransactionLogEntry | null>;
  getByRequestId(requestId: string): Promise<TransactionLogEntry | null>;
  query(filter: TransactionLogFilter): Promise<TransactionLogEntry[]>;
  delete(transactionId: string): Promise<void>;
}

/**
 * 内存事务日志存储
 * 生产环境应使用数据库或持久化存储
 */
export class InMemoryTransactionLogStorage implements TransactionLogStorage {
  private entries = new Map<string, TransactionLogEntry>();
  private byRequestId = new Map<string, string>();

  async save(entry: TransactionLogEntry): Promise<void> {
    this.entries.set(entry.transactionId, entry);
    this.byRequestId.set(entry.requestId, entry.transactionId);
  }

  async get(transactionId: string): Promise<TransactionLogEntry | null> {
    return this.entries.get(transactionId) || null;
  }

  async getByRequestId(requestId: string): Promise<TransactionLogEntry | null> {
    const transactionId = this.byRequestId.get(requestId);
    if (!transactionId) return null;
    return this.entries.get(transactionId) || null;
  }

  async query(filter: TransactionLogFilter): Promise<TransactionLogEntry[]> {
    let result = Array.from(this.entries.values());

    if (filter.transactionId) {
      result = result.filter(e => e.transactionId === filter.transactionId);
    }

    if (filter.requestId) {
      result = result.filter(e => e.requestId === filter.requestId);
    }

    if (filter.sagaName) {
      result = result.filter(e => e.sagaName === filter.sagaName);
    }

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      result = result.filter(e => statuses.includes(e.status));
    }

    if (filter.createdAfter) {
      result = result.filter(e => e.createdAt >= filter.createdAfter!);
    }

    if (filter.createdBefore) {
      result = result.filter(e => e.createdAt <= filter.createdBefore!);
    }

    // 排序（最新的在前）
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // 分页
    const offset = filter.offset || 0;
    const limit = filter.limit || 100;
    return result.slice(offset, offset + limit);
  }

  async delete(transactionId: string): Promise<void> {
    const entry = this.entries.get(transactionId);
    if (entry) {
      this.byRequestId.delete(entry.requestId);
      this.entries.delete(transactionId);
    }
  }
}

/**
 * 事务日志服务
 */
export class TransactionLog {
  private storage: TransactionLogStorage;

  constructor(storage?: TransactionLogStorage) {
    this.storage = storage || new InMemoryTransactionLogStorage();
  }

  /**
   * 创建新事务日志
   */
  async createTransaction(
    sagaName: string,
    input: unknown,
    context: SagaContext
  ): Promise<TransactionLogEntry> {
    const entry: TransactionLogEntry = {
      transactionId: context.transactionId,
      requestId: context.requestId,
      sagaName,
      status: SagaStatus.PENDING,
      input,
      createdAt: context.createdAt,
      updatedAt: context.updatedAt,
      stepExecutions: [],
      metadata: context.metadata,
    };

    await this.storage.save(entry);
    return entry;
  }

  /**
   * 获取事务日志
   */
  async getTransaction(transactionId: string): Promise<TransactionLogEntry | null> {
    return this.storage.get(transactionId);
  }

  /**
   * 根据请求 ID 获取事务日志
   */
  async getTransactionByRequestId(requestId: string): Promise<TransactionLogEntry | null> {
    return this.storage.getByRequestId(requestId);
  }

  /**
   * 更新事务状态
   */
  async updateStatus(
    transactionId: string,
    status: SagaStatus,
    output?: unknown,
    error?: string
  ): Promise<TransactionLogEntry | null> {
    const entry = await this.storage.get(transactionId);
    if (!entry) return null;

    entry.status = status;
    entry.updatedAt = new Date();
    if (output !== undefined) {
      entry.output = output;
    }
    if (error !== undefined) {
      entry.error = error;
    }
    if (status === SagaStatus.COMPLETED || status === SagaStatus.COMPENSATED || status === SagaStatus.FAILED) {
      entry.completedAt = new Date();
    }

    await this.storage.save(entry);
    return entry;
  }

  /**
   * 记录步骤开始
   */
  async recordStepStarted(transactionId: string, stepName: string, sequence: number): Promise<void> {
    const entry = await this.storage.get(transactionId);
    if (!entry) return;

    // 查找或创建步骤执行记录
    let stepExecution = entry.stepExecutions.find(e => e.stepName === stepName);
    if (!stepExecution) {
      stepExecution = createStepExecution(stepName, sequence);
      entry.stepExecutions.push(stepExecution);
    }

    stepExecution.status = SagaStepStatus.EXECUTING;
    stepExecution.startedAt = new Date();
    entry.updatedAt = new Date();

    await this.storage.save(entry);
  }

  /**
   * 记录步骤完成
   */
  async recordStepCompleted<TOutput>(
    transactionId: string,
    stepName: string,
    output: TOutput
  ): Promise<void> {
    const entry = await this.storage.get(transactionId);
    if (!entry) return;

    const stepExecution = entry.stepExecutions.find(e => e.stepName === stepName);
    if (!stepExecution) return;

    stepExecution.status = SagaStepStatus.COMPLETED;
    stepExecution.output = output;
    stepExecution.completedAt = new Date();
    entry.updatedAt = new Date();

    await this.storage.save(entry);
  }

  /**
   * 记录步骤失败
   */
  async recordStepFailed(transactionId: string, stepName: string, error: string): Promise<void> {
    const entry = await this.storage.get(transactionId);
    if (!entry) return;

    const stepExecution = entry.stepExecutions.find(e => e.stepName === stepName);
    if (!stepExecution) return;

    stepExecution.status = SagaStepStatus.FAILED;
    stepExecution.error = error;
    stepExecution.completedAt = new Date();
    entry.updatedAt = new Date();

    await this.storage.save(entry);
  }

  /**
   * 记录补偿开始
   */
  async recordCompensationStarted(transactionId: string, stepName: string): Promise<void> {
    const entry = await this.storage.get(transactionId);
    if (!entry) return;

    const stepExecution = entry.stepExecutions.find(e => e.stepName === stepName);
    if (!stepExecution) return;

    stepExecution.status = SagaStepStatus.COMPENSATING;
    stepExecution.compensationStartedAt = new Date();
    entry.status = SagaStatus.COMPENSATING;
    entry.updatedAt = new Date();

    await this.storage.save(entry);
  }

  /**
   * 记录补偿完成
   */
  async recordCompensationCompleted(transactionId: string, stepName: string): Promise<void> {
    const entry = await this.storage.get(transactionId);
    if (!entry) return;

    const stepExecution = entry.stepExecutions.find(e => e.stepName === stepName);
    if (!stepExecution) return;

    stepExecution.status = SagaStepStatus.COMPENSATED;
    stepExecution.compensationCompletedAt = new Date();
    entry.updatedAt = new Date();

    await this.storage.save(entry);
  }

  /**
   * 记录补偿失败
   */
  async recordCompensationFailed(transactionId: string, stepName: string, error: string): Promise<void> {
    const entry = await this.storage.get(transactionId);
    if (!entry) return;

    const stepExecution = entry.stepExecutions.find(e => e.stepName === stepName);
    if (!stepExecution) return;

    stepExecution.status = SagaStepStatus.COMPENSATION_FAILED;
    stepExecution.error = error;
    stepExecution.compensationCompletedAt = new Date();
    entry.status = SagaStatus.FAILED;
    entry.error = `Compensation failed for step ${stepName}: ${error}`;
    entry.updatedAt = new Date();

    await this.storage.save(entry);
  }

  /**
   * 增加重试计数
   */
  async incrementRetryCount(transactionId: string, stepName: string): Promise<number> {
    const entry = await this.storage.get(transactionId);
    if (!entry) return 0;

    const stepExecution = entry.stepExecutions.find(e => e.stepName === stepName);
    if (!stepExecution) return 0;

    stepExecution.retryCount += 1;
    entry.updatedAt = new Date();
    await this.storage.save(entry);

    return stepExecution.retryCount;
  }

  /**
   * 查询事务日志
   */
  async queryTransactions(filter: TransactionLogFilter): Promise<TransactionLogEntry[]> {
    return this.storage.query(filter);
  }

  /**
   * 获取可恢复的事务
   */
  async getRecoverableTransactions(): Promise<TransactionLogEntry[]> {
    return this.storage.query({
      status: [SagaStatus.RUNNING, SagaStatus.COMPENSATING],
    });
  }

  /**
   * 删除事务日志
   */
  async deleteTransaction(transactionId: string): Promise<void> {
    return this.storage.delete(transactionId);
  }

  /**
   * 获取底层存储
   */
  getStorage(): TransactionLogStorage {
    return this.storage;
  }
}