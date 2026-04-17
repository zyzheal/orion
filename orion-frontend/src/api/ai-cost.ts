/**
 * AI Cost Optimization API Service
 * Budget management, cost tracking, dashboard data, ROI reports, and alerts
 */
import { api } from './client';

// ---- Types ----

export interface Budget {
  id: string;
  name: string;
  type: 'tenant' | 'project' | 'user' | 'model';
  scope: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  amount: number;
  thresholds: { warning: number; critical: number };
  status: 'active' | 'paused' | 'exceeded' | 'restored';
  createdAt: string;
  updatedAt: string;
}

export interface CostRecord {
  id: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  tenantId: string;
  projectId: string;
  userId: string;
  timestamp: string;
}

export interface CostAlert {
  id: string;
  budgetId: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  currentUsage: number;
  threshold: number;
  createdAt: string;
}

export interface DashboardData {
  todayCost: number;
  totalTokens: number;
  totalRequests: number;
  budgetUsage: number;
  dailyTrend: { date: string; cost: number; tokens: number }[];
  topTenants: { tenantId: string; cost: number }[];
  topUsers: { userId: string; cost: number }[];
  modelDistribution: { model: string; cost: number }[];
}

export interface ModelPricing {
  model: string;
  provider: string;
  inputPricePer1K: number;
  outputPricePer1K: number;
}

export interface BudgetInput {
  name: string;
  type: string;
  scope: string;
  period: string;
  amount: number;
  thresholds: { warning: number; critical: number };
}

export interface UpdateBudgetInput {
  name?: string;
  amount?: number;
  thresholds?: { warning: number; critical: number };
  status?: string;
}

export interface BudgetListParams {
  type?: string;
  status?: string;
  page?: number;
  perPage?: number;
}

export interface CostListParams {
  tenantId?: string;
  projectId?: string;
  userId?: string;
  model?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  perPage?: number;
}

export interface CostSummaryParams {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'model' | 'tenant' | 'project' | 'user';
}

// ---- Budgets ----

export function getBudgets(params?: BudgetListParams) {
  return api.get('/v1/ai-cost/budgets', { params });
}

export function getBudget(id: string) {
  return api.get(`/v1/ai-cost/budgets/${id}`);
}

export function createBudget(data: BudgetInput) {
  return api.post('/v1/ai-cost/budgets', data);
}

export function updateBudget(id: string, data: UpdateBudgetInput) {
  return api.put(`/v1/ai-cost/budgets/${id}`, data);
}

export function restoreBudget(id: string) {
  return api.post(`/v1/ai-cost/budgets/${id}/restore`);
}

export function deleteBudget(id: string) {
  return api.delete(`/v1/ai-cost/budgets/${id}`);
}

// ---- Costs ----

export function getCosts(params?: CostListParams) {
  return api.get('/v1/ai-cost/costs', { params });
}

export function getCostSummary(params?: CostSummaryParams) {
  return api.get('/v1/ai-cost/costs/summary', { params });
}

// ---- Dashboard ----

export function getDashboardData() {
  return api.get('/v1/ai-cost/dashboard');
}

// ---- Alerts ----

export function getAlerts() {
  return api.get('/v1/ai-cost/alerts');
}

// ---- Model Pricing ----

export function getModelPricing() {
  return api.get('/v1/ai-cost/pricing');
}

// ---- ROI ----

export function getROIReport(params?: { period?: string }) {
  return api.get('/v1/ai-cost/roi', { params });
}
