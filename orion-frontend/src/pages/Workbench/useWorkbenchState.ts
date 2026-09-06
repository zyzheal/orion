/**
 * useWorkbenchState.ts - Workbench 状态 Hook
 * 抽取自 Workbench/WorkbenchPage.tsx (P2-9 Phase 65)
 */
import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { getWorkbenchData, acknowledgeAlert, type WorkbenchData } from '@/api/workbench';

export const useWorkbenchState = () => {
  const [data, setData] = useState<WorkbenchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getWorkbenchData();
      setData(result);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch workbench data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 60000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const handleAcknowledge = useCallback(
    async (alertId: string) => {
      try {
        await acknowledgeAlert(alertId);
        message.success('告警已确认');
        fetchData();
      } catch {
        message.error('确认告警失败');
      }
    },
    [fetchData],
  );

  return {
    data,
    loading,
    error,
    lastRefresh,
    fetchData,
    handleAcknowledge,
  };
};
