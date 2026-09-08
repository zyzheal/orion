/**
 * useAIDashboardState.ts - AI Dashboard 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 224)
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllHealth, type AIGatewayHealth } from '@/api/ai-gateway';
import { aiAgentApi } from '@/api/ai-agents';
import { listModels } from '@/api/ai-decision';
import { getDashboardData } from '@/api/ai-cost';
import { getSecurityStats } from '@/api/ai-security';

export interface AggregateStats {
  agentCount: number;
  modelCount: number;
  todayCost: number;
  complianceScore: number;
}

export function useAIDashboardState() {
  const navigate = useNavigate();
  const [healthData, setHealthData] = useState<AIGatewayHealth[]>([]);
  const [loading, setLoading] = useState(true);

  const [aggregateStats, setAggregateStats] = useState<AggregateStats>({
    agentCount: 0,
    modelCount: 0,
    todayCost: 0,
    complianceScore: 0,
  });
  const [aggregateLoading, setAggregateLoading] = useState(true);
  const [aggregateError, setAggregateError] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    try {
      const res = await getAllHealth();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (res as any)?.data?.health || (res as any)?.health || [];
      setHealthData(Array.isArray(data) ? data : []);
    } catch {
      // Silently fail — health data is optional
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAggregateStats = useCallback(async () => {
    try {
      const [agentsRes, modelsRes, costRes, securityRes] = await Promise.all([
        aiAgentApi.getList(),
        listModels({ status: 'active' }),
        getDashboardData(),
        getSecurityStats(),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const agents = (agentsRes as any)?.data || agentsRes || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const models = (modelsRes as any)?.data?.models || (modelsRes as any)?.models || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cost = (costRes as any)?.data || costRes;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const security = (securityRes as any)?.data || securityRes;

      setAggregateStats({
        agentCount: Array.isArray(agents) ? agents.length : 0,
        modelCount: Array.isArray(models) ? models.length : 0,
        todayCost: Number(cost?.todayCost) || 0,
        complianceScore: Number(security?.complianceScore) || 0,
      });
    } catch {
      setAggregateError('聚合数据加载失败，请稍后重试');
    } finally {
      setAggregateLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
    loadAggregateStats();
  }, [loadHealth, loadAggregateStats]);

  const healthyCount = healthData.filter((h) => h.isHealthy).length;
  const totalRequests = healthData.reduce((sum, h) => sum + (h.metrics?.totalRequests || 0), 0);
  const avgLatency =
    healthData.length > 0
      ? Math.round(
          healthData.reduce((sum, h) => sum + (h.metrics?.avgLatency || 0), 0) / healthData.length
        )
      : 0;

  const handleNavigate = useCallback(
    (route: string) => navigate(route),
    [navigate]
  );

  return {
    // State
    healthData,
    loading,
    aggregateStats,
    aggregateLoading,
    aggregateError,
    // Derived
    healthyCount,
    totalRequests,
    avgLatency,
    // Actions
    loadAggregateStats,
    handleNavigate,
  };
}
