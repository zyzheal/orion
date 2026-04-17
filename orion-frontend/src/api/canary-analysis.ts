/**
 * ML Canary Analysis API Service
 * Analysis runs, metrics, configurations, and ML results
 */
import { api } from './client';

// ---- Types ----

export interface CanaryAnalysisRun {
  id: string;
  deploymentId: string;
  runNumber: number;
  trafficSplit: { canary: number; baseline: number };
  status: 'running' | 'promote' | 'rollback' | 'inconclusive';
  confidence?: number;
  decision?: 'promote' | 'rollback' | 'continue';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

export interface CanaryMetricResult {
  id: string;
  runId: string;
  metricName: string;
  baselineValue?: number;
  canaryValue?: number;
  mannWhitneyP?: number;
  ksStatistic?: number;
  cliffDelta?: number;
  verdict?: 'pass' | 'warn' | 'fail';
  category?: string;
}

export interface CanaryMlResult {
  id: string;
  runId: string;
  modelName: string;
  prediction: string;
  confidence?: number;
  shapExplanation?: Record<string, unknown>;
  clusterId?: number;
}

export interface CanaryAnalysisConfig {
  id: string;
  serviceName: string;
  environment: string;
  analysisIntervalSec: number;
  maxRounds: number;
  warmupPeriodSec: number;
  promoteThreshold: number;
  rollbackThreshold: number;
  trafficStep: number;
  metricWeights?: Record<string, number>;
  excludedMetrics?: string[];
  sloMetrics?: string[];
  createdAt: string;
  updatedAt: string;
}

// ---- Params ----

export interface CanaryRunListParams {
  deploymentId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface CanaryTriggerInput {
  deploymentId: string;
  roundNumber: number;
  config?: Partial<CanaryAnalysisConfig>;
}

export interface CanaryConfigInput {
  serviceName: string;
  environment: string;
  analysisIntervalSec?: number;
  maxRounds?: number;
  warmupPeriodSec?: number;
  promoteThreshold?: number;
  rollbackThreshold?: number;
  trafficStep?: number;
  metricWeights?: Record<string, number>;
  excludedMetrics?: string[];
  sloMetrics?: string[];
}

export interface ForceActionInput {
  runId: string;
  reason: string;
}

// ---- API Functions ----

export function getCanaryRuns(params?: CanaryRunListParams) {
  return api.get('/v1/canary-analysis/runs', { params });
}

export function getCanaryRun(id: string) {
  return api.get(`/v1/canary-analysis/runs/${id}`);
}

export function getCanaryMetrics(runId: string) {
  return api.get(`/v1/canary-analysis/runs/${runId}/metrics`);
}

export function getCanaryMlResults(runId: string) {
  return api.get(`/v1/canary-analysis/runs/${runId}/ml-results`);
}

export function triggerCanaryAnalysis(data: CanaryTriggerInput) {
  return api.post('/v1/canary-analysis/runs', data);
}

export function getCanaryConfigs(params?: { serviceName?: string; environment?: string }) {
  return api.get('/v1/canary-analysis/configs', { params });
}

export function getCanaryConfigByService(serviceName: string, environment: string) {
  return api.get(`/v1/canary-analysis/configs/${serviceName}/${environment}`);
}

export function createCanaryConfig(data: CanaryConfigInput) {
  return api.post('/v1/canary-analysis/configs', data);
}

export function updateCanaryConfig(id: string, data: Partial<CanaryConfigInput>) {
  return api.put(`/v1/canary-analysis/configs/${id}`, data);
}

export function deleteCanaryConfig(id: string) {
  return api.delete(`/v1/canary-analysis/configs/${id}`);
}

export function forcePromote(data: ForceActionInput) {
  return api.post('/v1/canary-analysis/force-promote', data);
}

export function forceRollback(data: ForceActionInput) {
  return api.post('/v1/canary-analysis/force-rollback', data);
}

export function discoverMetrics(params?: { serviceName?: string }) {
  return api.get('/v1/canary-analysis/metrics/discover', { params });
}

export function retrainCanaryModel(modelName?: string) {
  return api.post('/v1/canary-analysis/models/retrain', { modelName });
}
