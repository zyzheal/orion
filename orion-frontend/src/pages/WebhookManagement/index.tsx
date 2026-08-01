import { PermissionGuard } from '@/components/PermissionGuard';
/**
 * Webhook Management Page
 *
 * Admin page for webhook CRUD: create, edit, delete, test webhooks.
 * Uses api/webhook.ts for all data operations.
 *
 * Note: This is a GENERAL webhook management page for the platform.
 * It is separate from /console/code-mgmt/webhooks which shows code repo webhook logs only.
 *
 * Route: /console/webhooks
 * Access: admin, platform_admin
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Space, Tag, Card, Modal, Form, Input,
  Switch, message, Popconfirm, Tooltip, Select, Drawer,
} from 'antd';
import {
  ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  SendOutlined, EyeOutlined, LinkOutlined, CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import DataState from '@/components/DataState';
import { colors, spacing } from '@/tokens';
import {
  getWebhooks, createWebhook, updateWebhook,
  deleteWebhook, testWebhook, getWebhookLogs,
  type Webhook, type WebhookInput, type WebhookLog,
} from '@/api/webhook';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const EVENT_OPTIONS = [
  'pipeline.completed', 'pipeline.failed', 'deployment.success',
  'deployment.failed', 'alert.triggered', 'alert.resolved',
  'selfhealing.triggered', 'cost.anomaly',
];

const WebhookManagement: React.FC = () => {
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

  useEffect(() => { loadWebhooks(); }, [loadWebhooks]);

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

  const columns: TableColumn<Webhook>[] = [
    {
      key: 'url',
      title: 'URL',
      dataIndex: 'url',
      ellipsis: true,
      render: (v: unknown) => <Text code style={{ fontSize: 12 }}>{String(v)}</Text>,
    },
    {
      key: 'events',
      title: '订阅事件',
      dataIndex: 'events',
      width: 250,
      render: (v: unknown) => (
        <Space wrap>
          {(v as string[]).map((e) => <Tag key={e} color="blue" style={{ fontSize: 11 }}>{e}</Tag>)}
        </Space>
      ),
    },
    {
      key: 'enabled',
      title: '状态',
      dataIndex: 'enabled',
      width: 80,
      render: (v: unknown) => v ? <Tag color="success">启用</Tag> : <Tag>禁用</Tag>,
    },
    {
      key: 'failureCount',
      title: '失败次数',
      dataIndex: 'failureCount',
      width: 80,
      render: (v: unknown) => {
        const count = typeof v === 'number' ? v : 0;
        return <Text style={{ color: count > 3 ? colors.error[500] : 'inherit' }}>{count}</Text>;
      },
    },
    {
      key: 'lastStatus',
      title: '最后状态',
      dataIndex: 'lastStatus',
      width: 90,
      render: (v: unknown) => {
        if (!v) return <Text type="secondary">—</Text>;
        const status = typeof v === 'number' ? v : 0;
        return status >= 200 && status < 300
          ? <Tag color="success" icon={<CheckCircleOutlined />}>{status}</Tag>
          : <Tag color="error" icon={<CloseCircleOutlined />}>{status}</Tag>;
      },
    },
    {
      key: 'lastTriggeredAt',
      title: '最后触发',
      dataIndex: 'lastTriggeredAt',
      width: 150,
      render: (v: unknown) => v ? dayjs(String(v)).format('MM-DD HH:mm') : '—',
    },
    {
      key: 'actions',
      title: '操作',
      width: 180,
      render: (_: unknown, record: Webhook) => (
        <Space size="small">
          <Tooltip title="测试">
            <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleTest(record.id)} />
          </Tooltip>
          <Tooltip title="日志">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewLogs(record)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm title="确认删除该 Webhook?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const logColumns: TableColumn<WebhookLog>[] = [
    { key: 'event', title: '事件', dataIndex: 'event', width: 180, render: (v: unknown) => <Tag color="blue">{String(v)}</Tag> },
    { key: 'status', title: 'HTTP 状态', dataIndex: 'status', width: 100, render: (v: unknown) => {
      const s = typeof v === 'number' ? v : 0;
      return <Tag color={s >= 200 && s < 300 ? 'success' : 'error'}>{s}</Tag>;
    }},
    { key: 'error', title: '错误', dataIndex: 'error', ellipsis: true, render: (v: unknown) => v ? <Text type="danger">{String(v)}</Text> : '—' },
    { key: 'createdAt', title: '时间', dataIndex: 'createdAt', width: 150, render: (v: unknown) => dayjs(String(v)).format('MM-DD HH:mm:ss') },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Header - always visible */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <LinkOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            Webhook 管理
          </Title>
          <Text type="secondary">平台 Webhook 配置与监控</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadWebhooks} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建 Webhook</Button>
        </Space>
      </div>

      <DataState
        loading={loading && webhooks.length === 0}
        error={error}
        empty={webhooks.length === 0 && !loading}
        emptyText="暂无 Webhook"
        loadingText="加载 Webhook..."
        retry={loadWebhooks}
      >
        <Card>
          <Table columns={columns} dataSource={webhooks} loading={loading} rowKey="id" size="middle" striped />
        </Card>
      </DataState>

      {/* Create/Edit Modal */}
      <Modal
        title={editingWebhook ? '编辑 Webhook' : '新建 Webhook'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingWebhook(null); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={editingWebhook ? handleUpdate : handleCreate}>
          <Form.Item name="url" label="URL" rules={[{ required: true, type: 'url' }]}>
            <Input placeholder="https://example.com/webhook" />
          </Form.Item>
          <Form.Item name="events" label="订阅事件" rules={[{ required: true }]}>
            <Select mode="multiple" options={EVENT_OPTIONS.map((e) => ({ label: e, value: e }))} />
          </Form.Item>
          <Form.Item name="secret" label="Signing Secret">
            <Input.Password placeholder="用于验证 webhook 签名的密钥" />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Logs Drawer */}
      <Drawer
        title={`Webhook 日志: ${selectedWebhook?.url ?? ''}`}
        open={logDrawerVisible}
        onClose={() => setLogDrawerVisible(false)}
        width={720}
      >
        <Table columns={logColumns} dataSource={logs} rowKey="id" size="small" />
      </Drawer>
    </div>
  );
};


export default () => (
  <PermissionGuard requiredRoles={["admin", "platform_admin"]} pageLevel resourceName="Webhook 管理">
    <WebhookManagement />
  </PermissionGuard>
);
