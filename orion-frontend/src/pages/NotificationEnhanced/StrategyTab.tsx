/**
 * StrategyTab — 通知策略管理
 * CRUD: 创建/编辑/删除/状态切换通知策略
 */
import React, { useState, useEffect } from 'react';
import {
  Typography, Button, Space, Table, Card, Modal, Form, Input,
  Select, Tag, Tooltip, Popconfirm, message, Empty,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  PoweroffOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import {
  getNotificationStrategies,
  createNotificationStrategy,
  updateNotificationStrategy,
  deleteNotificationStrategy,
  toggleNotificationStrategyStatus,
  type NotificationStrategy,
  type NotificationStrategyInput,
  type NotificationStrategyAction,
  CHANNEL_TYPES,
} from '@/api/notification-enhanced';

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  active: { color: colors.success[500], label: '启用' },
  disabled: { color: colors.neutral[500], label: '停用' },
  paused: { color: colors.warning[500], label: '暂停' },
};

const TRIGGER_OPTIONS = [
  { label: '定时 (Schedule)', value: 'schedule' },
  { label: '事件 (Event)', value: 'event' },
  { label: '手动 (Manual)', value: 'manual' },
];

const STATUS_OPTIONS = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' },
  { label: '暂停', value: 'paused' },
];

const StrategyTab: React.FC = () => {
  const [items, setItems] = useState<NotificationStrategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NotificationStrategy | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await getNotificationStrategies();
      setItems(data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载策略列表失败');
    } finally { setLoading(false); }
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({
      status: 'active',
      priority: 5,
      trigger_type: 'event',
      channels: [],
      cooldown_seconds: 60,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: NotificationStrategy) => {
    setEditingItem(item);
    form.resetFields();
    form.setFieldsValue({
      name: item.name,
      description: item.description,
      status: item.status,
      priority: item.priority,
      trigger_type: item.trigger_type,
      trigger_conditions: JSON.stringify(item.trigger_conditions, null, 2),
      actions: JSON.stringify(item.actions, null, 2),
      channels: item.channels,
      cooldown_seconds: item.cooldown_seconds,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const triggerConditions = parseJSON(values.trigger_conditions);
      const actions = (parseJSON(values.actions) as NotificationStrategyAction[]) || [];

      const payload: NotificationStrategyInput = {
        name: values.name,
        description: values.description,
        status: values.status,
        priority: values.priority,
        trigger_type: values.trigger_type,
        trigger_conditions: triggerConditions,
        actions,
        channels: values.channels || [],
        cooldown_seconds: values.cooldown_seconds,
      };

      if (editingItem) {
        await updateNotificationStrategy(editingItem.id, payload);
        message.success('策略更新成功');
      } else {
        await createNotificationStrategy(payload);
        message.success('策略创建成功');
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
      await deleteNotificationStrategy(id);
      message.success('策略删除成功');
      loadItems();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleToggleStatus = async (item: NotificationStrategy) => {
    const newStatus = item.status === 'active' ? 'disabled' : 'active';
    try {
      await toggleNotificationStrategyStatus(item.id, newStatus);
      message.success(`策略已${newStatus === 'active' ? '启用' : '停用'}`);
      loadItems();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '状态切换失败');
    }
  };

  const filteredItems = items.filter((item) => {
    if (statusFilter && item.status !== statusFilter) return false;
    if (searchText && !item.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const columns = [
    {
      title: '策略名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text style={{ fontWeight: 500 }}>{name}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const s = STATUS_MAP[status] || STATUS_MAP.disabled;
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '触发类型',
      dataIndex: 'trigger_type',
      key: 'trigger_type',
      width: 130,
      render: (v: string) => (
        <Tag color={v === 'event' ? 'blue' : v === 'schedule' ? 'purple' : 'default'}>
          {TRIGGER_OPTIONS.find((o) => o.value === v)?.label || v}
        </Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      align: 'center' as const,
    },
    {
      title: '动作数',
      dataIndex: 'actions',
      key: 'actions',
      width: 80,
      align: 'center' as const,
      render: (actions: any[]) => actions?.length || 0,
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      fixed: 'right' as const,
      render: (_: any, record: NotificationStrategy) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)} />
          </Tooltip>
          <Tooltip title={record.status === 'active' ? '停用' : '启用'}>
            <Button
              type="text"
              size="small"
              icon={<PoweroffOutlined />}
              disabled={loading}
              onClick={() => handleToggleStatus(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除此策略？"
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
          <Text type="secondary">共 {filteredItems.length} 条策略</Text>
        </Space>
        <Space>
          <Input
            placeholder="搜索策略名称"
            style={{ width: 200 }}
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 130 }}
            value={statusFilter}
            onChange={setStatusFilter}
          >
            {STATUS_OPTIONS.map((o) => (
              <Option key={o.value} value={o.value}>{o.label}</Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadItems}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            新建策略
          </Button>
        </Space>
      </div>

      {/* Table */}
      {filteredItems.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text type="secondary">
              暂无通知策略，点击上方「新建策略」开始创建
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
          scroll={{ x: 800 }}
        />
      )}

      {/* Create/Edit Modal */}
      <Modal
        title={editingItem ? '编辑策略' : '新建策略'}
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
            label="策略名称"
            rules={[{ required: true, message: '请输入策略名称' }]}
          >
            <Input placeholder="例：部署失败通知" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="策略描述（可选）" />
          </Form.Item>
          <Form.Item name="trigger_type" label="触发类型">
            <Select>
              {TRIGGER_OPTIONS.map((o) => (
                <Option key={o.value} value={o.value}>{o.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue={5}>
            <Select>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <Option key={n} value={n}>{n}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              {STATUS_OPTIONS.map((o) => (
                <Option key={o.value} value={o.value}>{o.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="trigger_conditions" label="触发条件 (JSON)">
            <TextArea rows={3} placeholder='{"pipeline": "failed"}' />
          </Form.Item>
          <Form.Item name="actions" label="动作列表 (JSON)">
            <TextArea rows={3} placeholder='[{"type":"notify","target_template":"default"}]' />
          </Form.Item>
          <Form.Item name="channels" label="通知渠道">
            <Select mode="multiple" placeholder="选择通知渠道">
              {CHANNEL_TYPES.map((c) => (
                <Option key={c.value} value={c.value}>{c.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="cooldown_seconds" label="冷却时间（秒）" initialValue={60}>
            <Input type="number" min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

function parseJSON(val: string): Record<string, any> | Record<string, any>[] {
  if (!val || typeof val !== 'string') return {};
  try { return JSON.parse(val); } catch { return {}; }
}

export default StrategyTab;
