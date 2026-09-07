/**
 * useHealthDashboardState - HealthDashboard 状态 hook
 * 抽取自 index.tsx (P2-9 Phase 126)
 */
import { useState, useEffect } from 'react';
import { message } from 'antd';
import {
  getHealthDashboard,
  type HealthAlert,
  type ServiceHealthRow,
  type TrendPoint,
} from '@/api/health';

export const useHealthDashboardState = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<{ score: number; level: string } | null>(null);
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [avgLatencyMs, setAvgLatencyMs] = useState(0);
  const [errorRate, setErrorRate] = useState(0);
  const [services, setServices] = useState<ServiceHealthRow[]>([]);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getHealthDashboard();
      setScore({ score: data.score.score, level: data.score.level });
      setActiveAlerts(data.activeAlerts);
      setAvgLatencyMs(data.avgLatencyMs);
      setErrorRate(data.errorRate);
      setServices(data.services);
      setAlerts(data.alerts);
      setTrend(data.trend);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载健康仪表盘数据失败';
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // 每 30 秒轮询
    const timer = setInterval(loadData, 30_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    loading,
    error,
    score,
    activeAlerts,
    avgLatencyMs,
    errorRate,
    services,
    alerts,
    trend,
    loadData,
  };
};

export type HealthDashboardState = ReturnType<typeof useHealthDashboardState>;
