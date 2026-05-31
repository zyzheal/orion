/**
 * LLM Trace Service - LLM调用链追踪服务
 *
 * 功能：
 * 1. Prompt记录和追踪
 * 2. Token消耗追踪
 * 3. 成本计算（多模型定价）
 * 4. Trace ID关联（父子追踪）
 * 5. 日聚合统计
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';
import pino from 'pino';
import { LLMTraceRepository } from '../../repositories/LLMTraceRepository.js';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Model pricing (CNY per token)
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4': { input: 0.002, output: 0.004 },
  'gpt-4-turbo': { input: 0.001, output: 0.002 },
  'gpt-3.5-turbo': { input: 0.0003, output: 0.0006 },
  'claude-opus': { input: 0.003, output: 0.006 },
  'claude-sonnet': { input: 0.001, output: 0.002 },
  'claude-haiku': { input: 0.0003, output: 0.0006 },
  'qwen-max': { input: 0.0005, output: 0.001 },
  'deepseek': { input: 0.0003, output: 0.0006 },
};

export interface TraceStartParams {
  tenantId: number;
  userId?: string;
  scenarioId?: string;
  providerId?: string;
  modelId: string;
  promptContent: string;
  parentTraceId?: string;
  requestContext?: Record<string, unknown>;
}

export interface TraceCompleteParams {
  outputContent: string;
  inputTokens: number;
  outputTokens: number;
  errorMessage?: string;
}

export interface LLMTrace {
  traceId: string;
  tenantId: number;
  userId?: string;
  scenarioId?: string;
  providerId?: string;
  modelId: string;
  promptContent?: string;
  promptHash?: string;
  outputContent?: string;
  outputHash?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  requestStartedAt: Date;
  requestCompletedAt?: Date;
  durationMs?: number;
  parentTraceId?: string;
  errorMessage?: string;
  requestContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface DailyStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  avgDurationMs: number;
  successRate: number;
}

export class LLMTraceService extends EventEmitter {
  private completedCount: number = 0;
  private failedCount: number = 0;
  private repo: LLMTraceRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }> }) {
    super();
    if (db) {
      this.repo = new LLMTraceRepository(db);
    } else {
      throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Database connection required for LLMTraceService');
    }
  }

  generateTraceId(): string {
    return `trace_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  async startTrace(params: TraceStartParams): Promise<LLMTrace> {
    const traceId = this.generateTraceId();
    const promptHash = this.hashContent(params.promptContent);

    const trace: LLMTrace = {
      traceId,
      tenantId: params.tenantId,
      userId: params.userId,
      scenarioId: params.scenarioId,
      providerId: params.providerId,
      modelId: params.modelId,
      promptContent: params.promptContent,
      promptHash,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      inputCost: 0,
      outputCost: 0,
      totalCost: 0,
      currency: 'CNY',
      status: 'pending',
      requestStartedAt: new Date(),
      parentTraceId: params.parentTraceId,
      requestContext: params.requestContext,
    };

    // Persist to database
    try {
      const saved = await this.repo.create(trace);
      logger.debug(`[LLMTrace] Started trace: ${traceId}`);
      this.emit('trace:started', saved);
      return saved;
    } catch (err) {
      logger.error(`[LLMTrace] Failed to persist trace ${traceId}:`, err);
      throw new OrionError(ErrorCode.OPERATION_FAILED, `Failed to create trace: ${traceId}`);
    }
  }

  async completeTrace(traceId: string, params: TraceCompleteParams): Promise<LLMTrace> {
    const trace = await this.repo.findByTraceId(traceId);
    if (!trace) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Trace not found: ${traceId}`);
    }

    const cost = this.calculateCost({
      modelId: trace.modelId,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
    });

    const outputHash = this.hashContent(params.outputContent);
    const status = params.errorMessage ? 'failed' : 'completed';
    const requestCompletedAt = new Date();
    const durationMs = requestCompletedAt.getTime() - trace.requestStartedAt.getTime();

    if (status === 'completed') {
      this.completedCount++;
    } else {
      this.failedCount++;
    }

    // Update in database
    try {
      const updated = await this.repo.update(traceId, {
        outputContent: params.outputContent,
        outputHash,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        totalTokens: params.inputTokens + params.outputTokens,
        inputCost: cost.inputCost,
        outputCost: cost.outputCost,
        totalCost: cost.totalCost,
        status,
        requestCompletedAt,
        durationMs,
        errorMessage: params.errorMessage,
      });

      if (!updated) {
        throw new OrionError(ErrorCode.NOT_FOUND, `Trace not found: ${traceId}`);
      }
      logger.debug(`[LLMTrace] Completed trace: ${traceId} tokens=${updated.totalTokens} cost=${updated.totalCost}`);
      this.emit('trace:completed', updated);
      return updated;
    } catch (err) {
      logger.error(`[LLMTrace] Failed to update trace ${traceId}:`, err);
      throw new OrionError(ErrorCode.OPERATION_FAILED, `Failed to update trace: ${traceId}`);
    }
  }

  calculateCost(params: { modelId: string; inputTokens: number; outputTokens: number }): {
    inputCost: number;
    outputCost: number;
    totalCost: number;
  } {
    const pricing = MODEL_PRICING[params.modelId] || MODEL_PRICING['gpt-4'];
    const inputCost = params.inputTokens * pricing.input;
    const outputCost = params.outputTokens * pricing.output;
    const totalCost = inputCost + outputCost;
    return { inputCost, outputCost, totalCost };
  }

  hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 64);
  }

  async getTrace(traceId: string): Promise<LLMTrace | null> {
    return (await this.repo.findByTraceId(traceId)) || null;
  }

  async getTracesByTenant(tenantId: number): Promise<LLMTrace[]> {
    return this.repo.findByTenant(tenantId);
  }

  async getTracesByScenario(scenarioId: string): Promise<LLMTrace[]> {
    return this.repo.findByScenario(scenarioId);
  }

  getTrackingAccuracy(): number {
    const total = this.completedCount + this.failedCount;
    return total > 0 ? this.completedCount / total : 1.0;
  }

  getCompletedCount(): number {
    return this.completedCount;
  }

  getFailedCount(): number {
    return this.failedCount;
  }

  async aggregateDailyStats(tenantId: number, date: Date): Promise<DailyStats> {
    const dateStr = date.toISOString().slice(0, 10);

    const row = await this.repo.getDailyStats(tenantId, dateStr);
    return {
      totalRequests: parseInt(String(row.total_requests), 10),
      totalTokens: parseInt(String(row.total_tokens), 10),
      totalCost: parseFloat(String(row.total_cost)),
      avgDurationMs: parseFloat(String(row.avg_duration_ms)),
      successRate: parseFloat(String(row.success_rate)),
    };
  }

  async getAllTraces(): Promise<LLMTrace[]> {
    return this.repo.findAll();
  }

  async clearTraces(): Promise<void> {
    await this.repo.deleteAll();
    this.completedCount = 0;
    this.failedCount = 0;
  }
}
