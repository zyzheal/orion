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
  return api.get<DoraMetricsResult>('/efficiency/dora/metrics', { params: query });
}

export function generateDoraReport(query?: DoraMetricsQuery & { format?: 'json' | 'pdf' }) {
  return api.post<{ report: any }>('/efficiency/dora/report', query);
}

export function getDoraBenchmarks() {
  return api.get<DoraBenchmarks>('/efficiency/dora/benchmarks');
}

// ==================== ClickHouse Sync ====================

export function getClickHouseStatus() {
  return api.get<ClickHouseStatus>('/efficiency/clickhouse/status');
}

export function triggerClickHouseSync(full?: boolean) {
  return api.post<{ status: string; syncedAt: string }>('/efficiency/clickhouse/sync', { full });
}

export function getClickHouseConfig() {
  return api.get<{ config: { enabled: boolean } }>('/efficiency/clickhouse/config');
}

// ==================== Dashboard ====================

export function getEfficiencyDashboard(query?: { projectId?: string; teamId?: string }) {
  return api.get<{ dashboard: EfficiencyDashboard }>('/efficiency/dashboard', { params: query });
}

// ==================== Historical Trends ====================

export interface TrendHistoryPoint {
  week: string;
  deploymentFrequency: number;
  leadTime: number;
  mttr: number;
  changeFailureRate: number;
}

export function getDORTrends(query?: { tenantId?: string; weeks?: number }) {
  return api.get<{ trends: TrendHistoryPoint[] }>('/efficiency/trends', { params: query });
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
  return api.get<{ teams: TeamInfo[] }>('/efficiency/teams');
}

export function getTeamComparison(query?: { teamIds?: string; interval?: 'daily' | 'weekly' | 'monthly' }) {
  return api.get<TeamComparisonResult>('/efficiency/compare', { params: query });
}

// ==================== Developer Profiles ====================

export interface DeveloperProfile {
  id: string;
  name: string;
  team: string;
  role: string;
  commits: number;
  prs: number;
  reviews: number;
  bugsFixed: number;
  avgReviewTime: number;
  avgPRSize: number;
  codeQuality: number;
  activeDays: number;
  specialty: string[];
}

export function getDeveloperProfiles(params?: { tenantId?: string }) {
  return api.get<{ profiles: DeveloperProfile[] }>('/efficiency/developer-profiles', { params });
}

// ==================== Bottleneck Analysis ====================

export interface BottleneckItem {
  id: string;
  category: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  metric: string;
  currentValue: string;
  targetValue: string;
  suggestion: string;
}

export function getBottlenecks(params?: { tenantId?: string; timeWindow?: string; windowSize?: number }) {
  return api.get<{ bottlenecks: BottleneckItem[] }>('/efficiency/bottlenecks', { params });
}
