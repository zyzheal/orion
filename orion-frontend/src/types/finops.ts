/**
 * FinOps 成本管理前端类型定义
 *
 * 与后端 /v1/finops/* API 响应结构对齐
 */

// ============================================================================
// Cost Summary
// ============================================================================

export interface CostSummaryResponse {
  summary: {
    totalCost: number;
    computeCost: number;
    storageCost: number;
    networkCost: number;
    saasCost: number;
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    currency: string;
    tenantId?: string;
  };
}

// ============================================================================
// Cost Breakdown
// ============================================================================

export interface CostBreakdownItem {
  dimension: 'category' | 'tenant' | 'environment' | 'provider' | 'namespace';
  dimensionValue: string;
  cost: number;
  percentage: number;
  recordCount: number;
}

export interface CostBreakdownResponse {
  breakdown: CostBreakdownItem[];
}

// ============================================================================
// Cost Trend
// ============================================================================

export interface CostTrendPoint {
  date: string;
  cost: number;
  changeRate: number;
}

export interface CostTrendResponse {
  trend: {
    points: CostTrendPoint[];
    overallChangeRate: number;
    averageCost: number;
    maxCost: number;
    minCost: number;
  };
}

// ============================================================================
// Budget
// ============================================================================

export interface BudgetThreshold {
  id: string;
  percentage: number;
  triggered: boolean;
  triggeredAt?: string;
}

export interface Budget {
  id: string;
  entity_type: 'project' | 'tenant' | 'team';
  entity_id: string;
  amount: number;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  currency: string;
  alerts: BudgetThreshold[];
  environment?: string;
  description?: string;
  created_at: string;
  updated_at?: string;
}

export interface BudgetInput {
  entityType: 'project' | 'tenant' | 'team';
  entityId: string;
  amount: number;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  currency?: string;
  alerts?: { percentage: number }[];
  environment?: string;
  description?: string;
}

export interface BudgetUpdateInput {
  amount?: number;
  period?: string;
  alerts?: { percentage: number }[];
  environment?: string;
  description?: string;
}

export interface BudgetStatus {
  budgetId: string;
  entityType: string;
  entityId: string;
  budgetAmount: number;
  currentSpend: number;
  usagePercent: number;
  remaining: number;
  period: string;
  overBudget: boolean;
  triggeredAlerts: AlertTrigger[];
  forecastedSpend?: number;
}

export interface BudgetForecast {
  budgetId: string;
  currentSpend: number;
  forecastedSpend: number;
  projectedOverage: number;
  dailySpendRate: number;
  daysUntilExhausted: number;
  withinBudget: boolean;
  history: { date: string; cumulativeCost: number }[];
}

export interface AlertTrigger {
  id: string;
  budget_id: string;
  threshold: number;
  actual: number;
  percentage: number;
  triggered_at: string;
  entity_type: string;
  entity_id: string;
}

// ============================================================================
// Optimization Recommendation
// ============================================================================

export interface OptimizationRecommendation {
  id: string;
  category: string;
  description: string;
  estimated_savings: number;
  effort: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'identified' | 'reviewing' | 'approved' | 'in-progress' | 'completed' | 'rejected';
  resource_ids?: string[];
  entity_id?: string;
  entity_type?: string;
  created_at: string;
  updated_at?: string;
  notes?: string;
}

export interface RightSizingRecommendation {
  id: string;
  resourceId: string;
  resourceType: string;
  currentSpec: Record<string, any>;
  recommendedSpec: Record<string, any>;
  currentCost: number;
  estimatedCost: number;
  estimatedSavings: number;
  reason: string;
  tenantId?: string;
}

export interface SavingsMetrics {
  totalMonthlySavings: number;
  totalAnnualSavings: number;
  byCategory: Record<string, number>;
  suggestionCount: number;
}

// ============================================================================
// ROI
// ============================================================================

export interface ROISummary {
  totalAnalyses: number;
  averageROI: number;
  averagePaybackMonths: number;
  totalComparisons: number;
  totalSavings: number;
}

export interface ROIMetrics {
  summary: ROISummary;
}

// ============================================================================
// API Response wrapper (matches backend { success, data } pattern)
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ============================================================================
// FinOps Metrics
// ============================================================================

export interface FinOpsMetrics {
  costMetrics: CostSummaryResponse['summary'];
  roiMetrics: ROISummary;
  savingsMetrics: SavingsMetrics;
}
