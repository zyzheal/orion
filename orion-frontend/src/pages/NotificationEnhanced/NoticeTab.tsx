/**
 * NoticeTab — 公告管理
 * CRUD: 创建/编辑/删除/发布/撤回公告
 */
import React, { useState, useEffect } from 'react';
import {
  Typography, Button, Space, Table, Card, Modal, Form, Input,
  Select, Tag, Tooltip, Popconfirm, message, Empty, DatePicker,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import {
  getNotices,
  createNotice,
  updateNotice,
  deleteNotice,
  publishNotice,
  withdrawNotice,
  type Notice,
  type NoticeInput,
  CHANNEL_TYPES,
} from '@/api/notification-enhanced';

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  draft: { color: colors.neutral[500], label: '草稿' },
  published: { color: colors.success[500], label: '已发布' },
  withdrawn: { color: colors.warning[500], label: '已撤回' },
};

const PRIORITY_MAP: Record<string, { color: string; label: string }> = {
  low: { color: colors.neutral[500], label: '低' },
  medium: { color: colors.info[500], label: '中' },
  high: { color: colors.warning[500], label: '高' },
  critical: { color: colors.error[500], label: '紧急' },
};

const TYPE_OPTIONS = [
  { label: '系统公告', value: 'system' },
  { label: '维护通知', value: 'maintenance' },
  { label: '版本发布', value: 'release' },
  { label: '紧急通知', value: 'urgent' },
  { label: '一般公告', value: 'general' },
];

const PRIORITY_OPTIONS = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
  { label: '紧急', value: 'critical' },
];

const STATUS_OPTIONS = [
  { label: '全部', value: null },
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已撤回', value: 'withdrawn' },
];

const NoticeTab: React.FC = () => {
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Notice | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await getNotices(statusFilter ? statusFilter : undefined);
      setItems(data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载公告列表失败');
    } finally { setLoading(false); }
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ type: 'general', priority: 'medium' });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: Notice) => {
    setEditingItem(item);
    form.resetFields();
    form.setFieldsValue({
      title: item.title,
      content: item.content,
      type: item.type,
      priority: item.priority,
      target_users: item.target_users,
      target_channels: item.target_channels,
      publish_at: item.publish_at ? new Date(item.publish_at) : undefined,
      expire_at: item.expire_at ? new Date(item.expire_at) : undefined,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const publishAt = values.publish_at ? values.publish_at.format('YYYY-MM-DD HH:mm:ss') : undefined;
      const expireAt = values.expire_at ? values.expire_at.format('YYYY-MM-DD HH:mm:ss') : undefined;

      const payload: NoticeInput = {
        title: values.title,
        content: values.content,
        type: values.type,
        priority: values.priority,
        target_users: values.target_users,
        target_channels: values.target_channels,
        publish_at: publishAt,
        expire_at: expireAt,
      };

      if (editingItem) {
        await updateNotice(editingItem.id, payload);
        message.success('公告更新成功');
      } else {
        await createNotice(payload);
        message.success('公告创建成功');
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
      await deleteNotice(id);
      message.success('公告删除成功');
      loadItems();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await publishNotice(id);
      message.success('公告已发布');
      loadItems();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '发布失败');
    }
  };

  const handleWithdraw = async (id: string) => {
    try {
      await withdrawNotice(id);
      message.success('公告已撤回');
      loadItems();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '撤回失败');
    }
  };

  const filteredItems = items.filter((item) => {
    if (searchText && !item.title.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (v: string) => <Text style={{ fontWeight: 500 }}>{v}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (v: string) => {
        const t = TYPE_OPTIONS.find((o) => o.value === v);
        return <Tag>{t?.label || v}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const s = STATUS_MAP[v] || STATUS_MAP.draft;
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      render: (v: string) => {
        const p = PRIORITY_MAP[v] || PRIORITY_MAP.medium;
        return <Tag color={p.color}>{p.label}</Tag>;
      },
    },
    {
      title: '发布时间',
      dataIndex: 'published_at',
      key: 'published_at',
      width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-',
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
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: Notice) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)} />
          </Tooltip>
          {record.status === 'draft' && (
            <Tooltip title="发布">
              <Button type="text" size="small" icon={<GlobalOutlined />} onClick={() => handlePublish(record.id)} />
            </Tooltip>
          )}
          {record.status === 'published' && (
            <Popconfirm
              title="确认撤回此公告？"
              onConfirm={() => handleWithdraw(record.id)}
              okText="撤回"
              cancelText="取消"
            >
              <Tooltip title="撤回">
                <Button type="text" size="small" danger>撤回</Button>
              </Tooltip>
            </Popconfirm>
          )}
          <Popconfirm
            title="确认删除此公告？"
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
          <Text type="secondary">共 {filteredItems.length} 条公告</Text>
        </Space>
        <Space>
          <Input
            placeholder="搜索公告标题"
            style={{ width: 200 }}
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Select
            placeholder="状态筛选"
            style={{ width: 120 }}
            value={statusFilter}
            onChange={setStatusFilter}
          >
            {STATUS_OPTIONS.map((o) => (
              <Option key={String(o.value ?? 'all')} value={o.value}>{o.label}</Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadItems}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            新建公告
          </Button>
        </Space>
      </div>

      {/* Table */}
      {filteredItems.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text type="secondary">
              暂无公告，点击上方「新建公告」发布
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
        title={editingItem ? '编辑公告' : '新建公告'}
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
            name="title"
            label="公告标题"
            rules={[{ required: true, message: '请输入公告标题' }]}
          >
            <Input placeholder="例：系统维护通知" />
          </Form.Item>
          <Form.Item
            name="content"
            label="公告内容"
            rules={[
              { required: true, message: '请输入公告内容' },
              { min: 50, message: '内容至少 50 个字符' },
            ]}
          >
            <TextArea rows={6} placeholder="请输入公告正文（至少 50 字）" />
          </Form.Item>
          <Form.Item name="type" label="公告类型">
            <Select>
              {TYPE_OPTIONS.map((o) => (
                <Option key={o.value} value={o.value}>{o.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="priority" label="优先级">
            <Select>
              {PRIORITY_OPTIONS.map((o) => (
                <Option key={o.value} value={o.value}>{o.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="target_users" label="目标用户">
            <Input placeholder="用户 ID 列表，逗号分隔（可选）" />
          </Form.Item>
          <Form.Item name="target_channels" label="推送渠道">
            <Select mode="multiple" placeholder="选择推送渠道（可选）">
              {CHANNEL_TYPES.map((c) => (
                <Option key={c.value} value={c.value}>{c.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="publish_at" label="发布时间">
            <DatePicker showTime />
          </Form.Item>
          <Form.Item name="expire_at" label="过期时间">
            <DatePicker showTime />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default NoticeTab;
