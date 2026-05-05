/**
 * AI Decision API
 * Phase 2 - Decision explanation, model version management, A/B testing
 */
import { api } from './client';

// ---- Types ----

export interface DecisionExplanation {
  id: string;
  decisionType: string;
  decision: 'pass' | 'fail' | 'warn' | 'manual_review';
  confidence: number;
  explanation: string;
  factors: DecisionFactor[];
  createdAt: string;
}

export interface DecisionFactor {
  name: string;
  importance: number;
  direction: 'positive' | 'negative' | 'neutral';
  description: string;
}

export interface FeatureImportance {
  decisionId: string;
  features: Array<{
    name: string;
    importance: number;
    valueType: string;
  }>;
}

export interface ConfidenceExplanation {
  level: string;
  score: number;
  interpretation: string;
  recommendation: string;
}

export interface ModelVersion {
  id: string;
  name: string;
  version: string;
  status: 'active' | 'deprecated' | 'testing';
  framework: string;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ABTestResult {
  modelName: string;
  variantA: {
    modelId: string;
    trafficPercent: number;
    successRate: number;
    avgLatency: number;
  };
  variantB: {
    modelId: string;
    trafficPercent: number;
    successRate: number;
    avgLatency: number;
  };
  winner: 'A' | 'B' | 'inconclusive';
  confidence: number;
}

export interface ModelPerformance {
  modelName: string;
  totalDecisions: number;
  accuracy: number;
  avgConfidence: number;
  avgLatencyMs: number;
  errorRate: number;
  dailyTrend: Array<{ date: string; accuracy: number; decisions: number }>;
}

export interface ExplainRequest {
  decisionId: string;
  decisionType: string;
  decision: 'pass' | 'fail' | 'warn' | 'manual_review';
  features: Array<{ name: string; value: number }>;
  confidence?: number;
  threshold?: number;
  context?: Record<string, unknown>;
}

// ---- Decision Explanation API ----

export function explainDecision(data: ExplainRequest) {
  return api.post<DecisionExplanation>('/v1/ai-decisions/explain', data);
}

export function getFeatureImportance(decisionId: string, features?: string) {
  return api.get<FeatureImportance>(`/v1/ai-decisions/${decisionId}/feature-importance`, {
    params: { features },
  });
}

export function getConfidenceExplanation(level: string, score?: number) {
  return api.get<ConfidenceExplanation>(`/v1/ai-decisions/confidence/${level}`, {
    params: { score },
  });
}

// ---- Model Version API ----

export function listModels(params?: { status?: string; framework?: string; name?: string }) {
  return api.get<{ models: ModelVersion[] }>('/v1/ai-models', { params });
}

export function getModel(modelId: string) {
  return api.get<ModelVersion>(`/v1/ai-models/${modelId}`);
}

export function registerModel(data: {
  name: string;
  version: string;
  framework: string;
  metrics?: { accuracy?: number; precision?: number; recall?: number; f1Score?: number };
}) {
  return api.post<ModelVersion>('/v1/ai-models', data);
}

export function activateModel(modelId: string) {
  return api.post(`/v1/ai-models/${modelId}/activate`);
}

export function deprecateModel(modelId: string) {
  return api.post(`/v1/ai-models/${modelId}/deprecate`);
}

export function getModelVersions(modelName: string, includeDeprecated?: boolean) {
  return api.get<{ versions: ModelVersion[] }>(`/v1/ai-models/${modelName}/versions`, {
    params: { include_deprecated: includeDeprecated },
  });
}

export function getABTestResults(modelName: string) {
  return api.get<ABTestResult>(`/v1/ai-models/${modelName}/ab-test`);
}

export function getModelPerformance(modelName: string) {
  return api.get<ModelPerformance>(`/v1/ai-models/${modelName}/performance`);
}

// ---- Explanation History API ----

export interface MatchedRule {
  id: string;
  name: string;
  condition: string;
  matched: boolean;
  contribution?: number;
}

export interface ExplanationWithRules extends DecisionExplanation {
  matchedRules?: MatchedRule[];
}

export function getExplanationById(decisionId: string) {
  return api.get<ExplanationWithRules>(`/v1/ai-decisions/explanations/${decisionId}`);
}

export function getExplanationHistory(params?: { limit?: number; decisionType?: string }) {
  return api.get<ExplanationWithRules[]>('/v1/ai-decisions/explanations/history', { params });
}

// ---- Model Rollback API ----

export function rollbackModel(modelId: string, targetVersion?: string) {
  return api.post(`/v1/ai-models/${modelId}/rollback`, { targetVersion });
}
