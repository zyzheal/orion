/**
 * useAlertClosureState.ts - 告警闭环与升级策略 状态 Hook
 * 抽取自 AlertClosurePage/index.tsx (P2-9 Phase 88)
 */
import { useState, useEffect, useCallback } from 'react';
import { message, Modal, Form, Input } from 'antd';
import {
  listPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  evaluatePolicy,
  listTriggers,
  resolveTrigger,
  listClosures,
  acknowledgeAlert,
  resolveAlert,
  getMetrics,
  type EscalationPolicy,
  type EscalationTrigger,
  type AlertClosure,
  type AlertMetrics,
} from '@/api/alertEscalation';

export const useAlertClosureState = () => {
  const [activeTab, setActiveTab] = useState<'policies' | 'closures' | 'metrics'>('policies');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EscalationPolicy | null>(null);
  const [form] = Form.useForm();

  const [policies, setPolicies] = useState<EscalationPolicy[]>([]);
  const [triggers, setTriggers] = useState<EscalationTrigger[]>([]);
  const [closures, setClosures] = useState<AlertClosure[]>([]);
  const [metrics, setMetrics] = useState<AlertMetrics | null>(null);
  const [policyStatus, setPolicyStatus] = useState<string>('');

  const operator = localStorage.getItem('username') || 'system';

  const loadPolicies = useCallback(async () => {
    try {
      const data = await listPolicies();
      setPolicies(Array.isArray(data) ? data : []);
    } catch {
      setPolicies([]);
    }
  }, []);

  const loadTriggers = useCallback(async () => {
    try {
      const data = await listTriggers();
      setTriggers(Array.isArray(data) ? data : []);
    } catch {
      setTriggers([]);
    }
  }, []);

  const loadClosures = useCallback(async () => {
    try {
      const data = await listClosures(policyStatus || undefined);
      setClosures(Array.isArray(data) ? data : []);
    } catch {
      setClosures([]);
    }
  }, [policyStatus]);

  const loadMetrics = useCallback(async () => {
    try {
      const data = await getMetrics();
      setMetrics(data || {});
    } catch {
      setMetrics(null);
    }
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      if (activeTab === 'policies') {
        await Promise.all([loadPolicies(), loadTriggers()]);
      } else if (activeTab === 'closures') await loadClosures();
      else await loadMetrics();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // --- Policy CRUD ---
  const handleCreate = () => {
    setSelectedItem(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (r: EscalationPolicy) => {
    setSelectedItem(r);
    form.setFieldsValue(r);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      let rulesObj = values.rules;
      if (typeof rulesObj === 'string') {
        try {
          rulesObj = JSON.parse(rulesObj);
        } catch {
          message.error('Rules 格式无效');
          return;
        }
      }
      if (!Array.isArray(rulesObj) || rulesObj.length === 0) {
        message.error('至少需要一条升级规则');
        return;
      }

      if (selectedItem) {
        await updatePolicy(selectedItem.id, values);
        message.success('策略更新成功');
      } else {
        await createPolicy(values);
        message.success('策略创建成功');
      }
      setModalOpen(false);
      form.resetFields();
      loadPolicies();
    } catch {
      /* validated */
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复，确定要删除吗？',
      onOk: async () => {
        try {
          await deletePolicy(id);
          message.success('删除成功');
          loadPolicies();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleViewDetail = (r: EscalationPolicy) => {
    setSelectedItem(r);
    setDetailOpen(true);
  };

  const handleEvaluate = async (policy: EscalationPolicy) => {
    try {
      const data = await evaluatePolicy(policy.id, policy.severity || 'critical');
      message.success(`已触发 ${Array.isArray(data) ? data.length : 0} 个升级动作`);
      loadTriggers();
    } catch {
      message.error('评估失败');
    }
  };

  // --- Closure actions ---
  const handleAcknowledge = async (closure: AlertClosure) => {
    try {
      await acknowledgeAlert(closure.alertId, operator);
      message.success('告警已确认');
      loadClosures();
    } catch {
      message.error('确认失败');
    }
  };

  const handleResolve = (closure: AlertClosure) => {
    Modal.confirm({
      title: '确认解决',
      content: (
        <Input.TextArea
          rows={3}
          placeholder="请填写解决说明"
          onChange={(e) => {
            closure.resolutionNote = e.target.value;
          }}
        />
      ),
      onOk: async () => {
        try {
          await resolveAlert(closure.alertId, operator, closure.resolutionNote);
          message.success('告警已解决');
          loadClosures();
          loadMetrics();
        } catch {
          message.error('解决失败');
        }
      },
    });
  };

  const handleTriggerResolve = async (trigger: EscalationTrigger) => {
    try {
      await resolveTrigger(trigger.id);
      message.success('触发器已解决');
      loadTriggers();
    } catch {
      message.error('解决失败');
    }
  };

  return {
    activeTab,
    setActiveTab,
    loading,
    modalOpen,
    setModalOpen,
    detailOpen,
    setDetailOpen,
    selectedItem,
    form,
    policies,
    triggers,
    closures,
    setTriggers,
    metrics,
    policyStatus,
    setPolicyStatus,
    loadPolicies,
    loadTriggers,
    loadClosures,
    loadMetrics,
    handleRefresh,
    handleCreate,
    handleEdit,
    handleSubmit,
    handleDelete,
    handleViewDetail,
    handleEvaluate,
    handleAcknowledge,
    handleResolve,
    handleTriggerResolve,
  };
};
