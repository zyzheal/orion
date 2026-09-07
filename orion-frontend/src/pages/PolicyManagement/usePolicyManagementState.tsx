/**
 * PolicyManagement state hook
 * 抽取自 index.tsx (P2-9 Phase 114)
 */
import { useState, useMemo, useEffect } from 'react';
import { Form, message } from 'antd';
import {
  getPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  togglePolicy,
  getPolicyViolations,
  resolveViolation,
  evaluatePolicy,
} from '@/api/policies';
import type { PolicyDefinition, PolicyViolation, PolicyInput } from '@/api/policies';

export interface EvaluateFormValues {
  policyId: string;
  input?: string;
}

export const usePolicyManagementState = () => {
  const [loading, setLoading] = useState(false);
  const [policies, setPolicies] = useState<PolicyDefinition[]>([]);
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [policyModalVisible, setPolicyModalVisible] = useState(false);
  const [evaluateModalVisible, setEvaluateModalVisible] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyDefinition | null>(null);
  const [policySubmitting, setPolicySubmitting] = useState(false);
  const [evalSubmitting, setEvalSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [evalForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [policyRes, violationRes] = await Promise.all([getPolicies(), getPolicyViolations()]);
      setPolicies(Array.isArray(policyRes.data) ? policyRes.data : []);
      setViolations(Array.isArray(violationRes.data) ? violationRes.data : []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to load policy data：${error.message}`);
      } else {
        message.error('Failed to load policy data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredPolicies = useMemo(() => {
    return policies.filter((p) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.description || '').toLowerCase().includes(q))
          return false;
      }
      if (filters.category && filters.category !== 'all' && p.category !== filters.category)
        return false;
      if (filters.severity && filters.severity !== 'all' && p.severity !== filters.severity)
        return false;
      return true;
    });
  }, [searchQuery, filters, policies]);

  const openViolations = violations.filter((v) => v.status === 'open').length;
  const blockedViolations = violations.filter((v) => v.severity === 'block').length;

  const handleSavePolicy = async (values: Record<string, unknown>) => {
    setPolicySubmitting(true);
    try {
      const payload: PolicyInput = {
        name: String(values.name),
        description: values.description ? String(values.description) : undefined,
        category: values.category as PolicyInput['category'],
        regoPath: String(values.regoPath),
        gateId: values.gateId ? String(values.gateId) : undefined,
        severity: values.severity as PolicyInput['severity'],
        enabled: true,
      };
      if (editingPolicy) {
        await updatePolicy(editingPolicy.id, payload);
        message.success('Policy updated');
      } else {
        await createPolicy(payload);
        message.success('Policy created');
      }
      setPolicyModalVisible(false);
      setEditingPolicy(null);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to save policy：${error.message}`);
      } else {
        message.error('Failed to save policy');
      }
    } finally {
      setPolicySubmitting(false);
    }
  };

  const handleTogglePolicy = async (policy: PolicyDefinition) => {
    try {
      await togglePolicy(policy.id);
      message.success(`Policy ${policy.enabled ? 'disabled' : 'enabled'}`);
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to toggle policy：${error.message}`);
      } else {
        message.error('Failed to toggle policy');
      }
    }
  };

  const handleDeletePolicy = async (id: string) => {
    try {
      await deletePolicy(id);
      message.success('Policy deleted');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to delete policy：${error.message}`);
      } else {
        message.error('Failed to delete policy');
      }
    }
  };

  const handleEvaluate = async (values: EvaluateFormValues) => {
    setEvalSubmitting(true);
    try {
      const inputContext: Record<string, unknown> = values.input ? JSON.parse(values.input) : {};
      await evaluatePolicy({ policyId: values.policyId, input: inputContext });
      message.success('Policy evaluated');
      setEvaluateModalVisible(false);
      evalForm.resetFields();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to evaluate policy：${error.message}`);
      } else {
        message.error('Failed to evaluate policy');
      }
    } finally {
      setEvalSubmitting(false);
    }
  };

  const handleResolveViolation = async (id: string) => {
    try {
      await resolveViolation(id);
      message.success('Violation resolved');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to resolve violation：${error.message}`);
      } else {
        message.error('Failed to resolve violation');
      }
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
    policyModalVisible,
    setPolicyModalVisible,
    evaluateModalVisible,
    setEvaluateModalVisible,
    editingPolicy,
    setEditingPolicy,
    policySubmitting,
    evalSubmitting,
    form,
    evalForm,
    filteredPolicies,
    openViolations,
    blockedViolations,
    loadData,
    handleSavePolicy,
    handleTogglePolicy,
    handleDeletePolicy,
    handleEvaluate,
    handleResolveViolation,
  };
};

export type PolicyManagementState = ReturnType<typeof usePolicyManagementState>;
