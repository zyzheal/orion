/**
 * Multi-Cloud Management Page
 * 多云管理 - 资源概览 Dashboard + 云账号管理 + 资源跟踪
 *
 * Features:
 * - 资源统计概览 (统计卡片 + 云厂商分布 + 成本趋势)
 * - 云账号管理 (CRUD)
 * - 资源跟踪与同步
 * - 成本对比分析
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  message,
  Typography,
  Tabs,
  Progress,
  Tooltip,
  Badge,
} from 'antd';
import {
  CloudServerOutlined,
  PlusOutlined,
  ReloadOutlined,
  CloudOutlined,
  DollarOutlined,
  SyncOutlined,
  SafetyOutlined,
  GlobalOutlined,
  DatabaseOutlined,
  HddOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import {
  multiCloudApi,
  type CloudAccount,
  type CloudResource,
  type ResourceStatistics,
} from '@/api/multi-cloud';
import { colors } from '@/tokens';

const { Title, Text } = Typography;

const providerTypeColor: Record<string, string> = {
  aws: 'orange',
  azure: 'blue',
  gcp: 'red',
  alicloud: 'green',
  aliyun: 'green',
  tencent: 'cyan',
};

const providerLabelMap: Record<string, string> = {
  aws: 'AWS',
  azure: 'Azure',
  gcp: 'Google Cloud',
  alicloud: '阿里云',
  aliyun: '阿里云',
  tencent: '腾讯云',
  private: '私有云',
};

const statusColorMap: Record<string, string> = {
  active: 'green',
  inactive: 'default',
  error: 'red',
};

const statusLabelMap: Record<string, string> = {
  active: '已连接',
  inactive: '未激活',
  error: '错误',
};

const providerIconColors: Record<string, string> = {
  aws: '#FF9900',
  azure: '#0078D4',
  gcp: '#4285F4',
  alicloud: '#FF6A00',
  aliyun: '#FF6A00',
  tencent: '#006EFF',
};

const MultiCloudPage: React.FC = () => {
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [resources, setResources] = useState<CloudResource[]>([]);
  const [statistics, setStatistics] = useState<ResourceStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [costModalOpen, setCostModalOpen] = useState(false);
  const [costComparison, setCostComparison] = useState<any[]>([]);
  const [costLoading, setCostLoading] = useState(false);
  const [form] = Form.useForm();
  const [costForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accountsRes, resourcesRes, statsRes] = await Promise.allSettled([
        multiCloudApi.listCloudAccounts(),
        multiCloudApi.listCloudResources(),
        multiCloudApi.getResourceStatistics(),
      ]);
      if (accountsRes.status === 'fulfilled') {
        const data = accountsRes.value as any;
        setAccounts(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
      }
      if (resourcesRes.status === 'fulfilled') {
        const data = resourcesRes.value as any;
        setResources(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
      }
      if (statsRes.status === 'fulfilled') {
        const data = statsRes.value as any;
        setStatistics(data?.data ?? data ?? null);
      }
    } catch (error: unknown) {
      message.error(`加载多云数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      await multiCloudApi.registerCloudAccount({
        provider: values.provider,
        name: values.name,
        region: values.region,
        credentials_ref: values.credentials_ref ?? '',
        metadata: {},
      });
      message.success('云账号注册成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`注册失败: ${(error as Error).message}`);
    }
  };

  const handleSync = async (accountId: string) => {
    setSyncing(accountId);
    try {
      await multiCloudApi.syncAccountResources(accountId);
      message.success('资源同步已启动');
      setTimeout(() => {
        loadData();
        setSyncing(null);
      }, 2000);
    } catch (error: unknown) {
      message.error(`同步失败: ${(error as Error).message}`);
      setSyncing(null);
    }
  };

  const handleCostCompare = async (values: any) => {
    setCostLoading(true);
    try {
      const res = await multiCloudApi.compareCloudCosts({
        vm_count: values.vm_count,
        vm_type: values.vm_type,
        storage_gb: values.storage_gb,
        bandwidth_gb_month: values.bandwidth_gb_month,
      });
      const data = (res as any)?.data ?? res;
      setCostComparison(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      message.error(`成本对比失败: ${(error as Error).message}`);
    } finally {
      setCostLoading(false);
    }
  };

  // Stats
  const stats = useMemo(() => ({
    total: accounts.length,
    active: accounts.filter((a) => a.status === 'active').length,
    error: accounts.filter((a) => a.status === 'error').length,
    resources: resources.length,
    providers: new Set(accounts.map(a => a.provider || a.credential_type)).size,
    regions: new Set(accounts.map(a => a.region)).size,
  }), [accounts, resources]);

  // Provider distribution for visualization
  const providerDistribution = useMemo(() => {
    const source = statistics?.byProvider ?? {};
    const entries = Object.entries(source);
    const total = entries.reduce((sum, [, count]) => sum + (count as number), 0);
    if (total === 0) {
      // Fallback to accounts data
      const providerCounts: Record<string, number> = {};
      accounts.forEach(a => {
        const p = a.provider || a.credential_type || 'unknown';
        providerCounts[p] = (providerCounts[p] || 0) + 1;
      });
      const fallbackEntries = Object.entries(providerCounts);
      const fallbackTotal = fallbackEntries.reduce((sum, [, count]) => sum + count, 0);
      return fallbackEntries.map(([provider, count]) => ({
        provider,
        count,
        percentage: fallbackTotal > 0 ? Math.round((count / fallbackTotal) * 100) : 0,
      }));
    }
    return entries.map(([provider, count]) => ({
      provider,
      count: count as number,
      percentage: Math.round(((count as number) / total) * 100),
    }));
  }, [statistics, accounts]);

  // Resource type distribution
  const resourceTypeDistribution = useMemo(() => {
    const source = statistics?.byType ?? {};
    const entries = Object.entries(source);
    const total = entries.reduce((sum, [, count]) => sum + (count as number), 0);
    return entries.map(([type, count]) => ({
      type,
      count: count as number,
      percentage: total > 0 ? Math.round(((count as number) / total) * 100) : 0,
    }));
  }, [statistics]);

  // Simulated cost trend data
  const costTrend = useMemo(() => [
    { month: '1月', cost: 18200 },
    { month: '2月', cost: 19500 },
    { month: '3月', cost: 21000 },
    { month: '4月', cost: 20300 },
    { month: '5月', cost: 22800 },
    { month: '6月', cost: statistics?.totalMonthlyCost ?? 24500 },
  ], [statistics]);

  const maxCost = Math.max(...costTrend.map(t => t.cost));

  // Account columns
  const accountColumns = [
    {
      title: '账号名称',
      dataIndex: 'account_name',
      key: 'account_name',
      width: 160,
      render: (v: string, record: any) => v || record.name || '-',
    },
    {
      title: '云厂商',
      key: 'provider',
      width: 120,
      render: (_: unknown, record: any) => {
        const provider = record.provider_id || record.credential_type || record.provider || 'unknown';
        return <Tag color={providerTypeColor[provider] || 'default'}>{providerLabelMap[provider] || provider}</Tag>;
      },
    },
    { title: '区域', dataIndex: 'region', key: 'region', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <Tag color={statusColorMap[v] || 'default'}>{statusLabelMap[v] || v}</Tag>,
    },
    {
      title: '资源数',
      key: 'resourceCount',
      width: 80,
      render: (_: unknown, record: any) => {
        const accountId = record.account_id || record.id;
        return resources.filter((r) => r.account_id === accountId || r.accountId === accountId).length;
      },
    },
    {
      title: '月度费用',
      key: 'cost',
      width: 100,
      render: (_: unknown, record: any) => {
        const cost = record.current_spend ?? 0;
        return cost > 0 ? `$${cost.toFixed(2)}` : '-';
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: any) => (
        <Space>
          <Tooltip title="同步资源">
            <Button
              type="link"
              size="small"
              icon={<SyncOutlined spin={syncing === (record.account_id || record.id)} />}
              onClick={() => handleSync(record.account_id || record.id)}
              disabled={syncing !== null}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
  ];

  // Resource columns
  const resourceColumns = [
    { title: '名称', dataIndex: 'resource_name', key: 'resource_name', width: 160, render: (v: string, r: any) => v || r.name || '-' },
    {
      title: '类型',
      dataIndex: 'resource_type',
      key: 'resource_type',
      width: 120,
      render: (v: string) => {
        const typeColors: Record<string, string> = {
          compute: 'blue', storage: 'green', database: 'purple', network: 'orange', container: 'cyan',
        };
        return <Tag color={typeColors[v] || 'default'}>{v}</Tag>;
      },
    },
    { title: '区域', dataIndex: 'region', key: 'region', width: 120 },
    {
      title: '状态',
      dataIndex: 'state',
      key: 'state',
      width: 100,
      render: (v: string) => {
        const stateColors: Record<string, string> = {
          running: 'green', active: 'green', stopped: 'red', error: 'red', pending: 'orange',
        };
        return <Badge status={stateColors[v] === 'green' ? 'success' : stateColors[v] === 'red' ? 'error' : 'warning'} text={v} />;
      },
    },
    {
      title: '月度费用',
      dataIndex: 'monthly_cost',
      key: 'monthly_cost',
      width: 100,
      render: (v: number) => v > 0 ? `$${v.toFixed(2)}` : '-',
    },
    {
      title: '标签',
      key: 'tags',
      width: 160,
      render: (_: unknown, record: CloudResource) =>
        record.tags ? Object.entries(record.tags).slice(0, 2).map(([k, v]) => <Tag key={k}>{k}: {v}</Tag>) : '-',
    },
  ];

  // Dashboard overview section
  const renderDashboard = () => (
    <div style={{ marginBottom: 24 }}>
      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card
            size="small"
            style={{ borderRadius: 12, borderTop: `3px solid ${colors.primary[500]}` }}
          >
            <Statistic
              title="云账号"
              value={stats.total}
              prefix={<CloudServerOutlined style={{ color: colors.primary[500] }} />}
              valueStyle={{ fontSize: 28, fontWeight: 600 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>{stats.active} 已连接</Text>
          </Card>
        </Col>
        <Col span={4}>
          <Card
            size="small"
            style={{ borderRadius: 12, borderTop: `3px solid ${colors.success[500]}` }}
          >
            <Statistic
              title="云资源"
              value={stats.resources}
              prefix={<HddOutlined style={{ color: colors.success[500] }} />}
              valueStyle={{ fontSize: 28, fontWeight: 600 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>{stats.providers} 云厂商</Text>
          </Card>
        </Col>
        <Col span={4}>
          <Card
            size="small"
            style={{ borderRadius: 12, borderTop: `3px solid ${colors.info[500]}` }}
          >
            <Statistic
              title="覆盖区域"
              value={stats.regions}
              prefix={<GlobalOutlined style={{ color: colors.info[500] }} />}
              valueStyle={{ fontSize: 28, fontWeight: 600 }}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card
            size="small"
            style={{ borderRadius: 12, borderTop: `3px solid ${colors.warning[500]}` }}
          >
            <Statistic
              title="月度费用"
              value={statistics?.totalMonthlyCost ?? 0}
              prefix={<DollarOutlined style={{ color: colors.warning[500] }} />}
              valueStyle={{ fontSize: 28, fontWeight: 600 }}
              precision={2}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card
            size="small"
            style={{ borderRadius: 12, borderTop: `3px solid ${stats.error > 0 ? colors.error[500] : colors.success[500]}` }}
          >
            <Statistic
              title="异常账号"
              value={stats.error}
              prefix={stats.error > 0
                ? <ExclamationCircleOutlined style={{ color: colors.error[500] }} />
                : <CheckCircleOutlined style={{ color: colors.success[500] }} />
              }
              valueStyle={{ fontSize: 28, fontWeight: 600, color: stats.error > 0 ? colors.error[500] : colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card
            size="small"
            style={{ borderRadius: 12, borderTop: `3px solid ${colors.purple[500]}` }}
          >
            <Statistic
              title="资源类型"
              value={resourceTypeDistribution.length}
              prefix={<ApiOutlined style={{ color: colors.purple[500] }} />}
              valueStyle={{ fontSize: 28, fontWeight: 600 }}
              suffix="种"
            />
          </Card>
        </Col>
      </Row>

      {/* Provider Distribution + Cost Trend */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card
            title="云厂商资源分布"
            size="small"
            style={{ borderRadius: 12 }}
          >
            {providerDistribution.length > 0 ? (
              <div>
                {providerDistribution.map((item) => (
                  <div key={item.provider} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Space>
                        <CloudOutlined style={{ color: providerIconColors[item.provider] || colors.neutral[500] }} />
                        <Text strong>{providerLabelMap[item.provider] || item.provider}</Text>
                      </Space>
                      <Text type="secondary">{item.count} 个资源 ({item.percentage}%)</Text>
                    </div>
                    <Progress
                      percent={item.percentage}
                      strokeColor={providerIconColors[item.provider] || colors.primary[500]}
                      showInfo={false}
                      size="small"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <Text type="secondary">暂无数据，请先添加云账号</Text>
              </div>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card
            title="月度费用趋势"
            size="small"
            style={{ borderRadius: 12 }}
            extra={
              <Button type="link" size="small" onClick={() => setCostModalOpen(true)}>
                成本对比
              </Button>
            }
          >
            <div style={{ display: 'flex', alignItems: 'flex-end', height: 160, gap: 8, padding: '0 8px' }}>
              {costTrend.map((item, index) => {
                const height = maxCost > 0 ? (item.cost / maxCost) * 140 : 0;
                const isCurrent = index === costTrend.length - 1;
                return (
                  <Tooltip key={item.month} title={`$${item.cost.toLocaleString()}`}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Text style={{ fontSize: 10, marginBottom: 4 }}>${(item.cost / 1000).toFixed(1)}k</Text>
                      <div
                        style={{
                          width: '100%',
                          height: Math.max(height, 4),
                          backgroundColor: isCurrent ? colors.primary[500] : colors.primary[200],
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.3s ease',
                        }}
                      />
                      <Text type="secondary" style={{ fontSize: 10, marginTop: 4 }}>{item.month}</Text>
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Resource Type Distribution */}
      {resourceTypeDistribution.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card title="资源类型分布" size="small" style={{ borderRadius: 12 }}>
              <Row gutter={16}>
                {resourceTypeDistribution.map((item) => {
                  const typeIcons: Record<string, React.ReactNode> = {
                    compute: <CloudServerOutlined />,
                    storage: <HddOutlined />,
                    database: <DatabaseOutlined />,
                    network: <ApiOutlined />,
                    container: <CloudOutlined />,
                  };
                  const typeColorsMap: Record<string, string> = {
                    compute: colors.primary[500],
                    storage: colors.success[500],
                    database: colors.purple[500],
                    network: colors.warning[500],
                    container: colors.info[500],
                  };
                  return (
                    <Col span={4} key={item.type}>
                      <Card
                        size="small"
                        style={{
                          textAlign: 'center',
                          borderRadius: 8,
                          borderTop: `2px solid ${typeColorsMap[item.type] || colors.neutral[300]}`,
                        }}
                      >
                        <div style={{ fontSize: 24, color: typeColorsMap[item.type], marginBottom: 8 }}>
                          {typeIcons[item.type] || <HddOutlined />}
                        </div>
                        <Statistic
                          title={item.type}
                          value={item.count}
                          valueStyle={{ fontSize: 20 }}
                        />
                        <Progress
                          percent={item.percentage}
                          size="small"
                          strokeColor={typeColorsMap[item.type]}
                          format={() => `${item.percentage}%`}
                        />
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );

  const tabItems = [
    {
      key: 'accounts',
      label: <><CloudServerOutlined /> 云账号</>,
      children: (
        <Table
          columns={accountColumns}
          dataSource={accounts}
          rowKey={(r: any) => r.id || r.account_id}
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      ),
    },
    {
      key: 'resources',
      label: <><HddOutlined /> 云资源</>,
      children: (
        <Table
          columns={resourceColumns}
          dataSource={resources}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: colors.light.bg.secondary, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <CloudOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            多云管理
          </Title>
          <Text type="secondary">统一管理多云账号、资源跟踪、成本分析和跨云编排</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button icon={<DollarOutlined />} onClick={() => setCostModalOpen(true)}>
            成本对比
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            添加云账号
          </Button>
        </Space>
      </div>

      {/* Dashboard */}
      {renderDashboard()}

      {/* Tabs */}
      <Card style={{ borderRadius: 12 }}>
        <Tabs items={tabItems} />
      </Card>

      {/* Create Modal */}
      <Modal
        title="添加云账号"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="账号名称" name="name" rules={[{ required: true, message: '请输入账号名称' }]}>
            <Input placeholder="如: AWS Production" />
          </Form.Item>
          <Form.Item label="云厂商" name="provider" rules={[{ required: true, message: '请选择云厂商' }]}>
            <Select
              options={[
                { value: 'aws', label: 'AWS' },
                { value: 'azure', label: 'Azure' },
                { value: 'gcp', label: 'Google Cloud' },
                { value: 'alicloud', label: '阿里云' },
                { value: 'tencent', label: '腾讯云' },
              ]}
            />
          </Form.Item>
          <Form.Item label="区域" name="region" rules={[{ required: true, message: '请输入区域' }]}>
            <Input placeholder="如: us-east-1" />
          </Form.Item>
          <Form.Item label="凭证引用" name="credentials_ref">
            <Input placeholder="如: IAM Role ARN 或 Service Account Path" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Cost Comparison Modal */}
      <Modal
        title="跨云成本对比"
        open={costModalOpen}
        onCancel={() => {
          setCostModalOpen(false);
          setCostComparison([]);
        }}
        footer={null}
        width={700}
      >
        <Form form={costForm} layout="inline" onFinish={handleCostCompare} style={{ marginBottom: 16 }}>
          <Form.Item label="VM 数量" name="vm_count" initialValue={1}>
            <Input type="number" style={{ width: 80 }} />
          </Form.Item>
          <Form.Item label="VM 类型" name="vm_type" initialValue="medium">
            <Select
              style={{ width: 100 }}
              options={[
                { value: 'small', label: 'Small' },
                { value: 'medium', label: 'Medium' },
                { value: 'large', label: 'Large' },
              ]}
            />
          </Form.Item>
          <Form.Item label="存储(GB)" name="storage_gb" initialValue={100}>
            <Input type="number" style={{ width: 80 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={costLoading}>对比</Button>
          </Form.Item>
        </Form>

        {costComparison.length > 0 && (
          <Table
            dataSource={costComparison}
            rowKey="provider"
            pagination={false}
            size="small"
            columns={[
              {
                title: '云厂商',
                dataIndex: 'provider',
                render: (v: string) => <Tag color={providerTypeColor[v]}>{providerLabelMap[v] || v}</Tag>,
              },
              { title: '计算费用', dataIndex: ['breakdown', 'compute'], render: (v: number) => `$${v?.toFixed(2) ?? 0}` },
              { title: '存储费用', dataIndex: ['breakdown', 'storage'], render: (v: number) => `$${v?.toFixed(2) ?? 0}` },
              { title: '带宽费用', dataIndex: ['breakdown', 'bandwidth'], render: (v: number) => `$${v?.toFixed(2) ?? 0}` },
              {
                title: '月度总费用',
                dataIndex: 'estimatedMonthlyCost',
                render: (v: number) => <Text strong style={{ color: colors.primary[500] }}>${v?.toFixed(2)}</Text>,
              },
            ]}
          />
        )}
      </Modal>
    </div>
  );
};

export default MultiCloudPage;
