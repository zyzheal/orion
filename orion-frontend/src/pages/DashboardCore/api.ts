/**
 * Dashboard Core API/data-fetching helpers
 * 抽取自 index.tsx (P2-9 Phase 156)
 */
import { api } from '@/api/client';
import { getServiceHealthList } from '@/api/health';
import { colors } from '@/tokens';
import type { TimelineEvent } from '@/components/Timeline';
import type {
  AlertsResponse,
  DashboardKPI,
  EfficiencyDashboardResponse,
  SystemHealthItem,
} from './types';

export interface FetchDashboardResult {
  kpis: DashboardKPI[];
  events: TimelineEvent[];
  systemHealth: SystemHealthItem[];
}

export async function fetchDashboardData(): Promise<FetchDashboardResult> {
  const [efficiencyRes, alertsRes] = await Promise.allSettled([
    api.get('/efficiency/dashboard'),
    api.get('/alerts'),
  ]);

  const kpis: DashboardKPI[] = [];
  let events: TimelineEvent[] = [];

  if (efficiencyRes.status === 'fulfilled') {
    const efficiencyData = efficiencyRes.value.data as EfficiencyDashboardResponse | undefined;
    const dashboard = efficiencyData?.dashboard;
    if (dashboard?.dora) {
      const summary = dashboard.summary || {};
      const total = summary.totalDeployments || 0;
      const success = summary.successfulDeployments || 0;
      const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : '0.0';
      const prevSuccessRate = total > 0 ? ((success / total) * 95).toFixed(1) : '0.0';

      kpis.push({
        id: 'pipeline-success-rate',
        title: 'Pipeline 成功率',
        value: successRate,
        unit: '%',
        trend: 'up',
        trendPercent: 2.3,
        previousValue: prevSuccessRate,
        color: colors.success[500],
      });
    }

    if (dashboard?.dora?.deploymentFrequency !== undefined) {
      const df = dashboard.dora.deploymentFrequency;
      const weekly = Math.round(df * 7);
      kpis.push({
        id: 'deployment-frequency',
        title: '部署频率',
        value: weekly,
        unit: '次/周',
        trend: 'up',
        trendPercent: 12.1,
        previousValue: Math.round(weekly * 0.88),
        color: colors.primary[500],
      });
    }
  }

  if (alertsRes.status === 'fulfilled') {
    const alertsData = alertsRes.value.data as AlertsResponse | undefined;
    const activeCount =
      alertsData?.activeCount ??
      (Array.isArray(alertsData?.data)
        ? alertsData.data.filter((a) => a.status === 'active').length
        : 0);

    kpis.push({
      id: 'active-alerts',
      title: '活跃告警',
      value: activeCount,
      unit: '个',
      trend: activeCount > 0 ? 'up' : 'stable',
      trendPercent: 25,
      previousValue: Math.max(0, activeCount - 1),
      color: colors.warning[500],
    });

    if (Array.isArray(alertsData?.data)) {
      events = alertsData.data.slice(0, 5).map((a, i: number) => ({
        id: `alert-${a.id || i}`,
        title: `告警: ${a.metric || a.message || '未知指标'}`,
        description: a.message || '',
        time: a.created_at || a.firstTriggered || new Date().toISOString(),
        type: 'alert',
        status: a.status === 'active' ? 'warning' : 'success',
        user: 'system',
      }));
    }
  }

  return { kpis, events, systemHealth: [] };
}

export async function fetchSystemHealth(): Promise<SystemHealthItem[]> {
  const healthServices = await getServiceHealthList();
  const mapped = (Array.isArray(healthServices) ? healthServices : []).map((s) => ({
    name: s.serviceName,
    status: s.status === 'unhealthy' ? 'warning' : 'success',
    latency: s.latencyMs > 0 ? `${s.latencyMs}ms` : '-',
  }));
  return mapped;
}
