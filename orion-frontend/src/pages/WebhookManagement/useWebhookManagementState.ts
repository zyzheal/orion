/**
 * WebhookManagement state hook
 * 抽取自 index.tsx (P2-9 Phase 172)
 */
import { useState } from 'react';
import { Form, message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
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

export function useWebhookManagementState() {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [logDrawerVisible, setLogDrawerVisible] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [form] = Form.useForm();

  const {
    data: webhooks = [] as Webhook[],
    isLoading: loading,
    isError,
    error,
    refetch: loadWebhooks,
  } = useQuery<Webhook[]>({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const res = await getWebhooks();
      return (res.data as any)?.webhooks ?? [];
    },
    staleTime: 30_000,
  });

  const errorState = isError ? (error as Error | null) : null;

  const handleCreate = async (values: WebhookInput) => {
    setSubmitting(true);
    try {
      await createWebhook(values);
      message.success('Webhook 已创建');
      setModalVisible(false);
      form.resetFields();
      loadWebhooks();
    } catch (err) {
      message.error('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (values: WebhookInput) => {
    if (!editingWebhook) return;
    setSubmitting(true);
    try {
      await updateWebhook(editingWebhook.id, values);
      message.success('Webhook 已更新');
      setModalVisible(false);
      setEditingWebhook(null);
      form.resetFields();
      loadWebhooks();
    } catch (err) {
      message.error('更新失败');
    } finally {
      setSubmitting(false);
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

  return {
    webhooks,
    loading,
    errorState,
    modalVisible,
    setModalVisible,
    editingWebhook,
    setEditingWebhook,
    submitting,
    logDrawerVisible,
    setLogDrawerVisible,
    selectedWebhook,
    setSelectedWebhook,
    logs,
    setLogs,
    form,
    loadWebhooks,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleTest,
    handleViewLogs,
    openEdit,
    openCreate,
  };
}
