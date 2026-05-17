/**
 * LLM Trace API Routes
 *
 * Routes under /api/v1/llm
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { LLMTraceService, LLMTrace } from '../services/llm-trace/LLMTraceService';
import { CostCalculator } from '../services/llm-trace/CostCalculator';
import { LLMTraceRepository } from '../repositories/LLMTraceRepository';

let traceService: LLMTraceService | null = null;
let costCalculator: CostCalculator | null = null;

export function initLLMTrace(database?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }> }): void {
  const repo = database ? new LLMTraceRepository(database) : undefined;
  traceService = new LLMTraceService(repo);
  costCalculator = new CostCalculator();
}

// Default initialization (in-memory only, for backward compatibility)
initLLMTrace();

interface TraceIdParams {
  traceId: string;
}

interface TraceQuery {
  tenantId?: number;
  scenarioId?: string;
  limit?: number;
}

interface DailyStatsQuery {
  tenantId: number;
  date?: string;
}

interface CostBreakdownQuery {
  tenantId: number;
  startDate?: string;
  endDate?: string;
}

export async function llmTraceRoutes(app: FastifyInstance): Promise<void> {
  const svc = traceService!;
  const calc = costCalculator!;

  // GET /api/v1/llm/traces/:traceId - Get trace by ID
  app.get<{ Params: TraceIdParams }>(
    '/traces/:traceId',
    async (request: FastifyRequest<{ Params: TraceIdParams }>, reply: FastifyReply) => {
      const { traceId } = request.params;
      const trace = svc.getTrace(traceId);
      if (!trace) {
        return reply.code(404).send({ error: 'Trace not found', traceId });
      }
      return reply.send(trace);
    }
  );

  // GET /api/v1/llm/traces - List traces with filters
  app.get<{ Querystring: TraceQuery }>(
    '/traces',
    async (request: FastifyRequest<{ Querystring: TraceQuery }>, reply: FastifyReply) => {
      const { tenantId, scenarioId, limit = 100 } = request.query;
      let traces: LLMTrace[];
      if (tenantId) {
        traces = svc.getTracesByTenant(tenantId);
      } else if (scenarioId) {
        traces = svc.getTracesByScenario(scenarioId);
      } else {
        traces = [];
      }
      return reply.send({ data: traces.slice(0, limit), total: traces.length, limit });
    }
  );

  // GET /api/v1/llm/stats/daily - Get daily aggregated statistics
  app.get<{ Querystring: DailyStatsQuery }>(
    '/stats/daily',
    async (request: FastifyRequest<{ Querystring: DailyStatsQuery }>, reply: FastifyReply) => {
      const { tenantId, date } = request.query;
      const targetDate = date ? new Date(date) : new Date();
      const stats = await svc.aggregateDailyStats(tenantId, targetDate);
      return reply.send({ tenantId, date: targetDate.toISOString().slice(0, 10), ...stats });
    }
  );

  // GET /api/v1/llm/cost/breakdown - Get cost breakdown
  app.get<{ Querystring: CostBreakdownQuery }>(
    '/cost/breakdown',
    async (request: FastifyRequest<{ Querystring: CostBreakdownQuery }>, reply: FastifyReply) => {
      const { tenantId, startDate, endDate } = request.query;
      const traces = svc.getTracesByTenant(tenantId);
      let filteredTraces = traces;
      if (startDate) {
        const start = new Date(startDate);
        filteredTraces = filteredTraces.filter(t => t.requestStartedAt >= start);
      }
      if (endDate) {
        const end = new Date(endDate);
        filteredTraces = filteredTraces.filter(t => t.requestStartedAt <= end);
      }
      const breakdown = calc.calculateBatch(
        filteredTraces.map(t => ({ modelId: t.modelId, inputTokens: t.inputTokens, outputTokens: t.outputTokens }))
      );
      return reply.send({ tenantId, startDate, endDate, totalTraces: filteredTraces.length, ...breakdown });
    }
  );

  // GET /api/v1/llm/tracking/accuracy - Get tracking accuracy metrics
  app.get(
    '/tracking/accuracy',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const accuracy = svc.getTrackingAccuracy();
      const completed = svc.getCompletedCount();
      const failed = svc.getFailedCount();
      return reply.send({ accuracy, completed, failed, total: completed + failed, targetAccuracy: 0.98, meetsTarget: accuracy >= 0.98 });
    }
  );

  // GET /api/v1/llm/pricing - Get model pricing table
  app.get(
    '/pricing',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const pricing = calc.getAllPricing();
      return reply.send({ currency: 'CNY', unit: 'per token', pricing });
    }
  );

  // POST /api/v1/llm/cost/estimate - Estimate cost for tokens
  app.post<{ Body: { modelId: string; inputTokens: number; outputTokens: number } }>(
    '/cost/estimate',
    async (request: FastifyRequest<{ Body: { modelId: string; inputTokens: number; outputTokens: number } }>, reply: FastifyReply) => {
      const { modelId, inputTokens, outputTokens } = request.body;
      if (!modelId || inputTokens === undefined || outputTokens === undefined) {
        return reply.code(400).send({ error: 'Missing required fields: modelId, inputTokens, outputTokens' });
      }
      const breakdown = calc.calculate(modelId, inputTokens, outputTokens);
      return reply.send({ modelId, inputTokens, outputTokens, ...breakdown });
    }
  );
}

export default llmTraceRoutes;
