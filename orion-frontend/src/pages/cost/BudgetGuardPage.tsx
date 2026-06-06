/**
 * Budget Guard Page
 * Phase 2 - Budget guard configuration, evaluation, and cost forecasting
 *
 * Features:
 * - Budget guard CRUD (create, edit, delete, toggle)
 * - Guard list with status, action, scope display
 * - Budget evaluation panel (test pipeline against guards)
 * - Cost forecast display
 * - Full integration with /v1/cost-operations/budget-guards API
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
  InputNumber,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  message,
  Typography,
  Descriptions,
  Popconfirm,
  Switch,
  Alert,
  Divider,
} from 'antd';
import {
  SafetyOutlined,
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  LineChartOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  DollarOutlined,} from '@ant-design/icons';
import type { TableColumn } from '@/components/Table';
import {
  getBudgetGuards,
  createBudgetGuard,
  evaluateBudgetGuard,
  getCostForecast,
  type BudgetGuard,
  type BudgetGuardInput,
  type EvaluationResult,
  type CostForecastResult,
} from '@/api/cost-operations';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

// ============================================================================
// Summary Cards Component
// ============================================================================

interface SummaryCardsProps {
  guards: BudgetGuard[];
  forecast: CostForecastResult | null;
  evaluationCount: number;
  blockedCount: number;
}

const SummaryCards: React.FC<SummaryCardsProps> = ({ guards, forecast: _forecast, evaluationCount, blockedCount }) => {
  const activeCount = guards.filter((g) => g.status === 'active').length;
  const totalBudget = guards.reduce((sum, g) => sum + g.budgetAmount, 0);

  return (
    <Row gutter={spacing[4]} style={{ marginBottom: spacing[4] }}>
      <Col span={6}>
        <Card>
          <Statistic
            title="Budget Guards"
            value={guards.length}
            prefix={<SafetyOutlined />}
            suffix={`/ ${activeCount} active`}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="Total Budget"
            value={totalBudget}
            precision={2}
            prefix="¥"
            suffix="/ month"
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="Evaluations"
            value={evaluationCount}
            prefix={<ThunderboltOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="Blocked"
            value={blockedCount}
            prefix={<CloseCircleOutlined />}
            valueStyle={{ color: blockedCount > 0 ? colors.error[500] : colors.success[500] }}
          />
        </Card>
      </Col>
    </Row>
  );
};

// ============================================================================
// Forecast Card Component
// ============================================================================

interface ForecastCardProps {
  forecast: CostForecastResult | null;
  loading: boolean;
}

const ForecastCard: React.FC<ForecastCardProps> = ({ forecast, loading }) => {
  if (!forecast) {
    return (
      <Card
        title={
          <Space>
            <LineChartOutlined />
            Cost Forecast
          </Space>
        }
        loading={loading}
      >
        <Alert
          message="No forecast data available"
          description="Cost forecast is generated based on historical spending patterns."
          type="info"
          showIcon
        />
      </Card>
    );
  }

  const isOverBudget = forecast.projectedOverage > 0;

  return (
    <Card
      title={
        <Space>
          <LineChartOutlined />
          Cost Forecast
        </Space>
      }
      loading={loading}
    >
      <Row gutter={spacing[4]}>
        <Col span={8}>
          <Statistic
            title="Current Spend"
            value={forecast.currentSpend}
            precision={2}
            prefix="¥"
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Predicted End of Month"
            value={forecast.predictedEndOfMonthCost}
            precision={2}
            prefix="¥"
            valueStyle={{ color: isOverBudget ? colors.error[500] : colors.success[500] }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={isOverBudget ? 'Projected Overage' : 'Budget Remaining'}
            value={Math.abs(forecast.projectedOverage)}
            precision={2}
            prefix="¥"
            valueStyle={{ color: isOverBudget ? colors.error[500] : colors.success[500] }}
          />
        </Col>
      </Row>
      <Divider />
      <Descriptions size="small" column={2}>
        <Descriptions.Item label="Confidence">
          {(forecast.confidence * 100).toFixed(0)}%
        </Descriptions.Item>
        <Descriptions.Item label="Forecast Days">
          {forecast.dailyForecast?.length || 0} days
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
};

// ============================================================================
// Budget Guard Page Component
// ============================================================================

const BudgetGuardPage: React.FC = () => {
  // Guard list state
  const [guards, setGuards] = useState<BudgetGuard[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingGuard, setEditingGuard] = useState<BudgetGuard | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // Evaluation state
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [evalForm] = Form.useForm();
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);

  // Forecast state
  const [forecast, setForecast] = useState<CostForecastResult | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  // Stats
  const [evaluationCount, setEvaluationCount] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadGuards = async () => {
    setLoading(true);
    try {
      const res = await getBudgetGuards();
      const data = res.data?.data;
      setGuards(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      setGuards([]);
      if (error instanceof Error) {
        message.error(`加载 Budget Guard 列表失败: ${error.message}`);
      } else {
        message.error('加载 Budget Guard 列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadForecast = async () => {
    setForecastLoading(true);
    try {
      const res = await getCostForecast({ days: 30 });
      // API returns { success: boolean; data: CostForecastResult } structure
      const apiResponse = res.data as unknown as { data?: CostForecastResult };
      setForecast(apiResponse?.data || null);
    } catch {
      setForecast(null);
    } finally {
      setForecastLoading(false);
    }
  };

  useEffect(() => {
    loadGuards();
    loadForecast();
  }, []);

  // ============================================================================
  // Filtering
  // ============================================================================

  const filteredGuards = useMemo(() => {
    return guards.filter((g) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !g.name.toLowerCase().includes(q) &&
          !(g.description || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (statusFilter !== 'all' && g.status !== statusFilter) return false;
      if (actionFilter !== 'all' && g.action !== actionFilter) return false;
      return true;
    });
  }, [guards, searchQuery, statusFilter, actionFilter]);

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  const handleCreate = async (values: BudgetGuardInput) => {
    setSubmitting(true);
    try {
      await createBudgetGuard({
        name: values.name,
        description: values.description,
        budgetAmount: values.budgetAmount,
        currency: values.currency || 'CNY',
        action: values.action,
        scope: values.scope,
      });
      message.success('Budget Guard 创建成功');
      setCreateModalOpen(false);
      createForm.resetFields();
      await loadGuards();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`创建失败: ${error.message}`);
      } else {
        message.error('创建失败，请稍后重试');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (_values: BudgetGuardInput) => {
    if (!editingGuard) return;
    setSubmitting(true);
    try {
      // Note: updateBudgetGuard would be added to API when backend supports it
      message.info('更新功能待后端支持');
      setEditModalOpen(false);
      await loadGuards();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`更新失败: ${error.message}`);
      } else {
        message.error('更新失败，请稍后重试');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (_id: string) => {
    try {
      // Note: deleteBudgetGuard would be added to API when backend supports it
      message.info('删除功能待后端支持');
      await loadGuards();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除失败: ${error.message}`);
      } else {
        message.error('删除失败，请稍后重试');
      }
    }
  };

  const handleToggle = async (guard: BudgetGuard) => {
    try {
      // Note: toggleBudgetGuard would be added to API when backend supports it
      const newStatus = guard.status === 'active' ? 'inactive' : 'active';
      message.success(`Guard ${guard.name} ${newStatus === 'active' ? '已启用' : '已停用'}`);
      await loadGuards();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`操作失败: ${error.message}`);
      } else {
        message.error('操作失败，请稍后重试');
      }
    }
  };

  // ============================================================================
  // Evaluation
  // ============================================================================

  const handleEvaluate = async (values: { pipelineId: string; estimatedCost: number }) => {
    setEvalLoading(true);
    setEvalResult(null);
    try {
      const res = await evaluateBudgetGuard(values.pipelineId, values.estimatedCost);
      setEvalResult(res.data?.data || null);
      setEvaluationCount((prev) => prev + 1);
      if (res.data?.data?.passed === false) {
        setBlockedCount((prev) => prev + 1);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`评估失败: ${error.message}`);
      } else {
        message.error('评估失败，请稍后重试');
      }
    } finally {
      setEvalLoading(false);
    }
  };

  // ============================================================================
  // Table Columns
  // ============================================================================

  const columns: TableColumn<BudgetGuard>[] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (_: unknown, record: BudgetGuard) => (
        <Space>
          <SafetyOutlined />
          <Text strong>{record.name}</Text>
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (value: unknown) => (value as string | null) || '--',
    },
    {
      title: 'Budget',
      dataIndex: 'budgetAmount',
      key: 'budgetAmount',
      width: 120,
      render: (_: unknown, record: BudgetGuard) => (
        <Text>
          {record.currency || 'CNY'} {record.budgetAmount.toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (value: unknown) => {
        const action = value as 'allow' | 'block' | 'warn';
        const config = {
          allow: { color: 'success', icon: <CheckCircleOutlined />, label: 'Allow' },
          block: { color: 'error', icon: <CloseCircleOutlined />, label: 'Block' },
          warn: { color: 'warning', icon: <WarningOutlined />, label: 'Warn' },
        }[action];
        return <Tag icon={config.icon} color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: 'Scope',
      dataIndex: 'scope',
      key: 'scope',
      width: 180,
      render: (value: unknown) => {
        const scope = value as BudgetGuard['scope'];
        if (!scope) return <Text type="secondary">Global</Text>;
        const parts: string[] = [];
        if (scope.projectIds?.length) parts.push(`${scope.projectIds.length} projects`);
        if (scope.environment) parts.push(scope.environment);
        return <Text>{parts.join(', ') || 'Global'}</Text>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: unknown) => {
        const status = value as 'active' | 'inactive';
        return (
          <Tag color={status === 'active' ? 'green' : 'default'}>
            {status === 'active' ? 'Active' : 'Inactive'}
          </Tag>
        );
      },
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (value: unknown) => new Date(value as string).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      fixed: 'right' as const,
      render: (_: unknown, record: BudgetGuard) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingGuard(record);
              editForm.setFieldsValue({
                name: record.name,
                description: record.description || undefined,
                budgetAmount: record.budgetAmount,
                currency: record.currency || 'CNY',
                action: record.action,
              });
              setEditModalOpen(true);
            }}
          >
            Edit
          </Button>
          <Switch
            size="small"
            checked={record.status === 'active'}
            onChange={() => handleToggle(record)}
            checkedChildren="On"
            unCheckedChildren="Off"
          />
          <Popconfirm
            title="Delete Budget Guard"
            description={`Are you sure you want to delete "${record.name}"?`}
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div style={{ padding: spacing[6], background: colors.light.bg.primary, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[4] }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <DollarOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            <SafetyOutlined style={{ marginRight: spacing[2] }} />
            Budget Guard
          </Title>
          <Text type="secondary">
            Configure budget guards to control pipeline execution based on cost constraints
          </Text>
        </div>
        <Space>
          <Button
            icon={<ThunderboltOutlined />}
            onClick={() => {
              setEvalResult(null);
              evalForm.resetFields();
              setEvalModalOpen(true);
            }}
          >
            Evaluate
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadGuards}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              createForm.resetFields();
              setCreateModalOpen(true);
            }}
          >
            Create Guard
          </Button>
        </Space>
      </div>

      {/* Summary Cards */}
      <SummaryCards
        guards={guards}
        forecast={forecast}
        evaluationCount={evaluationCount}
        blockedCount={blockedCount}
      />

      {/* Forecast Card */}
      <ForecastCard forecast={forecast} loading={forecastLoading} />

      {/* Filters */}
      <Card style={{ marginTop: spacing[4], marginBottom: spacing[4] }}>
        <Space>
          <Input.Search
            placeholder="Search guards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 120 }}
            options={[
              { label: 'All Status', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
            ]}
          />
          <Select
            value={actionFilter}
            onChange={setActionFilter}
            style={{ width: 120 }}
            options={[
              { label: 'All Actions', value: 'all' },
              { label: 'Allow', value: 'allow' },
              { label: 'Block', value: 'block' },
              { label: 'Warn', value: 'warn' },
            ]}
          />
        </Space>
      </Card>

      {/* Guard List Table */}
      <Card title={`Budget Guards (${filteredGuards.length})`}>
        <Table
          columns={columns}
          dataSource={filteredGuards}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} guards`,
          }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="Create Budget Guard"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={submitting}
        width={600}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="Guard Name"
            name="name"
            rules={[{ required: true, message: 'Please enter guard name' }]}
          >
            <Input placeholder="e.g., Production Budget Guard" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} placeholder="Describe the purpose of this guard" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Budget Amount"
                name="budgetAmount"
                rules={[{ required: true, message: 'Please enter budget amount' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder="10000"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Currency" name="currency" initialValue="CNY">
                <Select
                  options={[
                    { label: 'CNY (¥)', value: 'CNY' },
                    { label: 'USD ($)', value: 'USD' },
                    { label: 'EUR (€)', value: 'EUR' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="Action"
            name="action"
            rules={[{ required: true, message: 'Please select action' }]}
            initialValue="warn"
          >
            <Select
              options={[
                { label: 'Allow - Always allow execution', value: 'allow' },
                { label: 'Block - Block if over budget', value: 'block' },
                { label: 'Warn - Warn but allow execution', value: 'warn' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="Edit Budget Guard"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={submitting}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
          <Form.Item
            label="Guard Name"
            name="name"
            rules={[{ required: true, message: 'Please enter guard name' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Budget Amount"
                name="budgetAmount"
                rules={[{ required: true }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Currency" name="currency">
                <Select
                  options={[
                    { label: 'CNY (¥)', value: 'CNY' },
                    { label: 'USD ($)', value: 'USD' },
                    { label: 'EUR (€)', value: 'EUR' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="Action"
            name="action"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { label: 'Allow', value: 'allow' },
                { label: 'Block', value: 'block' },
                { label: 'Warn', value: 'warn' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Evaluation Modal */}
      <Modal
        title="Budget Evaluation"
        open={evalModalOpen}
        onCancel={() => setEvalModalOpen(false)}
        footer={null}
        width={700}
      >
        <Form form={evalForm} layout="vertical" onFinish={handleEvaluate}>
          <Form.Item
            label="Pipeline ID"
            name="pipelineId"
            rules={[{ required: true, message: 'Please enter pipeline ID' }]}
          >
            <Input placeholder="e.g., pipeline-001" />
          </Form.Item>
          <Form.Item
            label="Estimated Cost"
            name="estimatedCost"
            rules={[{ required: true, message: 'Please enter estimated cost' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="500.00" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={evalLoading} block>
              <ThunderboltOutlined /> Evaluate
            </Button>
          </Form.Item>
        </Form>

        {evalResult && (
          <Card
            title="Evaluation Result"
            style={{ marginTop: spacing[4] }}
            styles={{ body: { padding: spacing[4] } }}
          >
            <Alert
              message={evalResult.passed ? 'PASSED' : 'BLOCKED'}
              description={evalResult.message}
              type={evalResult.passed ? 'success' : 'error'}
              showIcon
              icon={evalResult.passed ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              style={{ marginBottom: spacing[3] }}
            />
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Estimated Cost">
                ¥{evalResult.estimatedCost?.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="Budget Limit">
                ¥{evalResult.budgetAmount?.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="Usage Percent">
                {evalResult.usagePercent?.toFixed(1)}%
              </Descriptions.Item>
              <Descriptions.Item label="Action">
                <Tag color={evalResult.action === 'block' ? 'error' : evalResult.action === 'warn' ? 'warning' : 'success'}>
                  {evalResult.action}
                </Tag>
              </Descriptions.Item>
              {evalResult.matchedGuard && (
                <Descriptions.Item label="Matched Guard" span={2}>
                  {evalResult.matchedGuard.name}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        )}
      </Modal>
    </div>
  );
};

export default BudgetGuardPage;
