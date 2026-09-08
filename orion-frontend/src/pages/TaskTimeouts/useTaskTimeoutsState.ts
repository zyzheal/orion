/**
 * useTaskTimeoutsState.ts - 任务超时状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 200)
 */
import { useEffect, useState } from 'react';
import { message } from 'antd';
import {
  getTimedOutTasks,
  triggerCheckNow,
  getTimeoutStatus,
  TimedOutTask,
  TimeoutStatus,
} from '@/api/task-timeout';
import { useQuery } from '@/providers/QueryProvider';

export function useTaskTimeoutsState() {
  const [checking, setChecking] = useState(false);

  const {
    data: timedOutTasks = [],
    isLoading: loading,
    isError,
    error,
    refetch: fetchTimedOutTasks,
  } = useQuery<TimedOutTask[]>({
    queryKey: ['task-timeouts'],
    queryFn: async () => {
      const data = await getTimedOutTasks();
      return data || [];
    },
    staleTime: 30_000,
    retry: 0,
  });

  const {
    data: status = { isRunning: false, processedEventsCount: 0 },
    refetch: fetchStatus,
  } = useQuery<TimeoutStatus>({
    queryKey: ['task-timeout-status'],
    queryFn: async () => {
      const data = await getTimeoutStatus();
      return data || { isRunning: false, processedEventsCount: 0 };
    },
    staleTime: 30_000,
    retry: 0,
  });

  useEffect(() => {
    if (!isError) return;
    message.error(error instanceof Error ? error.message : '加载超时任务失败');
  }, [isError, error]);

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      const result = await triggerCheckNow();
      message.success(`检查完成，已处理 ${result?.checkedTasks || 0} 个超时任务`);
      fetchTimedOutTasks();
      fetchStatus();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '触发检查失败');
    } finally {
      setChecking(false);
    }
  };

  const handleRefresh = () => {
    fetchTimedOutTasks();
    fetchStatus();
  };

  return {
    timedOutTasks,
    loading,
    status,
    checking,
    handleCheckNow,
    handleRefresh,
    fetchTimedOutTasks,
    fetchStatus,
  };
}
