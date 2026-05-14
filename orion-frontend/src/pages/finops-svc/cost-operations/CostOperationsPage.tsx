/**
 * CostOperationsPage (Phase 2)
 * 成本运营页 - 预算门禁、成本趋势、异常检测、优化建议
 */
import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Typography,
  Card,
  Tabs,
  Table,
  Tag,
  Space,
  Button,
  Form,
  Input,
  Select,
  message,
  Row,
  Col,
  Statistic,
  Modal,
  Alert,
  Progress,
} from 'antd';
import {
  DollarOutlined,
  ReloadOutlined,
  PlusOutlined,
  WarningOutlined,
  RiseOutlined,
  FallOutlined,
  CheckCircleOutlined,
  SafetyOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import PageSkeleton from '@/components/PageSkeleton';
import {
  getCostOverview,
  getCostTrend,
  getCostByService,
  getCostAnomalies,
  getOptimizationSuggestions,
  getBudgets,
  createBudget,
  deleteBudget,
  checkBudgetGate,
  applyOptimization,
  rejectOptimization,
  type CostOverview as CostOverviewType,
  type CostTrendPoint,
  type CostByService as CostByServiceType,
  type CostAnomaly,
  type OptimizationSuggestion,
  type BudgetConfig,
} from '@/api/cost-operations';

const { Title, Text } = Typography;

// ---- Color maps ----

const severityColorMap: Record<string, string> = {
  low: 'blue',
  medium: 'warning',
  high: 'orange',
};

const suggestionStatusMap: Record<string, string> = {
  pending: 'default',
  accepted: 'processing',
  rejected: 'error',
  implemented: 'success',
};

const categoryLabelMap: Record<string, string> = {
  compute: '计算资源',
  storage: '存储资源',
  network: '网络资源',
  idle: '闲置资源',
  rightsizing: '规格优化',
};

// ---- Overview Tab ----

const CostOverviewTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<CostOverviewType | null>(null);
  const [trends, setTrends] = useState<CostTrendPoint[]>([]);
  const [byService, setByService] = useState<CostByServiceType[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [overviewRes, trendRes, serviceRes] = await Promise.all([
        getCostOverview(),
        getCostTrend({ days: 30 }),
        getCostByService(),
      ]);
      setOverview(overviewRes.data?.data || null);
      setTrends(trendRes.data?.data?.trends || []);
      setByService(serviceRes.data?.data?.services || []);
    } catch (error: unknown) {
      message.error(`加载成本数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const trendOption = {
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['实际成本', '预算'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      boundaryGap: false,
      data: trends.map((t) => t.date),
    },
    yAxis: { type: 'value' as const, name: '成本 (元)' },
    series: [
      {
        name: '实际成本',
        type: 'line' as const,
        data: trends.map((t) => t.cost),
        smooth: true,
        itemStyle: { color: colors.primary[500] },
        areaStyle: { color: colors.primary[200], opacity: 0.3 },
      },
      {
        name: '预算',
        type: 'line' as const,
        data: trends.map((t) => t.budget),
        smooth: true,
        itemStyle: { color: colors.warning[500] },
        lineStyle: { type: 'dashed' as const },
      },
    ],
  };

  const servicePieOption = {
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c}元 ({d}%)' },
    series: [
      {
        type: 'pie' as const,
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        data: byService.map((s) => ({ name: s.serviceName, value: Math.round(s.cost * 100) / 100 })),
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
      },
    ],
  };

  const columns = [
    { title: '服务', dataIndex: 'serviceName', key: 'serviceName', width: 160, render: (v: string) => <Text strong>{v}</Text> },
    {
      title: '成本',
      dataIndex: 'cost',
      key: 'cost',
      width: 120,
      render: (v: number) => `¥${v.toFixed(2)}`,
    },
    {
      title: '占比',
      dataIndex: 'percentOfTotal',
      key: 'percentOfTotal',
      width: 100,
      render: (v: number) => <Progress percent={Math.round(v)} size="small" style={{ width: 80 }} />,
    },
    {
      title: '趋势',
      key: 'trend',
      width: 120,
      render: (_: unknown, record: CostByServiceType) => (
        <Space>
          {record.trend === 'up' ? (
            <RiseOutlined style={{ color: colors.error[400] }} />
          ) : record.trend === 'down' ? (
            <FallOutlined style={{ color: colors.success[500] }} />
          ) : (
            <Text>-</Text>
          )}
          <Text type="secondary">{record.trendPercent.toFixed(1)}%</Text>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Summary Cards */}
      {overview && (
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="本月成本"
                value={overview.currentMonthCost}
                prefix="¥"
                precision={2}
              />
              {overview.monthOverMonthChange !== 0 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  环比 {overview.monthOverMonthChange > 0 ? (
                    <RiseOutlined style={{ color: colors.error[400] }} />
                  ) : (
                    <FallOutlined style={{ color: colors.success[500] }} />
                  )} {Math.abs(overview.monthOverMonthChange).toFixed(1)}%
                </Text>
              )}
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="预计月度成本"
                value={overview.projectedMonthlyCost}
                prefix="¥"
                precision={2}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="预算剩余"
                value={overview.budgetRemaining}
                prefix="¥"
                precision={2}
                valueStyle={{ color: overview.budgetRemaining > 0 ? colors.success[500] : colors.error[400] }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="预算使用率"
                value={overview.budgetUsagePercent}
                suffix="%"
                valueStyle={{
                  color:
                    overview.budgetUsagePercent > 90
                      ? colors.error[400]
                      : overview.budgetUsagePercent > 70
                        ? colors.warning[500]
                        : colors.success[500],
                }}
              />
              <Progress
                percent={Math.round(overview.budgetUsagePercent)}
                size="small"
                style={{ marginTop: 8 }}
                strokeColor={
                  overview.budgetUsagePercent > 90
                    ? colors.error[400]
                    : overview.budgetUsagePercent > 70
                      ? colors.warning[500]
                      : colors.success[500]
                }
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Charts */}
      <Row gutter={16}>
        <Col span={16}>
          <Card title="成本趋势 (30天)" loading={loading}>
            <ReactECharts option={trendOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="服务成本分布" loading={loading}>
            <ReactECharts option={servicePieOption} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      {/* Service Cost Table */}
      <Card title="服务成本明细">
        <Table
          columns={columns}
          dataSource={byService}
          rowKey="serviceName"
          size="small"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </Space>
  );
};

// ---- Anomaly Detection Tab ----

const AnomalyDetectionTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [anomalies, setAnomalies] = useState<CostAnomaly[]>([]);

  const loadAnomalies = async () => {
    setLoading(true);
    try {
      const res = await getCostAnomalies({ days: 7 });
      setAnomalies(res.data?.data?.anomalies || []);
    } catch (error: unknown) {
      message.error(`加载异常检测数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnomalies();
  }, []);

  const anomalyTypeMap: Record<string, string> = {
    spike: '成本突增',
    drop: '成本骤降',
    pattern_change: '模式变化',
  };

  const columns = [
    { title: '服务', dataIndex: 'serviceName', key: 'serviceName', width: 160, render: (v: string) => <Text strong>{v}</Text> },
    {
      title: '异常类型',
      dataIndex: 'anomalyType',
      key: 'anomalyType',
      width: 120,
      render: (v: string) => <Tag color={v === 'spike' ? 'error' : v === 'drop' ? 'success' : 'warning'}>{anomalyTypeMap[v]}</Tag>,
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (v: string) => <Tag color={severityColorMap[v]}>{v}</Tag>,
    },
    { title: '预期成本', key: 'expected', width: 100, render: (_: unknown, r: CostAnomaly) => `¥${r.expectedCost.toFixed(2)}` },
    { title: '实际成本', key: 'actual', width: 100, render: (_: unknown, r: CostAnomaly) => `¥${r.actualCost.toFixed(2)}` },
    {
      title: '偏差',
      key: 'deviation',
      width: 80,
      render: (_: unknown, r: CostAnomaly) => (
        <Text style={{ color: r.deviation > 0 ? colors.error[400] : colors.success[500] }}>
          {r.deviation > 0 ? '+' : ''}{r.deviation.toFixed(1)}%
        </Text>
      ),
    },
    { title: '检测时间', dataIndex: 'detectedAt', key: 'detectedAt', width: 160, render: (v: string) => new Date(v).toLocaleString() },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary">自动检测成本异常波动</Text>
        <Button icon={<ReloadOutlined />} onClick={loadAnomalies} loading={loading}>刷新</Button>
      </div>

      {anomalies.length === 0 && !loading && (
        <Card>
          <Alert
            message="未检测到异常"
            description="过去 7 天内未发现成本异常波动"
            type="success"
            icon={<CheckCircleOutlined />}
          />
        </Card>
      )}

      {anomalies.length > 0 && (
        <Card
          title={
            <Space>
              <WarningOutlined style={{ color: colors.warning[500] }} />
              <span>检测到 {anomalies.length} 个异常</span>
            </Space>
          }
        >
          <Table columns={columns} dataSource={anomalies} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10 }} />
        </Card>
      )}
    </div>
  );
};

