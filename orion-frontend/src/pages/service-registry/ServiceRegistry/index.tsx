/**
 * Service Registry Page (Phase 6 Service Governance)
 *
 * Features:
 * - Service list with health status, address, port, protocol, version
 * - Search by service name
 * - Filter by health status
 * - Register new service via Modal form
 * - Deregister service with confirmation
 * - Refresh service list
 * - Empty state with guided action
 */

import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  message,
  Empty,
  Modal,
  Input,
  Select,
  Form,
  Card,
  Tooltip,
} from 'antd';
import {
  SettingOutlined,
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  HeartOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import {
  getServices,
  registerService,
  deregisterService,
  type ServiceInfo,
  type GetServicesParams,
} from '@/api/service-registry';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { Option } = Select;

// ==================== Health Status Config ====================

const HEALTH_STATUS_CONFIG: Record<
  string,
  { color: string; label: string; icon?: React.ReactNode }
> = {
  healthy: { color: colors.success[500], label: '健康' },
  unhealthy: { color: colors.error[500], label: '异常' },
  degraded: { color: colors.warning[500], label: '降级' },
  unknown: { color: colors.neutral[500], label: '未知' },
};

// ==================== Component ====================

const ServiceRegistry: React.FC = () => {
  // Data state
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [healthFilter, setHealthFilter] = useState<string | undefined>(undefined);

  // Register modal state
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerForm] = Form.useForm();

  // Deregister confirmation state
  const [deregisteringId, setDeregisteringId] = useState<string | null>(null);
  const [deregisterLoading, setDeregisterLoading] = useState(false);

  // ==================== Data Loading ====================

  const loadServices = async () => {
    setLoading(true);
    try {
      const params: GetServicesParams = {};
      if (searchText.trim()) {
        params.serviceName = searchText.trim();
      }
      if (healthFilter) {
        params.health = healthFilter;
      }
      const data = await getServices(params);
      setServices(data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载服务列表失败：${error.message}`);
      } else {
        message.error('加载服务列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, [searchText, healthFilter]);

  // ==================== Event Handlers ====================

  const handleRefresh = () => {
    loadServices();
    message.info('正在刷新服务列表...');
  };

  const handleRegister = async (values: {
    serviceId: string;
    serviceName: string;
    serviceUrl: string;
    protocol: string;
    version: string;
  }) => {
    setRegisterLoading(true);
    try {
      await registerService({
        serviceId: values.serviceId,
        serviceName: values.serviceName,
        serviceUrl: values.serviceUrl,
        protocol: values.protocol as 'http' | 'grpc' | 'tcp' | 'custom',
        version: values.version || undefined,
      });
      message.success(`服务 "${values.serviceName}" 注册成功`);
      setRegisterModalVisible(false);
      registerForm.resetFields();
      loadServices();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`注册服务失败：${error.message}`);
      } else {
        message.error('注册服务失败，请稍后重试');
      }
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleDeregister = async (record: ServiceInfo) => {
    setDeregisteringId(record.id);
    setDeregisterLoading(true);
    try {
      await deregisterService(record.id);
      message.success(`服务 "${record.name}" 已取消注册`);
      loadServices();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`取消注册失败：${error.message}`);
      } else {
        message.error('取消注册失败，请稍后重试');
      }
    } finally {
      setDeregisterLoading(false);
      setDeregisteringId(null);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const handleHealthFilterChange = (value: string) => {
    setHealthFilter(value || undefined);
  };

  // ==================== Table Columns ====================

  const columns: TableColumn<ServiceInfo>[] = [
    {
      key: 'name',
      title: '服务名',
      dataIndex: 'name',
      width: 180,
      render: (_value: unknown, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ color: colors.primary[500] }}>
            {record.name}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            {record.serviceId}
          </Text>
        </Space>
      ),
    },
    {
      key: 'address',
      title: '地址',
      dataIndex: 'address',
      width: 160,
      render: (value: unknown) => <Text code>{String(value)}</Text>,
    },
    {
      key: 'port',
      title: '端口',
      dataIndex: 'port',
      width: 90,
      render: (value: unknown) => <Tag color="blue">{String(value)}</Tag>,
    },
    {
      key: 'protocol',
      title: '协议',
      dataIndex: 'protocol',
      width: 100,
      render: (value: unknown) => {
        const protocol = String(value || 'http');
        const colorMap: Record<string, string> = {
          http: 'blue',
          grpc: 'green',
          tcp: 'orange',
          custom: 'purple',
        };
        return <Tag color={colorMap[protocol] || 'default'}>{protocol.toUpperCase()}</Tag>;
      },
    },
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 100,
      render: (value: unknown) => <Text type="secondary">{String(value || '-')}</Text>,
    },
    {
      key: 'health',
      title: '健康状态',
      dataIndex: 'health',
      width: 120,
      render: (value: unknown) => {
        const health = String(value || 'unknown');
        const config = HEALTH_STATUS_CONFIG[health] || HEALTH_STATUS_CONFIG.unknown;
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      key: 'lastHeartbeat',
      title: '最后心跳',
      dataIndex: 'lastHeartbeat',
      width: 160,
      render: (value: unknown) => {
        const time = String(value || '');
        if (!time) {
          return <Text type="secondary">暂无</Text>;
        }
        return (
          <Tooltip title={dayjs(time).format('YYYY-MM-DD HH:mm:ss')}>
            <Text type="secondary">{dayjs(time).fromNow()}</Text>
          </Tooltip>
        );
      },
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      fixed: 'right',
      render: (_: unknown, record) => (
        <Space size="small">
          <Tooltip title="发送心跳">
            <Button
              type="link"
              size="small"
              icon={<HeartOutlined />}
              onClick={async () => {
                try {
                  // 使用 fetch 直接调用心跳接口，因为 API client 未导出 heartbeat
                  const { api } = await import('@/api/client');
                  await api.post(`/v1/service-registry/services/${record.id}/heartbeat`);
                  message.success(`心跳已发送：${record.name}`);
                  loadServices();
                } catch (error: unknown) {
                  if (error instanceof Error) {
                    message.error(`发送心跳失败：${error.message}`);
                  } else {
                    message.error('发送心跳失败，请稍后重试');
                  }
                }
              }}
            >
              心跳
            </Button>
          </Tooltip>
          <Tooltip title="取消注册">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deregisteringId === record.id && deregisterLoading}
              disabled={deregisteringId === record.id}
              onClick={() => {
                Modal.confirm({
                  title: '确认取消注册',
                  content: `确定要取消注册服务 "${record.name}" 吗？此操作不可恢复。`,
                  okText: '确认取消注册',
                  okType: 'danger',
                  cancelText: '再想想',
                  onOk: () => handleDeregister(record),
                });
              }}
            >
              取消注册
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ==================== Render ====================

  return (
    <div style={{ padding: 0 }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <SettingOutlined style={{ marginRight: spacing[3], color: colors.purple[500] }} />
            服务注册中心
          </Title>
          <Text type="secondary">
            共 {services.length} 个已注册服务
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setRegisterModalVisible(true)}
          >
            注册新服务
          </Button>
        </Space>
      </div>

      {/* Search and filter bar */}
      <Card
        size="small"
        style={{ marginBottom: spacing.md, borderRadius: componentRadius.card }}
      >
        <Space size="middle" wrap>
          <Input
            placeholder="搜索服务名..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={handleSearchChange}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder="健康状态"
            value={healthFilter}
            onChange={handleHealthFilterChange}
            style={{ width: 140 }}
            allowClear
          >
            <Option value="healthy">健康</Option>
            <Option value="unhealthy">异常</Option>
            <Option value="degraded">降级</Option>
            <Option value="unknown">未知</Option>
          </Select>
        </Space>
      </Card>

      {/* Service table or empty state */}
      {services.length === 0 && !loading ? (
        <Card
          style={{
            borderRadius: componentRadius.card,
            boxShadow: shadows.card,
            textAlign: 'center',
            padding: spacing.xxl,
          }}
        >
          <Empty
            description="暂无已注册的服务"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setRegisterModalVisible(true)}
            >
              注册第一个服务
            </Button>
          </Empty>
        </Card>
      ) : (
        <Table
          columns={columns}
          dataSource={services}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
          clientPagination
          pageSizeOptions={[10, 20, 50]}
        />
      )}

      {/* Register Service Modal */}
      <Modal
        title="注册新服务"
        open={registerModalVisible}
        onCancel={() => {
          setRegisterModalVisible(false);
          registerForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={registerForm}
          layout="vertical"
          onFinish={handleRegister}
          style={{ marginTop: spacing.md }}
        >
          <Form.Item
            label="服务 ID"
            name="serviceId"
            rules={[
              { required: true, message: '请输入服务 ID' },
              { pattern: /^[a-zA-Z0-9_-]+$/, message: '仅支持字母、数字、下划线和连字符' },
            ]}
          >
            <Input placeholder="例如：user-service" />
          </Form.Item>

          <Form.Item
            label="服务名称"
            name="serviceName"
            rules={[{ required: true, message: '请输入服务名称' }]}
          >
            <Input placeholder="例如：用户服务" />
          </Form.Item>

          <Form.Item
            label="服务地址"
            name="serviceUrl"
            rules={[
              { required: true, message: '请输入服务地址' },
              { type: 'url', message: '请输入有效的 URL' },
            ]}
          >
            <Input placeholder="例如：http://user-service.default.svc.cluster.local" />
          </Form.Item>

          <Form.Item
            label="协议"
            name="protocol"
            initialValue="http"
            rules={[{ required: true, message: '请选择协议' }]}
          >
            <Select>
              <Option value="http">HTTP</Option>
              <Option value="grpc">gRPC</Option>
              <Option value="tcp">TCP</Option>
              <Option value="custom">Custom</Option>
            </Select>
          </Form.Item>

          <Form.Item label="版本" name="version">
            <Input placeholder="例如：1.0.0" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: spacing.lg }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                onClick={() => {
                  setRegisterModalVisible(false);
                  registerForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={registerLoading}>
                注册
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ServiceRegistry;
