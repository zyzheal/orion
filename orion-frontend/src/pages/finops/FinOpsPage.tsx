/**
 * FinOps 成本管理主页面
 *
 * 包含四个 Tab: 成本总览 / 预算管理 / 成本预测 / 优化建议
 * - 使用 Design Token 体系
 * - 完整 CRUD 交互链
 * - 空状态引导 + loading 状态 + 操作反馈
 *
 * 拆分后的职责划分：
 * - config.ts          常量与标签映射
 * - columns.tsx        工厂函数形式的表格列定义
 * - FinOpsModals.tsx   所有弹窗
 * - OverviewTab.tsx    成本总览 Tab
 * - BudgetTab.tsx      预算管理 Tab（含预算弹窗接入）
 * - ForecastTab.tsx    成本预测 Tab
 * - RecommendationsTab.tsx 优化建议 Tab
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, Space, Tabs, Typography, message } from 'antd';
import {
  DollarOutlined,
  ExportOutlined,
  LineChartOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import {
  createBudget,
  deleteBudget,
  deleteRecommendation,
  exportCostReport,
  getBudgets,
  getCostBreakdown,
  getCostOverview,
  getForecasts,
  getRecommendations,
  updateBudget,
  updateRecommendationStatus,
} from '@/api/finops';
import type {
  Budget,
  BudgetForecast,
  BudgetInput,
  BudgetUpdateInput,
  CostBreakdownItem,
  CostSummaryResponse,
  OptimizationRecommendation,
} from '@/types/finops';
import { colors, componentRadius, spacing } from '@/tokens';
import { OverviewTab } from './OverviewTab';
import { BudgetTab } from './BudgetTab';
import { ForecastTab } from './ForecastTab';
import { RecommendationsTab } from './RecommendationsTab';

const { Title, Text } = Typography;

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
    } catch (error: unknown) {
      message.error(`加载成本概览失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  }, []);

  const loadCostBreakdown = useCallback(async () => {
    try {
      const data = await getCostBreakdown({ dimension: 'category' });
      setCostBreakdown(data);
    } catch {
      // Non-critical, don't show error for breakdown
    }
  }, []);

  const loadBudgets = useCallback(async () => {
    try {
      const data = await getBudgets();
      setBudgets(data);
    } catch (error: unknown) {
      message.error(`加载预算列表失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  }, []);

  const loadRecommendations = useCallback(async () => {
    setRecommendationsLoading(true);
    try {
      const data = await getRecommendations();
      setRecommendations(data);
    } catch (error: unknown) {
      message.error(`加载优化建议失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setRecommendationsLoading(false);
    }
  }, []);

  const loadForecasts = useCallback(async () => {
    setForecastLoading(true);
    try {
      const data = await getForecasts();
      setForecasts(data);
    } catch (error: unknown) {
      message.error(`加载成本预测失败：${error instanceof Error ? error.message : '未知错误'}`);
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

  const handleBudgetCancel = () => {
    setBudgetModalOpen(false);
    budgetForm.resetFields();
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
    } catch (error: unknown) {
      if (!(error && typeof error === 'object' && 'errorFields' in error)) {
        message.error(`保存预算失败：${error instanceof Error ? error.message : '未知错误'}`);
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
    } catch (error: unknown) {
      message.error(`删除预算失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleExportReport = async () => {
    try {
      await exportCostReport({});
      message.success('报表导出成功');
    } catch (error: unknown) {
      message.error(`导出报表失败：${error instanceof Error ? error.message : '未知错误'}`);
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
    } catch (error: unknown) {
      message.error(`操作失败：${error instanceof Error ? error.message : '未知错误'}`);
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
    } catch (error: unknown) {
      message.error(`操作失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setUpdatingRecommendation(null);
    }
  };

  const handleDeleteRecommendation = async (id: string) => {
    try {
      await deleteRecommendation(id);
      message.success('优化建议已删除');
      loadRecommendations();
    } catch (error: unknown) {
      message.error(`删除失败：${error instanceof Error ? error.message : '未知错误'}`);
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
      children: (
        <OverviewTab
          costSummary={costSummary}
          costBreakdown={costBreakdown}
          onExportReport={handleExportReport}
        />
      ),
    },
    {
      key: 'budget',
      label: (
        <Space>
          <WalletOutlined />
          预算管理
        </Space>
      ),
      children: (
        <BudgetTab
          budgets={budgets}
          loading={loading}
          budgetModalOpen={budgetModalOpen}
          editing={editingBudget !== null}
          budgetSubmitting={budgetSubmitting}
          form={budgetForm}
          onOpenModal={handleOpenBudgetModal}
          onSubmit={handleBudgetSubmit}
          onCancel={handleBudgetCancel}
          onDelete={handleDeleteBudget}
        />
      ),
    },
    {
      key: 'forecast',
      label: (
        <Space>
          <LineChartOutlined />
          成本预测
        </Space>
      ),
      children: <ForecastTab forecasts={forecasts} loading={forecastLoading} onRefresh={loadForecasts} />,
    },
    {
      key: 'recommendations',
      label: (
        <Space>
          <ThunderboltOutlined />
          优化建议
        </Space>
      ),
      children: (
        <RecommendationsTab
          recommendations={recommendations}
          loading={recommendationsLoading}
          updatingRecommendation={updatingRecommendation}
          onApprove={handleApproveRecommendation}
          onReject={handleRejectRecommendation}
          onDelete={handleDeleteRecommendation}
          onRefresh={loadRecommendations}
        />
      ),
    },
  ];

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div style={{ padding: 0 }} >
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <DollarOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            FinOps 成本管理
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            云资源成本追踪、预算管理、优化建议与预测分析
          </Text>
        </div>
        <Space>
          <Button icon=<ExportOutlined /> onClick={handleExportReport}>
            导出报表
          </Button>
          <Button
            icon=<ReloadOutlined />
            onClick={() => {
              loadCostOverview();
              loadCostBreakdown();
            }}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* Main Tabs */}
      <Card bordered={false} style={{ borderRadius: componentRadius.card }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />
      </Card>
    </div>
  );
};

export default FinOpsPage;
