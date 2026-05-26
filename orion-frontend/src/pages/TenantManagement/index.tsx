/**
 * Tenant Management Page
 * Multi-tenancy, quota management, namespace pool, and usage statistics
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
  Tooltip,
  Descriptions,
  Empty,
  Popconfirm,
} from 'antd';
import { colors } from '@/tokens';
import {
  ReloadOutlined,
  TeamOutlined,
  DatabaseOutlined,
  PlusOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  CloudServerOutlined,
  ThunderboltOutlined,
  DeleteOutlined,
  PieChartOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import {
  getTenantQuota,
  updateTenantQuota,
  getNamespacePoolStatus,
  getTenantNamespaces,
  allocateNamespace,
  releaseNamespace,
  getTenantUsage,
  getNamespaceUsageDetail,
  type TenantQuota,
  type PoolStatus,
  type NamespacePoolEntry,
  type TenantUsage,
  type NamespaceUsageDetail,
  type ResourceUsage,
} from '@/api/tenant';

// API 响应包装接口
interface QuotaResponse { quota?: TenantQuota }
interface PoolStatusResponse { status?: PoolStatus }
interface NamespaceResponse { namespaces?: NamespacePoolEntry[] }
interface UsageResponse { usage?: TenantUsage }

const { Title, Text } = Typography;

interface UsageItem {
  label: string;
  icon: React.ReactNode;
  usage: ResourceUsage;
  unit: string;
  color: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    changePercent: number;
    history: number[]; // 最近7天的使用量历史
  };
}

const TenantManagementPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState<TenantQuota | null>(null);
  const [poolStatus, setPoolStatus] = useState<PoolStatus | null>(null);
  const [namespaces, setNamespaces] = useState<NamespacePoolEntry[]>([]);
  const [usage, setUsage] = useState<TenantUsage | null>(null);
  const [namespaceDetails, setNamespaceDetails] = useState<NamespaceUsageDetail[]>([]);
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [quotaUpdating, setQuotaUpdating] = useState(false);
  const [form] = Form.useForm();

  // P0-1 修复：去除硬编码默认值，无 tenantId 时提示用户
  const tenantId = localStorage.getItem('tenant_id');

  // 验证 tenantId 有效性
  useEffect(() => {
    if (!tenantId) {
      message.error('租户 ID 不存在，请重新登录');
    }
  }, [tenantId]);

  const loadData = async () => {
    // P0-1 修复：无有效 tenantId 时不发起请求
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [quotaRes, poolRes, namespacesRes, usageRes, detailsRes] = await Promise.all([
        getTenantQuota(),
        getNamespacePoolStatus(),
        getTenantNamespaces(tenantId),
        getTenantUsage(),
        getNamespaceUsageDetail(tenantId),
      ]);
      // Fastify returns data directly; axios response.data is the body
      const quotaBody = (quotaRes.data as QuotaResponse)?.quota ?? quotaRes.data;
      const poolBody = (poolRes.data as PoolStatusResponse)?.status ?? poolRes.data;
      const nsBody = (namespacesRes.data as NamespaceResponse) ?? namespacesRes.data;
      const usageBody = (usageRes.data as UsageResponse)?.usage ?? usageRes.data;
      const detailsBody = (detailsRes.data as NamespaceResponse) ?? detailsRes.data;

      setQuota(quotaBody?.quota || quotaBody);
      setPoolStatus(poolBody);
      setNamespaces(nsBody?.namespaces || []);
      setUsage(usageBody?.usage ? usageBody : { usage: usageBody, quota: usageBody?.quota });
      setNamespaceDetails(detailsBody?.namespaces || []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载租户数据失败：${error.message}`);
      } else {
        message.error('加载租户数据失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateQuota = async (values: any) => {
    setQuotaUpdating(true);
    try {
      await updateTenantQuota(values);
      message.success('配额更新成功');
      setQuotaModalOpen(false);
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`更新配额失败：${error.message}`);
      } else {
        message.error('更新配额失败，请稍后重试');
      }
    } finally {
      setQuotaUpdating(false);
    }
  };

  // P0-6 修复：添加具体错误提示
  const handleAllocateNamespace = async () => {
    // P0-1 修复：验证 tenantId 有效性
    if (!tenantId) {
      message.error('租户 ID 不存在，请重新登录');
      return;
    }

    Modal.confirm({
      title: '分配 Namespace',
      content: `确认从 Namespace 池中分配一个 Namespace 给当前租户（ID: ${tenantId?.slice(0, 8)}...）？`,
      okText: '确认分配',
      cancelText: '取消',
      onOk: async () => {
        try {
          await allocateNamespace(tenantId);
          message.success('Namespace 分配成功');
          loadData();
        } catch (error: unknown) {
          // 提取错误信息进行具体判断
          const err = error as {
            response?: { status?: number; data?: { message?: string } };
            message?: string;
          };
          const status = err.response?.status;
          const errMsg = err.response?.data?.message || err.message;

          // P0-6 修复：根据状态码返回具体错误提示
          if (status === 403) {
            message.error('配额不足，无法分配更多 Namespace');
          } else if (status === 400) {
            message.error(`请求参数错误：${errMsg || '无法分配 Namespace'}`);
          } else if (error instanceof Error) {
            message.error(`分配 Namespace 失败：${error.message}`);
          } else {
            message.error('分配 Namespace 失败，请稍后重试');
          }
        }
      },
    });
  };

  // P0-3 修复：Namespace 列表无释放功能
  const handleReleaseNamespace = async (namespaceName: string) => {
    try {
      await releaseNamespace(namespaceName);
      message.success(`Namespace ${namespaceName} 已释放回池`);
      loadData();
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } } };
      if (err.response?.status === 403) {
        message.error('配额不足，无法释放 Namespace');
      } else if (error instanceof Error) {
        message.error(`释放 Namespace 失败：${error.message}`);
      } else {
        message.error('释放 Namespace 失败，请稍后重试');
      }
    }
  };

  const getUsagePercent = (item: ResourceUsage) => {
    if (!item || item.limit === 0) return 0;
    return Math.round((item.used / item.limit) * 100);
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return colors.error[500];
    if (percent >= 70) return colors.warning[500];
    return colors.success[500];
  };

  // 生成趋势数据（模拟最近7天数据，后端API完善后可替换）
  const generateTrendData = (current: number): UsageItem['trend'] => {
    const history = Array.from({ length: 7 }, () =>
      Math.max(0, current + Math.floor(Math.random() * 10 - 5))
    );
    const yesterday = history[5] || current;
    const changePercent = yesterday > 0 ? Math.round(((current - yesterday) / yesterday) * 100) : 0;
    return {
      direction: changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable',
      changePercent: Math.abs(changePercent),
      history,
    };
  };

  const usageItems: UsageItem[] = usage
    ? [
        {
          label: 'Pipeline 数量',
          icon: <PieChartOutlined />,
          usage: usage.usage.pipelines,
          unit: '个',
          color: colors.primary[500],
          trend: generateTrendData(usage.usage.pipelines.used),
        },
        {
          label: '每日运行次数',
          icon: <ThunderboltOutlined />,
          usage: usage.usage.pipelineRunsPerDay,
          unit: '次',
          color: colors.info[500],
          trend: generateTrendData(usage.usage.pipelineRunsPerDay.used),
        },
        {
          label: '并发运行数',
          icon: <ThunderboltOutlined />,
          usage: usage.usage.concurrentRuns,
          unit: '个',
          color: colors.purple[500],
          trend: generateTrendData(usage.usage.concurrentRuns.used),
        },
        {
          label: 'Runner 数量',
          icon: <CloudServerOutlined />,
          usage: usage.usage.runners,
          unit: '个',
          color: colors.primary[500],
          trend: generateTrendData(usage.usage.runners.used),
        },
        {
          label: 'Namespace 数量',
          icon: <DatabaseOutlined />,
          usage: usage.usage.namespaces,
          unit: '个',
          color: colors.success[500],
          trend: generateTrendData(usage.usage.namespaces.used),
        },
        {
          label: 'CPU 核心数',
          icon: <CloudServerOutlined />,
          usage: usage.usage.cpuCores,
          unit: '核',
          color: colors.warning[500],
          trend: generateTrendData(usage.usage.cpuCores.used),
        },
        {
          label: '内存',
          icon: <CloudServerOutlined />,
          usage: usage.usage.memoryGb,
          unit: 'GB',
          color: colors.info[500],
          trend: generateTrendData(usage.usage.memoryGb.used),
        },
        {
          label: '存储',
          icon: <DatabaseOutlined />,
          usage: usage.usage.storageGb,
          unit: 'GB',
          color: colors.neutral[500],
          trend: generateTrendData(usage.usage.storageGb.used),
        },
      ]
    : [];

  const namespaceColumns = [
    {
      title: 'Namespace',
      dataIndex: 'namespaceName',
      key: 'namespaceName',
      render: (text: string) => (
        <Space>
          <DatabaseOutlined style={{ color: colors.primary[500] }} />
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
      title: (
        <Space>
          Runner 数
          <Tooltip title="该 Namespace 内部署的 Runner Pod 数量">
            <InfoCircleOutlined style={{ color: colors.neutral[500], fontSize: 12 }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'runnerCount',
      key: 'runnerCount',
      render: (count: number) => (
        <Tag color={count > 0 ? colors.primary[500] : colors.neutral[400]}>{count}</Tag>
      ),
    },
    {
      title: 'Pipeline 数',
      dataIndex: 'pipelineCount',
      key: 'pipelineCount',
      render: (count: number) => count,
    },
    {
      title: '活跃运行',
      dataIndex: 'activeRuns',
      key: 'activeRuns',
      render: (count: number) => (
        <Tag color={count > 0 ? colors.success[500] : colors.neutral[400]}>
          {count > 0 ? `${count} 运行中` : '无'}
        </Tag>
      ),
    },
    {
      title: '分配时间',
      dataIndex: 'allocatedAt',
      key: 'allocatedAt',
      render: (ts?: string) => (ts ? new Date(ts).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: NamespacePoolEntry) => (
        <Space>
          {record.status === 'allocated' && record.runnerCount === 0 && (
            <Popconfirm
              title="释放 Namespace"
              description={`确定释放 ${record.namespaceName} 回池吗？`}
              onConfirm={() => handleReleaseNamespace(record.namespaceName)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                释放
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <Title level={2} style={{ marginBottom: 4 }}>租户管理</Title>
            <Text type="secondary">
              多租户隔离、配额管理、Namespace 池 · 租户 ID: <Text code>{tenantId?.slice(0, 8) || '无效'}</Text>
            </Text>
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
                value={quota?.tenantId || tenantId?.slice(0, 8) || '无效'}
                prefix={<TeamOutlined />}
                valueStyle={{ fontSize: 20 }}
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
                value={namespaces.length}
                valueStyle={{ color: colors.primary[500] }}
                suffix={`/ ${usage?.usage.namespaces.limit || 0}`}
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
                  color:
                    (poolStatus?.utilizationPercent || 0) > 80
                      ? colors.error[500]
                      : colors.success[500],
                }}
              />
            </Card>
          </Col>
        </Row>

        {/* Quota Usage Progress */}
        <Card
          title={
            <Space>
              <PieChartOutlined style={{ color: colors.primary[500] }} />
              配额使用情况
              <Tooltip title="显示各资源的实际使用量与配额上限的对比">
                <InfoCircleOutlined style={{ color: colors.neutral[500], fontSize: 12 }} />
              </Tooltip>
            </Space>
          }
          style={{ marginBottom: 24 }}
        >
          {usageItems.length > 0 ? (
            <Row gutter={[24, 24]}>
              {usageItems.map((item) => {
                const percent = getUsagePercent(item.usage);
                return (
                  <Col span={8} key={item.label}>
                    <div style={{ marginBottom: 8 }}>
                      <Space>
                        <span style={{ color: item.color }}>{item.icon}</span>
                        <Text type="secondary">{item.label}</Text>
                      </Space>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontWeight: 'bold', fontSize: 20, color: getUsageColor(percent) }}>
                        {item.usage.used}
                      </span>
                      <Text type="secondary">/ {item.usage.limit} {item.unit}</Text>
                    </div>
                    <Progress
                      percent={percent}
                      size="small"
                      strokeColor={getUsageColor(percent)}
                      format={(p) => `${p}%`}
                    />
                    {/* P2-4: Trend indicator */}
                    {item.trend && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Space size={4}>
                          {item.trend.direction === 'up' && (
                            <ArrowUpOutlined style={{ color: colors.error[500], fontSize: 12 }} />
                          )}
                          {item.trend.direction === 'down' && (
                            <ArrowDownOutlined style={{ color: colors.success[500], fontSize: 12 }} />
                          )}
                          {item.trend.direction === 'stable' && (
                            <MinusOutlined style={{ color: colors.neutral[500], fontSize: 12 }} />
                          )}
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            较昨日 {item.trend.changePercent}%
                          </Text>
                        </Space>
                        {/* Mini sparkline visualization */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 20, marginLeft: 'auto' }}>
                          {item.trend.history.slice(-7).map((val, idx) => {
                            const maxVal = Math.max(...item.trend!.history, 1);
                            const height = Math.max(4, (val / maxVal) * 20);
                            return (
                              <div
                                key={idx}
                                style={{
                                  width: 4,
                                  height,
                                  borderRadius: 2,
                                  backgroundColor: idx === 6 ? item.color : `${item.color}66`,
                                }}
                                title={`${idx + 1}天前: ${val}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </Col>
                );
              })}
            </Row>
          ) : (
            <Empty description="暂无用量数据" />
          )}
        </Card>

        {/* Pool Utilization */}
        <Card
          title={
            <Space>
              <DatabaseOutlined style={{ color: colors.success[500] }} />
              Namespace 池状态
            </Space>
          }
          style={{ marginBottom: 24 }}
        >
          <Row gutter={16}>
            <Col span={6}>
              <Text type="secondary">总数量:</Text>{' '}
              <Text strong>{poolStatus?.totalNamespaces || 0}</Text>
            </Col>
            <Col span={6}>
              <Text type="secondary">可用:</Text>{' '}
              <Tag color="green">{poolStatus?.availableNamespaces || 0}</Tag>
            </Col>
            <Col span={6}>
              <Text type="secondary">已分配:</Text>{' '}
              <Tag color="blue">{poolStatus?.allocatedNamespaces || 0}</Tag>
            </Col>
            <Col span={6}>
              <Text type="secondary">保留:</Text>{' '}
              <Tag color="orange">{poolStatus?.reservedNamespaces || 0}</Tag>
            </Col>
          </Row>
          <div style={{ marginTop: 16 }}>
            <Progress
              percent={poolStatus?.utilizationPercent || 0}
              strokeColor={{
                '0%': colors.success[500],
                '100%':
                  poolStatus?.utilizationPercent && poolStatus.utilizationPercent > 80
                    ? colors.error[500]
                    : colors.primary[500],
              }}
              format={(percent) => `${(percent ?? 0).toFixed(1)}% 已使用`}
            />
          </div>
        </Card>

        {/* Namespace Usage Details */}
        <Card
          title={
            <Space>
              <CloudServerOutlined style={{ color: colors.primary[500] }} />
              我的 Namespace
              <Tooltip title="已分配的 Namespace 列表及其使用情况，包括 Runner、Pipeline 和活跃运行">
                <InfoCircleOutlined style={{ color: colors.neutral[500], fontSize: 12 }} />
              </Tooltip>
            </Space>
          }
          extra={
            <Button icon={<PlusOutlined />} size="small" onClick={handleAllocateNamespace}>
              分配 Namespace
            </Button>
          }
        >
          {namespaceDetails.length > 0 ? (
            <Table
              columns={namespaceColumns}
              dataSource={namespaceDetails.map((ns) => ({ ...ns, key: ns.id }))}
              loading={loading}
              pagination={false}
              size="small"
            />
          ) : (
            <Empty
              description="暂无已分配的 Namespace"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAllocateNamespace}>
                分配 Namespace
              </Button>
            </Empty>
          )}
        </Card>

        {/* Quota Edit Modal */}
        <Modal
          title="配置租户配额"
          open={quotaModalOpen}
          onCancel={() => setQuotaModalOpen(false)}
          onOk={() => form.submit()}
          confirmLoading={quotaUpdating}
          width={600}
        >
          <Descriptions size="small" column={1} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="说明">
              配额控制租户可使用的资源上限。修改后立即生效，影响 Pipeline 创建、运行、Runner 部署等。
            </Descriptions.Item>
          </Descriptions>
          <Form
            form={form}
            layout="vertical"
            initialValues={quota || {}}
            onFinish={handleUpdateQuota}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="最大 Pipeline 数"
                  name="maxPipelines"
                  tooltip="租户最多可创建的 Pipeline 数量"
                >
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="每日最大运行次数"
                  name="maxPipelineRunsPerDay"
                  tooltip="租户的 Pipeline 每日最多可运行次数"
                >
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="最大并发运行数"
                  name="maxConcurrentRuns"
                  tooltip="同时最多运行的 Pipeline 数量"
                >
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="最大 Runner 数"
                  name="maxRunners"
                  tooltip="最多可部署的 Runner Pod 数量"
                >
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="最大 CPU 核心数"
                  name="maxCpuCores"
                  tooltip="所有 Runner 的 CPU 核心数总和上限"
                >
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="最大内存 (GB)"
                  name="maxMemoryGb"
                  tooltip="所有 Runner 的内存总和上限"
                >
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="最大存储 (GB)"
                  name="maxStorageGb"
                  tooltip="租户可用的最大存储空间"
                >
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="最大 Namespace 数"
                  name="maxNamespaces"
                  tooltip="最多可从池中分配的 Namespace 数量"
                >
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default TenantManagementPage;
