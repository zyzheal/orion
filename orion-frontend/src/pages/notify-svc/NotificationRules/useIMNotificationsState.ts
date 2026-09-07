/**
 * useIMNotificationsState hook
 * 抽取自 notify-svc/NotificationRules/index.tsx (P2-9 Phase 177)
 */
import { useCallback, useEffect, useState } from 'react';
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
  const [editingRule, setEditingRule] = useState<IMNotificationRule | null>(null);
  const [form] = Form.useForm();

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getIMNotificationRules();
      setRules(data);
    } catch (err) {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const openCreate = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({ enabled: true });
    setModalVisible(true);
  };

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

  const handleModalClose = () => {
    setModalVisible(false);
    setEditingRule(null);
  };

  const handleSubmit = async (values: IMNotificationRuleInput) => {
    try {
      if (editingRule) {
        await updateIMNotificationRule(editingRule.id, values);
        message.success('IM 通知规则已更新');
      } else {
        await createIMNotificationRule(values);
        message.success('IM 通知规则已创建');
      }
      handleModalClose();
      form.resetFields();
      loadRules();
    } catch {
      message.error(editingRule ? '更新失败' : '创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteIMNotificationRule(id);
      message.success('IM 通知规则已删除');
      loadRules();
    } catch {
      message.error('删除失败');
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleIMNotificationRule(id, enabled);
      message.success(enabled ? '已启用' : '已禁用');
      loadRules();
    } catch {
      message.error('操作失败');
    }
  };

  const handleTest = async (id: string) => {
    try {
      const result = await testIMNotificationRule(id);
      if (result.success) {
        message.success('测试通知已发送');
      } else {
        message.warning(`测试通知发送失败: ${result.message}`);
      }
    } catch {
      message.error('测试通知发送失败');
    }
  };

  return {
    loading,
    error,
    rules,
    modalVisible,
    editingRule,
    form,
    loadRules,
    openCreate,
    openEdit,
    handleModalClose,
    handleSubmit,
    handleDelete,
    handleToggle,
    handleTest,
  };
}
