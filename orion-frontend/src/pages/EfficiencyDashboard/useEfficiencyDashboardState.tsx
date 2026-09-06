/**
 * useEfficiencyDashboardState.ts - 效能看板状态 Hook
 * 抽取自 EfficiencyDashboard/index.tsx (P2-9 Phase 79)
 */
import { useState, useEffect, useMemo } from 'react';
import { message } from 'antd';
import {
  getDoraMetrics,
  getDoraBenchmarks,
  getEfficiencyDashboard,
  getDORTrends,
  getClickHouseStatus,
  getTeams,
} from '@/api/efficiency';
import type { TeamInfo, TrendHistoryPoint } from '@/api/efficiency';
import { STORAGE_KEYS } from '@/constants/dora-guidance';
import type { TrendDataPoint, BarDataItem } from '@/components/charts';
import {
  type DoraMetricsData,
  type DoraBenchmarks,
  type DoraBenchmarkCategory,
  type ClickHouseStatusData,
  type EfficiencyDashboardData,
  type MetricRow,
} from './types';
import { ThunderboltOutlined, ClockCircleOutlined, CloseCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';

export const useEfficiencyDashboardState = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [doraMetrics, setDoraMetrics] = useState<DoraMetricsData | null>(null);
  const [benchmarks, setBenchmarks] = useState<DoraBenchmarks | null>(null);
  const [dashboardData, setDashboardData] = useState<EfficiencyDashboardData | null>(null);
  const [clickHouseStatus, setClickHouseStatus] = useState<ClickHouseStatusData | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [trendHistory, setTrendHistory] = useState<TrendHistoryPoint[]>([]);

  // Check if user has seen onboarding
  useEffect(() => {
    const hasSeen = localStorage.getItem(STORAGE_KEYS.hasSeenOnboarding);
    if (!hasSeen) {
      setShowOnboarding(true);
    }
  }, []);

  const handleCloseOnboarding = () => {
    localStorage.setItem(STORAGE_KEYS.hasSeenOnboarding, 'true');
    setShowOnboarding(false);
  };

  const trendData: TrendDataPoint[][] = useMemo(() => {
    if (trendHistory.length > 0) {
      const weeks = trendHistory.map((t) => t.week);
      return [
        weeks.map((period, i) => ({
          period,
          value: trendHistory[i].deploymentFrequency,
          label: '部署频率',
        })),
        weeks.map((period, i) => ({
          period,
          value: trendHistory[i].leadTime,
          label: '交付周期(h)',
        })),
        weeks.map((period, i) => ({ period, value: trendHistory[i].mttr, label: 'MTTR(h)' })),
      ];
    }
    const now = new Date();
    const weeks = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (11 - i) * 7);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
    const baseDeployFreq = dashboardData?.dora?.deploymentFrequency ?? 5;
    const baseLeadTime = dashboardData?.dora?.leadTime ?? 24;
    return [
      weeks.map((period, i) => {
        const variation = (Math.sin(i * 0.5) * 0.3 + 1) * baseDeployFreq * 0.7;
        return { period, value: Math.round(variation), label: '部署频率' };
      }),
      weeks.map((period, i) => {
        const variation = (Math.cos(i * 0.4) * 0.2 + 1) * baseLeadTime * 0.8;
        return { period, value: Math.round(variation), label: '交付周期(h)' };
      }),
      weeks.map((period, i) => {
        const variation = (1 - i * 0.05) * baseLeadTime * 0.3;
        return { period, value: Math.round(variation * 10) / 10, label: 'MTTR(h)' };
      }),
    ];
  }, [dashboardData, trendHistory]);

  const deploymentByTeam: BarDataItem[] = useMemo(() => {
    if (teams.length === 0) return [];
    const total = dashboardData?.summary?.totalDeployments ?? 0;
    if (total === 0) {
      return teams.map((t) => ({ label: t.teamName, value: 0 }));
    }
    const perTeam = Math.floor(total / teams.length);
    const remainder = total - perTeam * teams.length;
    return teams.map((t, i) => ({
      label: t.teamName,
      value: i === 0 ? perTeam + remainder : perTeam,
    }));
  }, [dashboardData, teams]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [metricsRes, benchmarksRes, dashboardRes, statusRes, teamsRes, trendsRes] =
        await Promise.all([
          getDoraMetrics(),
          getDoraBenchmarks(),
          getEfficiencyDashboard(),
          getClickHouseStatus(),
          getTeams(),
          getDORTrends({ weeks: 12 }),
        ]);
      setDoraMetrics(metricsRes.data);
      setBenchmarks(benchmarksRes.data);
      setDashboardData((dashboardRes.data as any)?.dashboard ?? dashboardRes.data);
      setClickHouseStatus(statusRes.data);
      setTeams(teamsRes.data?.teams || []);
      setTrendHistory(trendsRes.data?.trends || []);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载效能数据失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getLevel = (value: unknown, metricKey: string) => {
    if (!benchmarks || value === undefined) return '-';
    const category = (benchmarks as unknown as Record<string, DoraBenchmarkCategory>)[metricKey];
    if (!category) return '-';
    const strValue = String(value);
    if (metricKey === 'deploymentFrequency') {
      if (strValue.includes('day') || strValue.includes('hour')) return 'Elite';
      if (strValue.includes('week')) return 'High';
      if (strValue.includes('month')) return 'Medium';
      return 'Low';
    } else {
      const numValue = parseFloat(strValue) || 0;
      const elite = parseFloat(category.elite) || 0;
      const high = parseFloat(category.high) || 0;
      const medium = parseFloat(category.medium) || 0;
      if (numValue <= elite || numValue <= high) return 'Elite';
      if (numValue <= medium) return 'High';
      return 'Medium';
    }
  };

  const doraMetricsData: MetricRow[] = doraMetrics
    ? [
        {
          key: 'deploymentFrequency',
          name: '发布频率',
          icon: <ThunderboltOutlined />,
          currentValue: doraMetrics.metrics?.deploymentFrequency || '-',
          trend: 'up',
          level: getLevel(doraMetrics.metrics?.deploymentFrequency, 'deploymentFrequency'),
          benchmarkKey: 'deploymentFrequency',
        },
        {
          key: 'leadTimeForChanges',
          name: '变更前置时间',
          icon: <ClockCircleOutlined />,
          currentValue: `${doraMetrics.metrics?.leadTimeForChanges || '-'} 小时`,
          trend: 'down',
          level: getLevel(doraMetrics.metrics?.leadTimeForChanges, 'leadTimeForChanges'),
          benchmarkKey: 'leadTimeForChanges',
        },
        {
          key: 'changeFailureRate',
          name: '变更失败率',
          icon: <CloseCircleOutlined />,
          currentValue: `${(doraMetrics.metrics?.changeFailureRate || 0).toFixed(1)}%`,
          trend: 'down',
          level: getLevel(doraMetrics.metrics?.changeFailureRate, 'changeFailureRate'),
          benchmarkKey: 'changeFailureRate',
        },
        {
          key: 'meanTimeToRecovery',
          name: '服务恢复时间',
          icon: <CheckCircleOutlined />,
          currentValue: `${doraMetrics.metrics?.meanTimeToRecovery || '-'} 分钟`,
          trend: 'down',
          level: getLevel(doraMetrics.metrics?.meanTimeToRecovery, 'meanTimeToRecovery'),
          benchmarkKey: 'meanTimeToRecovery',
        },
      ]
    : [];

  return {
    loading,
    activeTab,
    setActiveTab,
    doraMetrics,
    benchmarks,
    dashboardData,
    clickHouseStatus,
    showOnboarding,
    setShowOnboarding,
    teams,
    trendData,
    deploymentByTeam,
    loadData,
    getLevel,
    doraMetricsData,
    handleCloseOnboarding,
  };
};
