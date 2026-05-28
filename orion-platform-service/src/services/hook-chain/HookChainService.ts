/**
 * Hook Chain Orchestration Service
 *
 * 支持多个 Hook 组成执行链，实现复杂的触发和响应编排
 *
 * 功能:
 * 1. Hook 链定义与编排
 * 2. 条件过滤触发
 * 3. 同步/异步执行模式
 * 4. Hook 间数据传递
 * 5. 失败处理与重试
 * 6. 执行审计日志
 */
import { EventEmitter } from 'events';
import pino from 'pino';
import { OrionError, ErrorCode } from '../../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ==================== Types ====================

export interface HookDefinition {
  id: string;
  name: string;
  type: 'webhook' | 'script' | 'notification' | 'api_call' | 'pipeline_trigger' | 'approval';
  config: Record<string, any>;
  timeout?: number; // 执行超时时间 (ms)
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number; // ms
    backoffMultiplier?: number;
  };
  condition?: HookCondition; // 执行条件
}

export interface HookCondition {
  type: 'always' | 'on_success' | 'on_failure' | 'on_match' | 'expression';
  expression?: string; // JavaScript 表达式
  matchPatterns?: string[]; // 用于匹配 payload 中的字段
  matchField?: string;
}

export interface HookChainDefinition {
  id: string;
  name: string;
  description?: string;
  hooks: HookDefinition[];
  executionMode: 'sequential' | 'parallel' | 'mixed'; // 执行模式
  stopOnFailure: boolean; // 失败时是否停止后续 Hook
  inputTransform?: string; // 输入转换表达式
  outputTransform?: string; // 输出转换表达式
  metadata?: Record<string, any>;
}

export interface HookExecutionContext {
  chainId: string;
  executionId: string;
  triggerSource: string; // 触发来源
  triggerPayload: Record<string, any>; // 触发 payload
  currentHookIndex: number;
  previousHookOutput?: Record<string, any>; // 上一个 Hook 的输出
  accumulatedData: Record<string, any>; // 链执行过程中累积的数据
  startTime: Date;
  tenantId: string;
}

export interface HookExecutionResult {
  hookId: string;
  hookName: string;
  success: boolean;
  output?: Record<string, any>;
  error?: string;
  durationMs: number;
  retryCount: number;
  timestamp: Date;
}

export interface ChainExecutionResult {
  chainId: string;
  executionId: string;
  success: boolean;
  hookResults: HookExecutionResult[];
  totalDurationMs: number;
  finalOutput?: Record<string, any>;
  error?: string;
  timestamp: Date;
}

export interface HookExecutor {
  execute(context: HookExecutionContext, config: Record<string, any>): Promise<Record<string, any>>;
}

// ==================== Hook Executors ====================

class WebhookExecutor implements HookExecutor {
  async execute(context: HookExecutionContext, config: Record<string, any>): Promise<Record<string, any>> {
    const { url, method = 'POST', headers = {} } = config;

    // 发送 HTTP 请求
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        chainId: context.chainId,
        executionId: context.executionId,
        payload: context.triggerPayload,
        accumulatedData: context.accumulatedData,
      }),
    });

    if (!response.ok) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Webhook call failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<Record<string, any>>;
  }
}

class NotificationExecutor implements HookExecutor {
  constructor(private eventBus: EventEmitter) {}

  async execute(context: HookExecutionContext, config: Record<string, any>): Promise<Record<string, any>> {
    const { channels, template, recipients } = config;

    const notification = {
      chainId: context.chainId,
      executionId: context.executionId,
      message: template ? this.renderTemplate(template, context) : `Hook chain ${context.chainId} executed`,
      recipients,
      channels,
      timestamp: new Date(),
    };

    this.eventBus.emit('notification:send', notification);

    return { sent: true, channels, recipients };
  }

  private renderTemplate(template: string, context: HookExecutionContext): string {
    // 简单模板渲染
    return template
      .replace(/\$\{chainId\}/g, context.chainId)
      .replace(/\$\{executionId\}/g, context.executionId)
      .replace(/\$\{triggerSource\}/g, context.triggerSource);
  }
}

class PipelineTriggerExecutor implements HookExecutor {
  constructor(private pipelineService: any) {}

