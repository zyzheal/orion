/**
 * Cost Allocation Page (P2-9 Phase 72 - slim)
 *
 * 模块拆分：
 * - ./constants               常量 (scopeTypeLabel/Color, formatCost)
 * - ./useCostAllocationState  状态 + 数据加载 + CRUD handler
 * - ./CostAllocationColumns   3 个表格列配置 hook
 * - ./BudgetModal             预算创建/编辑弹窗
 */
import {
  Tag,
  Typography,
  Card,
  Table,
  Space,
  Button,
  Select,
  Row,
  Col,
  Statistic,
  Progress,
  Empty,
} from 'antd';
import {
  DollarOutlined,
  ReloadOutlined,
  PlusOutlined,
  WarningOutlined,
  BarChartOutlined,
  ClusterOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius } from '@/tokens';
import { formatCost } from './constants';
import { useCostAllocationState } from './useCostAllocationState';
import { useNamespaceColumns, useTrendColumns, useBudgetColumns } from './CostAllocationColumns';
import { BudgetModal } from './BudgetModal';

const { Title, Text } = Typography;

const summaryCardStyle: React.CSSProperties = {
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
};

export default function CostAllocationPage() {
  const {
    summary,
    trend,
    topNamespaces,
    budgets,
    loading,
    selectedMonth,
    setSelectedMonth,
    budgetModalVisible,
    setBudgetModalVisible,
    budgetConfirmLoading,
    editingBudget,
    setEditingBudget,
    form,
    fetchAll,
    monthOptions,
    handleCreateBudget,
    handleEditBudget,
    handleSaveBudget,
    handleDeleteBudget,
    activeAlerts,
  } = useCostAllocationState();

  const namespaceColumns = useNamespaceColumns();
  const trendColumns = useTrendColumns(trend);
  const budgetColumns = useBudgetColumns({ handleEditBudget, handleDeleteBudget });

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: 16 }}>
        <DollarOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        成本分配
      </Title>

      {/* --- Month Selector + Refresh --- */}
      <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
        <Col>
          <Space>
            <Text>选择月份：</Text>
            <Select
              value={selectedMonth}
              onChange={setSelectedMonth}
              options={monthOptions}
              style={{ width: 140 }}
            />
          </Space>
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading}>
            刷新
          </Button>
        </Col>
      </Row>

      {/* --- Cost Summary Cards --- */}
      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={summaryCardStyle}>
            <Statistic
              title={<Text style={{ color: colors.neutral[500] }}>本月总费用</Text>}
              value={summary?.totalCost ?? 0}
              precision={2}
              prefix={<DollarOutlined style={{ color: colors.primary[500] }} />}
              suffix="CNY"
              valueStyle={{ color: colors.neutral[900], fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={summaryCardStyle}>
            <Statistic
              title={<Text style={{ color: colors.neutral[500] }}>计算费用</Text>}
              value={summary?.computeCost ?? 0}
              precision={2}
              prefix="&#x2699;"
              suffix="CNY"
              valueStyle={{ color: colors.primary[500], fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={summaryCardStyle}>
            <Statistic
              title={<Text style={{ color: colors.neutral[500] }}>存储费用</Text>}
              value={summary?.storageCost ?? 0}
              precision={2}
              prefix="&#x1f4c1;"
              suffix="CNY"
              valueStyle={{ color: colors.warning[500], fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={summaryCardStyle}>
            <Statistic
              title={<Text style={{ color: colors.neutral[500] }}>网络费用</Text>}
              value={summary?.networkCost ?? 0}
              precision={2}
              prefix="&#x1f310;"
              suffix="CNY"
              valueStyle={{ color: colors.success[500], fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* --- Budget Alerts --- */}
      {activeAlerts.length > 0 && (
        <Card
          title={
            <Space>
              <WarningOutlined style={{ color: colors.warning[500] }} />
              <Text strong>预算告警</Text>
            </Space>
          }
          style={{
            borderRadius: 12,
            marginBottom: spacing.lg,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
            borderLeft: `3px solid ${colors.warning[500]}`,
          }}
        >
          <Row gutter={[16, 16]}>
            {activeAlerts.map((alert) => {
              const pct = Math.min(Math.round((alert.currentSpend / alert.limit) * 100), 100);
              const isOver = alert.exceeded || pct >= 100;
              return (
                <Col xs={24} sm={12} lg={8} key={alert.budgetId}>
                  <Card
                    size="small"
                    style={{
                      borderRadius: componentRadius.card,
                      background: isOver ? colors.error[50] : colors.warning[50],
                    }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Row justify="space-between">
                        <Text strong>{alert.budgetName}</Text>
                        <Tag color={isOver ? 'red' : 'orange'}>
                          {isOver ? '已超限' : '接近限额'}
                        </Tag>
                      </Row>
                      <Progress
                        percent={pct}
                        status={isOver ? 'exception' : 'active'}
                        strokeColor={isOver ? colors.error[500] : colors.warning[500]}
                        format={() =>
                          `${formatCost(alert.currentSpend)} / ${formatCost(alert.limit)}`
                        }
                      />
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Card>
      )}

      {/* --- Top Namespaces + Cost Trend --- */}
      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <ClusterOutlined style={{ color: colors.primary[500] }} />
                <Text strong>Top 10 高费用命名空间</Text>
              </Space>
            }
            style={summaryCardStyle}
          >
            {topNamespaces.length === 0 ? (
              <Empty description="暂无数据" />
            ) : (
              <Table
                columns={namespaceColumns}
                dataSource={topNamespaces}
                rowKey="namespace"
                size="small"
                pagination={false}
                loading={loading}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <BarChartOutlined style={{ color: colors.primary[500] }} />
                <Text strong>费用趋势（近 6 个月）</Text>
              </Space>
            }
            style={summaryCardStyle}
          >
            {trend.length === 0 ? (
              <Empty description="暂无数据" />
            ) : (
              <Table
                columns={trendColumns}
                dataSource={[...trend].reverse()}
                rowKey="month"
                size="small"
                pagination={false}
                loading={loading}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* --- Budget Management --- */}
      <Card
        title={
          <Space>
            <DollarOutlined style={{ color: colors.primary[500] }} />
            <Text strong>预算管理</Text>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateBudget}>
            创建预算
          </Button>
        }
        style={summaryCardStyle}
      >
        {budgets.length === 0 ? (
          <Empty description="暂无预算">
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateBudget}>
              创建第一个预算
            </Button>
          </Empty>
        ) : (
          <Table
            columns={budgetColumns}
            dataSource={budgets}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>

      <BudgetModal
        open={budgetModalVisible}
        form={form}
        editingBudget={editingBudget}
        confirmLoading={budgetConfirmLoading}
        onCancel={() => {
          setBudgetModalVisible(false);
          setEditingBudget(null);
          form.resetFields();
        }}
        onOk={handleSaveBudget}
      />
    </div>
  );
}
