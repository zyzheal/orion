/**
 * FinOps Cost Management API Service
 *
 * Aligned with backend /api/v1/finops/* routes (finops-v2-routes.ts)
 * Covers: cost overview, breakdown, budgets CRUD, forecasts, recommendations, reports, metrics
 */
import { api } from './client';
import type {
  CostSummaryResponse,
  CostBreakdownResponse,
  CostBreakdownItem,
  CostTrendResponse,
  CostTrendPoint,
  Budget,
  BudgetInput,
  BudgetUpdateInput,
  BudgetStatus,
  BudgetForecast,
  AlertTrigger,
  OptimizationRecommendation,
  RightSizingRecommendation,
  SavingsMetrics,
  ROISummary,
  FinOpsMetrics,
  ApiResponse,
} from '@/types/finops';

// ============================================================================
// Cost Overview
// ============================================================================

/**
 * 获取成本概览
 * GET /api/v1/finops/cost-overview
 */
export const getCostOverview = async (
  params?: { period?: string; tenantId?: string }
): Promise<CostSummaryResponse['summary']> => {
  const response = await api.get<ApiResponse<CostSummaryResponse>>('/api/v1/finops/cost-overview', { params });
  return response.data.data.summary;
};

/**
 * 获取成本分解
 * GET /api/v1/finops/cost-breakdown
 */
export const getCostBreakdown = async (
  params?: { dimension?: string; tenantId?: string }
): Promise<CostBreakdownItem[]> => {
  const response = await api.get<ApiResponse<CostBreakdownResponse>>('/api/v1/finops/cost-breakdown', { params });
  return response.data.data.breakdown;
};

/**
 * 获取成本趋势
 * GET /api/v1/finops/track/:entityType/:entityId/trend
 */
export const getCostTrend = async (
  entityType?: string,
  entityId?: string,
  params?: { period?: string; category?: string }
): Promise<{ points: CostTrendPoint[]; overallChangeRate: number; averageCost: number; maxCost: number; minCost: number }> => {
  const et = entityType || 'project';
  const eid = entityId || 'default';
  const response = await api.get<ApiResponse<CostTrendResponse>>(
    `/api/v1/finops/track/${et}/${eid}/trend`,
    { params }
  );
  return response.data.data.trend;
};

// ============================================================================
// Budget Management (Full CRUD)
// ============================================================================

/**
 * 获取预算列表
 * GET /api/v1/finops/budgets
 */
export const getBudgets = async (
  params?: { entityType?: string; entityId?: string }
): Promise<Budget[]> => {
  const response = await api.get<ApiResponse<{ budgets: Budget[] }>>('/api/v1/finops/budgets', { params });
  return response.data.data.budgets;
};

/**
 * 获取单个预算
 * GET /api/v1/finops/budgets/:id
 */
export const getBudget = async (id: string): Promise<Budget> => {
  const response = await api.get<ApiResponse<{ budget: Budget }>>(`/api/v1/finops/budgets/${id}`);
  return response.data.data.budget;
};

/**
 * 创建预算
 * POST /api/v1/finops/budgets
 */
export const createBudget = async (input: BudgetInput): Promise<Budget> => {
  const response = await api.post<ApiResponse<{ budget: Budget }>>('/api/v1/finops/budgets', input);
  return response.data.data.budget;
};

/**
 * 更新预算
 * PUT /api/v1/finops/budgets/:id
 */
export const updateBudget = async (id: string, input: BudgetUpdateInput): Promise<Budget> => {
  const response = await api.put<ApiResponse<{ budget: Budget }>>(`/api/v1/finops/budgets/${id}`, input);
  return response.data.data.budget;
};

/**
 * 删除预算
 * DELETE /api/v1/finops/budgets/:id
 */
export const deleteBudget = async (id: string): Promise<void> => {
  await api.delete(`/api/v1/finops/budgets/${id}`);
};

/**
 * 获取预算状态
 * GET /api/v1/finops/budgets/:id/status
 */
export const getBudgetStatus = async (id: string): Promise<BudgetStatus> => {
  const response = await api.get<ApiResponse<{ status: BudgetStatus }>>(`/api/v1/finops/budgets/${id}/status`);
  return response.data.data.status;
};

/**
 * 获取预算预测
 * GET /api/v1/finops/budgets/:id/forecast
 */
