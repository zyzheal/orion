/**
 * types.ts - CanaryAnalysis 类型定义
 * 抽取自 CanaryAnalysis/index.tsx (P2-9 Phase 80)
 */

export interface TriggerFormValues {
  deploymentId: string;
  roundNumber: number;
}

export interface ConfigFormValues {
  serviceName: string;
  environment: string;
  analysisIntervalSec: number;
  maxRounds: number;
  warmupPeriodSec: number;
  trafficStep: number;
  promoteThreshold: number;
  rollbackThreshold: number;
}
