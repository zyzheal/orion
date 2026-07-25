/**
 * IntegrationTab — 通知集成管理
 * CRUD: 创建/编辑/删除/测试通知渠道集成
 */
import React, { useState, useEffect } from 'react';
import {
  Typography, Button, Space, Table, Card, Modal, Form, Input,
  Select, Switch, Tag, Tooltip, Popconfirm, message, Empty,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import {
  getNotificationIntegrations,
  createNotificationIntegration,
  updateNotificationIntegration,
  deleteNotificationIntegration,
  testNotificationIntegration,
  type NotificationIntegration,
  type NotificationIntegrationInput,
  CHANNEL_TYPES,
  CHANNEL_LABELS,
  CHANNEL_COLORS,
} from '@/api/notification-enhanced';

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const TEST_STATUS_MAP: Record<string, { color: string; label: string }> = {
  success: { color: colors.success[500], label: '成功' },
  failed: { color: colors.error[500], label: '失败' },
  never: { color: colors.neutral[500], label: '未测试' },
};

const IntegrationTab: React.FC = () => {
  const [items, setItems] = useState<NotificationIntegration[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NotificationIntegration | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [channelFilter, setChannelFilter] = useState<string | undefined>();

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await getNotificationIntegrations();
      setItems(data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载集成列表失败');
    } finally { setLoading(false); }
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ enabled: true, rate_limit_per_minute: 60 });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: NotificationIntegration) => {
    setEditingItem(item);
    form.resetFields();
    form.setFieldsValue({
      name: item.name,
      channel_type: item.channel_type,
      description: item.description,
      config: JSON.stringify(item.config, null, 2),
      rate_limit_per_minute: item.rate_limit_per_minute,
      enabled: item.enabled,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload: NotificationIntegrationInput = {
        name: values.name,
        channel_type: values.channel_type,
        description: values.description,
        config: parseJSON(values.config),
        rate_limit_per_minute: values.rate_limit_per_minute,
      };

      if (editingItem) {
        await updateNotificationIntegration(editingItem.id, { ...payload, enabled: values.enabled });
        message.success('集成更新成功');
      } else {
        await createNotificationIntegration(payload);
        message.success('集成创建成功');
      }
      setModalOpen(false);
      loadItems();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(err instanceof Error ? err.message : '保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotificationIntegration(id);
      message.success('集成删除成功');
      loadItems();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const result = await testNotificationIntegration(id);
      if (result.success) {
        message.success(`测试成功: ${result.message}`);
      } else {
        message.error(`测试失败: ${result.message}`);
      }
      loadItems();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '测试请求失败');
    } finally { setTestingId(null); }
  };

  const handleToggleEnabled = async (item: NotificationIntegration) => {
    try {
      await updateNotificationIntegration(item.id, { enabled: !item.enabled });
      message.success(`集成已${!item.enabled ? '启用' : '停用'}`);
      loadItems();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '状态切换失败');
    }
  };

  const filteredItems = items.filter((item) => {
    if (channelFilter && item.channel_type !== channelFilter) return false;
    if (searchText && !item.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text style={{ fontWeight: 500 }}>{name}</Text>,
    },
    {
      title: '渠道类型',
      dataIndex: 'channel_type',
      key: 'channel_type',
      width: 140,
      render: (v: string) => (
        <Space>
          <span
            style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: CHANNEL_COLORS[v] || colors.neutral[500],
            }}
          />
          <span>{CHANNEL_LABELS[v] || v}</span>
        </Space>
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      align: 'center' as const,
      render: (enabled: boolean, record: NotificationIntegration) => (
        <Switch
          size="small"
          checked={enabled}
          onChange={() => handleToggleEnabled(record)}
          disabled={loading}
        />
      ),
    },
    {
      title: '限速/分钟',
      dataIndex: 'rate_limit_per_minute',
      key: 'rate_limit_per_minute',
      width: 100,
      align: 'center' as const,
    },
    {
      title: '最近测试',
      dataIndex: 'last_test_status',
      key: 'last_test_status',
      width: 100,
      align: 'center' as const,
      render: (v: string) => {
        const s = TEST_STATUS_MAP[v] || TEST_STATUS_MAP.never;
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: NotificationIntegration) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)} />
          </Tooltip>
          <Tooltip title="测试连接">
            <Button
              type="text"
              size="small"
              icon={<ThunderboltOutlined />}
              loading={testingId === record.id}
              onClick={() => handleTest(record.id)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除此集成？"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="text" size="small" icon={<DeleteOutlined />} danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}
      bodyStyle={{ padding: spacing.md }}
    >
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
        <Space>
          <Text type="secondary">共 {filteredItems.length} 个集成</Text>
        </Space>
        <Space>
          <Input
            placeholder="搜索集成名称"
            style={{ width: 200 }}
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Select
            placeholder="渠道筛选"
            allowClear
            style={{ width: 160 }}
            value={channelFilter}
            onChange={setChannelFilter}
          >
            {CHANNEL_TYPES.map((c) => (
              <Option key={c.value} value={c.value}>{c.label}</Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadItems}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            新建集成
          </Button>
        </Space>
      </div>

      {/* Table */}
      {filteredItems.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text type="secondary">
              暂无通知集成，点击上方「新建集成」添加通知渠道
            </Text>
          }
        />
      ) : (
        <Table
          dataSource={filteredItems}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 900 }}
        />
      )}

      {/* Create/Edit Modal */}
      <Modal
        title={editingItem ? '编辑集成' : '新建集成'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={loading}
        width={720}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ maxWidth: 700 }}>
          <Form.Item
            name="name"
            label="集成名称"
            rules={[{ required: true, message: '请输入集成名称' }]}
          >
            <Input placeholder="例：企业微信-开发组" />
          </Form.Item>
          <Form.Item
            name="channel_type"
            label="渠道类型"
            rules={[{ required: true, message: '请选择渠道类型' }]}
          >
            <Select placeholder="选择渠道类型">
              {CHANNEL_TYPES.map((c) => (
                <Option key={c.value} value={c.value}>{c.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="集成描述（可选）" />
          </Form.Item>
          <Form.Item name="config" label="配置 (JSON)">
            <TextArea rows={4} placeholder='{"webhook_url":"https://..."}' />
          </Form.Item>
          <Form.Item name="rate_limit_per_minute" label="限速（次/分钟）" initialValue={60}>
            <Input type="number" min={1} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

function parseJSON(val: string): Record<string, any> {
  if (!val || typeof val !== 'string') return {};
  try { return JSON.parse(val); } catch { return {}; }
}

export default IntegrationTab;
