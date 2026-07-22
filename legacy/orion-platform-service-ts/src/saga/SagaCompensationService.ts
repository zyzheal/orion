/**
 * SagaCompensationService - Saga 补偿事务服务
 *
 * 提供 Saga 模式的补偿事务管理能力：
 * - 注册补偿操作 (registerCompensation)
 * - 执行单个补偿 (executeCompensation)
 * - 执行完全补偿 (executeFullCompensation)
 * - 查询补偿状态 (getCompensationStatus)
 *
 * Phase 3 执行引擎集成
 */

// ==================== Types ====================

export interface CompensationRecord {
  /** 操作 ID */
  actionId: string;
  /** 所属编排 ID */
  orchestrationId: string;
  /** 原始操作名称 */
  actionName: string;
  /** 补偿函数 */
  compensationFn: (context: CompensationContext) => Promise<CompensationResult>;
  /** 补偿状态 */
  status: CompensationStatus;
  /** 原始操作输出 */
  originalOutput?: unknown;
  /** 补偿执行时间 */
  compensatedAt?: Date;
  /** 补偿错误 */
  error?: string;
  /** 注册时 */
  registeredAt: Date;
  /** 重试次数 */
  retryCount: number;
  /** 最大重试次数 */
  maxRetries: number;
}

export interface CompensationContext {
  /** 操作 ID */
  actionId: string;
  /** 编排 ID */
  orchestrationId: string;
  /** 原始操作输出 */
  originalOutput?: unknown;
  /** 元数据 */
  metadata: Record<string, unknown>;
}

export interface CompensationResult {
  success: boolean;
  result: string;
  error?: string;
}

export type CompensationStatus =
  | 'registered'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'retrying';

export interface CompensationStatusSummary {
  /** 编排 ID */
  orchestrationId: string;
  /** 总操作数 */
  totalActions: number;
  /** 已补偿数 */
  compensatedCount: number;
  /** 失败数 */
  failedCount: number;
  /** 待补偿数 */
  pendingCount: number;
  /** 补偿状态 */
  overallStatus: 'completed' | 'partial' | 'failed' | 'not_started';
  /** 各操作补偿记录 */
  actions: {
    actionId: string;
    actionName: string;
    status: CompensationStatus;
    error?: string;
  }[];
}

// ==================== SagaCompensationService ====================

export class SagaCompensationError extends Error {
  constructor(message: string, public code: string, public cause?: Error) {
    super(message);
    this.name = 'SagaCompensationError';
  }
}

export class SagaCompensationService {
  private compensations: Map<string, CompensationRecord> = new Map();
  private orchestrationActions: Map<string, string[]> = new Map();
  private compensationCounter: number = 0;

  /**
   * 注册补偿操作
   */
  registerCompensation(
    actionId: string,
    compensationFn: (context: CompensationContext) => Promise<CompensationResult>,
    options?: {
      orchestrationId?: string;
      actionName?: string;
      originalOutput?: unknown;
      maxRetries?: number;
      metadata?: Record<string, unknown>;
    }
  ): void {
    if (!actionId) {
      throw new SagaCompensationError('actionId is required', 'INVALID_INPUT');
    }
    if (typeof compensationFn !== 'function') {
      throw new SagaCompensationError('compensationFn must be a function', 'INVALID_INPUT');
    }

    const existing = this.compensations.get(actionId);
    if (existing && existing.status !== 'completed') {
      throw new SagaCompensationError(
        `Compensation already registered for action: ${actionId}`,
        'DUPLICATE_REGISTRATION'
      );
    }

    const orchestrationId = options?.orchestrationId || 'default';

    // Track action in orchestration
    const actions = this.orchestrationActions.get(orchestrationId) || [];
    if (!actions.includes(actionId)) {
      actions.push(actionId);
      this.orchestrationActions.set(orchestrationId, actions);
    }

    const record: CompensationRecord = {
      actionId,
      orchestrationId,
      actionName: options?.actionName || actionId,
      compensationFn,
      status: 'registered',
      originalOutput: options?.originalOutput,
      registeredAt: new Date(),
      retryCount: 0,
      maxRetries: options?.maxRetries ?? 3,
    };

    this.compensations.set(actionId, record);
  }

