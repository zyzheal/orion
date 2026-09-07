/**
 * NotificationRules IM tab state hook
 * 抽取自 index.tsx (P2-9 Phase 175)
 */
import { useState, useEffect, useCallback } from 'react';
import { Form, message } from 'antd';
import {
  getIMNotificationRules,
  createIMNotificationRule,
  updateIMNotificationRule,
  deleteIMNotificationRule,
  toggleIMNotificationRule,
  testIMNotificationRule,
  type IMNotificationRule,
  type IMNotificationRuleInput,
} from '@/api/notificationRules';

export function useIMNotificationsState() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [rules, setRules] = useState<IMNotificationRule[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingRule, setEditingRule] = useState<IMNotificationRule | null>(null);
  const [form] = Form.useForm();

  /** Load IM notification rules */
  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getIMNotificationRules();
      setRules(data);
    } catch (err) {
      console.warn('IM notification rules API unavailable, showing empty state:', err);
      // Backend endpoint not yet implemented — show empty state gracefully
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  /** Open create modal */
  const openCreate = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({ enabled: true });
    setModalVisible(true);
  };

  /** Open edit modal */
  const openEdit = (rule: IMNotificationRule) => {
    setEditingRule(rule);
    form.setFieldsValue({
      platform: rule.platform,
      name: rule.name,
      webhookUrl: rule.webhookUrl,
      events: rule.events,
      enabled: rule.enabled,
    });
    setModalVisible(true);
  };

  /** Handle form submission (create or update) */
  const handleSubmit = async (values: IMNotificationRuleInput) => {
    setSubmitting(true);
    try {
      if (editingRule) {
        await updateIMNotificationRule(editingRule.id, values);
        message.success('IM 通知规则已更新');
      } else {
        await createIMNotificationRule(values);
        message.success('IM 通知规则已创建');
      }
      setModalVisible(false);
      setEditingRule(null);
      form.resetFields();
      loadRules();
    } catch (err) {
      message.error(editingRule ? '更新失败' : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  /** Delete a rule */
  const handleDelete = async (id: string) => {
    try {
      await deleteIMNotificationRule(id);
      message.success('IM 通知规则已删除');
      loadRules();
    } catch (err) {
      message.error('删除失败');
    }
  };

  /** Toggle enabled/disabled */
  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleIMNotificationRule(id, enabled);
      message.success(enabled ? '已启用' : '已禁用');
      loadRules();
    } catch (err) {
      message.error('操作失败');
    }
  };

  /** Send test notification */
  const handleTest = async (id: string) => {
    try {
      const result = await testIMNotificationRule(id);
      if (result.success) {
        message.success('测试通知已发送');
      } else {
        message.warning(`测试通知发送失败: ${result.message}`);
      }
    } catch (err) {
      message.error('测试通知发送失败');
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingRule(null);
  };

  return {
    loading,
    error,
    rules,
    modalVisible,
    setModalVisible,
    submitting,
    editingRule,
    setEditingRule,
    form,
    loadRules,
    openCreate,
    openEdit,
    handleSubmit,
    handleDelete,
    handleToggle,
    handleTest,
    closeModal,
  };
}
