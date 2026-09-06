/**
 * useFeatureFlagsState.ts - Feature Flags 页面状态管理
 * 抽取自 FeatureFlagsPage.tsx (P2-9 Phase 54)
 * 全部 state + loadFlags/loadStats + 7 handlers + filteredFlags memo
 * 表单 validateFields 由主页面 wrapper 负责，本 hook handler 接收 values/ID
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import {
  getFeatureFlags,
  createFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
  toggleFeatureFlag,
  evaluateFeatureFlag,
  getFeatureFlagStats,
  type FeatureFlag,
  type FeatureFlagStats,
} from '@/api/feature-flags';

// ============================================================================
// Types
// ============================================================================

export interface CreateFlagInput {
  name?: string;
  key?: string;
  description?: string;
  type?: string;
  defaultValue?: unknown;
  strategy?: string;
  enabled?: boolean;
  tenantId?: string;
  userGroups?: string;
  percentage?: number;
}

export interface UpdateFlagInput {
  name?: string;
  key?: string;
  description?: string;
  type?: string;
  defaultValue?: unknown;
  strategy?: string;
  tenantId?: string;
  userGroups?: string;
  percentage?: number;
}

export interface EvaluateFlagInput {
  tenantId?: string;
  userId?: string;
  userGroups?: string;
}

// ============================================================================
// Helpers
// ============================================================================

const splitCsv = (s: string | undefined): string[] | undefined =>
  s ? s.split(',').map((x) => x.trim()).filter(Boolean) : undefined;

// ============================================================================
// Hook
// ============================================================================

export const useFeatureFlagsState = () => {
  // --- State ---
  const [loading, setLoading] = useState(false);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [evaluateModalVisible, setEvaluateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [evaluatingFlag, setEvaluatingFlag] = useState<FeatureFlag | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<FeatureFlagStats | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // --- Loaders ---

  const loadFlags = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const response = await getFeatureFlags();
      setFlags(response.data || []);
    } catch (error: unknown) {
      const err = error as Error;
      setApiError(err.message);
      setFlags([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const response = await getFeatureFlagStats();
      setStats(response.data || null);
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    loadFlags();
    loadStats();
  }, [loadFlags, loadStats]);

  // --- Memo ---

  const filteredFlags = useMemo(
    () =>
      flags.filter((f) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (!f.name.toLowerCase().includes(q) && !f.key.toLowerCase().includes(q)) return false;
        }
        if (typeFilter !== 'all' && f.type !== typeFilter) return false;
        if (strategyFilter !== 'all' && f.strategy !== strategyFilter) return false;
        return true;
      }),
    [flags, searchQuery, typeFilter, strategyFilter],
  );

  // --- Handlers ---

  const handleCreate = async (values: CreateFlagInput) => {
    setSubmitting(true);
    try {
      await createFeatureFlag({
        name: values.name as string,
        key: values.key as string,
        description: values.description || '',
        type: values.type as FeatureFlag['type'],
        defaultValue: String(values.defaultValue),
        strategy: (values.strategy || 'default') as FeatureFlag['strategy'],
        enabled: values.enabled ?? true,
        tenantId: values.tenantId || undefined,
        userGroups: splitCsv(values.userGroups),
        percentage: values.percentage || undefined,
      });
      message.success('特性开关创建成功');
      setCreateModalVisible(false);
      await loadFlags();
      await loadStats();
    } catch (error: unknown) {
      message.error(`创建失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (values: UpdateFlagInput) => {
    if (!editingFlag) return;
    setSubmitting(true);
    try {
      await updateFeatureFlag(editingFlag.id, {
        name: values.name as string,
        key: values.key as string,
        description: values.description,
        type: values.type as FeatureFlag['type'],
        defaultValue: String(values.defaultValue),
        strategy: values.strategy as FeatureFlag['strategy'],
        tenantId: values.tenantId || undefined,
        userGroups: splitCsv(values.userGroups),
        percentage: values.percentage || undefined,
      });
      message.success('特性开关更新成功');
      setEditModalVisible(false);
      setEditingFlag(null);
      await loadFlags();
    } catch (error: unknown) {
      message.error(`更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (flag: FeatureFlag) => {
    try {
      await deleteFeatureFlag(flag.id);
      message.success('特性开关已删除');
      await loadFlags();
      await loadStats();
    } catch (error: unknown) {
      message.error(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleToggle = async (flag: FeatureFlag, enabled: boolean) => {
    try {
      await toggleFeatureFlag(flag.id, enabled);
      setFlags((prev) => prev.map((f) => (f.id === flag.id ? { ...f, enabled } : f)));
      message.success(`"${flag.name}" 已${enabled ? '启用' : '禁用'}`);
      await loadStats();
    } catch (error: unknown) {
      message.error(`操作失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleEvaluate = async (values: EvaluateFlagInput) => {
    if (!evaluatingFlag) return;
    setSubmitting(true);
    try {
      const result = await evaluateFeatureFlag(evaluatingFlag.id, {
        tenantId: values.tenantId || undefined,
        userId: values.userId || undefined,
        userGroups: splitCsv(values.userGroups),
      });
      setEvaluationResult(String(result.data?.result ?? '未知'));
      message.success('评估完成');
    } catch (error: unknown) {
      message.error(`评估失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (flag: FeatureFlag) => {
    setEditingFlag(flag);
    setEditModalVisible(true);
  };

  const handleOpenEvaluate = (flag: FeatureFlag) => {
    setEvaluatingFlag(flag);
    setEvaluationResult(null);
    setEvaluateModalVisible(true);
  };

  const handleViewDetail = (flag: FeatureFlag) => {
    setSelectedFlag(flag);
    setDetailModalVisible(true);
  };

  // --- Returns ---

  return {
    // State
    loading,
    flags,
    searchQuery, setSearchQuery,
    typeFilter, setTypeFilter,
    strategyFilter, setStrategyFilter,
    createModalVisible, setCreateModalVisible,
    editModalVisible, setEditModalVisible,
    evaluateModalVisible, setEvaluateModalVisible,
    detailModalVisible, setDetailModalVisible,
    editingFlag, setEditingFlag,
    selectedFlag, setSelectedFlag,
    evaluatingFlag, setEvaluatingFlag,
    submitting,
    stats,
    evaluationResult,
    apiError,
    // Memo
    filteredFlags,
    // Loaders
    loadFlags,
    loadStats,
    // Handlers
    handleCreate,
    handleEdit,
    handleDelete,
    handleToggle,
    handleEvaluate,
    handleOpenEdit,
    handleOpenEvaluate,
    handleViewDetail,
  };
};
