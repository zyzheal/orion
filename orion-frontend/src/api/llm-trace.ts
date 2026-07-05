/**
 * LLM Trace API Service
 * LLM call chain tracing, cost tracking, and statistics
 */
import { api } from './client';

// ---- Types ----

export interface LLMTrace {
  traceId: string;
  tenantId: number;
  scenarioId: string;
  modelId: string;
  providerId: string;
  promptHash: string;
  promptTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  requestStartedAt: Date;
  requestCompletedAt: Date | null;
  responseLatencyMs: number | null;
  status: 'pending' | 'completed' | 'failed' | 'timeout';
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
}

export interface DailyStats {
  date: string;
  tenantId: number;
  totalTraces: number;
  completedTraces: number;
  failedTraces: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  averageLatencyMs: number;
  topModels: { modelId: string; count: number; cost: number }[];
  topScenarios: { scenarioId: string; count: number; cost: number }[];
}

export interface CostBreakdown {
  tenantId: number;
  startDate?: string;
  endDate?: string;
  totalTraces: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  inputCost: number;
  outputCost: number;
  modelBreakdown: { modelId: string; traces: number; cost: number }[];
}

export interface TrackingAccuracy {
  accuracy: number;
  completed: number;
  failed: number;
  total: number;
  targetAccuracy: number;
  meetsTarget: boolean;
}

export interface ModelPricing {
  modelId: string;
  provider: string;
  inputPricePerToken: number;
  outputPricePerToken: number;
  currency: string;
}

export interface PricingTable {
  currency: string;
  unit: string;
  pricing: ModelPricing[];
}

export interface CostEstimate {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

// ---- Query Types ----

export interface TraceQuery {
  tenantId?: number;
  scenarioId?: string;
  limit?: number;
}

export interface DailyStatsQuery {
  tenantId: number;
  date?: string;
}

export interface CostBreakdownQuery {
  tenantId: number;
  startDate?: string;
  endDate?: string;
}

export interface CostEstimateInput {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
}

// ---- Traces ----

export function getTrace(traceId: string) {
  return api.get<LLMTrace>(`/api/v1/llm/traces/${traceId}`);
}

export function getTraces(params?: TraceQuery) {
  return api.get<LLMTrace[]>('/api/v1/llm/traces', { params });
}

// ---- Statistics ----

export function getDailyStats(params: DailyStatsQuery) {
  return api.get<DailyStats>('/api/v1/llm/stats/daily', { params });
}

// ---- Cost Analysis ----

export function getCostBreakdown(params: CostBreakdownQuery) {
  return api.get<CostBreakdown>('/api/v1/llm/cost/breakdown', { params });
}

export function getTrackingAccuracy() {
  return api.get<TrackingAccuracy>('/api/v1/llm/tracking/accuracy');
}

// ---- Pricing ----

export function getPricing() {
  return api.get<PricingTable>('/api/v1/llm/pricing');
}

export function estimateCost(data: CostEstimateInput) {
  return api.post<CostEstimate>('/api/v1/llm/cost/estimate', data);
}