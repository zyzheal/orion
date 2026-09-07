/**
 * useAISecurityState - AI Security 页面状态 hook
 * 抽取自 index.tsx (P2-9 Phase 118)
 */
import { useState, useMemo, useEffect } from 'react';
import { Form, message } from 'antd';
import { colors } from '@/tokens';
import {
  getSecurityStats,
  getPolicies,
  getEvaluations,
  createPolicy,
  updatePolicy,
  deletePolicy,
  togglePolicy,
} from '@/api/ai-security';
import {
  mapApiPolicyToUI,
  mapApiEvalToUI,
  type UISecurityPolicy,
  type SecurityStats,
  type PolicyEvaluation,
} from './config';

export const useAISecurityState = () => {
  const [loading, setLoading] = useState(false);
  const [policies, setPolicies] = useState<UISecurityPolicy[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editPolicy, setEditPolicy] = useState<UISecurityPolicy | null>(null);
  const [evaluateModalVisible, setEvaluateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<UISecurityPolicy | null>(null);
  const [evaluations, setEvaluations] = useState<PolicyEvaluation[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [policiesRes, evaluationsRes] = await Promise.all([getPolicies(), getEvaluations()]);
      setPolicies((policiesRes.data as any).policies.map(mapApiPolicyToUI));
      setEvaluations((evaluationsRes.data as any).evaluations.map(mapApiEvalToUI));
    } catch (error: unknown) {
      message.error(`Failed to load security data: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await getSecurityStats();
      const apiStats = (response.data as any).stats;
      setStats({
        policiesActive: apiStats.policiesActive,
        requestsBlocked: apiStats.requestsBlocked,
        sensitiveDataDetected: 0,
        complianceScore: apiStats.complianceScore,
        totalViolations: 0,
        avgResponseTime: 0,
      });
    } catch (error: unknown) {
      message.error(`Failed to load security stats: ${(error as Error).message}`);
    }
  };

  useEffect(() => {
    loadData();
    loadStats();
  }, []);

  const filteredData = useMemo(() => {
    return policies.filter((p) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (filters.type && filters.type !== 'all' && p.type !== filters.type) return false;
      if (filters.status && filters.status !== 'all' && p.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, policies]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const rules =
        typeof values.rules === 'string'
          ? values.rules.split(',').map((r: string) => r.trim())
          : [];
      await createPolicy({
        name: values.name,
        description: values.description || '',
        type: values.type,
        enabled: values.enabled ?? true,
        severity: values.severity,
        rule: rules[0] || '',
        action: 'block',
        matchCount: 0,
      } as any);
      message.success('安全策略创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
      loadStats();
    } catch (error: unknown) {
      if (!(error instanceof Error && error.name === 'ValidationError')) {
        message.error(`创建失败：${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editPolicy) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      const rules =
        typeof values.rules === 'string'
          ? values.rules.split(',').map((r: string) => r.trim())
          : [];
      await updatePolicy(editPolicy.id, {
        name: values.name,
        description: values.description,
        type: values.type,
        enabled: values.enabled,
        severity: values.severity,
        rule: rules[0] || editPolicy.rules[0],
      });
      message.success('策略更新成功');
      setEditModalVisible(false);
      setEditPolicy(null);
      loadData();
    } catch (error: unknown) {
      if (!(error instanceof Error && error.name === 'ValidationError')) {
        message.error(`更新失败：${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePolicy(id);
      message.success('策略已删除');
      loadData();
      loadStats();
    } catch (error: unknown) {
      message.error(`删除策略失败：${(error as Error).message}`);
    }
  };

  const handleTogglePolicy = async (record: UISecurityPolicy) => {
    const newEnabled = !record.enabled;
    try {
      await togglePolicy(record.id, newEnabled);
      setPolicies((prev) =>
        prev.map((p) => (p.id === record.id ? { ...p, enabled: newEnabled } : p))
      );
      message.success(`策略 "${record.name}" 已${newEnabled ? '启用' : '禁用'}`);
    } catch (error: unknown) {
      message.error(`状态更新失败：${(error as Error).message}`);
    }
  };

  const handleEvaluate = async () => {
    try {
      setSubmitting(true);
      message.success('策略评估已启动，结果将稍后显示');
      setEvaluateModalVisible(false);
    } catch (error: unknown) {
      message.error(`评估启动失败：${(error as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (record: UISecurityPolicy) => {
    setEditPolicy(record);
    editForm.setFieldsValue({
      name: record.name,
      description: record.description,
      type: record.type,
      severity: record.severity,
      enabled: record.enabled,
      rules: record.rules.join(', '),
    });
    setEditModalVisible(true);
  };

  const openDetail = (record: UISecurityPolicy) => {
    setSelectedPolicy(record);
    setDetailModalVisible(true);
  };

  const getComplianceColor = (score: number): string => {
    if (score >= 90) return colors.success[500];
    if (score >= 70) return colors.warning[500];
    return colors.error[500];
  };

  return {
    loading, policies, stats,
    searchQuery, setSearchQuery,
    filters, setFilters,
    createModalVisible, setCreateModalVisible,
    editModalVisible, setEditModalVisible,
    editPolicy, setEditPolicy,
    evaluateModalVisible, setEvaluateModalVisible,
    detailModalVisible, setDetailModalVisible,
    selectedPolicy, setSelectedPolicy,
    evaluations, submitting,
    createForm, editForm,
    loadData, loadStats,
    filteredData,
    handleCreate, handleEdit, handleDelete, handleTogglePolicy, handleEvaluate,
    openEdit, openDetail,
    getComplianceColor,
  };
};

export type AISecurityState = ReturnType<typeof useAISecurityState>;
