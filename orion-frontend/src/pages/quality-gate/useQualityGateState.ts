/**
 * useQualityGateState.ts - 质量门禁状态 Hook
 * 抽取自 quality-gate/QualityGatePage.tsx (P2-9 Phase 77)
 */
import { useState, useMemo, useEffect } from 'react';
import { message, Form } from 'antd';
import {
  getPolicies,
  getPolicyViolations,
  waiveViolation,
  evaluateGate,
  type PolicyDefinition,
  type PolicyViolation,
} from '@/api/policies';

export const useQualityGateState = () => {
  const [loading, setLoading] = useState(false);
  const [policies, setPolicies] = useState<PolicyDefinition[]>([]);
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});

  // Gate evaluation
  const [gateModalVisible, setGateModalVisible] = useState(false);
  const [gateForm] = Form.useForm();
  const [gateResult, setGateResult] = useState<Record<string, unknown> | null>(null);
  const [gateLoading, setGateLoading] = useState(false);

  // Waive modal
  const [waiveModalVisible, setWaiveModalVisible] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState<PolicyViolation | null>(null);
  const [waiveForm] = Form.useForm();
  const [waiveLoading, setWaiveLoading] = useState(false);

  // Detail drawer
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyDefinition | null>(null);

  const loadPolicies = async () => {
    setLoading(true);
    try {
      const res = await getPolicies({ page: 1, pageSize: 100 });
      const raw = res.data;
      setPolicies(Array.isArray(raw) ? raw : []);
    } catch (error: unknown) {
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  const loadViolations = async () => {
    try {
      const res = await getPolicyViolations({ page: 1, pageSize: 100 });
      const raw = res.data;
      setViolations(Array.isArray(raw) ? raw : []);
    } catch (error: unknown) {
      setViolations([]);
    }
  };

  useEffect(() => {
    loadPolicies();
    loadViolations();
  }, []);

  const filteredViolations = useMemo(() => {
    return violations.filter((v) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !v.message.toLowerCase().includes(q) &&
          !(v.policyName && v.policyName.toLowerCase().includes(q)) &&
          !(v.resourceId && v.resourceId.toLowerCase().includes(q))
        )
          return false;
      }
      if (filters.severity && filters.severity !== 'all' && v.severity !== filters.severity)
        return false;
      if (filters.status && filters.status !== 'all' && v.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, violations]);

  // Stats
  const stats = useMemo(() => {
    const total = policies.length;
    const enabled = policies.filter((p) => p.enabled).length;
    const openViolations = violations.filter((v) => v.status === 'open').length;
    const blocked = violations.filter((v) => v.status === 'open' && v.severity === 'block').length;
    return { total, enabled, openViolations, blocked };
  }, [policies, violations]);

  const handleWaive = async () => {
    if (!selectedViolation) return;
    try {
      const values = await waiveForm.validateFields();
      setWaiveLoading(true);
      await waiveViolation(selectedViolation.id, {
        reason: values.reason,
        expiresAt: values.expiresAt,
        scope: values.scope || 'project',
      });
      message.success('豁免申请提交成功');
      setWaiveModalVisible(false);
      waiveForm.resetFields();
      loadViolations();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`豁免失败: ${(error as Error).message}`);
      }
    } finally {
      setWaiveLoading(false);
    }
  };

  const openWaiveModal = (v: PolicyViolation) => {
    setSelectedViolation(v);
    waiveForm.resetFields();
    setWaiveModalVisible(true);
  };

  const openPolicyDetail = (p: PolicyDefinition) => {
    setSelectedPolicy(p);
    setDetailDrawerVisible(true);
  };

  const handleEvaluateGate = async () => {
    try {
      const values = await gateForm.validateFields();
      setGateLoading(true);
      const res = await evaluateGate(values.gateId, {});
      const data = res.data;
      setGateResult(data && typeof data === 'object' ? (data as Record<string, unknown>) : null);
      message.success('门禁评估完成');
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`评估失败: ${(error as Error).message}`);
      }
    } finally {
      setGateLoading(false);
    }
  };

  return {
    loading,
    policies,
    violations,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    gateModalVisible,
    setGateModalVisible,
    gateForm,
    gateResult,
    gateLoading,
    waiveModalVisible,
    setWaiveModalVisible,
    selectedViolation,
    setSelectedViolation,
    waiveForm,
    waiveLoading,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedPolicy,

    filteredViolations,
    stats,
    loadPolicies,
    loadViolations,
    handleWaive,
    openWaiveModal,
    openPolicyDetail,
    handleEvaluateGate,
  };
};
