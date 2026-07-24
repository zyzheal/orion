/**
 * Cost Allocation API
 * Phase 2 - K8s cost allocation and budget management
 */
import apiClient from './client';

export interface K8sClusterCost {
  id: string;
  tenantId: string;
  clusterName: string;
  region: string | null;
  month: string;
  nodeCount: number | null;
  totalCpuCores: number | null;
  totalMemoryGb: number | null;
  gpuCount: number | null;
  computeCost: number | null;
  storageCost: number | null;
  networkCost: number | null;
  totalCost: number | null;
  currency: string;
  createdAt: string;
}

export interface FinopsBudget {
  id: string;
  tenantId: string;
  name: string;
  scopeType: 'cluster' | 'namespace' | 'team';
  scopeValue: string;
  monthlyLimit: number;
  currency: string;
  alertThreshold: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CostSummary {
  totalCost: number;
  computeCost: number;
  storageCost: number;
  networkCost: number;
  clusterCount: number;
  topNamespaces: { namespace: string; cost: number }[];
}

export interface CostTrend {
  month: string;
  totalCost: number;
  computeCost: number;
  storageCost: number;
}

export interface CreateBudgetInput {
  name: string;
  scopeType: 'cluster' | 'namespace' | 'team';
  scopeValue: string;
  monthlyLimit: number;
  currency?: string;
  alertThreshold?: number;
  enabled?: boolean;
}

export interface UpdateBudgetInput {
  name?: string;
  monthlyLimit?: number;
  alertThreshold?: number;
  enabled?: boolean;
}

// Cost Summary & Trends
export const getCostSummary = (params?: { month?: string }) =>
  apiClient.get<CostSummary>('/cost-allocation/summary', { params });

export const getCostTrend = (params?: { months?: number }) =>
  apiClient.get<CostTrend[]>('/cost-allocation/trend', { params });

export const getTopNamespaces = (params?: { month?: string; limit?: number }) =>
  apiClient.get<{ namespace: string; cost: number }[]>('/cost-allocation/namespaces/top', { params });

// Budgets
export const listBudgets = () =>
  apiClient.get<FinopsBudget[]>('/cost-allocation/budgets');

export const createBudget = (data: CreateBudgetInput) =>
  apiClient.post<FinopsBudget>('/cost-allocation/budgets', data);

export const updateBudget = (id: string, data: UpdateBudgetInput) =>
  apiClient.put<FinopsBudget>(`/cost-allocation/budgets/${id}`, data);

export const deleteBudget = (id: string) =>
  apiClient.delete(`/cost-allocation/budgets/${id}`);

export const checkBudgetAlerts = () =>
  apiClient.get<{ budgetId: string; budgetName: string; currentSpend: number; limit: number; exceeded: boolean }[]>('/cost-allocation/budgets/alerts');
