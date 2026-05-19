/**
 * Base Agent - Agent 抽象基类
 *
 * 职责：
 * 1. 统一的生命周期管理（启用检查、限流、重试）
 * 2. 统一的 AI Gateway 调用封装
 * 3. 统一的审计日志记录
 * 4. 统一的错误处理
 */

import pino from 'pino';
import {
  AgentConfig,
  AgentExecutionContext,
  AgentAuditLog,
  AgentInfo,
  AgentStatus,
  AgentTokenUsage,
} from './types';
import { ToolAdapter } from './ToolAdapter';
import { AIGateway } from '../../ai/AIGateway';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Agent 抽象基类
 *
 * 所有具体 Agent 应继承此类并实现 doExecute 方法
 */
export abstract class BaseAgent {
  protected config: AgentConfig;
  protected aiGateway: AIGateway;
  protected toolAdapter: ToolAdapter;

  private concurrentCalls = 0;
  private status: AgentStatus = 'idle';
  private lastError?: string;

  /** 内存审计日志存储（带容量限制，防止内存泄漏） */
  private static auditLogs: AgentAuditLog[] = [];
  private static readonly maxAuditLogs = 10000;

  constructor(
    config: AgentConfig,
    aiGateway: AIGateway,
    toolAdapter: ToolAdapter
  ) {
    this.config = config;
    this.aiGateway = aiGateway;
    this.toolAdapter = toolAdapter;

    if (!config.enabled) {
      this.status = 'disabled';
    }

    logger.info({
      msg: 'Agent initialized',
      agentId: config.id,
      agentName: config.name,
      enabled: config.enabled,
      scenario: config.scenario,
    });
  }

  /**
   * 检查 Agent 是否可用
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 获取 Agent 状态
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * 获取 Agent 信息
   */
  getInfo(): AgentInfo {
    return {
      id: this.config.id,
      name: this.config.name,
      enabled: this.isEnabled(),
      scenario: this.config.scenario,
      status: this.getStatus(),
      currentConcurrency: this.concurrentCalls,
      maxConcurrency: this.config.maxConcurrency,
    };
  }

  /**
   * 统一的执行入口（包含限流、重试、审计）
   */
  async execute<TInput, TOutput>(
    input: TInput,
    context: AgentExecutionContext
  ): Promise<TOutput> {
    // 检查是否启用
    if (!this.isEnabled()) {
      const error = new Error(`Agent ${this.config.id} is disabled`);
      this.lastError = error.message;
      this.status = 'error';
      throw error;
    }

    // 限流检查
    if (this.concurrentCalls >= this.config.maxConcurrency) {
      const error = new Error(`Agent ${this.config.id} concurrency limit reached (${this.concurrentCalls}/${this.config.maxConcurrency})`);
      this.lastError = error.message;
      throw error;
    }

    this.concurrentCalls++;
    this.status = 'running';

    const startTime = Date.now();
    let success = false;
    let output: TOutput | undefined;
    let error: string | undefined;
    let tokenUsage: AgentTokenUsage = { input: 0, output: 0, total: 0 };

    try {
      // 执行（带重试）
      output = await this.executeWithRetry(input, context);
      success = true;
      this.status = 'idle';
      this.lastError = undefined;

      return output;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      this.lastError = error;
      this.status = 'error';
      throw e;
    } finally {
      this.concurrentCalls--;

      // 记录审计日志
      const auditLog: AgentAuditLog = {
        agentId: this.config.id,
        context,
        input,
        output,
        durationMs: Date.now() - startTime,
        tokenUsage,
        success,
        error,
      };

      this.recordAuditLog(auditLog);

      logger.debug({
        msg: 'Agent execution completed',
        agentId: this.config.id,
        durationMs: auditLog.durationMs,
        success,
        error,
      });
    }
  }

