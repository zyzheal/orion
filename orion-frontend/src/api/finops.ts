/**
 * FinOps Cost Management API Service
 * - Cost summary, trend, breakdown by service
 * - Optimization recommendations
 * - Budget alerts
 * - Cost report export
 */
import { api } from './client';
import type { ApiResponse } from './types';

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
  return response.data.data;
};

/**
 * 获取按服务分类的成本
 */
export const getCostByService = async (
  params?: CostByServiceParams
): Promise<CostByServiceItem[]> => {
  const response = await api.get<CostByServiceItem[]>('/v1/cost/breakdown', { params });
  return response.data.data;
};

/**
 * 获取成本趋势
 */
export const getCostTrend = async (
  params?: CostTrendParams
): Promise<CostTrendItem[]> => {
  const response = await api.post<CostTrendItem[]>('/v1/cost/trend', params);
  return response.data.data;
};

/**
 * 获取优化建议列表
 */
export const getOptimizations = async (): Promise<OptimizationItem[]> => {
  const response = await api.get<OptimizationItem[]>('/v1/finops/optimizations');
  return response.data.data;
};

/**
 * 应用优化建议
 */
export const applyOptimization = async (id: string): Promise<{ success: boolean }> => {
  const response = await api.post<{ success: boolean }>(
    `/v1/finops/optimizations/${id}/apply`
  );
  return response.data.data;
};

/**
 * 获取预算告警
 */
export const getBudgetAlerts = async (): Promise<BudgetAlertItem[]> => {
  const response = await api.get<BudgetAlertItem[]>('/v1/cost/budget-alerts');
  return response.data.data;
};

/**
 * 导出成本报表
 */
export const exportCostReport = async (
  params: CostReportParams
): Promise<Blob> => {
  const response = await api.post<Blob>('/v1/finops/export-report', params, {
    responseType: 'blob',
  });
  return response.data;
};