  /**
   * 执行补偿
   */
  async executeCompensation(actionId: string): Promise<CompensationResult> {
    const record = this.compensations.get(actionId);

    if (!record) {
      return {
        success: false,
        result: `No compensation registered for action: ${actionId}`,
        error: 'COMPENSATION_NOT_FOUND',
      };
    }

    if (record.status === 'completed') {
      return {
        success: false,
        result: `Compensation already completed for action: ${actionId}`,
        error: 'ALREADY_COMPLETED',
      };
    }

    // Retry loop
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= record.maxRetries; attempt += 1) {
      if (attempt > 0) {
        record.status = 'retrying';
        record.retryCount = attempt;
      }

      record.status = 'executing';

      try {
        const context: CompensationContext = {
          actionId: record.actionId,
          orchestrationId: record.orchestrationId,
          originalOutput: record.originalOutput,
          metadata: {},
        };

        const result = await record.compensationFn(context);

        if (result.success) {
          record.status = 'completed';
          record.compensatedAt = new Date();
          record.error = undefined;

          return {
            success: true,
            result: result.result,
          };
        }

        // Compensation function reported failure
        lastError = new Error(result.error || 'Compensation function returned failure');
      } catch (err) {
        lastError = err as Error;
      }

      // Exponential backoff before retry
      if (attempt < record.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // All retries exhausted
    record.status = 'failed';
    record.error = lastError?.message || 'Unknown error';

    return {
      success: false,
      result: `Compensation failed for action: ${actionId} after ${record.maxRetries} retries`,
      error: record.error,
    };
  }

  /**
   * 执行完全补偿（按注册逆序补偿所有操作）
   */
  async executeFullCompensation(orchestrationId: string): Promise<{
    success: boolean;
    result: CompensationStatusSummary;
    error?: string;
  }> {
    const actions = this.orchestrationActions.get(orchestrationId);

    if (!actions || actions.length === 0) {
      const summary: CompensationStatusSummary = {
        orchestrationId,
        totalActions: 0,
        compensatedCount: 0,
        failedCount: 0,
        pendingCount: 0,
        overallStatus: 'not_started',
        actions: [],
      };
      return {
        success: false,
        result: summary,
        error: `No actions registered for orchestration: ${orchestrationId}`,
      };
    }

    // Compensate in reverse order (LIFO - last action compensated first)
    const reversedActions = [...actions].reverse();
    const failedActions: string[] = [];

    for (const actionId of reversedActions) {
      const record = this.compensations.get(actionId);
      if (!record) continue;

      // Skip already completed compensations
      if (record.status === 'completed') continue;

      const result = await this.executeCompensation(actionId);
      if (!result.success) {
        failedActions.push(actionId);
      }
    }

    const summary = this.getCompensationStatus(orchestrationId);

    return {
      success: failedActions.length === 0,
      result: summary,
      error: failedActions.length > 0
        ? `Failed to compensate actions: ${failedActions.join(', ')}`
        : undefined,
    };
  }

  /**
   * 获取补偿状态
   */
  getCompensationStatus(orchestrationId: string): CompensationStatusSummary {
    const actions = this.orchestrationActions.get(orchestrationId) || [];
    const actionSummaries: {
      actionId: string;
      actionName: string;
      status: CompensationStatus;
      error?: string;
    }[] = [];

    let compensatedCount = 0;
    let failedCount = 0;
    let pendingCount = 0;

    for (const actionId of actions) {
      const record = this.compensations.get(actionId);
      if (!record) {
        pendingCount += 1;
        actionSummaries.push({
          actionId,
          actionName: actionId,
          status: 'registered',
        });
        continue;
      }

      actionSummaries.push({
        actionId: record.actionId,
        actionName: record.actionName,
        status: record.status,
        error: record.error,
      });

      switch (record.status) {
        case 'completed':
          compensatedCount += 1;
          break;
        case 'failed':
          failedCount += 1;
          break;
        default:
          pendingCount += 1;
          break;
      }
    }

    let overallStatus: CompensationStatusSummary['overallStatus'];
    if (compensatedCount === 0 && pendingCount === actions.length) {
      overallStatus = 'not_started';
    } else if (compensatedCount === actions.length) {
      overallStatus = 'completed';
    } else if (failedCount > 0) {
      overallStatus = 'failed';
    } else {
      overallStatus = 'partial';
    }

    return {
      orchestrationId,
      totalActions: actions.length,
      compensatedCount,
      failedCount,
      pendingCount,
      overallStatus,
      actions: actionSummaries,
    };
  }

  /**
   * 获取单个补偿记录
   */
  getRecord(actionId: string): CompensationRecord | undefined {
    return this.compensations.get(actionId);
  }

  /**
   * 获取所有补偿记录
   */
  getAllRecords(): CompensationRecord[] {
    return Array.from(this.compensations.values());
  }

  /**
   * 获取编排 ID 列表
   */
  getOrchestrationIds(): string[] {
    return Array.from(this.orchestrationActions.keys());
  }

  /**
   * 清除已完成的补偿记录（用于内存清理）
   */
  cleanupCompletedCompensations(): number {
    let cleaned = 0;
    for (const [actionId, record] of this.compensations.entries()) {
      if (record.status === 'completed') {
        this.compensations.delete(actionId);
        cleaned += 1;
      }
    }
    return cleaned;
  }

  /**
   * 重置所有状态（用于测试）
   */
  reset(): void {
    this.compensations.clear();
    this.orchestrationActions.clear();
    this.compensationCounter = 0;
  }
}
