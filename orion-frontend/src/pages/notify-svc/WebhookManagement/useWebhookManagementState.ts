/**
 * WebhookManagement state hook
 * 抽取自 index.tsx (P2-9 Phase 185)
 */
import { useState, useEffect, useCallback } from 'react';
import { Form, message } from 'antd';
import {
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getWebhookLogs,
  type Webhook,
  type WebhookInput,
  type WebhookLog,
} from '@/api/webhook';

export const useWebhookManagementState = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [logDrawerVisible, setLogDrawerVisible] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [form] = Form.useForm();

  const loadWebhooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getWebhooks();
      setWebhooks((res.data as any)?.webhooks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载 Webhook 列表失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWebhooks();
  }, [loadWebhooks]);

  const handleCreate = async (values: WebhookInput) => {
    try {
      await createWebhook(values);
      message.success('Webhook 已创建');
      setModalVisible(false);
      form.resetFields();
      loadWebhooks();
    } catch (err) {
      message.error('创建失败');
    }
  };

  const handleUpdate = async (values: WebhookInput) => {
    if (!editingWebhook) return;
    try {
      await updateWebhook(editingWebhook.id, values);
      message.success('Webhook 已更新');
      setModalVisible(false);
      setEditingWebhook(null);
      form.resetFields();
      loadWebhooks();
    } catch (err) {
      message.error('更新失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWebhook(id);
      message.success('Webhook 已删除');
      loadWebhooks();
    } catch (err) {
      message.error('删除失败');
    }
  };

  const handleTest = async (id: string) => {
    try {
      await testWebhook(id);
      message.success('测试请求已发送');
      loadWebhooks();
    } catch (err) {
      message.error('测试失败');
    }
  };

  const handleViewLogs = async (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setLogDrawerVisible(true);
    try {
      const res = await getWebhookLogs(webhook.id, 20);
      setLogs((res.data as any)?.logs ?? []);
    } catch (err) {
      message.error('加载日志失败');
      setLogs([]);
    }
  };

  const openEdit = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    form.setFieldsValue({
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret ?? '',
      enabled: webhook.enabled,
    });
    setModalVisible(true);
  };

  const openCreate = () => {
    setEditingWebhook(null);
    form.resetFields();
    form.setFieldsValue({ enabled: true });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingWebhook(null);
  };

  return {
    loading,
    error,
    webhooks,
    modalVisible,
    editingWebhook,
    logDrawerVisible,
    selectedWebhook,
    logs,
    form,
    loadWebhooks,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleTest,
    handleViewLogs,
    openEdit,
    openCreate,
    closeModal,
    setLogDrawerVisible,
  };
};