// ---- Optimization Tab ----

const OptimizationTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [filter, setFilter] = useState<string>('all');

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { category: filter } : undefined;
      const res = await getOptimizationSuggestions(params);
      setSuggestions(res.data?.data?.suggestions || []);
    } catch (error: unknown) {
      message.error(`加载优化建议失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, [filter]);

  const handleApply = async (id: string) => {
    try {
      await applyOptimization(id);
      message.success('优化建议已应用');
      loadSuggestions();
    } catch (error: unknown) {
      message.error(`应用失败: ${(error as Error).message}`);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectOptimization(id);
      message.success('已忽略该建议');
      loadSuggestions();
    } catch (error: unknown) {
      message.error(`操作失败: ${(error as Error).message}`);
    }
  };

  const effortColorMap: Record<string, string> = {
    low: 'success',
    medium: 'warning',
    high: 'error',
  };

  const columns = [
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (v: string) => <Tag color="blue">{categoryLabelMap[v] || v}</Tag>,
    },
    { title: '服务', dataIndex: 'serviceName', key: 'serviceName', width: 140 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '预计节省',
      dataIndex: 'potentialSavings',
      key: 'potentialSavings',
      width: 100,
      render: (v: number) => <Text strong style={{ color: colors.success[500] }}>¥{v.toFixed(2)}</Text>,
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 80,
      render: (v: number) => `${Math.round(v * 100)}%`,
    },
    {
      title: '实施难度',
      dataIndex: 'effort',
      key: 'effort',
      width: 80,
      render: (v: string) => <Tag color={effortColorMap[v]}>{v}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <Tag color={suggestionStatusMap[v]}>{v}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: OptimizationSuggestion) =>
        record.status === 'pending' ? (
          <Space size="small">
            <Button type="link" size="small" style={{ color: colors.success[500] }} onClick={() => handleApply(record.id)}>
              应用
            </Button>
            <Button type="link" size="small" danger onClick={() => handleReject(record.id)}>
              忽略
            </Button>
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Text type="secondary">AI 驱动的成本优化建议</Text>
          <Select
            style={{ width: 140 }}
            value={filter}
            onChange={setFilter}
            options={[
              { label: '全部类别', value: 'all' },
              { label: '计算资源', value: 'compute' },
              { label: '存储资源', value: 'storage' },
              { label: '网络资源', value: 'network' },
              { label: '闲置资源', value: 'idle' },
              { label: '规格优化', value: 'rightsizing' },
            ]}
          />
        </Space>
        <Button icon={<ReloadOutlined />} onClick={loadSuggestions} loading={loading}>刷新</Button>
      </div>

      {suggestions.length > 0 && (
        <Card title={<span><BulbOutlined style={{ color: colors.warning[500] }} /> 优化建议 ({suggestions.length})</span>}>
          <Table columns={columns} dataSource={suggestions} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10 }} />
        </Card>
      )}

      {suggestions.length === 0 && !loading && (
        <Card>
          <Alert
            message="暂无优化建议"
            description="当前资源配置良好，或者 AI 正在分析中"
            type="info"
          />
        </Card>
      )}
    </div>
  );
};

// ---- Budget Tab ----

const BudgetTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [budgets, setBudgets] = useState<BudgetConfig[]>([]);
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gateForm] = Form.useForm();
  const [gateLoading, setGateLoading] = useState(false);
  const [gateResult, setGateResult] = useState<{ passed: boolean; reason: string; estimated: number; limit: number } | null>(null);

  const loadBudgets = async () => {
    setLoading(true);
    try {
      const res = await getBudgets();
      setBudgets(res.data?.data?.budgets || []);
    } catch (error: unknown) {
      message.error(`加载预算失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudgets();
  }, []);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await createBudget({
        name: values.name,
        amount: values.amount,
        period: values.period,
        services: values.services
          ? (values.services as string).split(',').map((s: string) => s.trim())
          : [],
        alerts: [{ thresholdPercent: values.alertThreshold, action: values.alertAction, recipients: [] }],
      });
      message.success('预算已创建');
      setModalVisible(false);
      form.resetFields();
      loadBudgets();
    } catch (error: unknown) {
      if (!(error as { errorFields?: unknown }).errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (budgetId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      onOk: async () => {
        try {
          await deleteBudget(budgetId);
          message.success('预算已删除');
          loadBudgets();
        } catch (error: unknown) {
          message.error(`删除失败: ${(error as Error).message}`);
        }
      },
    });
  };

  const handleCheckGate = async () => {
    try {
      const values = await gateForm.validateFields();
      setGateLoading(true);
      const res = await checkBudgetGate(values.pipelineId, values.estimatedCost);
      const data = res.data?.data;
      setGateResult({
        passed: !data?.wouldExceed,
        reason: data?.reason || '预算检查通过',
        estimated: data?.estimatedCost || values.estimatedCost,
        limit: data?.budgetLimit || 0,
      });
    } catch (error: unknown) {
      if (!(error as { errorFields?: unknown }).errorFields) {
        message.error(`预算门禁检查失败: ${(error as Error).message}`);
      }
    } finally {
      setGateLoading(false);
    }
  };

  const periodMap: Record<string, string> = {
    monthly: '月度',
    quarterly: '季度',
    yearly: '年度',
  };

  const budgetColumns = [
    { title: '预算名称', dataIndex: 'name', key: 'name', width: 180, render: (v: string) => <Text strong>{v}</Text> },
    { title: '周期', dataIndex: 'period', key: 'period', width: 80, render: (v: string) => periodMap[v] || v },
    { title: '金额', dataIndex: 'amount', key: 'amount', width: 120, render: (v: number) => `¥${v.toFixed(2)}` },
    {
      title: '关联服务',
      key: 'services',
      render: (_: unknown, record: BudgetConfig) =>
        record.services.length > 0 ? (
          <Space wrap>
            {record.services.slice(0, 3).map((s: string, i: number) => (
              <Tag key={i}>{s}</Tag>
            ))}
            {record.services.length > 3 && <Tag>+{record.services.length - 3}</Tag>}
          </Space>
        ) : (
          <Text type="secondary">全部</Text>
        ),
    },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 160, render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: BudgetConfig) => (
        <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>删除</Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Budget Gate Check */}
      <Card title={<span><SafetyOutlined /> 预算门禁检查</span>}>
        <Form form={gateForm} layout="inline" onFinish={handleCheckGate}>
          <Form.Item name="pipelineId" label="Pipeline ID" rules={[{ required: true }]}>
            <Input placeholder="如: main-build" style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="estimatedCost" label="预估成本 (元)" rules={[{ required: true }]}>
            <Input type="number" placeholder="100.00" style={{ width: 140 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={gateLoading} icon={<SafetyOutlined />}>
              检查
            </Button>
          </Form.Item>
        </Form>

        {gateResult && (
          <Alert
            style={{ marginTop: 16 }}
            message={gateResult.passed ? '预算检查通过' : '预算检查未通过'}
            description={`${gateResult.reason} (预估: ¥${gateResult.estimated.toFixed(2)}, 预算: ¥${gateResult.limit.toFixed(2)})`}
            type={gateResult.passed ? 'success' : 'error'}
            showIcon
          />
        )}
      </Card>

      {/* Budgets List */}
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">配置和管理预算</Text>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadBudgets} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>创建预算</Button>
          </Space>
        </div>
        <Table columns={budgetColumns} dataSource={budgets} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10 }} />
      </div>

      {/* Create Budget Modal */}
      <Modal
        title="创建预算"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="预算名称" rules={[{ required: true }]}>
            <Input placeholder="如: 2026 Q2 预算" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="amount" label="预算金额 (元)" rules={[{ required: true }]}>
                <Input type="number" placeholder="10000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="period" label="周期" rules={[{ required: true }]} initialValue="monthly">
                <Select options={[
                  { label: '月度', value: 'monthly' },
                  { label: '季度', value: 'quarterly' },
                  { label: '年度', value: 'yearly' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="services" label="关联服务 (逗号分隔, 留空表示全部)">
            <Input placeholder="如: api-service, web-service" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="alertThreshold" label="告警阈值 (%)" initialValue={80}>
                <Input type="number" min={0} max={100} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="alertAction" label="告警动作" initialValue="notify">
                <Select options={[
                  { label: '通知', value: 'notify' },
                  { label: '警告', value: 'warn' },
                  { label: '阻断', value: 'block' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Space>
  );
};

// ---- Main Page ----

const CostOperationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <PageSkeleton rows={6} />;
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <DollarOutlined style={{ marginRight: 8 }} />
          成本运营
        </Title>
        <Text type="secondary">预算门禁、成本趋势分析、异常检测与优化建议</Text>
      </div>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane tab={<span><DollarOutlined /> 总览</span>} key="overview">
          <CostOverviewTab />
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span><WarningOutlined /> 异常检测</span>} key="anomalies">
          <AnomalyDetectionTab />
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span><BulbOutlined /> 优化建议</span>} key="optimization">
          <OptimizationTab />
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span><SafetyOutlined /> 预算管理</span>} key="budget">
          <BudgetTab />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default CostOperationsPage;
