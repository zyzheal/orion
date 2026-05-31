/**
 * ChatOps 速率限制配置
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, Switch, message, Popconfirm, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { chatopsAdminApi } from '@/api/chatops-admin';
import { colors } from '@/tokens';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

interface RateLimit {
  id: string;
  target_type: string;
  target_id: string | null;
  command_name: string | null;
  limit_type: string;
  limit_count: number;
  window_seconds: number;
  description: string;
  enabled: boolean;
  created_at: string;
}

const targetLabels: Record<string, string> = { user: '用户', group: '群组', command: '命令' };
const limitLabels: Record<string, string> = { minute: '次/分钟', hour: '次/小时', day: '次/天' };

const RateLimitPage: React.FC = () => {
  const [limits, setLimits] = useState<RateLimit[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLimit, setEditingLimit] = useState<RateLimit | null>(null);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await chatopsAdminApi.getRateLimits();
      setLimits((res as { data?: { data?: RateLimit[] } })?.data?.data ?? []);
    } catch {
      message.error('获取限流配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleEdit = (record: RateLimit) => {
    setEditingLimit(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingLimit) {
        await chatopsAdminApi.updateRateLimit(editingLimit.id, values);
        message.success('限流配置已更新');
      } else {
        await chatopsAdminApi.createRateLimit(values);
        message.success('限流配置已创建');
      }
      setModalVisible(false);
      form.resetFields();
      loadData();
    } catch {
      // validation error
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await chatopsAdminApi.deleteRateLimit(id);
      message.success('限流配置已删除');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const columns: ColumnsType<RateLimit> = [
    {
      title: '目标类型',
      dataIndex: 'target_type',
      key: 'target_type',
      width: 100,
      render: (v: string) => <Tag>{targetLabels[v] || v}</Tag>,
    },
    {
      title: '目标/命令',
      key: 'target',
      width: 150,
      render: (_, record) => <Text code>{record.command_name || record.target_id || '全部'}</Text>,
    },
    {
      title: '限流规则',
      key: 'rule',
      render: (_, record) => (
        <Text>{record.limit_count} {limitLabels[record.limit_type]}</Text>
      ),
    },
    {
      title: '窗口',
      dataIndex: 'window_seconds',
      key: 'window_seconds',
      width: 100,
      render: (v: number) => <Text>{v}s</Text>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (v: boolean) => <Tag color={v ? colors.success[500] : colors.neutral[300]}>{v ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card bodyStyle={{ padding: '0 24px 24px' }}>
        <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${colors.light.border.light}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <ThunderboltOutlined style={{ color: colors.warning[500], fontSize: 18 }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: colors.light.text.primary }}>速率限制</span>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingLimit(null); form.resetFields(); setModalVisible(true); }}>
              新建限流
            </Button>
          </Space>
        </div>

        <Table columns={columns} dataSource={limits} rowKey="id" loading={loading} pagination={false}
          locale={{ emptyText: limits.length === 0 ? '暂无限流配置' : undefined }} />
      </Card>

      <Modal title={editingLimit ? '编辑限流配置' : '新建限流配置'} open={modalVisible} onCancel={() => setModalVisible(false)} onOk={handleSave} width={500}>
        <Form form={form} layout="vertical">
          <Form.Item name="target_type" label="目标类型" rules={[{ required: true }]}>
            <Select options={[{ label: '用户', value: 'user' }, { label: '群组', value: 'group' }, { label: '命令', value: 'command' }]} />
          </Form.Item>
          <Form.Item name="command_name" label="命令名称">
            <Input placeholder="deploy (留空表示全部)" />
          </Form.Item>
          <Form.Item name="limit_type" label="限流类型" rules={[{ required: true }]}>
            <Select options={[{ label: '次/分钟', value: 'minute' }, { label: '次/小时', value: 'hour' }, { label: '次/天', value: 'day' }]} />
          </Form.Item>
          <Form.Item name="limit_count" label="限制次数" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="window_seconds" label="窗口时间(秒)" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RateLimitPage;
