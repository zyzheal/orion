/**
 * Autonomous Pipeline API
 * Phase 2 - Error classification, adaptive timeout, auto-retry
 */
import { api } from './client';

// ---- Types ----

export interface ErrorClassification {
  id: string;
  pipelineId: string;
  runId: string;
  stageName: string;
  errorMessage: string;
  errorCode: string;
  category: 'infrastructure' | 'application' | 'network' | 'timeout' | 'permission' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestedAction: string;
  isRetryable: boolean;
  confidence: number;
  createdAt: string;
}

export interface ErrorStats {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  retryablePercent: number;
  topErrors: Array<{
    errorCode: string;
    message: string;
    count: number;
    category: string;
  }>;
}

export interface TimeoutConfig {
  stageName: string;
  suggestedTimeoutMs: number;
  historicalAvgMs: number;
  percentile95Ms: number;
  percentile99Ms: number;
  sampleSize: number;
}

export interface ExecutionRecord {
  pipelineId: string;
  stageName: string;
  durationMs: number;
  status: 'success' | 'failure' | 'timeout';
  recordedAt: string;
}

export interface RetryConfig {
  pipelineId: string;
  maxRetries: number;
  backoffMultiplier: number;
  initialDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];
}

export interface RetryStats {
  pipelineId: string;
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  successRate: number;
  avgRetriesPerRun: number;
  history: Array<{
    date: string;
    retries: number;
    successes: number;
  }>;
}

// ---- Error Classification API ----

export function classifyError(data: {
  pipelineId: string;
  runId: string;
  stageName: string;
  errorMessage: string;
  errorCode?: string;
}) {
  return api.post<ErrorClassification>('/api/autonomous/classify-error', data);
}

export function getErrorStats(params?: { pipelineId?: string; days?: number }) {
  return api.get<ErrorStats>('/api/autonomous/error-stats', { params });
}

// ---- Adaptive Timeout API ----

export function getTimeoutForStage(stageName: string) {
  return api.get<TimeoutConfig>(`/api/autonomous/timeout/${stageName}`);
}

export function recordExecution(data: {
  pipelineId: string;
  stageName: string;
  durationMs: number;
  status: 'success' | 'failure' | 'timeout';
}) {
  return api.post<ExecutionRecord>('/api/autonomous/record-execution', data);
}

// ---- Auto Retry API ----

export function getRetryStats(pipelineId: string) {
  return api.get<RetryStats>(`/api/autonomous/retry-stats/${pipelineId}`);
}

export function configureRetry(data: RetryConfig) {
  return api.post<RetryConfig>('/api/autonomous/configure-retry', data);
}

// ---- Self-Healing API ----

export interface SelfHealingRecommendation {
  action: string;
  description: string;
  confidence: number;
  steps: string[];
}

export interface SelfHealingAction {
  id: string;
  name: string;
  description: string;
  applicableErrorTypes: string[] | 'all';
  applicableStages: string[];
  autoExecutable: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

export function recommendSelfHealing(data: {
  errorMessage: string;
  stageName?: string;
  pipelineId?: string;
  retryCount?: number;
}) {
  return api.post<{
    classification: ErrorClassification;
    recommendations: SelfHealingRecommendation[];
    autoRetryable: boolean;
  }>('/api/autonomous/self-healing/recommend', data);
}

export function getSelfHealingActions(params?: { errorType?: string; stageName?: string }) {
  return api.get<{ actions: SelfHealingAction[]; total: number }>('/api/autonomous/self-healing/actions', { params });
}
