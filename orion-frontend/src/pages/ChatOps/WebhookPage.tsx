/**
 * ChatOps Webhook 管理
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, Switch, message, Popconfirm, Tooltip, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, LinkOutlined, FileTextOutlined, ExperimentOutlined } from '@ant-design/icons';
import { chatopsAdminApi } from '@/api/chatops-admin';
import { colors } from '@/tokens';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

interface LogEntry {
  id: string;
  webhook_id: string;
  event: string;
  status: string;
  response_code?: number;
  created_at: string;
}
interface LogEntry {
  id: string;
  webhook_id: string;
  event: string;
  status: string;
  response_code?: number;
  created_at: string;
}
interface LogEntry {
  id: string;
  webhook_id: string;
  event: string;
  status: string;
  response_code?: number;
  created_at: string;
}
interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  retry_count: number;
  timeout_seconds: number;
  description: string;
  last_status: string | null;
  last_triggered_at: string | null;
  created_at: string;
}

const WebhookPage: React.FC = () => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [logsVisible, setLogsVisible] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await chatopsAdminApi.getWebhooks();
      setWebhooks((res as { data?: { data?: Webhook[] } })?.data?.data ?? []);
    } catch {
      message.error('获取 Webhook 列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleEdit = (record: Webhook) => {
    setEditingWebhook(record);
    form.setFieldsValue({ ...record, events: record.events });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingWebhook) {
        await chatopsAdminApi.updateWebhook(editingWebhook.id, values);
        message.success('Webhook 已更新');
      } else {
        await chatopsAdminApi.createWebhook(values);
        message.success('Webhook 已创建');
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
      await chatopsAdminApi.deleteWebhook(id);
      message.success('Webhook 已删除');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const handleTest = async (id: string) => {
    try {
      const res = await chatopsAdminApi.testWebhook(id);
      const resData = res as { data?: { success?: boolean } };
      message.success(resData.data?.success ? 'Webhook 测试成功' : 'Webhook 测试失败');
      loadData();
    } catch {
      message.error('Webhook 测试失败');
    }
  };

  const handleViewLogs = async (id: string) => {
    try {
      const res = await chatopsAdminApi.getWebhookLogs(id);
      setLogs((res as { data?: { data?: LogEntry[] } })?.data?.data ?? []);
      setLogsVisible(true);
    } catch {
      message.error('获取日志失败');
    }
  };

  const columns: ColumnsType<Webhook> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: '事件',
      dataIndex: 'events',
      key: 'events',
      width: 200,
      render: (events: string[]) => (
        <Space wrap>
          {events.slice(0, 3).map(e => <Tag key={e}>{e}</Tag>)}
          {events.length > 3 && <Tag>+{events.length - 3}</Tag>}
        </Space>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => (
        <Tag color={record.enabled ? (record.last_status === 'success' ? colors.success[500] : colors.info[500]) : colors.neutral[300]}>
          {record.enabled ? (record.last_status || '正常') : '禁用'}
        </Tag>
      ),
    },
    {
      title: '最后触发',
      dataIndex: 'last_triggered_at',
      key: 'last_triggered_at',
      width: 140,
      render: (v: string) => v ? <Text type="secondary">{dayjs(v).fromNow()}</Text> : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space>
          <Tooltip title="测试"><Button type="link" size="small" icon={<ExperimentOutlined />} onClick={() => handleTest(record.id)} /></Tooltip>
          <Tooltip title="日志"><Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => handleViewLogs(record.id)} /></Tooltip>
          <Tooltip title="编辑"><Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} /></Tooltip>
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除"><Button type="link" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const logColumns: ColumnsType<any> = [
    { title: '事件', dataIndex: 'event_type', key: 'event_type', width: 100 },
    { title: '状态码', dataIndex: 'response_status', key: 'response_status', width: 80, render: (v: number) => v ? <Tag color={v >= 200 && v < 300 ? colors.success[500] : colors.error[500]}>{v}</Tag> : '-' },
    { title: '错误', dataIndex: 'error_message', key: 'error_message', ellipsis: true },
    { title: '重试', dataIndex: 'retry_count', key: 'retry_count', width: 60 },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 160, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss') },
  ];

  const EVENT_OPTIONS = [
    { label: '命令执行', value: 'command.execute' },
    { label: '命令完成', value: 'command.complete' },
    { label: '命令失败', value: 'command.failed' },
    { label: '审批请求', value: 'approval.request' },
    { label: '审批通过', value: 'approval.approved' },
    { label: '审批拒绝', value: 'approval.rejected' },
    { label: '配置变更', value: 'config.change' },
  ];

  return (
    <div>
      <Card bodyStyle={{ padding: '0 24px 24px' }}>
        <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${colors.light.border.light}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <LinkOutlined style={{ color: colors.purple[500], fontSize: 18 }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: colors.light.text.primary }}>Webhook 管理</span>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingWebhook(null); form.resetFields(); form.setFieldsValue({ enabled: true, retry_count: 3, timeout_seconds: 10, events: [] }); setModalVisible(true); }}>
              新建 Webhook
            </Button>
          </Space>
        </div>

        <Table columns={columns} dataSource={webhooks} rowKey="id" loading={loading} pagination={false}
          locale={{ emptyText: webhooks.length === 0 ? '暂无 Webhook 配置' : undefined }} />
      </Card>

      {/* Edit/Create Modal */}
      <Modal title={editingWebhook ? '编辑 Webhook' : '新建 Webhook'} open={modalVisible} onCancel={() => setModalVisible(false)} onOk={handleSave} width={600}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="生产环境通知 Webhook" />
          </Form.Item>
          <Form.Item name="url" label="URL" rules={[{ required: true, type: 'url' }]}>
            <Input placeholder="https://hooks.example.com/chatops" />
          </Form.Item>
          <Form.Item name="events" label="订阅事件" rules={[{ required: true, message: '请选择至少一个事件' }]}>
            <Select mode="multiple" options={EVENT_OPTIONS} placeholder="选择事件" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="retry_count" label="重试次数">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="timeout_seconds" label="超时时间(秒)">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Logs Modal */}
      <Modal title="Webhook 执行日志" open={logsVisible} onCancel={() => setLogsVisible(false)} footer={<Button onClick={() => setLogsVisible(false)}>关闭</Button>} width={700}>
        <Table columns={logColumns} dataSource={logs} rowKey="id" pagination={{ pageSize: 10 }} size="small" />
      </Modal>
    </div>
  );
};

export default WebhookPage;
