/**
 * SubscriptionTab — 消息订阅管理
 * CRUD: 创建/编辑/删除用户消息订阅
 */
import React, { useState, useEffect } from 'react';
import {
  Typography, Button, Space, Table, Card, Modal, Form, Input,
  Select, Switch, Tag, Tooltip, Popconfirm, message, Empty,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import {
  getNotificationSubscriptions,
  createNotificationSubscription,
  updateNotificationSubscription,
  deleteNotificationSubscription,
  type NotificationSubscription,
  type NotificationSubscriptionInput,
  EVENT_TYPES,
  CHANNEL_TYPES,
  CHANNEL_LABELS,
} from '@/api/notification-enhanced';

const { Text } = Typography;
const { Option } = Select;

const FREQUENCY_MAP: Record<string, { color: string; label: string }> = {
  instant: { color: colors.primary[500], label: '即时' },
  daily_digest: { color: colors.info[500], label: '每日摘要' },
  weekly_digest: { color: colors.purple[500], label: '每周摘要' },
  critical_only: { color: colors.warning[500], label: '仅关键' },
};

const FREQUENCY_OPTIONS = [
  { label: '即时通知', value: 'instant' },
  { label: '每日摘要', value: 'daily_digest' },
  { label: '每周摘要', value: 'weekly_digest' },
  { label: '仅关键事件', value: 'critical_only' },
];

const EVENT_OPTIONS = EVENT_TYPES.map((e) => ({ label: e, value: e }));

const SubscriptionTab: React.FC = () => {
  const [items, setItems] = useState<NotificationSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NotificationSubscription | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>();

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await getNotificationSubscriptions();
      setItems(data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载订阅列表失败');
    } finally { setLoading(false); }
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ frequency: 'instant', enabled: true });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: NotificationSubscription) => {
    setEditingItem(item);
    form.resetFields();
    form.setFieldsValue({
      user_id: item.user_id,
      event_types: item.event_types,
      channels: item.channels,
      frequency: item.frequency,
      enabled: item.enabled,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload: NotificationSubscriptionInput = {
        user_id: values.user_id,
        event_types: values.event_types || [],
        channels: values.channels || [],
        frequency: values.frequency,
      };

      if (editingItem) {
        await updateNotificationSubscription(editingItem.id, {
          event_types: values.event_types,
          channels: values.channels,
          frequency: values.frequency,
          enabled: values.enabled,
        });
        message.success('订阅更新成功');
      } else {
        await createNotificationSubscription(payload);
        message.success('订阅创建成功');
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
      await deleteNotificationSubscription(id);
      message.success('订阅删除成功');
      loadItems();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleToggleEnabled = async (item: NotificationSubscription) => {
    try {
      await updateNotificationSubscription(item.id, { enabled: !item.enabled });
      message.success(`订阅已${!item.enabled ? '启用' : '停用'}`);
      loadItems();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '状态切换失败');
    }
  };

  const filteredItems = items.filter((item) => {
    if (statusFilter !== undefined && item.enabled !== statusFilter) return false;
    if (searchText && !item.user_id.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const columns = [
    {
      title: '用户 ID',
      dataIndex: 'user_id',
      key: 'user_id',
      render: (v: string) => (
        <Space>
          <UserOutlined style={{ color: colors.neutral[500] }} />
          <Text style={{ fontWeight: 500 }}>{v}</Text>
        </Space>
      ),
    },
    {
      title: '事件类型',
      dataIndex: 'event_types',
      key: 'event_types',
      render: (eventTypes: string[]) => {
        const show = eventTypes.slice(0, 3);
        const more = eventTypes.length - 3;
        return (
          <Space wrap>
            {show.map((e) => <Tag key={e} color="processing">{e}</Tag>)}
            {more > 0 && <Tag color="default">+{more} more</Tag>}
          </Space>
        );
      },
    },
    {
      title: '通知渠道',
      dataIndex: 'channels',
      key: 'channels',
      render: (channels: string[]) => (
        <Space wrap>
          {channels.slice(0, 3).map((c) => (
            <Tag key={c}>{CHANNEL_LABELS[c] || c}</Tag>
          ))}
          {channels.length > 3 && <Tag color="default">+{channels.length - 3}</Tag>}
        </Space>
      ),
    },
    {
      title: '频率',
      dataIndex: 'frequency',
      key: 'frequency',
      width: 120,
      render: (v: string) => {
        const f = FREQUENCY_MAP[v] || FREQUENCY_MAP.instant;
        return <Tag color={f.color}>{f.label}</Tag>;
      },
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      align: 'center' as const,
      render: (enabled: boolean, record: NotificationSubscription) => (
        <Switch
          size="small"
          checked={enabled}
          onChange={() => handleToggleEnabled(record)}
          disabled={loading}
        />
      ),
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
      width: 130,
      fixed: 'right' as const,
      render: (_: any, record: NotificationSubscription) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="确认删除此订阅？"
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
          <Text type="secondary">共 {filteredItems.length} 条订阅</Text>
        </Space>
        <Space>
          <Input
            placeholder="搜索用户 ID"
            style={{ width: 200 }}
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Select
            placeholder="启用状态"
            allowClear
            style={{ width: 130 }}
            value={statusFilter}
            onChange={setStatusFilter}
          >
            <Option value={true}>启用</Option>
            <Option value={false}>停用</Option>
          </Select>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadItems}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            新建订阅
          </Button>
        </Space>
      </div>

      {/* Table */}
      {filteredItems.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text type="secondary">
              暂无消息订阅，点击上方「新建订阅」开始订阅
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
        title={editingItem ? '编辑订阅' : '新建订阅'}
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
            name="user_id"
            label="用户 ID"
            rules={[{ required: true, message: '请输入用户 ID' }]}
          >
            <Input placeholder="例：user-001" />
          </Form.Item>
          <Form.Item
            name="event_types"
            label="订阅事件"
            rules={[{ required: true, message: '请选择至少一个事件类型' }]}
          >
            <Select mode="multiple" placeholder="选择事件类型">
              {EVENT_OPTIONS.map((o) => (
                <Option key={o.value} value={o.value}>{o.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="channels"
            label="通知渠道"
            rules={[{ required: true, message: '请选择至少一个通知渠道' }]}
          >
            <Select mode="multiple" placeholder="选择通知渠道">
              {CHANNEL_TYPES.map((c) => (
                <Option key={c.value} value={c.value}>{c.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="frequency" label="推送频率">
            <Select>
              {FREQUENCY_OPTIONS.map((o) => (
                <Option key={o.value} value={o.value}>{o.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default SubscriptionTab;
