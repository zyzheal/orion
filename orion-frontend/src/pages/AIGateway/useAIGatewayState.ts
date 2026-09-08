/**
 * useAIGatewayState.ts - AI Gateway 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 219)
 */
import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import {
  getAllHealth,
  getRules,
  getGatewayStatus,
  getEngineStatus,
  type AIGatewayHealth,
} from '@/api/ai-gateway';

export function useAIGatewayState() {
  const [loading, setLoading] = useState(false);
  const [healthData, setHealthData] = useState<AIGatewayHealth[]>([]);
  const [gatewayStatus, setGatewayStatus] = useState<{ status: string } | null>(null);
  const [engineStatus, setEngineStatus] = useState<{
    cacheEnabled: boolean;
    auditEnabled: boolean;
  } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rules, setRules] = useState<any>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, statusRes, engineRes, rulesRes] = await Promise.all([
        getAllHealth(),
        getGatewayStatus(),
        getEngineStatus(),
        getRules(),
      ]);
      setHealthData(healthRes.data.health || []);
      setGatewayStatus(statusRes.data);
      setEngineStatus(engineRes.data);
      setRules(rulesRes.data.rules);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载 AI Gateway 数据失败：${error.message}`);
      } else {
        message.error('加载 AI Gateway 数据失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    loading,
    healthData,
    gatewayStatus,
    engineStatus,
    rules,
    loadData,
  };
}
