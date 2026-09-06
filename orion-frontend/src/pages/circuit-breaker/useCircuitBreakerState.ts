/**
 * useCircuitBreakerState.ts - 熔断器状态 Hook
 * 抽取自 CircuitBreakerPage.tsx (P2-9 Phase 81)
 */
import { useState, useEffect, useCallback } from 'react';
import { message, Form } from 'antd';
import {
  getCircuitBreakers,
  createCircuitBreaker,
  updateCircuitBreaker,
  deleteCircuitBreaker,
  resetCircuitBreaker,
  getCircuitBreakerStats,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
} from '@/api/circuit-breaker';

export const useCircuitBreakerState = () => {
  const [loading, setLoading] = useState(false);
  const [breakers, setBreakers] = useState<CircuitBreakerConfig[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingBreaker, setEditingBreaker] = useState<CircuitBreakerConfig | null>(null);
  const [selectedBreaker, setSelectedBreaker] = useState<CircuitBreakerConfig | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<CircuitBreakerStats | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const loadBreakers = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const response = await getCircuitBreakers();
      setBreakers(response.data || []);
    } catch (error: unknown) {
      const err = error as Error;
      setApiError(err.message);
      setBreakers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const response = await getCircuitBreakerStats();
      setStats(response.data || null);
    } catch {
      message.error('加载熔断器统计失败');
      setStats(null);
    }
  }, []);

  useEffect(() => {
    loadBreakers();
    loadStats();
  }, [loadBreakers, loadStats]);

  const filteredBreakers = breakers.filter((b) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!b.name.toLowerCase().includes(q) && !b.service.toLowerCase().includes(q)) return false;
    }
    if (stateFilter !== 'all' && b.state !== stateFilter) return false;
    return true;
  });

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      await createCircuitBreaker({
        name: values.name,
        service: values.service,
        endpoint: values.endpoint || undefined,
        failureThreshold: values.failureThreshold,
        successThreshold: values.successThreshold,
        timeoutSeconds: values.timeoutSeconds,
        halfOpenMaxRequests: values.halfOpenMaxRequests,
        enabled: values.enabled ?? true,
        state: 'closed',
      });
      message.success('熔断器创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      await loadBreakers();
      await loadStats();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`创建失败: ${error.message}`);
      } else {
        message.error('创建失败: 未知错误');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingBreaker) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      await updateCircuitBreaker(editingBreaker.id, {
        name: values.name,
        service: values.service,
        endpoint: values.endpoint || undefined,
        failureThreshold: values.failureThreshold,
        successThreshold: values.successThreshold,
        timeoutSeconds: values.timeoutSeconds,
        halfOpenMaxRequests: values.halfOpenMaxRequests,
      });
      message.success('配置更新成功');
      setEditModalVisible(false);
      setEditingBreaker(null);
      editForm.resetFields();
      await loadBreakers();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`更新失败: ${error.message}`);
      } else {
        message.error('更新失败: 未知错误');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (breaker: CircuitBreakerConfig) => {
    try {
      await deleteCircuitBreaker(breaker.id);
      message.success('熔断器已删除');
      await loadBreakers();
      await loadStats();
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  const handleReset = async (breaker: CircuitBreakerConfig) => {
    try {
      await resetCircuitBreaker(breaker.id);
      message.success('熔断器已重置');
      await loadBreakers();
      await loadStats();
    } catch (error: unknown) {
      message.error(`重置失败: ${(error as Error).message}`);
    }
  };

  const openEdit = (breaker: CircuitBreakerConfig) => {
    setEditingBreaker(breaker);
    editForm.setFieldsValue({
      name: breaker.name,
      service: breaker.service,
      endpoint: breaker.endpoint || '',
      failureThreshold: breaker.failureThreshold,
      successThreshold: breaker.successThreshold,
      timeoutSeconds: breaker.timeoutSeconds,
      halfOpenMaxRequests: breaker.halfOpenMaxRequests,
    });
    setEditModalVisible(true);
  };

  return {
    loading,
    breakers,
    setBreakers,
    searchQuery,
    setSearchQuery,
    stateFilter,
    setStateFilter,
    createModalVisible,
    setCreateModalVisible,
    editModalVisible,
    setEditModalVisible,
    detailModalVisible,
    setDetailModalVisible,
    editingBreaker,
    setEditingBreaker,
    selectedBreaker,
    setSelectedBreaker,
    createForm,
    editForm,
    submitting,
    stats,
    apiError,
    filteredBreakers,
    loadBreakers,
    loadStats,
    handleCreate,
    handleEdit,
    handleDelete,
    handleReset,
    openEdit,
  };
};
