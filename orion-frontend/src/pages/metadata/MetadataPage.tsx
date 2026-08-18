/**
 * Metadata Management Page (Phase 4 Batch 2)
 * Data asset catalog, lineage tracking
 */
import React, { useState, useEffect } from 'react';
import {
  Typography, Table, Button, Tag, Space, Tabs, message,
  Modal, Form, Input, Select, Popconfirm,
} from 'antd';
import {
  DatabaseOutlined,
  PartitionOutlined,
  PlusOutlined,
  ReloadOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import {
  createCatalogItem, listCatalogItems, deleteCatalogItem,
  createLineage, getLineage, deleteLineage,
  type CatalogItem, type LineageRelation,
} from '@/api/metadata';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

// ============================================================================
// Catalog Tab
// ============================================================================

const CatalogTab: React.FC = () => {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listCatalogItems();
      setItems(((res.data as { data?: unknown[] })?.data ?? []) as CatalogItem[]);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载目录失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async (values: any) => {
    try {
      await createCatalogItem({
        name: values.name, description: values.description,
        type: values.type, owner: values.owner,
        tags: values.tags?.split(',').map((t: string) => t.trim()).filter(Boolean),
      });
      message.success('目录创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCatalogItem(id);
      message.success('删除成功');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const typeColorMap: Record<string, string> = {
    table: colors.primary[500],
    view: colors.info[500],
    pipeline: colors.success[500],
    dashboard: colors.warning[500],
    api: colors.purple[500],
    other: colors.neutral[400],
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '类型', dataIndex: 'type', key: 'type',
      render: (t: string) => <Tag color={typeColorMap[t]}>{t}</Tag>,
    },
    { title: '负责人', dataIndex: 'owner', key: 'owner', render: (v: string) => v || '-' },
    { title: '标签', dataIndex: 'tags', key: 'tags', render: (tags: string[]) => tags?.map((t) => <Tag key={t}>{t}</Tag>) || '-' },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: CatalogItem) => (
        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
          <Button size="small" type="link" danger>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <div>
          <Title level={3} style={{ marginBottom: spacing.sm }}>
            <DatabaseOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            数据资产目录
          </Title>
          <Text type="secondary">管理所有数据资产的元数据信息</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>注册资产</Button>
        </Space>
      </div>
      <Table columns={columns} dataSource={items} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      <Modal title="注册数据资产" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="名称" name="name" rules={[{ required: true }]}><Input placeholder="资产名称" /></Form.Item>
          <Form.Item label="类型" name="type" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="table">Table</Select.Option>
              <Select.Option value="view">View</Select.Option>
              <Select.Option value="pipeline">Pipeline</Select.Option>
              <Select.Option value="dashboard">Dashboard</Select.Option>
              <Select.Option value="api">API</Select.Option>
              <Select.Option value="other">Other</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="描述" name="description"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item label="负责人" name="owner"><Input placeholder="负责人" /></Form.Item>
          <Form.Item label="标签" name="tags"><Input placeholder="逗号分隔的标签" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============================================================================
// Lineage Tab
// ============================================================================

const LineageTab: React.FC = () => {
  const [relations, setRelations] = useState<LineageRelation[]>([]);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [relRes, itemRes] = await Promise.all([getLineage(), listCatalogItems()]);
      setRelations(((relRes.data as { data?: unknown[] })?.data ?? []) as LineageRelation[]);
      setItems(((itemRes.data as { data?: unknown[] })?.data ?? []) as CatalogItem[]);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载血缘关系失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async (values: any) => {
    try {
      await createLineage({ sourceId: values.sourceId, targetId: values.targetId, relation: values.relation });
      message.success('血缘关系创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLineage(id);
      message.success('删除成功');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const relationColorMap: Record<string, string> = {
    transforms: colors.primary[500],
    reads: colors.info[500],
    writes: colors.warning[500],
    depends_on: colors.purple[500],
  };

  const getItemName = (id: string) => items.find((i) => i.id === id)?.name || id;

  const columns = [
    { title: '来源', dataIndex: 'sourceId', key: 'sourceId', render: (id: string) => getItemName(id) },
    { title: '目标', dataIndex: 'targetId', key: 'targetId', render: (id: string) => getItemName(id) },
    {
      title: '关系', dataIndex: 'relation', key: 'relation',
      render: (r: string) => <Tag color={relationColorMap[r]}>{r}</Tag>,
    },
    { title: '描述', dataIndex: 'description', key: 'description', render: (v: string) => v || '-' },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: LineageRelation) => (
        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
          <Button size="small" type="link" danger>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <div>
          <Title level={3} style={{ marginBottom: spacing.sm }}>
            <PartitionOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            数据血缘
          </Title>
          <Text type="secondary">追踪数据资产间的流转和依赖关系</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<LinkOutlined />} onClick={() => setCreateModalOpen(true)}>添加血缘</Button>
        </Space>
      </div>
      <Table columns={columns} dataSource={relations} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      <Modal title="添加血缘关系" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="来源" name="sourceId" rules={[{ required: true, message: '请选择来源资产' }]}>
            <Select placeholder="选择来源资产">
              {items.map((item) => <Select.Option key={item.id} value={item.id}>{item.name} ({item.type})</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="目标" name="targetId" rules={[{ required: true, message: '请选择目标资产' }]}>
            <Select placeholder="选择目标资产">
              {items.map((item) => <Select.Option key={item.id} value={item.id}>{item.name} ({item.type})</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="关系" name="relation" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="transforms">Transforms</Select.Option>
              <Select.Option value="reads">Reads</Select.Option>
              <Select.Option value="writes">Writes</Select.Option>
              <Select.Option value="depends_on">Depends On</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============================================================================
// Main Page
// ============================================================================

const MetadataPage: React.FC = () => {
  const tabItems = [
    { key: 'catalog', label: '数据资产目录', children: <CatalogTab /> },
    { key: 'lineage', label: '数据血缘', children: <LineageTab /> },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Tabs defaultActiveKey="catalog" items={tabItems} size="large" />
    </div>
  );
};

export default MetadataPage;
