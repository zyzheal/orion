/**
 * Executive Dashboard data hook
 * 抽取自 index.tsx (P2-9 Phase 158)
 */
import { useMemo } from 'react';
import { colors } from '@/tokens';
import { WarningOutlined, ClockCircleOutlined, FireOutlined, TeamOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { KPIMetric, ExecutiveDashboardData as ExecDashboardData } from '@/types/pages';
import { useBiDashboard } from '@/hooks/useBiDashboard';
import { COLORS } from './constants';
import type { AlertCard } from './types';

export function useExecutiveDashboardData() {
  const { data: apiData, loading, error } = useBiDashboard('executive');

  const handleRetry = () => window.location.reload();

  const data = apiData as ExecDashboardData | undefined;
  const { overview, trends, teamRanking, alerts, distribution } =
    data ?? ({} as ExecDashboardData);

  const kpiMetrics: KPIMetric[] = useMemo(() => {
    if (!overview) return [];
    return [
      { title: '总工单数', value: overview.totalTickets ?? 0, suffix: '个', trend: { value: 12.5, direction: 'up' }, status: 'normal' },
      { title: '已解决', value: overview.resolvedTickets ?? 0, suffix: '个', trend: { value: 8.3, direction: 'up' }, status: 'success' },
      { title: '待处理', value: overview.openTickets ?? 0, suffix: '个', trend: { value: 3.2, direction: 'down' }, status: 'warning' },
      { title: '解决率', value: `${overview.overallResolutionRate ?? 0}%`, trend: { value: 2.1, direction: 'up' }, status: 'success' },
      { title: '平均解决时间', value: `${overview.avgResolutionTimeHours ?? 0}h`, trend: { value: 5.4, direction: 'down' }, status: 'success' },
      { title: 'SLA合规率', value: `${overview.slaComplianceRate ?? 0}%`, trend: { value: 1.2, direction: 'up' }, status: 'success' },
      { title: '工程师总数', value: overview.totalEngineers ?? 0, suffix: '人', status: 'normal' },
      { title: '活跃工程师', value: overview.activeEngineers ?? 0, suffix: '人', status: 'normal' },
    ];
  }, [overview]);

  const recentVolumeTrend = trends?.ticketVolumeTrend?.slice(-14) || [];

  const alertCards: AlertCard[] = [
    { title: 'SLA违规', value: alerts?.slaBreachedCount ?? 0, suffix: '个', color: COLORS.error, icon: <FireOutlined /> },
    { title: '超期工单', value: alerts?.overdueTicketsCount ?? 0, suffix: '个', color: COLORS.warning, icon: <ClockCircleOutlined /> },
    { title: '过载工程师', value: alerts?.overloadedEngineers ?? 0, suffix: '人', color: COLORS.warning, icon: <WarningOutlined /> },
    { title: '24h+未分配', value: alerts?.unassignedOlderThan24h ?? 0, suffix: '个', color: COLORS.info, icon: <TeamOutlined /> },
  ];

  const topPerformerColumns: ColumnsType<(typeof teamRanking.topPerformers)[0]> = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_, __, index) => (
        <span
          style={{
            display: 'inline-flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: 24,
            height: 24,
            borderRadius: 12,
            color: '#fff',
            backgroundColor:
              index === 0
                ? colors.warning[500]
                : index === 1
                  ? colors.neutral[400]
                  : colors.warning[700],
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {index + 1}
        </span>
      ),
    },
    { title: '工程师', dataIndex: 'name', key: 'name' },
    {
      title: '解决数',
      dataIndex: 'resolved',
      key: 'resolved',
      sorter: (a, b) => a.resolved - b.resolved,
    },
    {
      title: '综合评分',
      dataIndex: 'score',
      key: 'score',
      sorter: (a, b) => a.score - b.score,
      render: (score: number) => (
        <span style={{ fontWeight: 'bold', color: score >= 90 ? COLORS.success : COLORS.info }}>
          {score}
        </span>
      ),
    },
  ];

  return {
    loading,
    error,
    apiData,
    data,
    overview,
    trends,
    teamRanking,
    alerts,
    distribution,
    kpiMetrics,
    recentVolumeTrend,
    alertCards,
    topPerformerColumns,
    handleRetry,
  };
}

export type ExecutiveDashboardState = ReturnType<typeof useExecutiveDashboardData>;
