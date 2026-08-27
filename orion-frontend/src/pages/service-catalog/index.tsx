/**
 * ServiceCatalog — 服务目录
 * 对接后端 /api/v1/service-catalog 完整 CRUD
 * 含服务请求生命周期管理 + SLA 违规监控
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Switch,
  message,
  Popconfirm,
  Empty,
  Tabs,
  Descriptions,
} from 'antd';
import {
  CloudServerOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EyeOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  listCatalogItems,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  getCatalogItem,
  getRequestTimeline,
  getSLABreaches,
  type ServiceCatalog,
  type SLABreach,
  type TimelineEntry,
} from '@/api/service-catalog';
import { colors } from '@/tokens';

const { Title, Text } = Typography;

const SLA_STATUS_MAP: Record<string, { color: string; label: string }> = {
  breached: { color: 'red', label: '已违规' },
  warning: { color: 'orange', label: '接近违规' },
  ok: { color: 'green', label: '正常' },
};

const ServiceCatalogPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ServiceCatalog[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceCatalog | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('catalog');
  const [selectedItem, setSelectedItem] = useState<ServiceCatalog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [slaBreaches, setSlaBreaches] = useState<SLABreach[]>([]);
  const [slaLoading, setSlaLoading] = useState(false);
  const [form] = Form.useForm();

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCatalogItems();
      setItems(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载服务目录失败');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSLABreaches = useCallback(async () => {
    setSlaLoading(true);
    try {
      const data = await getSLABreaches();
      setSlaBreaches(data.breaches || []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载 SLA 数据失败');
      setSlaBreaches([]);
    } finally {
      setSlaLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (activeTab === 'sla') {
      loadSLABreaches();
    }
  }, [activeTab, loadSLABreaches]);

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = async (record: ServiceCatalog) => {
    setEditingItem(record);
    try {
      const detail = await getCatalogItem(record.id);
      form.setFieldsValue({
        name: detail.name,
        value: detail.value,
        enabled: detail.enabled,
      });
    } catch {
      form.setFieldsValue({
        name: record.name,
        value: record.value,
        enabled: record.enabled,
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingItem) {
        await updateCatalogItem(editingItem.id, values);
        message.success('更新服务目录成功');
      } else {
        await createCatalogItem(values);
        message.success('创建服务目录成功');
      }
      setModalOpen(false);
      loadItems();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCatalogItem(id);
      message.success('删除成功');
      loadItems();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleViewDetail = async (record: ServiceCatalog) => {
    setSelectedItem(record);
    setDetailOpen(true);
    try {
      const entries = await getRequestTimeline(record.id);
      setTimeline(Array.isArray(entries) ? entries : []);
    } catch {
      setTimeline([]);
    }
  };

  const columns: ColumnsType<ServiceCatalog> = useMemo(
    () => [
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        width: '20%',
        render: (text: string) => <Text strong>{text}</Text>,
      },
      {
        title: '值',
        dataIndex: 'value',
        key: 'value',
        width: '20%',
        ellipsis: true,
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        key: 'enabled',
        width: '10%',
        render: (enabled: boolean) =>
          enabled ? (
            <Tag color="green">启用</Tag>
          ) : (
            <Tag color="default">停用</Tag>
          ),
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: '18%',
        render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: '18%',
        render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
      },
      {
        title: '操作',
        key: 'action',
        width: '14%',
        render: (_: unknown, record: ServiceCatalog) => (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            >
              详情
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            <Popconfirm
              title="确认删除此服务目录项？"
              onConfirm={() => handleDelete(record.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    []
  );

  const slaColumns: ColumnsType<SLABreach> = useMemo(
    () => [
      {
        title: '请求 ID',
        dataIndex: 'requestId',
        key: 'requestId',
        width: '20%',
      },
      {
        title: '服务',
        dataIndex: 'service',
        key: 'service',
        width: '15%',
      },
      {
        title: 'SLA 目标(ms)',
        dataIndex: 'slaTargetMs',
        key: 'slaTargetMs',
        width: '15%',
      },
      {
        title: '实际(ms)',
        dataIndex: 'actualMs',
        key: 'actualMs',
        width: '12%',
      },
      {
        title: '超时(ms)',
        dataIndex: 'overdueMs',
        key: 'overdueMs',
        width: '12%',
        render: (val: number) => (
          <Text type="danger">{val.toLocaleString()}</Text>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: '12%',
        render: (status: string) => {
          const info = SLA_STATUS_MAP[status] || { color: 'default', label: status };
          return <Tag color={info.color}>{info.label}</Tag>;
        },
      },
    ],
    []
  );

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <CloudServerOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        服务目录
      </Title>
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
        管理可复用的服务模板、元数据，监控服务请求 SLA 合规
      </Text>

      <Card
        style={{ borderRadius: 12 }}
        styles={{ body: { padding: 0 } }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ padding: '16px 16px 0' }}
          tabBarExtraContent={
            activeTab === 'catalog' ? (
              <Space>
                <Button icon={<ReloadOutlined />} onClick={loadItems} loading={loading}>
                  刷新
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                  新建
                </Button>
              </Space>
            ) : (
              <Button icon={<ReloadOutlined />} onClick={loadSLABreaches} loading={slaLoading}>
                刷新
              </Button>
            )
          }
          items={[
            {
              key: 'catalog',
              label: (
                <span>
                  <CloudServerOutlined /> 服务目录
                </span>
              ),
              children: (
                <div style={{ padding: '0 16px 16px' }}>
                  <Table<ServiceCatalog>
                    columns={columns}
                    dataSource={items}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 项` }}
                    locale={{ emptyText: <Empty description="暂无服务目录数据" /> }}
                    scroll={{ x: 900 }}
                  />
                </div>
              ),
            },
            {
              key: 'sla',
              label: (
                <span>
                  <ClockCircleOutlined /> SLA 违规监控
                </span>
              ),
              children: (
                <div style={{ padding: '0 16px 16px' }}>
                  <Table<SLABreach>
                    columns={slaColumns}
                    dataSource={slaBreaches}
                    rowKey="requestId"
                    loading={slaLoading}
                    pagination={{ pageSize: 20, showSizeChanger: true }}
                    locale={{ emptyText: <Empty description="暂无 SLA 违规记录" /> }}
                    scroll={{ x: 900 }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* 创建/编辑 Modal */}
      <Modal
        title={editingItem ? '编辑服务目录' : '新建服务目录'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
        okText={editingItem ? '保存' : '创建'}
        cancelText="取消"
        width={520}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ enabled: true }}
        >
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入服务目录名称' }]}
          >
            <Input placeholder="请输入服务目录名称" />
          </Form.Item>
          <Form.Item name="value" label="值">
            <Input.TextArea rows={3} placeholder="请输入服务目录值（可选）" />
          </Form.Item>
          <Form.Item name="enabled" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情 Drawer */}
      <Modal
        title="服务目录详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={640}
        destroyOnClose
      >
        {selectedItem && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="名称">{selectedItem.name}</Descriptions.Item>
              <Descriptions.Item label="值">{selectedItem.value || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                {selectedItem.enabled ? <Tag color="green">启用</Tag> : <Tag color="default">停用</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleString('zh-CN') : '-'}
              </Descriptions.Item>
            </Descriptions>
            <Title level={5}>请求时间线</Title>
            {timeline.length === 0 ? (
              <Empty description="暂无时间线记录" />
            ) : (
              timeline.map((entry, i) => (
                <Card key={i} size="small" style={{ marginBottom: 8, borderRadius: 8 }}>
                  <Space direction="vertical" size={2}>
                    <Text strong>{entry.action}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {entry.by} · {new Date(entry.at).toLocaleString('zh-CN')}
                    </Text>
                    {entry.comment && <Text>{entry.comment}</Text>}
                  </Space>
                </Card>
              ))
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default ServiceCatalogPage;