  /**
   * 带重试的执行
   */
  private async executeWithRetry<TInput, TOutput>(
    input: TInput,
    context: AgentExecutionContext
  ): Promise<TOutput> {
    let lastError: Error | undefined;

    for (let i = 0; i <= this.config.retry.maxRetries; i++) {
      try {
        return await this.doExecute(input, context);
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));

        logger.warn({
          msg: 'Agent execution attempt failed',
          agentId: this.config.id,
          attempt: i + 1,
          maxRetries: this.config.retry.maxRetries,
          error: lastError.message,
        });

        if (i < this.config.retry.maxRetries) {
          const backoffMs = this.config.retry.backoffMs * Math.pow(2, i);
          await this.sleep(backoffMs);
        }
      }
    }

    throw lastError || new Error('Unknown error during agent execution');
  }

  /**
   * 子类实现具体执行逻辑
   *
   * @param input 输入数据
   * @param context 执行上下文
   * @returns 执行结果
   */
  protected abstract doExecute<TInput, TOutput>(
    input: TInput,
    context: AgentExecutionContext
  ): Promise<TOutput>;

  /**
   * 统一的 AI Gateway 调用
   *
   * @param prompt 输入提示词
   * @returns AI 返回的内容
   */
  protected async callAI(prompt: string): Promise<string> {
    const scenario = this.config.scenario as any;
    const result = await this.aiGateway.execute({
      scenario,
      input: {
        prompt,
        temperature: this.config.modelConfig?.temperature ?? 0.3,
        maxTokens: this.config.modelConfig?.maxTokens,
      },
      options: {
        timeout: this.config.timeoutMs,
        preferredProvider: this.config.provider,
      },
    });

    if (!result.success) {
      throw new Error(result.error || result.degradationReason || 'AI call failed');
    }

    return result.data as string;
  }

  /**
   * 调用工具
   *
   * @param toolName 工具名称
   * @param params 工具参数
   * @param context 执行上下文
   * @returns 工具执行结果
   */
  protected async callTool(
    toolName: string,
    params: Record<string, unknown>,
    context: AgentExecutionContext
  ): Promise<any> {
    const result = await this.toolAdapter.executeTool(toolName, params, context);

    if (!result.success) {
      throw new Error(`Tool '${toolName}' execution failed: ${result.error}`);
    }

    return result.data;
  }

  /**
   * 验证执行上下文
   *
   * @param context 执行上下文
   * @throws 如果上下文无效
   */
  protected validateContext(context: AgentExecutionContext): void {
    if (!context.traceId) {
      throw new Error('Missing required field: traceId');
    }
    if (!context.userId) {
      throw new Error('Missing required field: userId');
    }
    if (!context.tenantId) {
      throw new Error('Missing required field: tenantId');
    }
  }

  /**
   * 获取审计日志
   *
   * @param limit 返回最近 N 条记录
   * @returns 审计日志列表
   */
  getAuditLog(limit: number = 100): AgentAuditLog[] {
    return BaseAgent.auditLogs.slice(-limit);
  }

  /**
   * 记录审计日志 — 持久化到内存存储
   */
  protected recordAuditLog(auditLog: AgentAuditLog): void {
    // 持久化到内存（带容量限制）
    BaseAgent.auditLogs.push(auditLog);
    if (BaseAgent.auditLogs.length > BaseAgent.maxAuditLogs) {
      BaseAgent.auditLogs = BaseAgent.auditLogs.slice(-BaseAgent.maxAuditLogs);
    }

    logger.info({
      msg: 'Agent audit log',
      agentId: auditLog.agentId,
      success: auditLog.success,
      durationMs: auditLog.durationMs,
      userId: auditLog.context.userId,
      traceId: auditLog.context.traceId,
    });
  }

  /**
   * 清除所有审计日志（仅用于测试）
   */
  static clearAuditLogs(): void {
    BaseAgent.auditLogs = [];
  }

  /**
   * 获取配置
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * 获取最后的错误信息
   */
  getLastError(): string | undefined {
    return this.lastError;
  }

  /**
   * 当前并发数
   */
  getCurrentConcurrency(): number {
    return this.concurrentCalls;
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}