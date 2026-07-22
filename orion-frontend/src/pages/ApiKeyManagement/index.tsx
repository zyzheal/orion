/**
 * API Key Management Page
 *
 * Admin page for API key CRUD: create, revoke, view stats.
 * Uses api/api-key.ts for all data operations.
 *
 * Route: /console/api-keys
 * Access: admin, platform_admin
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Space, Tag, Card, Modal, Form, Input,
  message, Popconfirm, Tooltip, DatePicker, Alert,
} from 'antd';
import {
  ReloadOutlined, PlusOutlined, DeleteOutlined, KeyOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import MetricCard from '@/components/MetricCard';
import DataState from '@/components/DataState';
import { colors, spacing } from '@/tokens';
import {
  getApiKeys, createApiKey, revokeApiKey, getApiKeyStats,
  type ApiKey, type ApiKeyInput,
} from '@/api/api-key';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const ApiKeyManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [stats, setStats] = useState<{ total: number; active: number; expired: number } | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [keysRes, statsRes] = await Promise.all([getApiKeys(), getApiKeyStats()]);
      setKeys(((keysRes.data as any)?.keys ?? []) as ApiKey[]);
      setStats((statsRes.data as any)?.stats ?? null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载 API Key 列表失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async (values: ApiKeyInput) => {
    try {
      const res = await createApiKey(values);
      const newKey = (res.data as any)?.key?.key ?? '';
      setCreatedKey(newKey);
      message.success('API Key 已创建，请妥善保存');
      form.resetFields();
      loadData();
    } catch (err) {
      message.error('创建失败');
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeApiKey(id);
      message.success('API Key 已撤销');
      loadData();
    } catch (err) {
      message.error('撤销失败');
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    message.success('已复制到剪贴板');
  };

  const columns: TableColumn<ApiKey>[] = [
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      width: 160,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'key',
      title: 'Key',
      dataIndex: 'key',
      width: 280,
      render: (v: unknown) => {
        const keyStr = String(v);
        const display = keyStr.length > 20 ? `${keyStr.slice(0, 8)}...${keyStr.slice(-4)}` : keyStr;
        return (
          <Space>
            <Text code style={{ fontSize: 12 }}>{display}</Text>
            <Tooltip title="复制"><Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyKey(keyStr)} /></Tooltip>
          </Space>
        );
      },
    },
    {
      key: 'enabled',
      title: '状态',
      dataIndex: 'enabled',
      width: 70,
      render: (v: unknown) => v ? <Tag color="success">活跃</Tag> : <Tag color="default">已撤销</Tag>,
    },
    {
      key: 'expiresAt',
      title: '过期时间',
      dataIndex: 'expiresAt',
      width: 150,
      render: (v: unknown) => {
        if (!v) return <Tag>永不过期</Tag>;
        const expired = dayjs(String(v)).isBefore(dayjs());
        return <Tag color={expired ? 'error' : 'processing'}>{dayjs(String(v)).format('YYYY-MM-DD')}</Tag>;
      },
    },
    {
      key: 'lastUsedAt',
      title: '最后使用',
      dataIndex: 'lastUsedAt',
      width: 150,
      render: (v: unknown) => v ? dayjs(String(v)).format('MM-DD HH:mm') : '从未使用',
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 150,
      render: (v: unknown) => dayjs(String(v)).format('YYYY-MM-DD'),
    },
    {
      key: 'actions',
      title: '操作',
      width: 80,
      render: (_: unknown, record: ApiKey) =>
        record.enabled ? (
          <Popconfirm title="确认撤销该 API Key?" onConfirm={() => handleRevoke(record.id)}>
            <Tooltip title="撤销"><Button type="link" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        ) : '—',
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Header - always visible */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <KeyOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            API Key 管理
          </Title>
          <Text type="secondary">API Key Management</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreatedKey(null); setModalVisible(true); }}>新建 Key</Button>
        </Space>
      </div>

      <DataState
        loading={loading && keys.length === 0}
        error={error}
        empty={keys.length === 0 && !loading}
        emptyText="暂无 API Key"
        loadingText="加载 API Key..."
        retry={loadData}
      >
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing.md, marginBottom: spacing.lg }}>
            <MetricCard title="总数" value={stats.total} icon={<KeyOutlined />} color={colors.success[500]} size="medium" />
            <MetricCard title="活跃" value={stats.active} icon={<KeyOutlined />} color={colors.success[500]} size="medium" />
            <MetricCard title="已过期" value={stats.expired} icon={<KeyOutlined />} color={colors.error[500]} size="medium" />
          </div>
        )}

        <Card>
          <Table columns={columns} dataSource={keys} loading={loading} rowKey="id" size="middle" striped />
        </Card>
      </DataState>

      <Modal
        title="新建 API Key"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={createdKey ? [<Button key="close" type="primary" onClick={() => setModalVisible(false)}>完成</Button>] : undefined}
        width={480}
      >
        {createdKey ? (
          <div>
            <Alert message="请妥善保存此 API Key，关闭后将无法再次查看" type="warning" showIcon style={{ marginBottom: spacing.md }} />
            <Input value={createdKey} readOnly addonAfter={<Button type="link" onClick={() => copyKey(createdKey)}><CopyOutlined /> 复制</Button>} />
          </div>
        ) : (
          <Form form={form} layout="vertical" onFinish={handleCreate}>
            <Form.Item name="name" label="名称" rules={[{ required: true }]}>
              <Input placeholder="e.g. ci-pipeline-key" />
            </Form.Item>
            <Form.Item name="expiresAt" label="过期时间">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">创建</Button>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default ApiKeyManagement;
