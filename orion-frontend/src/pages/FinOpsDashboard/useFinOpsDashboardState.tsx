/**
 * useFinOpsDashboardState - FinOpsDashboard 状态 hook
 * 抽取自 index.tsx (P2-9 Phase 125)
 */
import { useState, useEffect } from 'react';
import { message } from 'antd';
import dayjs from 'dayjs';
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

export const useFinOpsDashboardState = () => {
  const [loading, setLoading] = useState(true);
  const [optimizations, setOptimizations] = useState<OptimizationItem[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [costByService, setCostByService] = useState<CostByServiceItem[]>([]);
  const [costTrend, setCostTrend] = useState<CostTrendItem[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlertItem[]>([]);

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

  const budgetUsagePercent =
    costSummary && costSummary.budgetLimit > 0
      ? Math.round((costSummary.totalMonthly / costSummary.budgetLimit) * 100)
      : 0;

  const monthOverMonthChange =
    costSummary && costSummary.previousMonth > 0
      ? Math.round(
          ((costSummary.totalMonthly - costSummary.previousMonth) / costSummary.previousMonth) * 100
        )
      : 0;

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

  const dataTimestamp = dayjs().format('YYYY-MM-DD HH:mm');

  return {
    loading,
    optimizations,
    costSummary,
    costByService,
    costTrend,
    budgetAlerts,
    budgetUsagePercent,
    monthOverMonthChange,
    dataTimestamp,
    loadData,
    handleApplyOptimization,
    handleExportReport,
  };
};

export type FinOpsDashboardState = ReturnType<typeof useFinOpsDashboardState>;
