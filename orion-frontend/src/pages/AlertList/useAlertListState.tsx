/**
 * useAlertListState.tsx - AlertList 状态 Hook
 * 抽取自 AlertList/index.tsx (P2-9 Phase 64)
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { themeVars } from '@/tokens';
import { usePermissionActions } from '@/hooks/usePermissionActions';
import {
  getAlerts,
  acknowledgeAlert as apiAcknowledgeAlert,
  resolveAlert as apiResolveAlert,
} from '@/api/alerts';
import type { Alert, AlertStatus } from '@/types/pages';
import type { FilterDefinition } from '@/components/SearchFilterBar';

export const useAlertListState = () => {
  const { canExecute } = usePermissionActions('alert');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getAlerts();
      const apiData = response.data;
      setAlerts(
        Array.isArray(apiData) ? apiData : ((apiData as { items?: unknown[] })?.items ?? []),
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载告警列表失败：${error.message}`);
      } else {
        message.error('加载告警列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [alert.metric, alert.source, alert.message, alert.value]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      const severityFilter = filters.severity;
      if (severityFilter && severityFilter !== 'all' && alert.severity !== severityFilter) {
        return false;
      }
      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all' && alert.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [searchQuery, filters, alerts]);

  const filterDefs = useMemo<FilterDefinition[]>(
    () => [
      {
        key: 'severity',
        label: '严重级别',
        options: [
          { label: '全部', value: 'all' },
          { label: '严重', value: 'critical' },
          { label: '警告', value: 'warning' },
          { label: '提示', value: 'info' },
        ],
      },
      {
        key: 'status',
        label: '状态',
        options: [
          { label: '全部', value: 'all' },
          { label: '活跃', value: 'active' },
          { label: '已确认', value: 'acknowledged' },
          { label: '已解决', value: 'resolved' },
          { label: '已抑制', value: 'suppressed' },
        ],
      },
    ],
    [],
  );

  const severityCounts = useMemo(
    () => ({
      critical: alerts.filter((a) => a.status === 'active' && a.severity === 'critical').length,
      warning: alerts.filter((a) => a.status === 'active' && a.severity === 'warning').length,
      info: alerts.filter((a) => a.status === 'active' && a.severity === 'info').length,
    }),
    [alerts],
  );

  const handleAcknowledge = useCallback(async (alertId: string) => {
    try {
      await apiAcknowledgeAlert(alertId);
      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId
            ? {
                ...alert,
                status: 'acknowledged' as AlertStatus,
                acknowledgedBy: 'heal',
                acknowledgedAt: new Date().toISOString(),
              }
            : alert,
        ),
      );
      message.success('告警已确认');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`确认告警失败：${error.message}`);
      } else {
        message.error('确认告警失败，请稍后重试');
      }
    }
  }, []);

  const handleResolve = useCallback(async (alertId: string) => {
    try {
      await apiResolveAlert(alertId);
      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId
            ? {
                ...alert,
                status: 'resolved' as AlertStatus,
                resolvedBy: 'heal',
                resolvedAt: new Date().toISOString(),
              }
            : alert,
        ),
      );
      message.success('告警已解决');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`解决告警失败：${error.message}`);
      } else {
        message.error('解决告警失败，请稍后重试');
      }
    }
  }, []);

  const handleAIExplain = useCallback(async (record: Alert) => {
    try {
      const { assistantAsk } = await import('@/api/assistant');
      const resp = (await assistantAsk({
        question: `请解释以下告警：${record.metric} 当前值=${record.value} 阈值=${record.threshold}，消息：${record.message || ''}`,
        intent: 'alert',
        top_k: 3,
      })) as { answer?: string };
      if (resp && resp.answer) {
        message.success({
          content: (
            <div>
              <strong style={{ marginBottom: 4, display: 'block' }}>AI 告警分析</strong>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: 12,
                  background: themeVars.bgSecondary,
                  padding: 8,
                  borderRadius: 4,
                  maxHeight: 200,
                  overflow: 'auto',
                }}
              >
                {resp.answer}
              </pre>
            </div>
          ),
          duration: 10,
          key: `ai-explain-${record.id}`,
        });
      } else {
        message.info('暂无分析结果');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`AI 分析失败：${error.message}`);
      } else {
        message.error('AI 分析失败，请稍后重试');
      }
    }
  }, []);

  const handleRefresh = useCallback(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleBatchAcknowledge = useCallback(async () => {
    if (selectedRowKeys.length === 0) return;
    let successCount = 0;
    for (const key of selectedRowKeys) {
      try {
        await apiAcknowledgeAlert(key as string);
        setAlerts((prev) =>
          prev.map((alert) =>
            alert.id === key
              ? {
                  ...alert,
                  status: 'acknowledged' as AlertStatus,
                  acknowledgedBy: 'heal',
                  acknowledgedAt: new Date().toISOString(),
                }
              : alert,
          ),
        );
        successCount++;
      } catch {
        // Continue with others
      }
    }
    message.success(`已批量确认 ${successCount}/${selectedRowKeys.length} 条告警`);
    setSelectedRowKeys([]);
  }, [selectedRowKeys]);

  const handleBatchResolve = useCallback(async () => {
    if (selectedRowKeys.length === 0) return;
    let successCount = 0;
    for (const key of selectedRowKeys) {
      try {
        await apiResolveAlert(key as string);
        setAlerts((prev) =>
          prev.map((alert) =>
            alert.id === key
              ? {
                  ...alert,
                  status: 'resolved' as AlertStatus,
                  resolvedBy: 'heal',
                  resolvedAt: new Date().toISOString(),
                }
              : alert,
          ),
        );
        successCount++;
      } catch {
        // Continue with others
      }
    }
    message.success(`已批量解决 ${successCount}/${selectedRowKeys.length} 条告警`);
    setSelectedRowKeys([]);
  }, [selectedRowKeys]);

  const batchableCount = useMemo(
    () =>
      alerts.filter(
        (a) => selectedRowKeys.includes(a.id) && (a.status === 'active' || a.status === 'acknowledged'),
      ).length,
    [alerts, selectedRowKeys],
  );

  const showDetail = useCallback((alert: Alert) => {
    setSelectedAlert(alert);
    setDetailModalVisible(true);
  }, []);

  return {
    canExecute,
    searchQuery, setSearchQuery,
    filters, setFilters,
    loading,
    alerts,
    selectedAlert, setSelectedAlert,
    detailModalVisible, setDetailModalVisible,
    selectedRowKeys, setSelectedRowKeys,
    filteredAlerts,
    filterDefs,
    severityCounts,
    batchableCount,
    loadAlerts,
    handleAcknowledge,
    handleResolve,
    handleAIExplain,
    handleRefresh,
    handleBatchAcknowledge,
    handleBatchResolve,
    showDetail,
  };
};
