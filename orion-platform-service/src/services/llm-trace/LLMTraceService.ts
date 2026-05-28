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
import { OrionError, ErrorCode } from '../../../errors';

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
  private traces: Map<string, LLMTrace> = new Map();
  private completedCount: number = 0;
  private failedCount: number = 0;
  private repo: LLMTraceRepository | null = null;

  constructor(repo?: LLMTraceRepository) {
    super();
    this.repo = repo ?? null;
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

    this.traces.set(traceId, trace);

    // Persist to database
    if (this.repo) {
      try {
        await this.repo.create(trace);
      } catch (err) {
        logger.error(`[LLMTrace] Failed to persist trace ${traceId}:`, err);
      }
    }

    logger.debug(`[LLMTrace] Started trace: ${traceId}`);
    this.emit('trace:started', trace);
    return trace;
  }

  async completeTrace(traceId: string, params: TraceCompleteParams): Promise<LLMTrace> {
    const trace = this.traces.get(traceId);
    if (!trace) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Trace not found: ${traceId}`);
    }

    const cost = this.calculateCost({
      modelId: trace.modelId,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
    });

    const outputHash = this.hashContent(params.outputContent);

    trace.outputContent = params.outputContent;
    trace.outputHash = outputHash;
    trace.inputTokens = params.inputTokens;
    trace.outputTokens = params.outputTokens;
    trace.totalTokens = params.inputTokens + params.outputTokens;
    trace.inputCost = cost.inputCost;
    trace.outputCost = cost.outputCost;
    trace.totalCost = cost.totalCost;
    trace.status = params.errorMessage ? 'failed' : 'completed';
    trace.requestCompletedAt = new Date();
    trace.durationMs = trace.requestCompletedAt.getTime() - trace.requestStartedAt.getTime();
    trace.errorMessage = params.errorMessage;

    if (trace.status === 'completed') {
      this.completedCount++;
    } else {
      this.failedCount++;
    }

    // Update in database
    if (this.repo) {
      try {
        await this.repo.update(traceId, {
          outputContent: trace.outputContent,
          outputHash: trace.outputHash,
          inputTokens: trace.inputTokens,
          outputTokens: trace.outputTokens,
          totalTokens: trace.totalTokens,
          inputCost: trace.inputCost,
          outputCost: trace.outputCost,
          totalCost: trace.totalCost,
          status: trace.status,
          requestCompletedAt: trace.requestCompletedAt,
          durationMs: trace.durationMs,
          errorMessage: trace.errorMessage,
        });
      } catch (err) {
        logger.error(`[LLMTrace] Failed to update trace ${traceId}:`, err);
      }
    }

    logger.debug(`[LLMTrace] Completed trace: ${traceId} tokens=${trace.totalTokens} cost=${trace.totalCost}`);
    this.emit('trace:completed', trace);
    return trace;
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

  getTrace(traceId: string): LLMTrace | null {
    return this.traces.get(traceId) || null;
  }

  getTracesByTenant(tenantId: number): LLMTrace[] {
    return Array.from(this.traces.values()).filter(t => t.tenantId === tenantId);
  }

  getTracesByScenario(scenarioId: string): LLMTrace[] {
    return Array.from(this.traces.values()).filter(t => t.scenarioId === scenarioId);
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

    // Use DB if available, fall back to in-memory
    if (this.repo) {
      try {
        const row = await this.repo.getDailyStats(tenantId, dateStr);
        return {
          totalRequests: parseInt(String(row.total_requests), 10),
          totalTokens: parseInt(String(row.total_tokens), 10),
          totalCost: parseFloat(String(row.total_cost)),
          avgDurationMs: parseFloat(String(row.avg_duration_ms)),
          successRate: parseFloat(String(row.success_rate)),
        };
      } catch (err) {
        logger.warn(`[LLMTrace] DB stats unavailable, using in-memory fallback:`, err);
      }
    }

    // In-memory fallback
    const traces = this.getTracesByTenant(tenantId);
    const dayTraces = traces.filter(t => t.requestStartedAt.toISOString().slice(0, 10) === dateStr && t.status !== 'pending');
    const totalRequests = dayTraces.length;
    const completedTraces = dayTraces.filter(t => t.status === 'completed');
    return {
      totalRequests,
      totalTokens: dayTraces.reduce((sum, t) => sum + t.totalTokens, 0),
      totalCost: dayTraces.reduce((sum, t) => sum + t.totalCost, 0),
      avgDurationMs: totalRequests > 0 ? dayTraces.reduce((sum, t) => sum + (t.durationMs || 0), 0) / totalRequests : 0,
      successRate: totalRequests > 0 ? completedTraces.length / totalRequests : 1.0,
    };
  }

  getAllTraces(): LLMTrace[] {
    return Array.from(this.traces.values());
  }

  clearTraces(): void {
    this.traces.clear();
    this.completedCount = 0;
    this.failedCount = 0;
  }
}
