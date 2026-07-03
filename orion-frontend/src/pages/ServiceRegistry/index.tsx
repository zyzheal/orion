/**
 * Service Registry Page (Task 6.5)
 * 服务注册发现管理：列表、注册/注销、健康状态实时更新
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Table,
  Button,
  Space,
  Tag,
  Drawer,
  Descriptions,
  Statistic,
  Row,
  Col,
  message,
  Spin,
  Empty,
  Tooltip,
} from 'antd';
import {
  CloudServerOutlined,
  PlusOutlined,
  MinusCircleOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
  HeartOutlined,
} from '@ant-design/icons';
import {
  getServices,
  registerService,
  deregisterService,
  getServiceHealth,
  type ServiceInfo,
  type RegisterServicePayload,
  type ServiceHealth,
} from '@/api/service-registry';
import { colors, spacing, radius } from '@/tokens';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const ServiceRegistryPage: React.FC = () => {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceInfo | null>(null);
  const [healthDetail, setHealthDetail] = useState<ServiceHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);

  // ==================== Data Loading ====================

  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getServices();
      setServices(data);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载服务列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
    // 健康状态实时轮询（30s）
    const timer = setInterval(loadServices, 30000);
    return () => clearInterval(timer);
  }, [loadServices]);

  // ==================== Handlers ====================

  const handleRowClick = async (record: ServiceInfo) => {
    setSelectedService(record);
    setDrawerOpen(true);
    setHealthLoading(true);
    try {
      const health = await getServiceHealth(record.id);
      setHealthDetail(health);
    } catch {
      // 抽屉仍可展示基本信息
    } finally {
      setHealthLoading(false);
    }
  };

  const handleRegister = async (values: RegisterServicePayload) => {
    try {
      const created = await registerService(values);
      message.success(`服务 ${created.name} 注册成功`);
      setRegisterModalOpen(false);
      loadServices();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '注册服务失败');
    }
  };

  const handleDeregister = async (serviceId: string, serviceName: string) => {
    try {
      await deregisterService(serviceId);
      message.success(`服务 ${serviceName} 已注销`);
      if (selectedService?.id === serviceId) {
        setDrawerOpen(false);
      }
      loadServices();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '注销服务失败');
    }
  };

  // ==================== Health Badge ====================

  const healthTag = (health: string) => {
    const map: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      healthy:   { color: colors.success[500], icon: <CheckCircleOutlined />,    text: '健康' },
      unhealthy: { color: colors.error[500],   icon: <CloseCircleOutlined />,   text: '异常' },
      unknown:   { color: colors.neutral[400], icon: <QuestionCircleOutlined />, text: '未知' },
    };
    const cfg = map[health] ?? map.unknown;
    return (
      <Tag color={cfg.color} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: radius.sm }}>
        {cfg.icon} {cfg.text}
      </Tag>
    );
  };

  // ==================== Summary Stats ====================

  const totalServices = services.length;
  const healthyCount = services.filter((s) => s.health === 'healthy').length;
  const unhealthyCount = services.filter((s) => s.health === 'unhealthy').length;

  // ==================== Table Columns ====================

  const columns = [
    {
      title: '服务名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string) => (
        <Space>
          <CloudServerOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      render: (addr: string) => <Text code style={{ fontSize: 12 }}>{addr}</Text>,
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port',
      width: 100,
      sorter: (a: ServiceInfo, b: ServiceInfo) => a.port - b.port,
    },
    {
      title: '健康状态',
      dataIndex: 'health',
      key: 'health',
      width: 130,
      filters: [
        { text: '健康', value: 'healthy' },
        { text: '异常', value: 'unhealthy' },
        { text: '未知', value: 'unknown' },
      ],
      onFilter: (value: string | number | boolean, record: ServiceInfo) => record.health === value,
      render: (health: string) => healthTag(health),
    },
    {
      title: '注册时间',
      dataIndex: 'registeredAt',
      key: 'registeredAt',
      width: 180,
      sorter: (a: ServiceInfo, b: ServiceInfo) =>
        dayjs(a.registeredAt).unix() - dayjs(b.registeredAt).unix(),
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 130,
      fixed: 'right' as const,
      render: (_: unknown, record: ServiceInfo) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              icon={<HeartOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleRowClick(record);
              }}
            >
              详情
            </Button>
          </Tooltip>
          <Tooltip title="注销服务">
            <Button
              type="link"
              size="small"
              danger
              icon={<MinusCircleOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleDeregister(record.id, record.name);
              }}
            >
              注销
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ==================== Drawer Detail View ====================

  const drawerExtra = selectedService && (
    <Space>
      <Button
        danger
        icon={<MinusCircleOutlined />}
        onClick={() => handleDeregister(selectedService.id, selectedService.name)}
      >
        注销服务
      </Button>
    </Space>
  );

  // ==================== Register Modal ====================

  const [registerForm] = (() => {
    // Inline simple form state
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [port, setPort] = useState<number>(3000);
    const [submitting, setSubmitting] = useState(false);

    const submit = async () => {
      if (!name.trim() || !address.trim()) {
        message.warning('请填写服务名称和地址');
        return;
      }
      setSubmitting(true);
      try {
        await handleRegister({ name: name.trim(), address: address.trim(), port });
        setName('');
        setAddress('');
        setPort(3000);
      } finally {
        setSubmitting(false);
      }
    };

    return { name, setName, address, setAddress, port, setPort, submitting, submit };
  })();

  // ==================== Render ====================

  return (
    <Spin spinning={loading}>
      <div style={{ padding: spacing.lg }}>
        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg, flexWrap: 'wrap', gap: spacing.md }}>
          <div>
            <Title level={2} style={{ marginBottom: spacing.sm }}>
              <CloudServerOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
              服务注册中心
            </Title>
            <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14 }}>
              管理微服务注册、发现与健康状态
            </Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadServices}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setRegisterModalOpen(true)}>
              注册服务
            </Button>
          </Space>
        </div>

        {/* Summary Statistics */}
        <Row gutter={16} style={{ marginBottom: spacing.lg }}>
          <Col span={8}>
            <Card>
              <Statistic title="服务总数" value={totalServices} prefix={<CloudServerOutlined />} />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="健康服务"
                value={healthyCount}
                valueStyle={{ color: colors.success[500] }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="异常服务"
                value={unhealthyCount}
                valueStyle={{ color: unhealthyCount > 0 ? colors.error[500] : colors.neutral[400] }}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* Service Table */}
        <Card styles={{ body: { padding: 0 } }}>
          <Table<ServiceInfo>
            rowKey="id"
            columns={columns}
            dataSource={services}
            onRow={(record) => ({
              onClick: () => handleRowClick(record),
              style: { cursor: 'pointer' },
            })}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 个服务` }}
            scroll={{ x: 900 }}
            locale={{ emptyText: <Empty description="暂无已注册服务" /> }}
          />
        </Card>

        {/* Service Detail Drawer */}
        <Drawer
          title={selectedService ? `服务详情 - ${selectedService.name}` : '服务详情'}
          placement="right"
          width={480}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          extra={drawerExtra}
        >
          {selectedService && (
            <Spin spinning={healthLoading}>
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                {/* Basic Info */}
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="服务 ID">{selectedService.id}</Descriptions.Item>
                  <Descriptions.Item label="服务名称">{selectedService.name}</Descriptions.Item>
                  <Descriptions.Item label="服务地址">
                    <Text code>{selectedService.address}:{selectedService.port}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="健康状态">
                    {healthTag(selectedService.health)}
                  </Descriptions.Item>
                  <Descriptions.Item label="注册时间">
                    {dayjs(selectedService.registeredAt).format('YYYY-MM-DD HH:mm:ss')}
                  </Descriptions.Item>
                  {selectedService.lastHeartbeat && (
                    <Descriptions.Item label="最后心跳">
                      {dayjs(selectedService.lastHeartbeat).format('YYYY-MM-DD HH:mm:ss')}
                    </Descriptions.Item>
                  )}
                </Descriptions>

                {/* Metadata */}
                {selectedService.metadata && Object.keys(selectedService.metadata).length > 0 && (
                  <Card size="small" title="元数据">
                    <Descriptions column={1} size="small">
                      {Object.entries(selectedService.metadata).map(([k, v]) => (
                        <Descriptions.Item key={k} label={k}>
                          {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                        </Descriptions.Item>
                      ))}
                    </Descriptions>
                  </Card>
                )}

                {/* Health Detail */}
                {healthDetail && (
                  <Card
                    size="small"
                    title={
                      <Space>
                        <HeartOutlined style={{ color: colors.primary[500] }} />
                        健康详情
                      </Space>
                    }
                  >
                    <Row gutter={12}>
                      <Col span={12}>
                        <Statistic
                          title="延迟"
                          value={healthDetail.latencyMs}
                          suffix="ms"
                          valueStyle={{ color: healthDetail.latencyMs > 500 ? colors.error[500] : colors.success[500] }}
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title="错误率"
                          value={healthDetail.errorRate}
                          suffix="%"
                          precision={2}
                          valueStyle={{ color: healthDetail.errorRate > 5 ? colors.error[500] : colors.success[500] }}
                        />
                      </Col>
                    </Row>
                    <div style={{ marginTop: spacing.sm }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        最近检测：{dayjs(healthDetail.lastChecked).format('YYYY-MM-DD HH:mm:ss')}
                      </Text>
                    </div>
                  </Card>
                )}
              </Space>
            </Spin>
          )}
        </Drawer>

        {/* Register Service Modal */}
        {registerModalOpen && (
          <Drawer
            title="注册新服务"
            placement="right"
            width={400}
            open={registerModalOpen}
            onClose={() => setRegisterModalOpen(false)}
            footer={
              <Space style={{ float: 'right' }}>
                <Button onClick={() => setRegisterModalOpen(false)}>取消</Button>
                <Button type="primary" onClick={() => (registerForm as any).submit()} loading={(registerForm as any).submitting}>
                  注册
                </Button>
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>服务名称 *</Text>
                <input
                  style={{ width: '100%', padding: '6px 12px', border: `1px solid ${colors.neutral[300]}`, borderRadius: radius.sm }}
                  placeholder="例如：order-service"
                  value={registerForm.name}
                  onChange={(e) => (registerForm as any).setName(e.target.value)}
                />
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>服务地址 *</Text>
                <input
                  style={{ width: '100%', padding: '6px 12px', border: `1px solid ${colors.neutral[300]}`, borderRadius: radius.sm }}
                  placeholder="例如：10.0.1.5"
                  value={registerForm.address}
                  onChange={(e) => (registerForm as any).setAddress(e.target.value)}
                />
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>端口号 *</Text>
                <input
                  type="number"
                  style={{ width: '100%', padding: '6px 12px', border: `1px solid ${colors.neutral[300]}`, borderRadius: radius.sm }}
                  value={registerForm.port}
                  onChange={(e) => (registerForm as any).setPort(Number(e.target.value))}
                />
              </div>
            </Space>
          </Drawer>
        )}
      </div>
    </Spin>
  );
};

export default ServiceRegistryPage;
