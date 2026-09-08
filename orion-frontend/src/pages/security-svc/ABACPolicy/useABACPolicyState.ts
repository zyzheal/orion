/**
 * useABACPolicyState.ts - ABAC 策略状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 202)
 */
import { useState, useEffect } from 'react';
import { Form, message } from 'antd';
import {
  getAllPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  togglePolicy,
  type AbacPolicy,
} from '@/api/abac-policy';

export function useABACPolicyState() {
  const [loading, setLoading] = useState(false);
  const [policies, setPolicies] = useState<AbacPolicy[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<AbacPolicy | null>(null);
  const [form] = Form.useForm();

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const res = await getAllPolicies();
      setPolicies(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误';
      message.error('获取策略失败: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await createPolicy(values);
      message.success('策略创建成功');
      setModalOpen(false);
      form.resetFields();
      fetchPolicies();
    } catch (err: unknown) {
      if ((err as { errorFields?: unknown })?.errorFields) return;
      const msg = err instanceof Error ? err.message : '未知错误';
      message.error('创建失败: ' + msg);
    }
  };

  const handleUpdate = async () => {
    if (!selectedPolicy) return;
    try {
      const values = await form.validateFields();
      await updatePolicy(selectedPolicy.id, values);
      message.success('策略更新成功');
      setModalOpen(false);
      form.resetFields();
      setSelectedPolicy(null);
      fetchPolicies();
    } catch (err: unknown) {
      if (
        !(err instanceof Error) &&
        (err as { errorFields?: unknown })?.errorFields
      ) {
        return;
      }
      const msg = err instanceof Error ? err.message : '未知错误';
      message.error('更新失败: ' + msg);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePolicy(id);
      message.success('策略删除成功');
      fetchPolicies();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误';
      message.error('删除失败: ' + msg);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await togglePolicy(id);
      message.success('策略状态已切换');
      fetchPolicies();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误';
      message.error('切换失败: ' + msg);
    }
  };

  const openEdit = (policy: AbacPolicy) => {
    setSelectedPolicy(policy);
    form.setFieldsValue(policy);
    setModalOpen(true);
  };

  const openDetail = (policy: AbacPolicy) => {
    setSelectedPolicy(policy);
    setDrawerOpen(true);
  };

  const openCreate = () => {
    setSelectedPolicy(null);
    form.resetFields();
    setModalOpen(true);
  };

  const closeCreate = () => {
    setModalOpen(false);
    form.resetFields();
    setSelectedPolicy(null);
  };

  return {
    loading,
    policies,
    modalOpen,
    setModalOpen,
    drawerOpen,
    setDrawerOpen,
    selectedPolicy,
    setSelectedPolicy,
    form,
    fetchPolicies,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleToggle,
    openEdit,
    openDetail,
    openCreate,
    closeCreate,
  };
}