export const getBudgetForecast = async (id: string): Promise<BudgetForecast> => {
  const response = await api.get<ApiResponse<{ forecast: BudgetForecast }>>(`/api/v1/finops/budgets/${id}/forecast`);
  return response.data.data.forecast;
};

/**
 * 检查预算告警
 * POST /api/v1/finops/budgets/check-alerts
 */
export const checkBudgetAlerts = async (): Promise<{ triggered: AlertTrigger[]; count: number }> => {
  const response = await api.post<ApiResponse<{ triggered: AlertTrigger[]; count: number }>>('/api/v1/finops/budgets/check-alerts');
  return response.data.data;
};

/**
 * 获取告警触发记录
 * GET /api/v1/finops/budgets/alert-triggers
 */
export const getAlertTriggers = async (
  params?: { budgetId?: string; entityType?: string }
): Promise<AlertTrigger[]> => {
  const response = await api.get<ApiResponse<{ triggers: AlertTrigger[] }>>('/api/v1/finops/budgets/alert-triggers', { params });
  return response.data.data.triggers;
};

// ============================================================================
// Cost Forecasts
// ============================================================================

/**
 * 获取成本预测列表
 * GET /api/v1/finops/forecasts
 */
export const getForecasts = async (): Promise<BudgetForecast[]> => {
  const response = await api.get<ApiResponse<{ forecasts: BudgetForecast[]; count: number }>>('/api/v1/finops/forecasts');
  return response.data.data.forecasts;
};

// ============================================================================
// Optimization Recommendations
// ============================================================================

/**
 * 获取优化建议列表
 * GET /api/v1/finops/recommendations
 */
export const getRecommendations = async (
  params?: { category?: string; priority?: string; status?: string }
): Promise<OptimizationRecommendation[]> => {
  const response = await api.get<ApiResponse<{ optimizations: OptimizationRecommendation[] }>>(
    '/api/v1/finops/recommendations',
    { params }
  );
  return response.data.data.optimizations;
};

/**
 * 更新优化建议状态
 * PATCH /api/v1/finops/recommendations/:id/status
 */
export const updateRecommendationStatus = async (
  id: string,
  status: string
): Promise<OptimizationRecommendation> => {
  const response = await api.patch<ApiResponse<{ optimization: OptimizationRecommendation }>>(
    `/api/v1/finops/recommendations/${id}/status`,
    { status }
  );
  return response.data.data.optimization;
};

/**
 * 删除优化建议
 * DELETE /api/v1/finops/recommendations/:id
 */
export const deleteRecommendation = async (id: string): Promise<void> => {
  await api.delete(`/api/v1/finops/recommendations/${id}`);
};

/**
 * 获取资源调整大小建议
 * GET /api/v1/finops/recommendations/right-sizing
 */
export const getRightSizingRecommendations = async (
  params?: { tenantId?: string; environment?: string }
): Promise<RightSizingRecommendation[]> => {
  const response = await api.get<ApiResponse<{ recommendations: RightSizingRecommendation[] }>>(
    '/api/v1/finops/recommendations/right-sizing',
    { params }
  );
  return response.data.data.recommendations;
};

/**
 * 获取预估节省金额
 * GET /api/v1/finops/recommendations/savings
 */
export const getSavingsMetrics = async (): Promise<SavingsMetrics> => {
  const response = await api.get<ApiResponse<{ savings: SavingsMetrics }>>('/api/v1/finops/recommendations/savings');
  return response.data.data.savings;
};

// ============================================================================
// Reports
// ============================================================================

/**
 * 获取报告列表
 * GET /api/v1/finops/reports
 */
export const getReports = async (params?: { tenantId?: string }): Promise<any[]> => {
  const response = await api.get<ApiResponse<{ reports: any[] }>>('/api/v1/finops/reports', { params });
  return response.data.data.reports;
};

/**
 * 导出成本报表
 */
export const exportCostReport = async (params?: Record<string, any>): Promise<Blob> => {
  const response = await api.get('/api/v1/finops/chargeback', {
    params,
    responseType: 'blob',
  });
  return response.data as unknown as Blob;
};

// ============================================================================
// ROI
// ============================================================================

/**
 * 获取 ROI 汇总
 * GET /api/v1/finops/roi/summary
 */
export const getROISummary = async (): Promise<ROISummary> => {
  const response = await api.get<ApiResponse<{ summary: ROISummary }>>('/api/v1/finops/roi/summary');
  return response.data.data.summary;
};

