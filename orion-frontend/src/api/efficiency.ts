/**
 * Efficiency Analytics API Service
 * DORA metrics and ClickHouse sync
 */
import { api } from './client';

export interface DoraMetrics {
  deploymentFrequency: string;
  leadTimeForChanges: number;
  changeFailureRate: number;
  meanTimeToRecovery: number;
}

export interface DoraMetricsResult {
  metrics: DoraMetrics;
  timeWindow: TimeWindowConfig;
  calculatedAt: string;
}

export interface TimeWindowConfig {
  window: 'day' | 'week' | 'month' | 'quarter';
  size: number;
  start: string;
  end: string;
}

export interface DoraBenchmarks {
  deploymentFrequency: {
    elite: string;
    high: string;
    medium: string;
    low: string;
  };
  leadTimeForChanges: {
    elite: string;
    high: string;
    medium: string;
    low: string;
  };
  changeFailureRate: {
    elite: string;
    high: string;
    medium: string;
    low: string;
  };
  meanTimeToRecovery: {
    elite: string;
    high: string;
    medium: string;
    low: string;
  };
}

export interface ClickHouseStatus {
  connected: boolean;
  host?: string;
  database?: string;
  lastSyncAt?: string;
  syncedRecords: number;
}

export interface EfficiencyDashboard {
  dora: DoraMetrics;
  trends: {
    deploymentFrequency: number;
    leadTime: number;
    mttr: number;
    changeFailureRate: number;
  };
  summary: {
    totalDeployments: number;
    successfulDeployments: number;
    failedDeployments: number;
  };
}

export interface DoraMetricsQuery {
  projectId?: string;
  teamId?: string;
  from?: string;
  to?: string;
  interval?: 'daily' | 'weekly' | 'monthly';
}

// ==================== DORA Metrics ====================

export function getDoraMetrics(query?: DoraMetricsQuery) {
  return api.get<DoraMetricsResult>('/v1/efficiency/dora/metrics', { params: query });
}

export function generateDoraReport(query?: DoraMetricsQuery & { format?: 'json' | 'pdf' }) {
  return api.post<{ report: any }>('/v1/efficiency/dora/report', query);
}

export function getDoraBenchmarks() {
  return api.get<DoraBenchmarks>('/v1/efficiency/dora/benchmarks');
}

// ==================== ClickHouse Sync ====================

export function getClickHouseStatus() {
  return api.get<ClickHouseStatus>('/v1/efficiency/clickhouse/status');
}

export function triggerClickHouseSync(full?: boolean) {
  return api.post<{ status: string; syncedAt: string }>('/v1/efficiency/clickhouse/sync', { full });
}

export function getClickHouseConfig() {
  return api.get<{ config: { enabled: boolean } }>('/v1/efficiency/clickhouse/config');
}

// ==================== Dashboard ====================

export function getEfficiencyDashboard(query?: { projectId?: string; teamId?: string }) {
  return api.get<EfficiencyDashboard>('/v1/efficiency/dashboard', { params: query });
}

// ==================== Team Comparison ====================

export interface TeamInfo {
  teamId: string;
  teamName: string;
}

export interface TeamMetrics {
  teamId: string;
  teamName: string;
  metrics: {
    deploymentFrequency: number;
    leadTimeMinutes: number | null;
    mttrMinutes: number | null;
    changeFailureRate: number;
  };
  score: number;
  level: 'elite' | 'high' | 'medium' | 'low';
}

export interface TeamComparisonResult {
  teams: TeamMetrics[];
  period: {
    start: string;
    end: string;
  };
}

export function getTeams() {
  return api.get<{ teams: TeamInfo[] }>('/v1/efficiency/teams');
}

export function getTeamComparison(query?: { teamIds?: string; interval?: 'daily' | 'weekly' | 'monthly' }) {
  return api.get<TeamComparisonResult>('/v1/efficiency/compare', { params: query });
}
