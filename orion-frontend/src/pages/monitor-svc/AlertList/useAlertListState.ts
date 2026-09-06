/**
 * useAlertListState.ts - Alert List 状态 Hook
 * 抽取自 AlertList/index.tsx (P2-9 Phase 53)
 * 全部 state + loadAlerts + 7 handlers + 4 memos (filteredAlerts/filterDefs/severityCounts/batchableCount)
 * + severityConfig/statusConfig 常量
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { message } from 'antd';
import {
  getAlerts,
  acknowledgeAlert as apiAcknowledgeAlert,
  resolveAlert as apiResolveAlert,
  getAlertExplain,
  type AlertExplanation,
} from '@/api/alerts';
import type { Alert, AlertSeverity, AlertStatus } from '@/types/pages';
import type { FilterDefinition } from '@/components/SearchFilterBar';
import { colors } from '@/tokens';

// ============================================================================
// Constants
// ============================================================================

export const severityConfig: Record<AlertSeverity, { color: string; label: string; icon: string }> =
  {
    critical: { color: colors.error[500], label: '严重', icon: '⚠' },
    warning: { color: colors.warning[500], label: '警告', icon: '⚡' },
    info: { color: colors.primary[500], label: '提示', icon: 'ℹ' },
  };

export const statusConfig: Record<AlertStatus, { color: string; label: string }> = {
  active: { color: 'red', label: '活跃' },
  acknowledged: { color: 'orange', label: '已确认' },
  resolved: { color: 'green', label: '已解决' },
  suppressed: { color: 'default', label: '已抑制' },
};

// ============================================================================
// Hook
// ============================================================================

export const useAlertListState = () => {
  // --- State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<AlertExplanation | null>(null);

  // ============================================================================
  // Fetchers
  // ============================================================================

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

  // ============================================================================
  // Memos
  // ============================================================================

  // Filter alerts based on search and filters
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [alert.metric, alert.source, alert.message, alert.value]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      // Severity filter
      const severityFilter = filters.severity;
      if (severityFilter && severityFilter !== 'all' && alert.severity !== severityFilter) {
        return false;
      }

      // Status filter
      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all' && alert.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [searchQuery, filters, alerts]);

  // Filter definitions for SearchFilterBar
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

  // Count active alerts by severity
  const severityCounts = useMemo(
    () => ({
      critical: alerts.filter((a) => a.status === 'active' && a.severity === 'critical').length,
      warning: alerts.filter((a) => a.status === 'active' && a.severity === 'warning').length,
      info: alerts.filter((a) => a.status === 'active' && a.severity === 'info').length,
    }),
    [alerts],
  );

  // Count active alerts that can be batch operated
  const batchableCount = useMemo(
    () =>
      alerts.filter(
        (a) =>
          selectedRowKeys.includes(a.id) &&
          (a.status === 'active' || a.status === 'acknowledged'),
      ).length,
    [alerts, selectedRowKeys],
  );

  // ============================================================================
  // Handlers
  // ============================================================================

  // Fetch AI explanation for the selected alert (TR-01).
  const handleExplain = useCallback(async (alertId: string) => {
    setExplaining(true);
    setExplanation(null);
    try {
      const res = await getAlertExplain(alertId);
      const data = (res.data as AlertExplanation | { explanation?: string } | undefined) ?? null;
      setExplanation(data as AlertExplanation | null);
      if (!data) {
        message.warning('该告警暂无解释内容');
      }
    } catch {
      message.error('获取 AI 解释失败，请稍后重试');
    } finally {
      setExplaining(false);
    }
  }, []);

  // Handle acknowledge
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

  // Handle resolve
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

  // Handle refresh
  const handleRefresh = useCallback(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Batch acknowledge selected alerts
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

  // Batch resolve selected alerts
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

  // Show alert detail modal
  const showDetail = useCallback((alert: Alert) => {
    setSelectedAlert(alert);
    setDetailModalVisible(true);
  }, []);

  return {
    // State
    searchQuery, setSearchQuery,
    filters, setFilters,
    loading,
    alerts, setAlerts,
    selectedAlert, setSelectedAlert,
    detailModalVisible, setDetailModalVisible,
    selectedRowKeys, setSelectedRowKeys,
    explaining,
    explanation,
    // Memos
    filteredAlerts,
    filterDefs,
    severityCounts,
    batchableCount,
    // Handlers
    loadAlerts,
    handleExplain,
    handleAcknowledge,
    handleResolve,
    handleRefresh,
    handleBatchAcknowledge,
    handleBatchResolve,
    showDetail,
  };
};