// ============================================================================
// Metrics
// ============================================================================

/**
 * 获取 FinOps 指标
 * GET /api/v1/finops/metrics
 */
export const getFinOpsMetrics = async (): Promise<FinOpsMetrics> => {
  const response = await api.get<ApiResponse<FinOpsMetrics>>('/api/v1/finops/metrics');
  return response.data.data;
};

// ============================================================================
// Backward-compatible exports (for FinOpsDashboard legacy page)
// ============================================================================

/** @deprecated Use CostSummaryResponse['summary'] instead */
export type CostSummary = CostSummaryResponse['summary'] & {
  totalMonthly: number;
  budgetLimit: number;
  previousMonth: number;
  projectedMonthly: number;
  savings: number;
  waste: number;
};
/** @deprecated Use CostBreakdownItem instead */
export type CostByServiceItem = {
  key: string;
  service: string;
  cost: number;
  percent: number;
  trend: 'up' | 'down' | 'stable';
};
/** @deprecated Use CostTrendPoint instead */
export type CostTrendItem = { month: string; cost: number };
/** @deprecated Use OptimizationRecommendation instead */
export type OptimizationItem = {
  key: string;
  title: string;
  description: string;
  savings: number;
  effort: 'low' | 'medium' | 'high';
  status: 'pending' | 'applied' | 'rejected';
};
/** @deprecated Use AlertTrigger instead */
export type BudgetAlertItem = {
  key: string;
  service: string;
  threshold: number;
  current: number;
  status: 'exceeded' | 'warning' | 'normal';
};

// Backward-compatible API functions that wrap the new V2 functions

/**
 * @deprecated Use getCostOverview instead
 * Legacy wrapper for FinOpsDashboard backward compatibility
 */
export const getCostSummary = async (): Promise<CostSummary> => {
  const summary = await getCostOverview({ period: 'monthly' });
  // Map V2 summary fields to legacy names for backward compatibility
  return {
    ...summary,
    totalMonthly: summary.totalCost,
    budgetLimit: 0,
    previousMonth: 0,
    projectedMonthly: summary.totalCost,
    savings: 0,
    waste: 0,
  };
};

/**
 * @deprecated Use getCostBreakdown instead
 * Maps breakdown data to old CostByServiceItem format
 */
export const getCostByService = async (
  _params?: Record<string, any>
): Promise<CostByServiceItem[]> => {
  try {
    const breakdown = await getCostBreakdown({ dimension: 'category' });
    return breakdown.map((item, i) => ({
      key: `svc-${i}`,
      service: item.dimensionValue,
      cost: item.cost,
      percent: item.percentage,
      trend: 'stable' as const,
    }));
  } catch {
    return [];
  }
};

/**
 * @deprecated Use getRecommendations instead
 * Maps recommendations to old OptimizationItem format
 */
export const getOptimizations = async (): Promise<OptimizationItem[]> => {
  try {
    const recs = await getRecommendations();
    return recs.map((r) => ({
      key: r.id,
      title: getCategoryLabelCompat(r.category),
      description: r.description,
      savings: r.estimated_savings,
      effort: r.effort <= 2 ? 'low' : r.effort <= 4 ? 'medium' : 'high',
      status: r.status === 'identified' ? 'pending' : r.status === 'completed' ? 'applied' : 'pending',
    }));
  } catch {
    return [];
  }
};

/**
 * @deprecated Use updateRecommendationStatus instead
 */
export const applyOptimization = async (id: string): Promise<{ success: boolean }> => {
  try {
    await updateRecommendationStatus(id, 'approved');
    return { success: true };
  } catch {
    return { success: false };
  }
};

/**
 * @deprecated Use checkBudgetAlerts or getAlertTriggers instead
 * Returns mock budget alerts for backward compatibility
 */
export const getBudgetAlerts = async (): Promise<BudgetAlertItem[]> => {
  try {
    const triggered = await checkBudgetAlerts();
    return triggered.triggered.map((t) => ({
      key: t.id,
      service: t.entity_id,
      threshold: t.threshold,
      current: t.percentage,
      status: t.percentage >= 100 ? 'exceeded' : t.percentage >= 80 ? 'warning' : 'normal',
    }));
  } catch {
    return [];
  }
};

function getCategoryLabelCompat(value: string): string {
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
