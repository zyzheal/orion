/**
 * 服务目录 (Service Catalog)
 * 后端: /api/v1/service-catalog — 服务注册、请求生命周期、SLA 违约
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Tag,
  Space,
  Row,
  Col,
  message,
  Typography,
  Empty,
  Descriptions,
  Popconfirm,
  Tabs,
  Switch,
} from 'antd';
import {
  AppstoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import {
  listCatalogItems,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  getSLABreaches,
  type ServiceCatalog,
  type SLABreach,
} from '@/api/service-catalog';

const { Title } = Typography;
const { TextArea } = Input;

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待处理' },
  approved: { color: 'green', label: '已批准' },
  in_progress: { color: 'gold', label: '处理中' },
  fulfilled: { color: 'green', label: '已完成' },
  rejected: { color: 'red', label: '已拒绝' },
  cancelled: { color: 'default', label: '已取消' },
};

const ServiceCatalogPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'sla'>('catalog');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ServiceCatalog | null>(null);
  const [form] = Form.useForm();

  const [items, setItems] = useState<ServiceCatalog[]>([]);
  const [breaches, setBreaches] = useState<SLABreach[]>([]);
  const [totalBreaches, setTotalBreaches] = useState(0);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCatalogItems();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      message.error('加载服务目录失败');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBreaches = useCallback(async () => {
    try {
      const data = await getSLABreaches({ limit: 20 });
      setBreaches(data?.breaches || []);
      setTotalBreaches(data?.total || 0);
    } catch {
      message.error('加载 SLA 违约记录失败');
      setBreaches([]);
      setTotalBreaches(0);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);
  useEffect(() => {
    loadBreaches();
  }, [loadBreaches]);

  const handleCreate = () => {
    setSelectedItem(null);
    form.resetFields();
    setModalOpen(true);
  };
  const handleEdit = (r: ServiceCatalog) => {
    setSelectedItem(r);
    form.setFieldsValue(r);
    setModalOpen(true);
  };
  const handleViewDetail = (r: ServiceCatalog) => {
    setSelectedItem(r);
    setDetailOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const values = await form.validateFields();
      if (selectedItem) {
        await updateCatalogItem(selectedItem.id, values);
        message.success('更新成功');
      } else {
        await createCatalogItem(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      form.resetFields();
      loadItems();
    } catch (error: unknown) {
      if (!(error instanceof Error) && (error as { errorFields?: unknown[] })?.errorFields) {
        return;
      }
      message.error('保存服务目录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复',
      onOk: async () => {
        try {
          await deleteCatalogItem(id);
          message.success('删除成功');
          loadItems();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '值', dataIndex: 'value', key: 'value', ellipsis: true },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '是' : '否'}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, r: ServiceCatalog) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(r)}
          >
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const breachColumns = [
    { title: '请求ID', dataIndex: 'requestId', key: 'requestId', ellipsis: true },
    { title: '服务', dataIndex: 'service', key: 'service' },
    { title: 'SLA目标(ms)', dataIndex: 'slaTargetMs', key: 'slaTargetMs', width: 120 },
    { title: '实际(ms)', dataIndex: 'actualMs', key: 'actualMs', width: 100 },
    { title: '超时(ms)', dataIndex: 'overdueMs', key: 'overdueMs', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => (
        <Tag color={STATUS_CONFIG[v]?.color || 'default'}>{STATUS_CONFIG[v]?.label || v}</Tag>
      ),
    },
  ];

  const enabledCount = items.filter((i) => i.enabled).length;

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <AppstoreOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        服务目录
      </Title>
      <Typography.Text type="secondary" style={{ marginBottom: spacing.md, display: 'block' }}>
        服务注册管理 · 请求生命周期 · SLA 违约追踪
      </Typography.Text>

      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card>
            <Typography.Text type="secondary">服务总数</Typography.Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.primary[500] }}>
              {items.length}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Typography.Text type="secondary">已启用</Typography.Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.success[500] }}>
              {enabledCount}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Typography.Text type="secondary">SLA 违约总数</Typography.Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.error[500] }}>
              {totalBreaches}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Typography.Text type="secondary">活跃违约</Typography.Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.warning[500] }}>
              {breaches.length}
            </div>
          </Card>
        </Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k as 'catalog' | 'sla')}>
        <Tabs.TabPane tab={`服务目录 (${items.length})`} key="catalog" />
        <Tabs.TabPane tab={`SLA 违约 (${totalBreaches})`} key="sla" />
      </Tabs>

      {activeTab === 'catalog' && (
        <Card
          title="服务目录"
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} size="small" onClick={loadItems} loading={loading}>
                刷新
              </Button>
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCreate}>
                新建服务
              </Button>
            </Space>
          }
        >
          {items.length === 0 ? (
            <Empty description="暂无服务，请注册第一个服务" />
          ) : (
            <Table
              columns={columns}
              dataSource={items}
              rowKey="id"
              loading={loading}
              size="small"
              pagination={{ pageSize: 10, showTotal: (t: number) => `共 ${t} 条` }}
            />
          )}
        </Card>
      )}

      {activeTab === 'sla' && (
        <Card
          title={
            <>
              <BellOutlined /> SLA 违约记录
            </>
          }
          extra={
            <Button icon={<ReloadOutlined />} size="small" onClick={loadBreaches}>
              刷新
            </Button>
          }
        >
          {breaches.length === 0 ? (
            <Empty description="暂无 SLA 违约记录" />
          ) : (
            <Table
              columns={breachColumns}
              dataSource={breaches}
              rowKey="requestId"
              size="small"
              pagination={{ pageSize: 10 }}
            />
          )}
        </Card>
      )}

      <Modal
        title={selectedItem ? '编辑服务' : '新建服务'}
        open={modalOpen}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText={selectedItem ? '保存' : '创建'}
        onCancel={() => setModalOpen(false)}
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="服务名称"
            rules={[{ required: true, message: '请输入服务名称' }]}
          >
            <Input placeholder="e.g. user-service" />
          </Form.Item>
          <Form.Item name="value" label="服务值">
            <TextArea rows={3} placeholder="服务描述或配置值" />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="服务详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
        width={560}
      >
        {selectedItem && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="服务 ID">{selectedItem.id}</Descriptions.Item>
            <Descriptions.Item label="服务名称">{selectedItem.name}</Descriptions.Item>
            <Descriptions.Item label="服务值">
              <pre style={{ margin: 0, fontSize: 12, maxHeight: 120, overflow: 'auto' }}>
                {selectedItem.value}
              </pre>
            </Descriptions.Item>
            <Descriptions.Item label="启用状态">
              <Tag color={selectedItem.enabled ? 'green' : 'default'}>
                {selectedItem.enabled ? '已启用' : '已禁用'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {selectedItem.updatedAt ? new Date(selectedItem.updatedAt).toLocaleString() : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default ServiceCatalogPage;
