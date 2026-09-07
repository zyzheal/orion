/**
 * TenantQuotaPage state hook
 * 抽取自 index.tsx (P2-9 Phase 136)
 */
import { useCallback, useEffect, useState } from 'react';
import { Form, Modal, message } from 'antd';
import {
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  listUsage,
  listAlerts,
  checkQuota,
  type QuotaPlan,
  type QuotaUsage,
  type QuotaAlert,
} from '@/api/tenantQuota';

export const useTenantQuotaState = () => {
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<QuotaPlan | null>(null);
  const [form] = Form.useForm();

  const [plans, setPlans] = useState<QuotaPlan[]>([]);
  const [usages, setUsages] = useState<QuotaUsage[]>([]);
  const [alerts, setAlerts] = useState<QuotaAlert[]>([]);
  const [status, setStatus] = useState<string>('');

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPlans();
      setPlans(Array.isArray(data) ? data : []);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsage = useCallback(async () => {
    try {
      const data = await listUsage();
      setUsages(Array.isArray(data) ? data : []);
    } catch {
      setUsages([]);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await listAlerts();
      setAlerts(Array.isArray(data) ? data : []);
    } catch {
      setAlerts([]);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);
  useEffect(() => {
    loadUsage();
  }, [loadUsage]);
  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleCreate = () => {
    setSelectedPlan(null);
    form.resetFields();
    setModalOpen(true);
  };
  const handleEdit = (r: QuotaPlan) => {
    setSelectedPlan(r);
    form.setFieldsValue(r);
    setModalOpen(true);
  };
  const handleViewDetail = (r: QuotaPlan) => {
    setSelectedPlan(r);
    setDetailOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (selectedPlan) {
        await updatePlan(selectedPlan.id, values);
        message.success('配额计划更新成功');
      } else {
        await createPlan(values);
        message.success('配额计划创建成功');
      }
      setModalOpen(false);
      form.resetFields();
      loadPlans();
    } catch {
      /* validated */
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复',
      onOk: async () => {
        try {
          await deletePlan(id);
          message.success('删除成功');
          loadPlans();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleCheckQuota = async (metric: string) => {
    try {
      const result = await checkQuota(metric, 1);
      message.info(
        `${result.metric}: 已用 ${result.currentValue}/${result.limit} (${result.usagePct.toFixed(1)}%)`
      );
    } catch {
      message.error('检查失败');
    }
  };

  return {
    loading,
    modalOpen,
    setModalOpen,
    detailOpen,
    setDetailOpen,
    selectedPlan,
    form,
    plans,
    usages,
    alerts,
    status,
    setStatus,
    loadPlans,
    loadUsage,
    loadAlerts,
    handleCreate,
    handleEdit,
    handleViewDetail,
    handleSubmit,
    handleDelete,
    handleCheckQuota,
  };
};

export type TenantQuotaState = ReturnType<typeof useTenantQuotaState>;
