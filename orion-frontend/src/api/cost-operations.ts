/**
 * Cost Operations API
 * Phase 2 - Budget gates, cost trends, anomaly detection, optimization suggestions
 */
import { api } from './client';

// ---- Types ----

export interface CostOverview {
  totalCost: number;
  currentMonthCost: number;
  previousMonthCost: number;
  monthOverMonthChange: number;
  projectedMonthlyCost: number;
  budgetRemaining: number;
  budgetTotal: number;
  budgetUsagePercent: number;
}

export interface CostTrendPoint {
  date: string;
  cost: number;
  budget: number;
}

export interface CostByService {
  serviceName: string;
  cost: number;
  percentOfTotal: number;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

export interface CostAnomaly {
  id: string;
  serviceName: string;
  anomalyType: 'spike' | 'drop' | 'pattern_change';
  detectedAt: string;
  severity: 'low' | 'medium' | 'high';
  expectedCost: number;
  actualCost: number;
  deviation: number;
  description: string;
}

export interface OptimizationSuggestion {
  id: string;
  category: 'compute' | 'storage' | 'network' | 'idle' | 'rightsizing';
  serviceName: string;
  description: string;
  potentialSavings: number;
  confidence: number;
  effort: 'low' | 'medium' | 'high';
  status: 'pending' | 'accepted' | 'rejected' | 'implemented';
}

export interface BudgetConfig {
  id: string;
  name: string;
  amount: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  alerts: BudgetAlertConfig[];
  services: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BudgetAlertConfig {
  thresholdPercent: number;
  action: 'notify' | 'warn' | 'block';
  recipients: string[];
}

export interface BudgetGateResult {
  pipelineId: string;
  estimatedCost: number;
  budgetLimit: number;
  wouldExceed: boolean;
  reason: string;
  checkedAt: string;
}

// ---- Cost Overview API ----

export function getCostOverview(params?: { projectId?: string; period?: string }) {
  return api.get<CostOverview>('/api/cost-operations/overview', { params });
}

export function getCostTrend(params?: {
  days?: number;
  serviceName?: string;
  granularity?: 'daily' | 'weekly' | 'monthly';
}) {
  return api.get<{ trends: CostTrendPoint[] }>('/api/cost-operations/trend', { params });
}

export function getCostByService(params?: { period?: string }) {
  return api.get<{ services: CostByService[] }>('/api/cost-operations/by-service', { params });
}

// ---- Anomaly Detection API ----

export function getCostAnomalies(params?: {
  days?: number;
  severity?: string;
  serviceName?: string;
}) {
  return api.get<{ anomalies: CostAnomaly[] }>('/api/cost-operations/anomalies', { params });
}

// ---- Optimization API ----

export function getOptimizationSuggestions(params?: {
  category?: string;
  status?: string;
  minSavings?: number;
}) {
  return api.get<{ suggestions: OptimizationSuggestion[] }>(
    '/api/cost-operations/optimizations',
    { params }
  );
}

export function applyOptimization(suggestionId: string) {
  return api.post(`/api/cost-operations/optimizations/${suggestionId}/apply`);
}

export function rejectOptimization(suggestionId: string) {
  return api.post(`/api/cost-operations/optimizations/${suggestionId}/reject`);
}

// ---- Budget API ----

export function getBudgets(params?: { projectId?: string }) {
  return api.get<{ budgets: BudgetConfig[] }>('/api/cost-operations/budgets', { params });
}

export function createBudget(data: {
  name: string;
  amount: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  services: string[];
  alerts: BudgetAlertConfig[];
}) {
  return api.post<BudgetConfig>('/api/cost-operations/budgets', data);
}

export function updateBudget(budgetId: string, data: Partial<typeof createBudget.arguments>) {
  return api.put<BudgetConfig>(`/api/cost-operations/budgets/${budgetId}`, data);
}

export function deleteBudget(budgetId: string) {
  return api.delete(`/api/cost-operations/budgets/${budgetId}`);
}

export function checkBudgetGate(pipelineId: string, estimatedCost: number) {
  return api.post<BudgetGateResult>('/api/cost-operations/budget-gate/check', {
    pipelineId,
    estimatedCost,
  });
}

// ---- Budget Guard API (Phase 2) ----

export interface BudgetGuard {
  id: string;
  name: string;
  description: string | null;
  budgetAmount: number;
  currency: string;
  action: 'allow' | 'block' | 'warn';
  scope: { projectIds: string[]; environment: string | null } | null;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface BudgetGuardInput {
  name: string;
  description?: string;
  budgetAmount: number;
  currency?: string;
  action: 'allow' | 'block' | 'warn';
  scope?: { projectIds?: string[]; environment?: string };
}

export interface EvaluationResult {
  passed: boolean;
  action: string;
  estimatedCost: number;
  budgetAmount: number;
  usagePercent: number;
  matchedGuard: BudgetGuard | null;
  message: string;
}

export function getBudgetGuards(params?: { tenantId?: string }) {
  return api.get<{ success: boolean; data: BudgetGuard[] }>(
    '/api/cost-operations/budget-guards',
    { params },
  );
}

export function createBudgetGuard(data: BudgetGuardInput) {
  return api.post<{ success: boolean; data: BudgetGuard }>('/api/cost-operations/budget-guards', data);
}

export function evaluateBudgetGuard(pipelineId: string, estimatedCost: number, options?: {
  tenantId?: string; projectId?: string; environment?: string;
}) {
  return api.post<{ success: boolean; data: EvaluationResult }>('/api/cost-operations/evaluate', {
    pipelineId, estimatedCost, ...options,
  });
}

// ---- Cost Forecast API ----

export interface CostForecastResult {
  predictedEndOfMonthCost: number;
  currentSpend: number;
  projectedOverage: number;
  confidence: number;
  dailyForecast: Array<{ date: string; predicted: number }>;
}

export function getCostForecast(params?: { days?: number; tenantId?: string }) {
  return api.get<{ success: boolean; data: CostForecastResult }>(
    '/api/cost-operations/forecast',
    { params },
  );
}