  async execute(context: HookExecutionContext, config: Record<string, any>): Promise<Record<string, any>> {
    const { pipelineId, parameters = {} } = config;

    if (!this.pipelineService) {
      throw new Error('Pipeline service not configured');
    }

    // 触发 Pipeline
    const result = await this.pipelineService.triggerPipeline({
      pipelineId,
      tenantId: context.tenantId,
      triggerSource: `hook-chain:${context.chainId}`,
      parameters: {
        ...parameters,
        chainData: context.accumulatedData,
      },
    });

    return {
      triggered: true,
      pipelineId,
      runId: result.runId,
    };
  }
}

class ApprovalExecutor implements HookExecutor {
  constructor(private approvalService: any) {}

  async execute(context: HookExecutionContext, config: Record<string, any>): Promise<Record<string, any>> {
    const { approvalType, approvers, timeoutMinutes = 30 } = config;

    if (!this.approvalService) {
      throw new Error('Approval service not configured');
    }

    // 创建审批请求
    const approval = await this.approvalService.createApproval({
      tenantId: context.tenantId,
      type: approvalType,
      approvers,
      context: {
        chainId: context.chainId,
        executionId: context.executionId,
        payload: context.triggerPayload,
      },
      timeoutMinutes,
    });

    return {
      approvalId: approval.id,
      status: 'pending',
      approvers,
    };
  }
}

// ==================== Hook Chain Service ====================

export class HookChainService extends EventEmitter {
  private chains: Map<string, HookChainDefinition> = new Map();
  private executors: Map<string, HookExecutor> = new Map();
  private executionHistory: Map<string, ChainExecutionResult[]> = new Map();
  private pendingExecutions: Map<string, HookExecutionContext> = new Map();

  constructor(options?: {
    eventBus?: EventEmitter;
    pipelineService?: any;
    approvalService?: any;
  }) {
    super();

    const eventBus = options?.eventBus || new EventEmitter();

    // 注册默认执行器
    this.executors.set('webhook', new WebhookExecutor());
    this.executors.set('notification', new NotificationExecutor(eventBus));
    this.executors.set('pipeline_trigger', new PipelineTriggerExecutor(options?.pipelineService));
    this.executors.set('approval', new ApprovalExecutor(options?.approvalService));
  }

  // ==================== Chain Management ====================

  /**
   * 创建 Hook 链
   */
  createChain(definition: HookChainDefinition): HookChainDefinition {
    // 验证定义
    this.validateChainDefinition(definition);

    // 存储
    this.chains.set(definition.id, definition);

    logger.info({ chainId: definition.id, hooksCount: definition.hooks.length }, 'Hook chain created');
    this.emit('chain:created', { chainId: definition.id, definition });

    return definition;
  }

  /**
   * 获取 Hook 链定义
   */
  getChain(chainId: string): HookChainDefinition | undefined {
    return this.chains.get(chainId);
  }

  /**
   * 列出所有 Hook 链
   */
  listChains(): HookChainDefinition[] {
    return Array.from(this.chains.values());
  }

  /**
   * 删除 Hook 链
   */
  deleteChain(chainId: string): boolean {
    const deleted = this.chains.delete(chainId);
    if (deleted) {
      this.emit('chain:deleted', { chainId });
    }
    return deleted;
  }

  /**
   * 更新 Hook 链
   */
  updateChain(chainId: string, updates: Partial<HookChainDefinition>): HookChainDefinition | undefined {
    const existing = this.chains.get(chainId);
    if (!existing) return undefined;

    const updated = { ...existing, ...updates };
    this.validateChainDefinition(updated);
    this.chains.set(chainId, updated);

    this.emit('chain:updated', { chainId, updates });
    return updated;
  }

  // ==================== Chain Execution ====================

  /**
   * 执行 Hook 链
   */
  async executeChain(
    chainId: string,
    triggerSource: string,
    triggerPayload: Record<string, any>,
    tenantId: string
  ): Promise<ChainExecutionResult> {
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new Error(`Hook chain "${chainId}" not found`);
    }

    const executionId = `exec-${chainId}-${Date.now()}`;
    const startTime = new Date();

    const context: HookExecutionContext = {
      chainId,
      executionId,
      triggerSource,
      triggerPayload,
      currentHookIndex: 0,
      accumulatedData: {},
      startTime,
      tenantId,
    };

