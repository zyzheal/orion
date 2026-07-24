/**
 * ML Canary Analysis 数据模型
 */

import { v4 as uuidv4 } from 'uuid';

// ==================== CanaryAnalysisRun ====================

export type CanaryStatus = 'running' | 'promote' | 'rollback' | 'inconclusive';
export type CanaryDecision = 'promote' | 'rollback' | 'continue' | 'pending' | 'inconclusive';

export interface TrafficSplit {
  canary: number;
  baseline: number;
}

export interface CanaryAnalysisRun {
  id: string;
  deploymentId: string;
  runNumber: number;
  trafficSplit: TrafficSplit;
  status: CanaryStatus;
  confidence?: number;
  decision?: CanaryDecision;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
}

export interface CanaryAnalysisRunCreateInput {
  deploymentId: string;
  runNumber: number;
  trafficSplit: TrafficSplit;
}

export function createCanaryAnalysisRun(input: CanaryAnalysisRunCreateInput): CanaryAnalysisRun {
  const now = new Date();
  return {
    id: uuidv4(),
    deploymentId: input.deploymentId,
    runNumber: input.runNumber,
    trafficSplit: input.trafficSplit,
    status: 'running',
    startedAt: now,
  };
}

// ==================== CanaryMetricResult ====================

export type MetricVerdict = 'pass' | 'warn' | 'fail';
export type MetricCategory = 'latency' | 'error_rate' | 'throughput' | 'saturation';

export interface CanaryMetricResult {
  id: string;
  runId: string;
  metricName: string;
  baselineValue?: number;
  canaryValue?: number;
  mannWhitneyP?: number;
  ksStatistic?: number;
  cliffDelta?: number;
  verdict?: MetricVerdict;
  category?: MetricCategory;
}

export interface CanaryMetricResultCreateInput {
  runId: string;
  metricName: string;
  baselineValue?: number;
  canaryValue?: number;
  mannWhitneyP?: number;
  ksStatistic?: number;
  cliffDelta?: number;
  verdict?: MetricVerdict;
  category?: MetricCategory;
}

export function createCanaryMetricResult(input: CanaryMetricResultCreateInput): CanaryMetricResult {
  return {
    id: uuidv4(),
    runId: input.runId,
    metricName: input.metricName,
    baselineValue: input.baselineValue,
    canaryValue: input.canaryValue,
    mannWhitneyP: input.mannWhitneyP,
    ksStatistic: input.ksStatistic,
    cliffDelta: input.cliffDelta,
    verdict: input.verdict,
    category: input.category,
  };
}

// ==================== CanaryMLResult ====================

export interface CanaryMLResult {
  id: string;
  runId: string;
  modelName: string;
  prediction?: string;
  confidence?: number;
  shapExplanation?: Record<string, unknown>;
  clusterId?: number;
}

export interface CanaryMLResultCreateInput {
  runId: string;
  modelName: string;
  prediction?: string;
  confidence?: number;
  shapExplanation?: Record<string, unknown>;
  clusterId?: number;
}

export function createCanaryMLResult(input: CanaryMLResultCreateInput): CanaryMLResult {
  return {
    id: uuidv4(),
    runId: input.runId,
    modelName: input.modelName,
    prediction: input.prediction,
    confidence: input.confidence,
    shapExplanation: input.shapExplanation,
    clusterId: input.clusterId,
  };
}

// ==================== CanaryAnalysisConfig ====================

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
  excludedMetrics: string[];
  sloMetrics: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CanaryAnalysisConfigCreateInput {
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

export interface CanaryAnalysisConfigUpdateInput {
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

export function createCanaryAnalysisConfig(input: CanaryAnalysisConfigCreateInput): CanaryAnalysisConfig {
  const now = new Date();
  return {
    id: uuidv4(),
    serviceName: input.serviceName,
    environment: input.environment,
    analysisIntervalSec: input.analysisIntervalSec ?? 300,
    maxRounds: input.maxRounds ?? 5,
    warmupPeriodSec: input.warmupPeriodSec ?? 600,
    promoteThreshold: input.promoteThreshold ?? 0.75,
    rollbackThreshold: input.rollbackThreshold ?? 0.60,
    trafficStep: input.trafficStep ?? 20,
    metricWeights: input.metricWeights,
    excludedMetrics: input.excludedMetrics ?? [],
    sloMetrics: input.sloMetrics ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

// ==================== CanaryDecision ====================

export interface CanaryDecisionRecord {
  id: string;
  runId: string;
  decision: CanaryDecision;
  reason?: string;
  overriddenBy?: string;
  overrideReason?: string;
  decidedAt: Date;
}

export interface CanaryDecisionCreateInput {
  runId: string;
  decision: CanaryDecision;
  reason?: string;
  overriddenBy?: string;
  overrideReason?: string;
}

export function createCanaryDecision(input: CanaryDecisionCreateInput): CanaryDecisionRecord {
  const now = new Date();
  return {
    id: uuidv4(),
    runId: input.runId,
    decision: input.decision,
    reason: input.reason,
    overriddenBy: input.overriddenBy,
    overrideReason: input.overrideReason,
    decidedAt: now,
  };
}
