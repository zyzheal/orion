/**
 * Tenant Management Page
 * Multi-tenancy, quota management, and namespace pool
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Table,
  Tag,
  Space,
  Button,
  Statistic,
  Progress,
  Modal,
  Form,
  InputNumber,
  message,
} from 'antd';
import { colors, spacing } from '@/tokens';
import {
  ReloadOutlined,
  TeamOutlined,
  DatabaseOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import DashboardLayout from '@/components/DashboardLayout';
import {
  getTenantQuota,
  updateTenantQuota,
  getNamespacePoolStatus,
  getTenantNamespaces,
  allocateNamespace,
  type TenantQuota,
  type PoolStatus,
  type NamespacePoolEntry,
} from '@/api/tenant';

const { Title, Text } = Typography;

const TenantManagementPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState<TenantQuota | null>(null);
  const [poolStatus, setPoolStatus] = useState<PoolStatus | null>(null);
  const [namespaces, setNamespaces] = useState<NamespacePoolEntry[]>([]);
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [quotaRes, poolRes, namespacesRes] = await Promise.all([
        getTenantQuota(),
        getNamespacePoolStatus(),
        getTenantNamespaces(1),
      ]);
      setQuota(quotaRes.data.data);
      setPoolStatus(poolRes.data.data);
      setNamespaces(namespacesRes.data.data.namespaces || []);
    } catch (error) {
      console.error('Failed to load tenant data:', error);
      message.error('加载租户数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateQuota = async (values: any) => {
    try {
      await updateTenantQuota(values);
      message.success('配额更新成功');
      setQuotaModalOpen(false);
      loadData();
    } catch (error) {
      message.error('更新配额失败');
    }
  };

  const handleAllocateNamespace = async () => {
    try {
      await allocateNamespace(1);
      message.success('Namespace 分配成功');
      loadData();
    } catch (error) {
      message.error('分配 Namespace 失败');
    }
  };

  const namespaceColumns = [
    {
      title: 'Namespace',
      dataIndex: 'namespaceName',
      key: 'namespaceName',
      render: (text: string) => (
        <Space>
          <DatabaseOutlined />
          <Text code>{text}</Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          available: 'green',
          allocated: 'blue',
          reserved: 'orange',
        };
        return <Tag color={colorMap[status]}>{status}</Tag>;
      },
    },
    {
      title: '租户 ID',
      dataIndex: 'tenantId',
      key: 'tenantId',
      render: (id?: number) => id || '-',
    },
    {
      title: '集群',
      dataIndex: 'clusterId',
      key: 'clusterId',
    },
    {
      title: '分配时间',
      dataIndex: 'allocatedAt',
      key: 'allocatedAt',
      render: (ts?: string) => (ts ? new Date(ts).toLocaleString() : '-'),
    },
  ] as any[];

  const quotaItems = quota
    ? [
        { label: '最大 Pipeline 数', value: quota.maxPipelines, unit: '个' },
        { label: '每日最大运行次数', value: quota.maxPipelineRunsPerDay, unit: '次' },
        { label: '最大并发运行数', value: quota.maxConcurrentRuns, unit: '个' },
        { label: '最大 Runner 数', value: quota.maxRunners, unit: '个' },
        { label: '最大 CPU 核心数', value: quota.maxCpuCores, unit: '核' },
        { label: '最大内存', value: quota.maxMemoryGb, unit: 'GB' },
        { label: '最大存储', value: quota.maxStorageGb, unit: 'GB' },
        { label: '最大 Namespace 数', value: quota.maxNamespaces, unit: '个' },
      ]
    : [];

  return (
    <DashboardLayout>
      <div style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <Title level={2}>租户管理</Title>
            <Text type="secondary">多租户隔离、配额管理、Namespace 池</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              刷新
            </Button>
            <Button icon={<SettingOutlined />} onClick={() => setQuotaModalOpen(true)}>
              配置配额
            </Button>
            <Button icon={<PlusOutlined />} type="primary" onClick={handleAllocateNamespace}>
              分配 Namespace
            </Button>
          </Space>
        </div>

        {/* Summary Cards */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="租户 ID"
                value={quota?.tenantId || 0}
                prefix={<TeamOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="可用 Namespace"
                value={poolStatus?.availableNamespaces || 0}
                valueStyle={{ color: colors.success[500] }}
                suffix={`/ ${poolStatus?.totalNamespaces || 0}`}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="已分配 Namespace"
                value={poolStatus?.allocatedNamespaces || 0}
                valueStyle={{ color: colors.primary[500] }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="池利用率"
                value={poolStatus?.utilizationPercent || 0}
                precision={1}
                suffix="%"
                valueStyle={{
                  color: (poolStatus?.utilizationPercent || 0) > 80 ? colors.error[500] : colors.success[500],
                }}
              />
            </Card>
          </Col>
        </Row>

        {/* Quota Progress */}
        <Card title="配额使用情况" style={{ marginBottom: 24 }}>
          <Row gutter={[24, 24]}>
            {quotaItems.map((item) => (
              <Col span={8} key={item.label}>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary">{item.label}</Text>
                </div>
                <div style={{ fontWeight: 'bold', fontSize: spacing[5] }}>
                  {item.value} {item.unit}
                </div>
              </Col>
            ))}
          </Row>
        </Card>

        {/* Pool Utilization */}
        <Card title="Namespace 池状态" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Text type="secondary">总数量:</Text>{' '}
              <Text strong>{poolStatus?.totalNamespaces || 0}</Text>
            </Col>
            <Col span={8}>
              <Text type="secondary">可用:</Text>{' '}
              <Tag color="green">{poolStatus?.availableNamespaces || 0}</Tag>
            </Col>
            <Col span={8}>
              <Text type="secondary">已分配:</Text>{' '}
              <Tag color="blue">{poolStatus?.allocatedNamespaces || 0}</Tag>
            </Col>
          </Row>
          <div style={{ marginTop: 16 }}>
            <Progress
              percent={poolStatus?.utilizationPercent || 0}
              strokeColor={{
                '0%': colors.success[500],
                '100%': poolStatus?.utilizationPercent && poolStatus.utilizationPercent > 80 ? colors.error[500] : colors.primary[500],
              }}
              format={(percent) => `${(percent ?? 0).toFixed(1)}% 已使用`}
            />
          </div>
        </Card>

        {/* Namespace List */}
        <Card title="我的 Namespace">
          <Table
            columns={namespaceColumns}
            dataSource={namespaces.map((ns) => ({ ...ns, key: ns.id }))}
            loading={loading}
            pagination={false}
            size="small"
          />
        </Card>

        {/* Quota Edit Modal */}
        <Modal
          title="配置租户配额"
          open={quotaModalOpen}
          onCancel={() => setQuotaModalOpen(false)}
          onOk={() => form.submit()}
          width={600}
        >
          <Form form={form} layout="vertical" initialValues={quota || {}} onFinish={handleUpdateQuota}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="最大 Pipeline 数" name="maxPipelines">
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="每日最大运行次数" name="maxPipelineRunsPerDay">
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="最大并发运行数" name="maxConcurrentRuns">
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="最大 Runner 数" name="maxRunners">
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="最大 CPU 核心数" name="maxCpuCores">
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="最大内存 (GB)" name="maxMemoryGb">
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="最大存储 (GB)" name="maxStorageGb">
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="最大 Namespace 数" name="maxNamespaces">
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Modal>
      </div>
    </DashboardLayout>
  );
};

export default TenantManagementPage;
