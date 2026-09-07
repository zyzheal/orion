/**
 * Dashboard Core state hook
 * 抽取自 index.tsx (P2-9 Phase 156)
 */
import { useEffect, useState } from 'react';
import { message } from 'antd';
import { colors } from '@/tokens';
import {
  DEFAULT_ALERT_STATE_SYSTEM_HEALTH,
  DEFAULT_SYSTEM_HEALTH,
} from './constants';
import { fetchDashboardData, fetchSystemHealth } from './api';
import type { DashboardState, SystemHealthItem } from './types';

export function useDashboardCoreState() {
  const [state, setState] = useState<DashboardState>({
    kpis: [],
    events: [],
    loading: true,
    error: null,
  });
  const [systemHealth, setSystemHealth] = useState<SystemHealthItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setState({ kpis: [], events: [], loading: true, error: null });

      try {
        const result = await fetchDashboardData();

        if (cancelled) return;

        const { kpis, events } = result;

        // Fill in defaults if APIs returned empty
        if (kpis.length === 0) {
          kpis.push(
            {
              id: 'pipeline-success-rate',
              title: 'Pipeline 成功率',
              value: '0.0',
              unit: '%',
              trend: 'stable',
              trendPercent: 0,
              previousValue: '0.0',
              color: colors.success[500],
            },
            {
              id: 'deployment-frequency',
              title: '部署频率',
              value: 0,
              unit: '次/周',
              trend: 'stable',
              trendPercent: 0,
              previousValue: 0,
              color: colors.primary[500],
            },
            {
              id: 'active-alerts',
              title: '活跃告警',
              value: 0,
              unit: '个',
              trend: 'stable',
              trendPercent: 0,
              previousValue: 0,
              color: colors.warning[500],
            },
          );
        }
        if (kpis.length < 4) {
          kpis.push({
            id: 'system-health',
            title: '系统健康度',
            value: '99.8',
            unit: '%',
            trend: 'stable',
            trendPercent: 0,
            previousValue: '99.8',
            color: colors.purple[500],
          });
        }

        // Fetch system health from service-health API
        try {
          const mapped = await fetchSystemHealth();
          if (mapped.length > 0) {
            setSystemHealth(mapped);
          } else {
            setSystemHealth(DEFAULT_SYSTEM_HEALTH);
          }
        } catch {
          message.warning('系统健康数据加载失败，显示默认状态');
          setSystemHealth(DEFAULT_ALERT_STATE_SYSTEM_HEALTH);
        }

        setState({ kpis, events, loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setState({
          kpis: [],
          events: [],
          loading: false,
          error: err instanceof Error ? err : new Error('加载仪表盘数据失败'),
        });
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  return { state, systemHealth };
}

export type DashboardCoreState = ReturnType<typeof useDashboardCoreState>;
