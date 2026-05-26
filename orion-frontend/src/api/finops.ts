/**
 * FinOps Cost Management API Service
 * - Cost summary, trend, breakdown by service
 * - Optimization recommendations
 * - Budget alerts
 * - Cost report export
 */
import { api } from './client';

// ============================================================================
// Type Definitions
// ============================================================================

export interface CostSummary {
  totalMonthly: number;
  budgetLimit: number;
  previousMonth: number;
  projectedMonthly: number;
  savings: number;
  waste: number;
}

export interface CostByServiceItem {
  key: string;
  service: string;
  cost: number;
  percent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface CostTrendItem {
  month: string;
  cost: number;
}

export interface OptimizationItem {
  key: string;
  title: string;
  description: string;
  savings: number;
  effort: 'low' | 'medium' | 'high';
  status: 'pending' | 'applied' | 'rejected';
}

export interface BudgetAlertItem {
  key: string;
  service: string;
  threshold: number;
  current: number;
  status: 'exceeded' | 'warning' | 'normal';
}

export interface CostReportParams {
  startDate?: string;
  endDate?: string;
  format?: 'csv' | 'xlsx' | 'pdf';
  services?: string[];
}

export interface CostByServiceParams {
  service?: string;
  month?: string;
}

export interface CostTrendParams {
  startDate?: string;
  endDate?: string;
  granularity?: 'daily' | 'weekly' | 'monthly';
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * 获取成本概览
 */
export const getCostSummary = async (): Promise<CostSummary> => {
  const response = await api.get<CostSummary>('/v1/cost/summary');
  // 拦截器已自动解包，response.data 直接是 CostSummary
  return response.data;
};

/**
 * 获取按服务分类的成本
 */
export const getCostByService = async (
  params?: CostByServiceParams
): Promise<CostByServiceItem[]> => {
  const response = await api.get<CostByServiceItem[]>('/v1/cost/breakdown', { params });
  // 拦截器已自动解包，response.data 直接是 CostByServiceItem[]
  return response.data;
};

/**
 * 获取成本趋势
 */
export const getCostTrend = async (params?: CostTrendParams): Promise<CostTrendItem[]> => {
  const response = await api.post<CostTrendItem[]>('/v1/cost/trend', params);
  // 拦截器已自动解包，response.data 直接是 CostTrendItem[]
  return response.data;
};

/**
 * 获取优化建议列表
 */
export const getOptimizations = async (): Promise<OptimizationItem[]> => {
  const response = await api.get<OptimizationItem[]>('/v1/finops/optimize/suggestions');
  // 拦截器已自动解包，response.data 直接是 OptimizationItem[]
  return response.data;
};

/**
 * 应用优化建议
 */
export const applyOptimization = async (id: string): Promise<{ success: boolean }> => {
  const response = await api.patch<{ success: boolean }>(`/v1/finops/optimize/${id}/status`, {
    status: 'applied',
  });
  // 拦截器已自动解包，response.data 直接是 { success: boolean }
  return response.data;
};

/**
 * 获取预算告警
 */
export const getBudgetAlerts = async (): Promise<BudgetAlertItem[]> => {
  const response = await api.get<BudgetAlertItem[]>('/v1/finops/budget/check-alerts');
  // 拦截器已自动解包，response.data 直接是 BudgetAlertItem[]
  return response.data;
};

/**
 * 导出成本报表
 */
export const exportCostReport = async (params: CostReportParams): Promise<Blob> => {
  // Backend doesn't have a direct export endpoint; use chargeback report
  const response = await api.get('/v1/finops/chargeback', {
    params,
    responseType: 'blob',
  });
  return response.data as unknown as Blob;
};
