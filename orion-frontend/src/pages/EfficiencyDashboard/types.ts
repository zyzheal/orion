/**
 * types.ts - EfficiencyDashboard 类型定义
 * 抽取自 EfficiencyDashboard/index.tsx (P2-9 Phase 79)
 */
import type { ReactNode } from 'react';

export interface DoraBenchmarkCategory {
  elite: string;
  high: string;
  medium: string;
}

export interface DoraBenchmarks {
  deploymentFrequency: DoraBenchmarkCategory;
  leadTimeForChanges: DoraBenchmarkCategory;
  changeFailureRate: DoraBenchmarkCategory;
  meanTimeToRecovery: DoraBenchmarkCategory;
}

export interface DoraMetricsData {
  metrics?: {
    deploymentFrequency?: string;
    leadTimeForChanges?: number;
    changeFailureRate?: number;
    meanTimeToRecovery?: number;
  };
}

export interface ClickHouseStatusData {
  connected?: boolean;
  syncedRecords?: number;
  lastSyncAt?: string;
}

export interface DashboardDoraData {
  deploymentFrequency?: number;
  leadTime?: number;
  mttr?: number;
  changeFailureRate?: number;
}

export interface EfficiencyDashboardData {
  dora?: DashboardDoraData;
  trends?: {
    deploymentFrequency?: number;
    leadTime?: number;
    mttr?: number;
    changeFailureRate?: number;
  };
  summary?: {
    totalDeployments?: number;
    successfulDeployments?: number;
    failedDeployments?: number;
  };
}

export interface MetricRow {
  key: string;
  name: string;
  icon: ReactNode;
  currentValue: string;
  trend: string;
  level: string;
  benchmarkKey: string;
}
