/**
 * FinOps Dashboard Page
 *
 * A comprehensive cost management dashboard with:
 * - Summary cards (monthly cost, budget usage, waste, savings)
 * - Cost trend chart (placeholder)
 * - Cost by service table
 * - Budget alerts
 * - Optimization recommendations
 * - Quick actions
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Col,
  Row,
  Tag,
  Typography,
  Button,
  Space,
  Progress,
  Statistic,
  Alert,
  message,
  Tooltip,
} from 'antd';
import {
  DollarOutlined,
  WalletOutlined,
  FireOutlined,
  CheckCircleOutlined,
  ExportOutlined,
  SettingOutlined,
  FileSearchOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import TableComponent, { type TableColumn } from '@/components/Table';
import { TrendLineChart, PieChart } from '@/components/charts';
import {
  getCostSummary,
  getCostByService,
  getCostTrend,
  getOptimizations,
  getBudgetAlerts,
  applyOptimization as apiApplyOptimization,
  exportCostReport as apiExportCostReport,
  type CostSummary,
  type CostByServiceItem,
  type CostTrendItem,
  type OptimizationItem,
  type BudgetAlertItem,
} from '@/api/finops';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// Effort level config
const effortConfig: Record<string, { color: string; label: string }> = {
  low: { color: 'green', label: '低投入' },
  medium: { color: 'orange', label: '中投入' },
  high: { color: 'red', label: '高投入' },
};

// Status config for optimizations
const optimizationStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待处理' },
  applied: { color: 'success', label: '已应用' },
  rejected: { color: 'error', label: '已拒绝' },
};

// Budget alert status config
const alertStatusConfig: Record<string, { color: string; label: string }> = {
  exceeded: { color: 'red', label: '已超支' },
  warning: { color: 'orange', label: '接近上限' },
  normal: { color: 'green', label: '正常' },
};

const FinOpsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [optimizations, setOptimizations] = useState<OptimizationItem[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [costByService, setCostByService] = useState<CostByServiceItem[]>([]);
  const [costTrend, setCostTrend] = useState<CostTrendItem[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlertItem[]>([]);

  // Load data from API
  const loadData = async () => {
    setLoading(true);
    try {
      const [costSummaryRes, costByServiceRes, costTrendRes, optimizationsRes, budgetAlertsRes] =
        await Promise.all([
          getCostSummary(),
          getCostByService(),
          getCostTrend(),
          getOptimizations(),
          getBudgetAlerts(),
        ]);

      setCostSummary(costSummaryRes);
      setCostByService(Array.isArray(costByServiceRes) ? costByServiceRes : []);
      setCostTrend(Array.isArray(costTrendRes) ? costTrendRes : []);
      setOptimizations(Array.isArray(optimizationsRes) ? optimizationsRes : []);
      setBudgetAlerts(Array.isArray(budgetAlertsRes) ? budgetAlertsRes : []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载成本数据失败：${error.message}`);
      } else {
        message.error('加载成本数据失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Calculate budget usage percentage
  const budgetUsagePercent = costSummary
    ? Math.round((costSummary.totalMonthly / costSummary.budgetLimit) * 100)
    : 0;

  // Calculate month-over-month change
  const momChange = costSummary
    ? (
        ((costSummary.totalMonthly - costSummary.previousMonth) / costSummary.previousMonth) *
        100
      ).toFixed(1)
    : '0.0';

  // Handle apply optimization
  const handleApplyOptimization = async (key: string) => {
    try {
      await apiApplyOptimization(key);
      setOptimizations((prev) =>
        prev.map((opt) => (opt.key === key ? { ...opt, status: 'applied' as const } : opt))
      );
      message.success('优化建议已应用');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`应用优化建议失败：${error.message}`);
      } else {
        message.error('应用优化建议失败');
      }
    }
  };

  // Handle export report
  const handleExportReport = async () => {
    try {
      await apiExportCostReport({});
      message.success('报表导出中，请稍后在通知中心查看');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`导出报表失败：${error.message}`);
      } else {
        message.error('导出报表失败');
      }
    }
  };

  // Cost by service columns
  const costByServiceColumns: TableColumn<CostByServiceItem>[] = [
    {
      key: 'service',
      title: '服务名称',
      dataIndex: 'service',
      render: (value: unknown) => <Text strong>{value as string}</Text>,
    },
    {
      key: 'cost',
      title: '月费用 (¥)',
      dataIndex: 'cost',
      sorter: (a: CostByServiceItem, b: CostByServiceItem) => a.cost - b.cost,
      render: (value: unknown) => (
        <Text strong style={{ color: colors.primary[500] }}>
          ¥{(value as number).toLocaleString()}
        </Text>
      ),
    },
    {
      key: 'percent',
      title: '占比',
      dataIndex: 'percent',
      render: (value: unknown) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Progress
            percent={value as number}
            size="small"
            strokeColor={colors.primary[500]}
            showInfo={false}
            style={{ flex: 1 }}
          />
          <Text type="secondary" style={{ fontSize: spacing[3], minWidth: 40 }}>
            {value as number}%
          </Text>
        </div>
      ),
    },
    {
      key: 'trend',
      title: '趋势',
      dataIndex: 'trend',
      width: 80,
      render: (value: unknown) => {
        const v = value as 'up' | 'down' | 'stable';
        const config: Record<string, { icon: React.ReactNode; color: string }> = {
          up: { icon: <ArrowUpOutlined />, color: colors.error[400] },
          down: { icon: <ArrowDownOutlined />, color: colors.success[500] },
          stable: { icon: <MinusOutlined />, color: colors.neutral[400] },
        };
        const c = config[v];
        return (
          <Tooltip title={v === 'up' ? '上升' : v === 'down' ? '下降' : '持平'}>
            <Text style={{ color: c.color, fontSize: spacing[4] }}>{c.icon}</Text>
          </Tooltip>
        );
      },
    },
  ];

  // Data timestamp
  const dataTimestamp = dayjs().format('YYYY-MM-DD HH:mm');

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
          <Title level={3} style={{ margin: 0 }}>
            <DollarOutlined style={{ marginRight: 8 }} />
            成本分析
          </Title>
          <Text type="secondary">数据更新时间：{dataTimestamp}</Text>
        </div>
      </div>

      {/* Summary Cards Row */}
      {loading || !costSummary ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>Loading...</div>
      ) : (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {/* Monthly Cost */}
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} style={{ borderRadius: 8 }}>
              <Statistic
                title="本月花费"
                value={costSummary.totalMonthly}
                prefix={<DollarOutlined style={{ color: colors.primary[500] }} />}
                suffix="¥"
                precision={0}
                valueStyle={{ color: colors.primary[500], fontSize: spacing[8] }}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: spacing[3] }}>
                  较上月{' '}
                  <Text
                    style={{
                      color: parseFloat(momChange) > 0 ? colors.error[400] : colors.success[500],
                      fontWeight: 600,
                    }}
                  >
                    {parseFloat(momChange) > 0 ? '+' : ''}
                    {momChange}%{' '}
                    {parseFloat(momChange) > 0 ? (
                      <ArrowUpOutlined style={{ fontSize: spacing[2] }} />
                    ) : (
                      <ArrowDownOutlined style={{ fontSize: spacing[2] }} />
                    )}
                  </Text>
                </Text>
              </div>
            </Card>
          </Col>

          {/* Budget Usage */}
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} style={{ borderRadius: 8 }}>
              <Statistic
                title="预算使用"
                value={budgetUsagePercent}
                prefix={<WalletOutlined />}
                suffix="%"
                precision={0}
                valueStyle={{
                  color:
                    budgetUsagePercent > 90
                      ? colors.error[400]
                      : budgetUsagePercent > 70
                        ? colors.warning[500]
                        : colors.success[500],
                  fontSize: spacing[8],
                }}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: spacing[3] }}>
                  预算上限 ¥{costSummary.budgetLimit.toLocaleString()}
                </Text>
                <Progress
                  percent={budgetUsagePercent}
                  size="small"
                  strokeColor={
                    budgetUsagePercent > 90
                      ? colors.error[400]
                      : budgetUsagePercent > 70
                        ? colors.warning[500]
                        : colors.success[500]
                  }
                  style={{ marginTop: 4 }}
                />
              </div>
            </Card>
          </Col>

          {/* Estimated Waste */}
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} style={{ borderRadius: 8 }}>
              <Statistic
                title="预计浪费"
                value={costSummary.waste}
                prefix={<FireOutlined style={{ color: colors.error[400] }} />}
                suffix="¥"
                precision={0}
                valueStyle={{ color: colors.error[400], fontSize: spacing[8] }}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: spacing[3] }}>
                  闲置资源和过度配置
                </Text>
              </div>
            </Card>
          </Col>

          {/* Savings */}
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} style={{ borderRadius: 8 }}>
              <Statistic
                title="节省金额"
                value={costSummary.savings}
                prefix={<CheckCircleOutlined style={{ color: colors.success[500] }} />}
                suffix="¥"
                precision={0}
                valueStyle={{ color: colors.success[500], fontSize: spacing[8] }}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: spacing[3] }}>
                  已通过优化措施节省
                </Text>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* Main Content: Two Column Layout */}
      <Row gutter={[16, 16]}>
        {/* Left Column (wide) */}
        <Col xs={24} lg={16}>
          {/* Cost Trend Chart */}
          <Card
            title={
              <Space>
                <ThunderboltOutlined />
                成本趋势（近12个月）
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 8, marginBottom: 16 }}
            loading={loading}
          >
            {costTrend.length > 0 ? (
              <TrendLineChart
                title="成本趋势（近12个月）"
                data={[
                  costTrend.map((d) => ({ period: d.month, value: d.cost, label: '实际成本' })),
                ]}
                height={280}
                showArea={true}
                smooth={true}
              />
            ) : (
              <div
                style={{
                  height: 280,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: colors.neutral[50],
                  borderRadius: 6,
                  border: `1px dashed ${colors.neutral[300]}`,
                }}
              >
                <Text type="secondary" style={{ fontSize: spacing[4] }}>
                  暂无趋势数据
                </Text>
              </div>
            )}
          </Card>

          {/* Cost by Service Table */}
          <Card
            title="各服务成本明细"
            bordered={false}
            style={{ borderRadius: 8, marginBottom: 16 }}
            loading={loading}
          >
            <TableComponent
              columns={costByServiceColumns}
              dataSource={costByService}
              rowKey="key"
              size="middle"
              pagination={false}
            />
          </Card>

          {/* Budget Alerts */}
          <Card title="预算告警" bordered={false} style={{ borderRadius: 8 }} loading={loading}>
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {budgetAlerts.map((alert) => (
                <Alert
                  key={alert.key}
                  message={
                    <Space>
                      <Text strong>{alert.service}</Text>
                      <Tag color={alertStatusConfig[alert.status].color}>
                        {alertStatusConfig[alert.status].label}
                      </Tag>
                    </Space>
                  }
                  description={
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: spacing[3] }}>
                        当前使用 {alert.current}% / 预算阈值 {alert.threshold}%
                      </Text>
                      <Progress
                        percent={alert.current}
                        size="small"
                        strokeColor={
                          alert.status === 'exceeded' ? colors.error[400] : colors.warning[500]
                        }
                        style={{ marginTop: 8 }}
                      />
                    </div>
                  }
                  type={alert.status === 'exceeded' ? 'error' : 'warning'}
                  showIcon
                />
              ))}
            </Space>
          </Card>
        </Col>

        {/* Right Column (narrow) */}
        <Col xs={24} lg={8}>
          {/* Budget Allocation PieChart */}
          <Card
            title="预算分配"
            bordered={false}
            style={{ borderRadius: 8, marginBottom: 16 }}
            loading={loading}
          >
            {costByService.length > 0 ? (
              <PieChart
                title="预算分配"
                data={costByService.map((c) => ({ name: c.service, value: c.cost }))}
                variant="donut"
                centerLabel={true}
                height={200}
              />
            ) : (
              <div
                style={{
                  height: 200,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: colors.neutral[50],
                  borderRadius: 6,
                }}
              >
                <Text type="secondary" style={{ fontSize: spacing[3] }}>
                  暂无预算分配数据
                </Text>
              </div>
            )}
          </Card>

          {/* Optimization Recommendations */}
          <Card
            title="优化建议"
            bordered={false}
            style={{ borderRadius: 8, marginBottom: 16 }}
            loading={loading}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {optimizations.map((opt) => (
                <Card
                  key={opt.key}
                  size="small"
                  style={{ borderRadius: 6 }}
                  extra={
                    opt.status === 'pending' ? (
                      <Button
                        type="primary"
                        size="small"
                        onClick={() => handleApplyOptimization(opt.key)}
                      >
                        应用
                      </Button>
                    ) : (
                      <Tag color={optimizationStatusConfig[opt.status].color}>
                        {optimizationStatusConfig[opt.status].label}
                      </Tag>
                    )
                  }
                >
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text strong>{opt.title}</Text>
                      <Tag color={effortConfig[opt.effort].color}>
                        {effortConfig[opt.effort].label}
                      </Tag>
                    </div>
                    <Text type="secondary" style={{ fontSize: spacing[3] }}>
                      {opt.description}
                    </Text>
                    <Text strong style={{ color: colors.success[500], fontSize: spacing[4] }}>
                      预计节省 ¥{opt.savings.toLocaleString()}/月
                    </Text>
                  </Space>
                </Card>
              ))}
            </Space>
          </Card>

          {/* Quick Actions */}
          <Card title="快捷操作" bordered={false} style={{ borderRadius: 8 }} loading={loading}>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Button
                icon={<ExportOutlined />}
                block
                onClick={handleExportReport}
                style={{ textAlign: 'left' }}
              >
                导出报表
              </Button>
              <Button icon={<SettingOutlined />} block style={{ textAlign: 'left' }}>
                设置预算
              </Button>
              <Button icon={<FileSearchOutlined />} block style={{ textAlign: 'left' }}>
                查看明细
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default FinOpsDashboard;
