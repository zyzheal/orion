/**
 * Multi-Cloud Management Page
 * 多云管理 - 资源概览 Dashboard + 云账号管理 + 资源跟踪
 *
 * Features:
 * - 资源统计概览 (统计卡片 + 云厂商分布 + 成本趋势)
 * - 云账号管理 (CRUD)
 * - 资源跟踪与同步
 * - 成本对比分析
 *
 * 模块拆分：
 * - ./MultiCloudConfig    颜色 / 标签 / 选项等纯数据常量
 * - ./MultiCloudColumns   表格列定义（含工厂函数模式）
 * - ./MultiCloudModals    注册 / 编辑 / 成本对比弹窗
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Form,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  message,
  Typography,
  Tabs,
  Progress,
  Modal,
  Tooltip,
} from 'antd';
import {
  CloudServerOutlined,
  PlusOutlined,
  ReloadOutlined,
  CloudOutlined,
  DollarOutlined,
  GlobalOutlined,
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
  type CostComparison,
} from '@/api/multi-cloud';
import { colors, spacing, themeVars } from '@/tokens';
import {
  providerLabelMap,
  providerIconColors,
  resourceTypeIcons,
  resourceTypeTokenColors,
} from './MultiCloudConfig';
import { makeAccountColumns, resourceColumns } from './MultiCloudColumns';
import { CreateAccountModal, EditAccountModal, CostComparisonModal } from './MultiCloudModals';

const { Title, Text } = Typography;

const MultiCloudPage: React.FC = () => {
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [resources, setResources] = useState<CloudResource[]>([]);
  const [statistics, setStatistics] = useState<ResourceStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CloudAccount | null>(null);
  const [editForm] = Form.useForm();
  const [costModalOpen, setCostModalOpen] = useState(false);
  const [costComparison, setCostComparison] = useState<CostComparison[]>([]);
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
        const data = accountsRes.value as { data?: CloudAccount[] };
        setAccounts(Array.isArray(data?.data) ? data.data : []);
      }
      if (resourcesRes.status === 'fulfilled') {
        const data = resourcesRes.value as { data?: CloudResource[] };
        setResources(Array.isArray(data?.data) ? data.data : []);
      }
      if (statsRes.status === 'fulfilled') {
        const data = statsRes.value as { data?: ResourceStatistics };
        setStatistics(data?.data ?? null);
      }
    } catch (error: unknown) {
      message.error(`加载多云数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: {
    name: string;
    provider: string;
    region: string;
    credentials_ref?: string;
  }) => {
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
      loadData();
      setSyncing(null);
    } catch (error: unknown) {
      message.error(`同步失败: ${(error as Error).message}`);
      setSyncing(null);
    }
  };

  const handleEdit = (record: CloudAccount) => {
    setEditingAccount(record);
    editForm.setFieldsValue({
      name: record.account_name,
      provider: record.provider_id || record.credential_type,
      region: record.region,
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (values: { name: string; provider: string; region: string }) => {
    if (!editingAccount) return;
    try {
      await multiCloudApi.updateCloudAccount(editingAccount.id, {
        name: values.name,
        region: values.region,
      });
      message.success('云账号更新成功');
      setEditModalOpen(false);
      setEditingAccount(null);
      editForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`更新失败: ${(error as Error).message}`);
    }
  };

  const handleDelete = (record: CloudAccount) => {
    Modal.confirm({
      title: '确认删除云账号？',
      content: `将删除云账号「${record.account_name}」(${record.provider_id || record.credential_type})，该操作不可恢复。`,
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await multiCloudApi.deleteCloudAccount(record.id);
          message.success('云账号已删除');
          loadData();
        } catch (error: unknown) {
          message.error(`删除失败: ${(error as Error).message}`);
        }
      },
    });
  };

  const handleCostCompare = async (values: {
    vm_count: number;
    vm_type: string;
    storage_gb: number;
    bandwidth_gb_month: number;
  }) => {
    setCostLoading(true);
    try {
      const res = await multiCloudApi.compareCloudCosts({
        vm_count: values.vm_count,
        vm_type: values.vm_type,
        storage_gb: values.storage_gb,
        bandwidth_gb_month: values.bandwidth_gb_month,
      });
      setCostComparison((res.data as CostComparison[]) || []);
    } catch (error: unknown) {
      message.error(`成本对比失败: ${(error as Error).message}`);
    } finally {
      setCostLoading(false);
    }
  };

  // Stats
  const stats = useMemo(
    () => ({
      total: accounts.length,
      active: accounts.filter((a) => a.status === 'active').length,
      error: accounts.filter((a) => a.status === 'error').length,
      resources: resources.length,
      providers: new Set(accounts.map((a) => a.provider_id || a.credential_type)).size,
      regions: new Set(accounts.map((a) => a.region)).size,
    }),
    [accounts, resources]
  );

  // Provider distribution for visualization
  const providerDistribution = useMemo(() => {
    const source = statistics?.byProvider ?? {};
    const entries = Object.entries(source);
    const total = entries.reduce((sum, [, count]) => sum + (count as number), 0);
    if (total === 0) {
      // Fallback to accounts data
      const providerCounts: Record<string, number> = {};
      accounts.forEach((a) => {
        const p = a.provider_id || a.credential_type || 'unknown';
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

  // Cost trend data - from API with fallback
  const [costTrendData, setCostTrendData] = useState<
    Array<{ month: string; cost: number }>
  >([]);
  const [costTrendLoading, setCostTrendLoading] = useState(false);

  useEffect(() => {
    const fetchCostTrend = async () => {
      setCostTrendLoading(true);
      try {
        const res = await multiCloudApi.getCostStats();
        const data = (res.data as { months?: Array<{ month: string; cost: number }> }) || {};
        if (data.months && data.months.length > 0) {
          setCostTrendData(data.months);
        }
      } catch {
        // Fallback: empty state shown to user
        setCostTrendData([]);
      } finally {
        setCostTrendLoading(false);
      }
    };
    fetchCostTrend();
  }, []);

  const maxCost = Math.max(...costTrendData.map((t) => t.cost), 1);

  // Account columns
  const accountColumns = useMemo(
    () =>
      makeAccountColumns({
        resources,
        syncing,
        handleSync,
        handleEdit,
        handleDelete,
      }),
    [resources, syncing]
  );

  // Dashboard overview section
  const renderDashboard = () => (
    <div style={{ marginBottom: spacing.lg }}>
      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
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
            <Text type="secondary" style={{ fontSize: 12 }}>
              {stats.active} 已连接
            </Text>
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
            <Text type="secondary" style={{ fontSize: 12 }}>
              {stats.providers} 云厂商
            </Text>
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
            style={{
              borderRadius: 12,
              borderTop: `3px solid ${stats.error > 0 ? colors.error[500] : colors.success[500]}`,
            }}
          >
            <Statistic
              title="异常账号"
              value={stats.error}
              prefix={
                stats.error > 0 ? (
                  <ExclamationCircleOutlined style={{ color: colors.error[500] }} />
                ) : (
                  <CheckCircleOutlined style={{ color: colors.success[500] }} />
                )
              }
              valueStyle={{
                fontSize: 28,
                fontWeight: 600,
                color: stats.error > 0 ? colors.error[500] : colors.success[500],
              }}
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
      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col span={12}>
          <Card title="云厂商资源分布" size="small" style={{ borderRadius: 12 }}>
            {providerDistribution.length > 0 ? (
              <div>
                {providerDistribution.map((item) => (
                  <div key={item.provider} style={{ marginBottom: spacing.md }}>
                    <div
                      style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}
                    >
                      <Space>
                        <CloudOutlined
                          style={{
                            color: providerIconColors[item.provider] || colors.neutral[500],
                          }}
                        />
                        <Text strong>
                          {providerLabelMap[item.provider] || item.provider}
                        </Text>
                      </Space>
                      <Text type="secondary">
                        {item.count} 个资源 ({item.percentage}%)
                      </Text>
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
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                height: 160,
                gap: spacing.sm,
                padding: '0 8px',
              }}
            >
              {costTrendLoading ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 160,
                    width: '100%',
                  }}
                >
                  <Text type="secondary">加载中...</Text>
                </div>
              ) : costTrendData.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 160,
                    width: '100%',
                  }}
                >
                  <Text type="secondary">暂无成本数据</Text>
                </div>
              ) : (
                costTrendData.map((item, index) => {
                  const height = maxCost > 0 ? (item.cost / maxCost) * 140 : 0;
                  const isCurrent = index === costTrendData.length - 1;
                  return (
                    <Tooltip key={item.month} title={`$${item.cost.toLocaleString()}`}>
                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 10, marginBottom: 4 }}>
                          ${(item.cost / 1000).toFixed(1)}k
                        </Text>
                        <div
                          style={{
                            width: '100%',
                            height: Math.max(height, 4),
                            backgroundColor: isCurrent
                              ? colors.primary[500]
                              : colors.primary[200],
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 0.3s ease',
                          }}
                        />
                        <Text type="secondary" style={{ fontSize: 10, marginTop: 4 }}>
                          {item.month}
                        </Text>
                      </div>
                    </Tooltip>
                  );
                })
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Resource Type Distribution */}
      {resourceTypeDistribution.length > 0 && (
        <Row gutter={16} style={{ marginBottom: spacing.lg }}>
          <Col span={24}>
            <Card title="资源类型分布" size="small" style={{ borderRadius: 12 }}>
              <Row gutter={16}>
                {resourceTypeDistribution.map((item) => (
                  <Col span={4} key={item.type}>
                    <Card
                      size="small"
                      style={{
                        textAlign: 'center',
                        borderRadius: 8,
                        borderTop: `2px solid ${resourceTypeTokenColors[item.type] || colors.neutral[300]}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 24,
                          color: resourceTypeTokenColors[item.type],
                          marginBottom: spacing.sm,
                        }}
                      >
                        {resourceTypeIcons[item.type] || <HddOutlined />}
                      </div>
                      <Statistic
                        title={item.type}
                        value={item.count}
                        valueStyle={{ fontSize: 20 }}
                      />
                      <Progress
                        percent={item.percentage}
                        size="small"
                        strokeColor={resourceTypeTokenColors[item.type]}
                        format={() => `${item.percentage}%`}
                      />
                    </Card>
                  </Col>
                ))}
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
      label: (
        <>
          <CloudServerOutlined /> 云账号
        </>
      ),
      children: (
        <Table
          columns={accountColumns}
          dataSource={accounts}
          rowKey="account_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      ),
    },
    {
      key: 'resources',
      label: (
        <>
          <HddOutlined /> 云资源
        </>
      ),
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
    <div style={{ padding: spacing.lg, background: themeVars.bgSecondary, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <CloudOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
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

      <CreateAccountModal
        open={createModalOpen}
        form={form}
        onCancel={() => setCreateModalOpen(false)}
        onFinish={handleCreate}
      />

      <EditAccountModal
        open={editModalOpen}
        form={editForm}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingAccount(null);
          editForm.resetFields();
        }}
        onFinish={handleEditSubmit}
      />

      <CostComparisonModal
        open={costModalOpen}
        form={costForm}
        comparison={costComparison}
        loading={costLoading}
        onCancel={() => {
          setCostModalOpen(false);
          setCostComparison([]);
        }}
        onFinish={handleCostCompare}
      />
    </div>
  );
};

export default MultiCloudPage;
