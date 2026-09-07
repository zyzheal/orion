/**
 * Dashboard Core type definitions
 * 抽取自 index.tsx (P2-9 Phase 156)
 */
import type { TimelineEvent } from '@/components/Timeline';

/** KPI metric for the dashboard */
export interface DashboardKPI {
  id: string;
  title: string;
  value: string | number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  previousValue: string | number;
  color: string;
}

/** Quick action item */
export interface QuickActionItem {
  name: string;
  icon: string;
  path: string;
  color: string;
}

/** Dashboard data fetched from APIs */
export interface DashboardState {
  kpis: DashboardKPI[];
  events: TimelineEvent[];
  loading: boolean;
  error: Error | null;
}

/** System health service entry */
export interface SystemHealthItem {
  name: string;
  status: string;
  latency: string;
}

/** Efficiency API response structure */
export interface EfficiencyDashboardResponse {
  dashboard?: {
    dora?: {
      deploymentFrequency?: number;
      leadTimeForChanges?: number;
      meanTimeToRestore?: number;
      changeFailureRate?: number;
    };
    summary?: {
      totalDeployments?: number;
      successfulDeployments?: number;
      failedDeployments?: number;
    };
  };
}

/** Alerts API response structure */
export interface AlertsResponse {
  activeCount?: number;
  data?: Array<{
    id?: string;
    status?: string;
    metric?: string;
    message?: string;
    created_at?: string;
    firstTriggered?: string;
  }>;
}