    this.pendingExecutions.set(executionId, context);
    this.emit('chain:started', { chainId, executionId, triggerSource });

    const hookResults: HookExecutionResult[] = [];
    let finalOutput: Record<string, any> | undefined;
    let chainError: string | undefined;

    try {
      // 应用输入转换
      if (chain.inputTransform) {
        triggerPayload = this.transformData(chain.inputTransform, triggerPayload);
      }

      // 执行 Hooks
      if (chain.executionMode === 'parallel') {
        // 并行执行所有 Hooks
        const results = await Promise.allSettled(
          chain.hooks.map((hook, index) => this.executeHook(hook, context, index))
        );

        results.forEach((result, index) => {
          hookResults.push(this.resultToHookResult(chain.hooks[index], result));
        });

        // 检查是否有失败
        const failures = hookResults.filter(r => !r.success);
        if (failures.length > 0 && chain.stopOnFailure) {
          chainError = `Hook(s) failed: ${failures.map(f => f.hookName).join(', ')}`;
        }
      } else {
        // 串行或混合执行
        for (let i = 0; i < chain.hooks.length; i++) {
          context.currentHookIndex = i;

          const hook = chain.hooks[i];
          try {
            const result = await this.executeHook(hook, context, i);
            hookResults.push(result);

            if (result.success && result.output) {
              // 累积数据
              context.accumulatedData[hook.id] = result.output;
              context.previousHookOutput = result.output;
            }

            if (!result.success && chain.stopOnFailure) {
              chainError = `Hook "${hook.name}" failed: ${result.error}`;
              break;
            }
          } catch (error) {
            hookResults.push({
              hookId: hook.id,
              hookName: hook.name,
              success: false,
              error: error instanceof Error ? error.message : String(error),
              durationMs: 0,
              retryCount: 0,
              timestamp: new Date(),
            });

            if (chain.stopOnFailure) {
              chainError = error instanceof Error ? error.message : String(error);
              break;
            }
          }
        }
      }

      // 应用输出转换
      if (chain.outputTransform) {
        finalOutput = this.transformData(chain.outputTransform, context.accumulatedData);
      } else {
        finalOutput = context.accumulatedData;
      }

      const totalDurationMs = Date.now() - startTime.getTime();

      const result: ChainExecutionResult = {
        chainId,
        executionId,
        success: !chainError,
        hookResults,
        totalDurationMs,
        finalOutput,
        error: chainError,
        timestamp: new Date(),
      };

      // 存储执行历史
      this.storeExecutionHistory(chainId, result);

      this.emit('chain:completed', result);
      logger.info({ chainId, executionId, success: result.success, durationMs: totalDurationMs }, 'Hook chain completed');

      return result;
    } catch (error) {
      const totalDurationMs = Date.now() - startTime.getTime();

      const result: ChainExecutionResult = {
        chainId,
        executionId,
        success: false,
        hookResults,
        totalDurationMs,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };

      this.storeExecutionHistory(chainId, result);
      this.emit('chain:failed', result);

      return result;
    } finally {
      this.pendingExecutions.delete(executionId);
    }
  }

  /**
   * 执行单个 Hook
   */
  private async executeHook(
    hook: HookDefinition,
    context: HookExecutionContext,
    index: number
  ): Promise<HookExecutionResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: string | undefined;

    // 检查执行条件
    if (!this.evaluateCondition(hook.condition, context)) {
      logger.info({ hookId: hook.id, chainId: context.chainId }, 'Hook skipped due to condition');
      return {
        hookId: hook.id,
        hookName: hook.name,
        success: true,
        output: { skipped: true, reason: 'condition_not_met' },
        durationMs: 0,
        retryCount: 0,
        timestamp: new Date(),
      };
    }

    const executor = this.executors.get(hook.type);
    if (!executor) {
      throw new Error(`No executor registered for hook type "${hook.type}"`);
    }

    const maxRetries = hook.retryPolicy?.maxRetries || 0;
    const retryDelay = hook.retryPolicy?.retryDelay || 1000;
    const backoffMultiplier = hook.retryPolicy?.backoffMultiplier || 2;

    while (retryCount <= maxRetries) {
      try {
        // 执行 Hook
        const output = await executor.execute(context, hook.config);
        const durationMs = Date.now() - startTime;

        logger.info({ hookId: hook.id, hookName: hook.name, durationMs, retryCount }, 'Hook executed successfully');

        return {
          hookId: hook.id,
          hookName: hook.name,
          success: true,
          output,
          durationMs,
          retryCount,
          timestamp: new Date(),
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        retryCount++;

        if (retryCount <= maxRetries) {
          const delay = retryDelay * Math.pow(backoffMultiplier, retryCount - 1);
          logger.warn({ hookId: hook.id, retryCount, delay, error: lastError }, 'Hook failed, retrying');
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    const durationMs = Date.now() - startTime;

    logger.error({ hookId: hook.id, hookName: hook.name, error: lastError, retryCount }, 'Hook failed after retries');

    return {
      hookId: hook.id,
      hookName: hook.name,
      success: false,
      error: lastError,
      durationMs,
      retryCount,
      timestamp: new Date(),
    };
  }

  /**
   * 评估 Hook 执行条件
   */
  private evaluateCondition(condition: HookCondition | undefined, context: HookExecutionContext): boolean {
    if (!condition) return true;

    switch (condition.type) {
      case 'always':
        return true;

      case 'on_success':
        // 检查上一个 Hook 是否成功
        return context.currentHookIndex === 0 || !!context.previousHookOutput;

      case 'on_failure':
        // 检查上一个 Hook 是否失败
        return context.currentHookIndex > 0 && !context.previousHookOutput;

      case 'on_match':
        // 检查 payload 中的字段是否匹配
        if (!condition.matchField || !condition.matchPatterns) return false;
        const fieldValue = context.triggerPayload[condition.matchField];
        if (typeof fieldValue !== 'string') return false;
        return condition.matchPatterns.some(pattern => fieldValue.match(pattern));

      case 'expression':
        // 执行 JavaScript 表达式
        if (!condition.expression) return false;
        try {
          // 安全执行表达式 (简单实现)
          const fn = new Function('context', `return ${condition.expression}`);
          return fn(context) === true;
        } catch {
          return false;
        }

      default:
        return true;
    }
  }

  // ==================== Helpers ====================

  private validateChainDefinition(definition: HookChainDefinition): void {
    if (!definition.id) throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Chain id is required');
    if (!definition.hooks || definition.hooks.length === 0) throw new Error('Chain must have at least one hook');

    for (const hook of definition.hooks) {
      if (!hook.id) throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Hook id is required');
      if (!hook.type) throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Hook type is required');
      if (!this.executors.has(hook.type)) {
        logger.warn({ hookType: hook.type }, 'Unknown hook type, execution may fail');
      }
    }
  }

  private transformData(expression: string, data: Record<string, any>): Record<string, any> {
    try {
      const fn = new Function('data', `return ${expression}`);
      return fn(data);
    } catch {
      return data;
    }
  }

  private resultToHookResult(hook: HookDefinition, result: PromiseSettledResult<HookExecutionResult>): HookExecutionResult {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      hookId: hook.id,
      hookName: hook.name,
      success: false,
      error: result.reason?.message || String(result.reason),
      durationMs: 0,
      retryCount: 0,
      timestamp: new Date(),
    };
  }

  private storeExecutionHistory(chainId: string, result: ChainExecutionResult): void {
    let history = this.executionHistory.get(chainId) || [];
    history.push(result);
    // 限制历史数量
    if (history.length > 100) {
      history = history.slice(-100);
    }
    this.executionHistory.set(chainId, history);
  }

  // ==================== Query Methods ====================

  /**
   * 获取执行历史
   */
  getExecutionHistory(chainId: string): ChainExecutionResult[] {
    return this.executionHistory.get(chainId) || [];
  }

  /**
   * 获取正在执行的链
   */
  getPendingExecutions(): HookExecutionContext[] {
    return Array.from(this.pendingExecutions.values());
  }

  /**
   * 注册自定义执行器
   */
  registerExecutor(type: string, executor: HookExecutor): void {
    this.executors.set(type, executor);
    logger.info({ type }, 'Custom hook executor registered');
  }
}

export default HookChainService;