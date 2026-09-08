/**
 * useUEBAState.ts - UEBA 用户行为分析 状态 Hook
 * 抽取自 index.tsx (P2-9 Phase 242)
 */
import { useState, useEffect } from 'react';
import { message } from 'antd';
import { getHighRiskUsers, getAnomalies, type UEBAStats, type AnomalyAlert } from '@/api/ueba';

export function useUEBAState() {
  const [loading, setLoading] = useState(false);
  const [risks, setRisks] = useState<UEBAStats[]>([]);
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [hours, setHours] = useState(24);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [riskRes, alertRes] = await Promise.all([
        getHighRiskUsers(hours, 20),
        getAnomalies(hours),
      ]);
      setRisks(riskRes.data);
      setAlerts(alertRes.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误';
      message.error('获取数据失败: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours]);

  return {
    loading,
    risks,
    alerts,
    hours,
    setHours,
    fetchData,
  };
}
