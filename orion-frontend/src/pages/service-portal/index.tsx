/**
 * ServicePortal — 开发者服务门户
 * 对接后端 /api/v1/service-registry 服务注册与发现
 * 含服务列表、注册、健康监控
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@/providers/QueryProvider';
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
  Select,
  message,
  Popconfirm,
  Empty,
  Descriptions,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  AppstoreOutlined,
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getServices,
  registerService,
  deregisterService,
  getServiceHealth,
  type ServiceInfo,
  type RegisterServicePayload,
  type ServiceHealth,
} from '@/api/service-registry';
import { colors } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';

const { Title, Text } = Typography;

const HEALTH_STATUS: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  healthy: { color: 'green', icon: <CheckCircleOutlined />, label: '健康' },
  unhealthy: { color: 'red', icon: <CloseCircleOutlined />, label: '不健康' },
  degraded: { color: 'orange', icon: <WarningOutlined />, label: '降级' },
  unknown: { color: 'default', icon: <WarningOutlined />, label: '未知' },
};

const ServicePortalPage: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceInfo | null>(null);
  const [healthData, setHealthData] = useState<ServiceHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [form] = Form.useForm();

  const { data: rawData, isLoading: loading, refetch } = useQuery<ServiceInfo[]>({
    queryKey: ['service-registry/services'],
    queryFn: async () => {
      const data = await getServices();
      return Array.isArray(data) ? data : [];
    },
    retry: 0,
    staleTime: 30_000,
  });

  const services = rawData ?? [];

  const handleRegister = () => {
    form.resetFields();
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await registerService(values as RegisterServicePayload);
      message.success('服务注册成功');
      setModalOpen(false);
      refetch();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeregister = async (id: string) => {
    try {
      await deregisterService(id);
      message.success('服务已注销');
      refetch();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '注销失败');
    }
  };

  const handleViewDetail = async (record: ServiceInfo) => {
    setSelectedService(record);
    setDetailOpen(true);
    setHealthLoading(true);
    setHealthData(null);
    try {
      const health = await getServiceHealth(record.id);
      setHealthData(health);
    } catch {
      message.error('加载服务健康数据失败');
      setHealthData(null);
    } finally {
      setHealthLoading(false);
    }
  };

  const healthStats = useMemo(() => {
    const total = services.length;
    const healthy = services.filter((s) => s.health === 'healthy').length;
    const unhealthy = services.filter((s) => s.health === 'unhealthy').length;
    const degraded = services.filter((s) => s.health === 'degraded').length;
    return { total, healthy, unhealthy, degraded };
  }, [services]);

  const columns: ColumnsType<ServiceInfo> = useMemo(
    () => [
      {
        title: '服务名称',
        dataIndex: 'name',
        key: 'name',
        width: '18%',
        render: (text: string) => <Text strong>{text}</Text>,
      },
      {
        title: '服务 ID',
        dataIndex: 'serviceId',
        key: 'serviceId',
        width: '15%',
        render: (val: string) => <Text code>{val}</Text>,
      },
      {
        title: '地址',
        dataIndex: 'address',
        key: 'address',
        width: '15%',
        render: (addr: string, record: ServiceInfo) =>
          `${addr}:${record.port}`,
      },
      {
        title: '协议',
        dataIndex: 'protocol',
        key: 'protocol',
        width: '10%',
        render: (val: string | undefined) => val ? <Tag>{val.toUpperCase()}</Tag> : '-',
      },
      {
        title: '版本',
        dataIndex: 'version',
        key: 'version',
        width: '10%',
        render: (val: string | undefined) => val || '-',
      },
      {
        title: '健康状态',
        dataIndex: 'health',
        key: 'health',
        width: '12%',
        render: (health: string) => {
          const info = HEALTH_STATUS[health] || HEALTH_STATUS.unknown;
          return (
            <Tag icon={info.icon} color={info.color}>
              {info.label}
            </Tag>
          );
        },
      },
      {
        title: '操作',
        key: 'action',
        width: '20%',
        render: (_: unknown, record: ServiceInfo) => (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            >
              详情
            </Button>
            <Popconfirm
              title="确认注销此服务？"
              onConfirm={() => handleDeregister(record.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                注销
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    []
  );

  // 初始加载骨架屏，提升感知性能
  return loading ? (
    <PageSkeleton rows={8} />
  ) : (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <AppstoreOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        开发者门户
      </Title>
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
        一站式开发者服务入口 — 服务注册、发现与健康监控
      </Text>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card style={{ borderRadius: 12 }} size="small">
            <Statistic title="服务总数" value={healthStats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12 }} size="small">
            <Statistic
              title="健康"
              value={healthStats.healthy}
              valueStyle={{ color: colors.success[500] }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12 }} size="small">
            <Statistic
              title="降级"
              value={healthStats.degraded}
              valueStyle={{ color: colors.warning[500] }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12 }} size="small">
            <Statistic
              title="不健康"
              value={healthStats.unhealthy}
              valueStyle={{ color: colors.error[500] }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleRegister}>
            注册服务
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadServices} loading={loading}>
            刷新
          </Button>
        </Space>
        <Table<ServiceInfo>
          columns={columns}
          dataSource={services}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 项`,
          }}
          locale={{ emptyText: <Empty description="暂无注册服务" /> }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* 注册服务 Modal */}
      <Modal
        title="注册服务"
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
        okText="注册"
        cancelText="取消"
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="serviceId"
            label="服务 ID"
            rules={[{ required: true, message: '请输入服务唯一标识' }]}
          >
            <Input placeholder="如：user-service, payment-api" />
          </Form.Item>
          <Form.Item
            name="serviceName"
            label="服务名称"
            rules={[{ required: true, message: '请输入服务显示名称' }]}
          >
            <Input placeholder="如：用户服务, 支付 API" />
          </Form.Item>
          <Form.Item
            name="serviceUrl"
            label="服务地址"
            rules={[{ required: true, message: '请输入服务 URL' }]}
          >
            <Input placeholder="如：http://localhost:8080" />
          </Form.Item>
          <Form.Item name="protocol" label="协议" initialValue="http">
            <Select
              options={[
                { label: 'HTTP', value: 'http' },
                { label: 'gRPC', value: 'grpc' },
                { label: 'TCP', value: 'tcp' },
                { label: '自定义', value: 'custom' },
              ]}
            />
          </Form.Item>
          <Form.Item name="version" label="版本">
            <Input placeholder="如：1.0.0" />
          </Form.Item>
          <Form.Item name="metadata" label="元数据">
            <Input.TextArea rows={3} placeholder='JSON 格式，如：{"region":"cn-north","env":"prod"}' />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情 Modal */}
      <Modal
        title={selectedService ? selectedService.name : '服务详情'}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={640}
        destroyOnClose
      >
        {selectedService && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="名称">{selectedService.name}</Descriptions.Item>
              <Descriptions.Item label="服务 ID">
                <Text code>{selectedService.serviceId}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="地址">
                {selectedService.address}:{selectedService.port}
              </Descriptions.Item>
              <Descriptions.Item label="协议">
                {selectedService.protocol?.toUpperCase() || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="版本">{selectedService.version || '-'}</Descriptions.Item>
              <Descriptions.Item label="注册时间">
                {selectedService.registeredAt
                  ? new Date(selectedService.registeredAt).toLocaleString('zh-CN')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="心跳">
                {selectedService.lastHeartbeat
                  ? new Date(selectedService.lastHeartbeat).toLocaleString('zh-CN')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="健康状态">
                <Tag icon={HEALTH_STATUS[selectedService.health]?.icon} color={HEALTH_STATUS[selectedService.health]?.color}>
                  {HEALTH_STATUS[selectedService.health]?.label || '未知'}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Title level={5}>健康详情</Title>
            {healthLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}>加载中...</div>
            ) : healthData ? (
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="状态">
                  <Tag icon={HEALTH_STATUS[healthData.status]?.icon} color={HEALTH_STATUS[healthData.status]?.color}>
                    {HEALTH_STATUS[healthData.status]?.label || '未知'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="延迟 (ms)">{healthData.latencyMs}</Descriptions.Item>
                <Descriptions.Item label="错误率">{healthData.errorRate}%</Descriptions.Item>
                <Descriptions.Item label="最后检查">
                  {new Date(healthData.lastChecked).toLocaleString('zh-CN')}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Empty description="暂无健康数据" />
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default ServicePortalPage;