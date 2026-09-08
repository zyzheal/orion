/**
 * Cost Allocation Page (P2-9 Phase 220 - slim)
 *
 * 模块拆分：
 * - ./constants                 常量 (scopeTypeLabel/Color, formatCost)
 * - ./useCostAllocationState    状态 + 数据加载 + CRUD handler
 * - ./CostAllocationColumns     3 个表格列配置 hook
 * - ./BudgetModal               预算创建/编辑弹窗
 * - ./Components/Toolbar        月份选择 + 刷新
 * - ./Components/SummaryCards   4 Statistic 汇总卡片
 * - ./Components/BudgetAlerts   预算告警卡片
 * - ./Components/TopNamespaces  Top 10 命名空间表
 * - ./Components/TrendTable     费用趋势表
 * - ./Components/BudgetManagement 预算管理表
 */
import { Row, Typography } from 'antd';
import { DollarOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useCostAllocationState } from './useCostAllocationState';
import { useNamespaceColumns, useTrendColumns, useBudgetColumns } from './CostAllocationColumns';
import { BudgetModal } from './BudgetModal';
import { Toolbar } from './Components/Toolbar';
import { SummaryCards } from './Components/SummaryCards';
import { BudgetAlerts } from './Components/BudgetAlerts';
import { TopNamespaces } from './Components/TopNamespaces';
import { TrendTable } from './Components/TrendTable';
import { BudgetManagement } from './Components/BudgetManagement';

const { Title } = Typography;

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

      <Toolbar
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        monthOptions={monthOptions}
        onRefresh={fetchAll}
        loading={loading}
      />

      <SummaryCards summary={summary} />

      <BudgetAlerts alerts={activeAlerts} />

      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <TopNamespaces
          topNamespaces={topNamespaces}
          columns={namespaceColumns}
          loading={loading}
        />
        <TrendTable trend={trend} columns={trendColumns} loading={loading} />
      </Row>

      <BudgetManagement
        budgets={budgets}
        columns={budgetColumns}
        loading={loading}
        onCreate={handleCreateBudget}
      />

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
