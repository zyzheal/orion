/**
 * MatrixTab — 数据矩阵管理
 * CRUD: 创建/编辑/删除数据矩阵
 */
import React, { useState, useEffect } from 'react';
import {
  Typography, Button, Space, Table, Card, Modal, Form, Input,
  Select, Tag, Tooltip, Popconfirm, message, Empty,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import {
  getDataMatrices,
  createDataMatrix,
  updateDataMatrix,
  deleteDataMatrix,
  type DataMatrix,
  type DataMatrixInput,
} from '@/api/notification-enhanced';

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const TYPE_OPTIONS = [
  { label: '集成配置', value: 'integration' },
  { label: '订阅配置', value: 'subscription' },
  { label: '渠道配置', value: 'channel' },
  { label: '自定义', value: 'custom' },
];

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  active: { color: colors.success[500], label: '活跃' },
  archived: { color: colors.neutral[500], label: '已归档' },
};

const STATUS_FILTERS = [
  { label: '全部', value: undefined },
  { label: '活跃', value: 'active' },
  { label: '已归档', value: 'archived' },
];

const MatrixTab: React.FC = () => {
  const [items, setItems] = useState<DataMatrix[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DataMatrix | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<string | undefined>();

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await getDataMatrices(typeFilter);
      setItems(data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载矩阵列表失败');
    } finally { setLoading(false); }
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ matrix_type: 'custom' });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: DataMatrix) => {
    setEditingItem(item);
    form.resetFields();
    form.setFieldsValue({
      name: item.name,
      description: item.description,
      matrix_type: item.matrix_type,
      data: JSON.stringify(item.data, null, 2),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload: DataMatrixInput = {
        name: values.name,
        description: values.description,
        matrix_type: values.matrix_type,
        data: parseJSON(values.data),
      };

      if (editingItem) {
        await updateDataMatrix(editingItem.id, payload);
        message.success('矩阵更新成功');
      } else {
        await createDataMatrix(payload);
        message.success('矩阵创建成功');
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
      await deleteDataMatrix(id);
      message.success('矩阵删除成功');
      loadItems();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const filteredItems = items.filter((item) => {
    if (statusFilter && item.status !== statusFilter) return false;
    if (searchText && !item.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <Text style={{ fontWeight: 500 }}>{v}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'matrix_type',
      key: 'matrix_type',
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
        const s = STATUS_MAP[v] || STATUS_MAP.active;
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      align: 'center' as const,
    },
    {
      title: '创建者',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 120,
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
      render: (_: any, record: DataMatrix) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="确认删除此矩阵？"
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
          <Text type="secondary">共 {filteredItems.length} 个矩阵</Text>
        </Space>
        <Space>
          <Input
            placeholder="搜索矩阵名称"
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
            {STATUS_FILTERS.map((o) => (
              <Option key={String(o.value ?? 'all')} value={o.value}>{o.label}</Option>
            ))}
          </Select>
          <Select
            placeholder="类型筛选"
            allowClear
            style={{ width: 140 }}
            value={typeFilter}
            onChange={setTypeFilter}
          >
            {TYPE_OPTIONS.map((o) => (
              <Option key={o.value} value={o.value}>{o.label}</Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadItems}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            新建矩阵
          </Button>
        </Space>
      </div>

      {/* Table */}
      {filteredItems.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text type="secondary">
              暂无数据矩阵，点击上方「新建矩阵」开始创建
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
        title={editingItem ? '编辑矩阵' : '新建矩阵'}
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
            label="矩阵名称"
            rules={[{ required: true, message: '请输入矩阵名称' }]}
          >
            <Input placeholder="例：通知渠道映射表" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="矩阵描述（可选）" />
          </Form.Item>
          <Form.Item
            name="matrix_type"
            label="矩阵类型"
            rules={[{ required: true, message: '请选择矩阵类型' }]}
          >
            <Select>
              {TYPE_OPTIONS.map((o) => (
                <Option key={o.value} value={o.value}>{o.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="data"
            label="矩阵数据 (JSON)"
            rules={[{ required: true, message: '请输入矩阵数据' }]}
          >
            <TextArea rows={8} placeholder='{"key1": "value1"}' />
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

export default MatrixTab;
