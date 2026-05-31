/**
 * FinOps 成本管理主页面
 *
 * 包含四个 Tab: 成本总览 / 预算管理 / 成本预测 / 优化建议
 * - 使用 Design Token 体系
 * - 完整 CRUD 交互链
 * - 空状态引导 + loading 状态 + 操作反馈
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tabs,
  Row,
  Col,
  Button,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Empty,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Popconfirm,
  Statistic,
  Progress,
  Descriptions,
  Divider,
} from 'antd';
import {
  DollarOutlined,
  WalletOutlined,
  LineChartOutlined,
  ThunderboltOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExportOutlined,
  ArrowUpOutlined,
  MinusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  getCostOverview,
  getCostBreakdown,
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  getForecasts,
  getRecommendations,
  updateRecommendationStatus,
  deleteRecommendation,
  exportCostReport,
} from '@/api/finops';
import type {
  CostSummaryResponse,
  CostBreakdownItem,
  Budget,
  BudgetInput,
  BudgetUpdateInput,
  OptimizationRecommendation,
  BudgetForecast,
} from '@/types/finops';
import { colors, radius, componentRadius } from '@/tokens';

const { Title, Text } = Typography;

// ============================================================================
// Configurations
// ============================================================================

const periodOptions = [
  { label: '每日', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
  { label: '每季', value: 'quarterly' },
  { label: '每年', value: 'yearly' },
];

const entityTypeOptions = [
  { label: '项目', value: 'project' },
  { label: '租户', value: 'tenant' },
  { label: '团队', value: 'team' },
];

const priorityConfig: Record<string, { color: string; label: string }> = {
  critical: { color: 'red', label: '紧急' },
  high: { color: 'orange', label: '高' },
  medium: { color: 'blue', label: '中' },
  low: { color: 'default', label: '低' },
};

const statusConfig: Record<string, { color: string; label: string }> = {
  identified: { color: 'default', label: '已识别' },
  reviewing: { color: 'processing', label: '评审中' },
  approved: { color: 'blue', label: '已批准' },
  'in-progress': { color: 'processing', label: '进行中' },
  completed: { color: 'success', label: '已完成' },
  rejected: { color: 'error', label: '已拒绝' },
};

// ============================================================================
// Main Component
// ============================================================================

const FinOpsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);

  // Cost overview state
  const [costSummary, setCostSummary] = useState<CostSummaryResponse['summary'] | null>(null);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdownItem[]>([]);

  // Budget state
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [budgetForm] = Form.useForm();
  const [budgetSubmitting, setBudgetSubmitting] = useState(false);

  // Forecast state
  const [forecasts, setForecasts] = useState<BudgetForecast[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);

  // Recommendation state
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [updatingRecommendation, setUpdatingRecommendation] = useState<string | null>(null);

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadCostOverview = useCallback(async () => {
    try {
      const data = await getCostOverview({ period: 'monthly' });
      setCostSummary(data);
    } catch (error: any) {
      message.error(`加载成本概览失败：${error?.message || '未知错误'}`);
    }
  }, []);

  const loadCostBreakdown = useCallback(async () => {
    try {
      const data = await getCostBreakdown({ dimension: 'category' });
      setCostBreakdown(data);
    } catch (error: any) {
      // Non-critical, don't show error for breakdown
    }
  }, []);

  const loadBudgets = useCallback(async () => {
    try {
      const data = await getBudgets();
      setBudgets(data);
    } catch (error: any) {
      message.error(`加载预算列表失败：${error?.message || '未知错误'}`);
    }
  }, []);

  const loadRecommendations = useCallback(async () => {
    setRecommendationsLoading(true);
    try {
      const data = await getRecommendations();
      setRecommendations(data);
    } catch (error: any) {
      message.error(`加载优化建议失败：${error?.message || '未知错误'}`);
    } finally {
      setRecommendationsLoading(false);
    }
  }, []);

  const loadForecasts = useCallback(async () => {
    setForecastLoading(true);
    try {
      const data = await getForecasts();
      setForecasts(data);
    } catch (error: any) {
      message.error(`加载成本预测失败：${error?.message || '未知错误'}`);
    } finally {
      setForecastLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([loadCostOverview(), loadCostBreakdown()]).finally(() => setLoading(false));
  }, [loadCostOverview, loadCostBreakdown]);

  // Load budgets when tab is activated
  useEffect(() => {
    if (activeTab === 'budget') loadBudgets();
    if (activeTab === 'forecast') loadForecasts();
    if (activeTab === 'recommendations') loadRecommendations();
  }, [activeTab, loadBudgets, loadForecasts, loadRecommendations]);

  // ============================================================================
  // Handlers - Budget CRUD
  // ============================================================================

  const handleOpenBudgetModal = (budget?: Budget) => {
    if (budget) {
      setEditingBudget(budget);
      budgetForm.setFieldsValue({
        entityType: budget.entity_type,
        entityId: budget.entity_id,
        amount: budget.amount,
        period: budget.period,
        environment: budget.environment,
        description: budget.description,
      });
    } else {
      setEditingBudget(null);
      budgetForm.resetFields();
    }
    setBudgetModalOpen(true);
  };

  const handleBudgetSubmit = async () => {
    try {
      const values = await budgetForm.validateFields();
      setBudgetSubmitting(true);

      if (editingBudget) {
        const updateInput: BudgetUpdateInput = {
          amount: values.amount,
          period: values.period,
          environment: values.environment,
          description: values.description,
        };
        await updateBudget(editingBudget.id, updateInput);
        message.success('预算更新成功');
      } else {
        const createInput: BudgetInput = {
          entityType: values.entityType,
          entityId: values.entityId,
          amount: values.amount,
          period: values.period,
          environment: values.environment,
          description: values.description,
        };
        await createBudget(createInput);
        message.success('预算创建成功');
      }

      setBudgetModalOpen(false);
      budgetForm.resetFields();
      loadBudgets();
    } catch (error: any) {
      if (!error.errorFields) {
        message.error(`保存预算失败：${error?.message || '未知错误'}`);
      }
    } finally {
      setBudgetSubmitting(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    try {
      await deleteBudget(id);
      message.success('预算已删除');
      loadBudgets();
    } catch (error: any) {
      message.error(`删除预算失败：${error?.message || '未知错误'}`);
    }
  };

  const handleExportReport = async () => {
    try {
      await exportCostReport({});
      message.success('报表导出成功');
    } catch (error: any) {
      message.error(`导出报表失败：${error?.message || '未知错误'}`);
    }
  };

  // ============================================================================
  // Handlers - Recommendations
  // ============================================================================

  const handleApproveRecommendation = async (id: string) => {
    try {
      setUpdatingRecommendation(id);
      await updateRecommendationStatus(id, 'approved');
      message.success('优化建议已批准');
      loadRecommendations();
    } catch (error: any) {
      message.error(`操作失败：${error?.message || '未知错误'}`);
    } finally {
      setUpdatingRecommendation(null);
    }
  };

  const handleRejectRecommendation = async (id: string) => {
    try {
      setUpdatingRecommendation(id);
      await updateRecommendationStatus(id, 'rejected');
      message.success('优化建议已拒绝');
      loadRecommendations();
    } catch (error: any) {
      message.error(`操作失败：${error?.message || '未知错误'}`);
    } finally {
      setUpdatingRecommendation(null);
    }
  };

  const handleDeleteRecommendation = async (id: string) => {
    try {
      await deleteRecommendation(id);
      message.success('优化建议已删除');
      loadRecommendations();
    } catch (error: any) {
      message.error(`删除失败：${error?.message || '未知错误'}`);
    }
  };

  // ============================================================================
  // Tab Definitions
  // ============================================================================

  const tabItems = [
    {
      key: 'overview',
      label: (
        <Space>
          <DollarOutlined />
          成本总览
        </Space>
      ),
      children: renderOverviewTab(),
    },
    {
      key: 'budget',
      label: (
        <Space>
          <WalletOutlined />
          预算管理
        </Space>
      ),
      children: renderBudgetTab(),
    },
    {
      key: 'forecast',
      label: (
        <Space>
          <LineChartOutlined />
          成本预测
        </Space>
      ),
      children: renderForecastTab(),
    },
    {
      key: 'recommendations',
      label: (
        <Space>
          <ThunderboltOutlined />
          优化建议
        </Space>
      ),
      children: renderRecommendationsTab(),
    },
  ];

  // ============================================================================
  // Tab: 成本总览
  // ============================================================================

  function renderOverviewTab() {
    if (!costSummary) {
      return (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Empty description="暂无成本数据" />
        </div>
      );
    }

    // TODO: link to budget data for usage percentage and month-over-month comparison

    return (
      <div>
        {/* Summary Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} style={{ borderRadius: componentRadius.card }}>
              <Statistic
                title="总成本"
                value={costSummary.totalCost}
                precision={2}
                prefix={
                  costSummary.totalCost > 0 ? (
                    <ArrowUpOutlined style={{ color: colors.error[500], fontSize: radius.xl }} />
                  ) : (
                    <MinusOutlined style={{ color: colors.neutral[400], fontSize: radius.xl }} />
                  )
                }
                suffix="¥"
                valueStyle={{ fontSize: 28, fontWeight: 600 }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {costSummary.period === 'monthly' ? '本月' : costSummary.period}
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} style={{ borderRadius: componentRadius.card }}>
              <Statistic
                title="计算资源"
                value={costSummary.computeCost}
                precision={2}
                suffix="¥"
                valueStyle={{ color: colors.primary[500] }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} style={{ borderRadius: componentRadius.card }}>
              <Statistic
                title="存储"
                value={costSummary.storageCost}
                precision={2}
                suffix="¥"
                valueStyle={{ color: colors.info[500] }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} style={{ borderRadius: componentRadius.card }}>
              <Statistic
                title="SaaS 工具"
                value={costSummary.saasCost}
                precision={2}
                suffix="¥"
                valueStyle={{ color: colors.warning[500] }}
              />
            </Card>
          </Col>
        </Row>

        {/* Cost Breakdown Table */}
        <Card
          title="成本分解"
          bordered={false}
          style={{ borderRadius: 12, marginBottom: 16 }}
          extra={
            <Button icon={<ExportOutlined />} onClick={handleExportReport}>
              导出报表
            </Button>
          }
        >
          <Table<CostBreakdownItem>
            columns={[
              {
                title: '类别',
                dataIndex: 'dimensionValue',
                key: 'dimensionValue',
                render: (v: string) => (
                  <Text strong style={{ color: colors.neutral[900] }}>
                    {getCategoryLabel(v)}
                  </Text>
                ),
              },
              {
                title: '成本 (¥)',
                dataIndex: 'cost',
                key: 'cost',
                sorter: (a, b) => a.cost - b.cost,
                render: (v: number) => (
                  <Text strong style={{ color: colors.primary[500] }}>
                    ¥{v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                ),
              },
              {
                title: '占比',
                dataIndex: 'percentage',
                key: 'percentage',
                render: (v: number) => <Tag color={colors.primary[500]}>{v}%</Tag>,
              },
            ]}
            dataSource={costBreakdown}
            rowKey="dimensionValue"
            pagination={false}
            locale={{ emptyText: <Empty description="暂无成本分解数据" /> }}
            size="middle"
          />
        </Card>

        {/* Cost Breakdown by Category Pie-like view */}
        <Card title="费用构成" bordered={false} style={{ borderRadius: componentRadius.card }}>
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {costBreakdown.map((item) => (
              <div key={item.dimensionValue}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text strong>{getCategoryLabel(item.dimensionValue)}</Text>
                  <Text type="secondary">¥{item.cost.toLocaleString()}</Text>
                </div>
                <Progress
                  percent={item.percentage}
                  strokeColor={colors.primary[500]}
                  showInfo={false}
                  size="small"
                />
              </div>
            ))}
            {costBreakdown.length === 0 && (
              <Empty description="暂无费用构成数据" />
            )}
          </Space>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // Tab: 预算管理
  // ============================================================================

  function renderBudgetTab() {
    return (
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">
            管理项目/租户/团队的预算配置
          </Text>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenBudgetModal()}
          >
            创建预算
          </Button>
        </div>

        <Table<Budget>
          columns={[
            {
              title: '实体类型',
              dataIndex: 'entity_type',
              key: 'entity_type',
              width: 100,
              render: (v: string) => <Tag color="blue">{getEntityTypeLabel(v)}</Tag>,
            },
            {
              title: '实体 ID',
              dataIndex: 'entity_id',
              key: 'entity_id',
              ellipsis: true,
            },
            {
              title: '预算金额',
              dataIndex: 'amount',
              key: 'amount',
              width: 120,
              sorter: (a, b) => a.amount - b.amount,
              render: (v: number) => (
                <Text strong style={{ color: colors.primary[500] }}>
                  ¥{v.toLocaleString()}
                </Text>
              ),
            },
            {
              title: '周期',
              dataIndex: 'period',
              key: 'period',
              width: 80,
              render: (v: string) => <Tag>{periodOptions.find(o => o.value === v)?.label || v}</Tag>,
            },
            {
              title: '环境',
              dataIndex: 'environment',
              key: 'environment',
              width: 100,
              render: (v?: string) => v ? <Tag color="geekblue">{v}</Tag> : '-',
            },
            {
              title: '描述',
              dataIndex: 'description',
              key: 'description',
              ellipsis: true,
            },
            {
              title: '操作',
              key: 'actions',
              width: 150,
              render: (_: unknown, record: Budget) => (
                <Space>
                  <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleOpenBudgetModal(record)}
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="确认删除"
                    description="删除此预算后不可恢复"
                    onConfirm={() => handleDeleteBudget(record.id)}
                    okText="确认"
                    cancelText="取消"
                  >
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
          dataSource={budgets}
          rowKey="id"
          loading={loading}
          locale={{
            emptyText: (
              <Empty
                description="暂无预算配置"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button type="primary" onClick={() => handleOpenBudgetModal()}>
                  <PlusOutlined /> 创建第一个预算
                </Button>
              </Empty>
            ),
          }}
        />

        {/* Budget Create/Edit Modal */}
        <Modal
          title={editingBudget ? '编辑预算' : '创建预算'}
          open={budgetModalOpen}
          onOk={handleBudgetSubmit}
          onCancel={() => {
            setBudgetModalOpen(false);
            budgetForm.resetFields();
          }}
          confirmLoading={budgetSubmitting}
          okText="保存"
          cancelText="取消"
          width={600}
        >
          <Form
            form={budgetForm}
            layout="vertical"
            style={{ marginTop: 24 }}
          >
            <Form.Item
              name="entityType"
              label="实体类型"
              rules={[{ required: true, message: '请选择实体类型' }]}
            >
              <Select options={entityTypeOptions} />
            </Form.Item>

            <Form.Item
              name="entityId"
              label="实体 ID"
              rules={[{ required: true, message: '请输入实体 ID' }]}
            >
              <Input placeholder="输入项目/租户/团队 ID" />
            </Form.Item>

            <Form.Item
              name="amount"
              label="预算金额 (¥)"
              rules={[{ required: true, message: '请输入预算金额' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                placeholder="输入预算金额"
                prefix="¥"
              />
            </Form.Item>

            <Form.Item
              name="period"
              label="预算周期"
              rules={[{ required: true, message: '请选择预算周期' }]}
            >
              <Select options={periodOptions} />
            </Form.Item>

            <Form.Item name="environment" label="环境">
              <Input placeholder="例如: production, staging" />
            </Form.Item>

            <Form.Item name="description" label="描述">
              <Input.TextArea rows={3} placeholder="预算用途说明" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    );
  }

  // ============================================================================
  // Tab: 成本预测
  // ============================================================================

  function renderForecastTab() {
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              loading={forecastLoading}
              onClick={loadForecasts}
            >
              刷新预测
            </Button>
          </Space>
        </div>

        {forecasts.length > 0 ? (
          <Row gutter={[16, 16]}>
            {forecasts.map((forecast, index) => (
              <Col xs={24} lg={12} key={index}>
                <Card
                  title={`预测 #${index + 1}`}
                  bordered={false}
                  style={{ borderRadius: componentRadius.card }}
                >
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="当前花费">
                      <Text strong style={{ color: colors.primary[500] }}>
                        ¥{forecast.currentSpend.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="预测花费">
                      <Text strong style={{ color: colors.warning[500] }}>
                        ¥{forecast.forecastedSpend.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="预计超支">
                      <Text
                        strong
                        style={{
                          color: forecast.projectedOverage > 0
                            ? colors.error[500]
                            : colors.success[500],
                        }}
                      >
                        ¥{forecast.projectedOverage.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="每日花费率">
                      ¥{forecast.dailySpendRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </Descriptions.Item>
                    <Descriptions.Item label="耗尽天数">
                      {forecast.daysUntilExhausted > 0
                        ? `${forecast.daysUntilExhausted} 天`
                        : '无数据'}
                    </Descriptions.Item>
                    <Descriptions.Item label="是否超预算">
                      <Tag color={forecast.withinBudget ? 'success' : 'error'}>
                        {forecast.withinBudget ? '未超预算' : '预计超预算'}
                      </Tag>
                    </Descriptions.Item>
                  </Descriptions>

                  {forecast.history.length > 0 && (
                    <>
                      <Divider style={{ margin: '16px 0 8px' }} />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        历史数据点：{forecast.history.length} 条
                      </Text>
                    </>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty
            description="暂无成本预测数据"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={loadForecasts} loading={forecastLoading}>
              <ReloadOutlined /> 刷新预测数据
            </Button>
          </Empty>
        )}
      </div>
    );
  }

  // ============================================================================
  // Tab: 优化建议
  // ============================================================================

  function renderRecommendationsTab() {
    return (
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">
            系统自动识别的成本优化机会
          </Text>
          <Button
            icon={<ReloadOutlined />}
            loading={recommendationsLoading}
            onClick={loadRecommendations}
          >
            刷新建议
          </Button>
        </div>

        <Table<OptimizationRecommendation>
          columns={[
            {
              title: '类别',
              dataIndex: 'category',
              key: 'category',
              width: 120,
              render: (v: string) => <Tag color="purple">{getCategoryLabel(v)}</Tag>,
            },
            {
              title: '描述',
              dataIndex: 'description',
              key: 'description',
              ellipsis: true,
            },
            {
              title: '预估节省',
              dataIndex: 'estimated_savings',
              key: 'estimated_savings',
              width: 120,
              sorter: (a, b) => a.estimated_savings - b.estimated_savings,
              render: (v: number) => (
                <Text strong style={{ color: colors.success[500] }}>
                  ¥{v.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </Text>
              ),
            },
            {
              title: '优先级',
              dataIndex: 'priority',
              key: 'priority',
              width: 80,
              render: (v: string) => (
                <Tag color={priorityConfig[v]?.color || 'default'}>
                  {priorityConfig[v]?.label || v}
                </Tag>
              ),
            },
            {
              title: '投入',
              dataIndex: 'effort',
              key: 'effort',
              width: 60,
              render: (v: number) => <Tag>{v}天</Tag>,
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              width: 100,
              render: (v: string) => (
                <Tag color={statusConfig[v]?.color || 'default'}>
                  {statusConfig[v]?.label || v}
                </Tag>
              ),
            },
            {
              title: '操作',
              key: 'actions',
              width: 200,
              render: (_: unknown, record: OptimizationRecommendation) => {
                if (record.status === 'identified' || record.status === 'reviewing') {
                  return (
                    <Space>
                      <Button
                        type="link"
                        size="small"
                        loading={updatingRecommendation === record.id}
                        onClick={() => handleApproveRecommendation(record.id)}
                      >
                        批准
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        loading={updatingRecommendation === record.id}
                        onClick={() => handleRejectRecommendation(record.id)}
                      >
                        拒绝
                      </Button>
                      <Popconfirm
                        title="确认删除"
                        description="删除此优化建议后不可恢复"
                        onConfirm={() => handleDeleteRecommendation(record.id)}
                        okText="确认"
                        cancelText="取消"
                      >
                        <Button type="link" size="small" danger>
                          <DeleteOutlined />
                        </Button>
                      </Popconfirm>
                    </Space>
                  );
                }
                return <Tag color={statusConfig[record.status]?.color}>{statusConfig[record.status]?.label}</Tag>;
              },
            },
          ]}
          dataSource={recommendations}
          rowKey="id"
          loading={recommendationsLoading}
          locale={{
            emptyText: (
              <Empty
                description="暂无优化建议"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button type="primary" onClick={loadRecommendations}>
                  <ReloadOutlined /> 刷新优化建议
                </Button>
              </Empty>
            ),
          }}
        />
      </div>
    );
  }

  // ============================================================================
  // Helper Functions
  // ============================================================================

  function getCategoryLabel(value: string): string {
    const map: Record<string, string> = {
      compute: '计算资源',
      storage: '存储',
      network: '网络',
      saas: 'SaaS 工具',
      'right-sizing': '资源调整',
      'unused-resources': '闲置资源',
      'reserved-instances': '预留实例',
      'storage-optimization': '存储优化',
      'network-optimization': '网络优化',
      scheduling: '调度优化',
      architecture: '架构优化',
    };
    return map[value] || value;
  }

  function getEntityTypeLabel(value: string): string {
    const map: Record<string, string> = {
      project: '项目',
      tenant: '租户',
      team: '团队',
    };
    return map[value] || value;
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div style={{ padding: 0 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <DollarOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            FinOps 成本管理
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            云资源成本追踪、预算管理、优化建议与预测分析
          </Text>
        </div>
        <Space>
          <Button icon={<ExportOutlined />} onClick={handleExportReport}>
            导出报表
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => {
            loadCostOverview();
            loadCostBreakdown();
          }}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Main Tabs */}
      <Card bordered={false} style={{ borderRadius: componentRadius.card }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
        />
      </Card>
    </div>
  );
};

export default FinOpsPage;
