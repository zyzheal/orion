/**
 * AI Cost Optimization 数据模型
 *
 * 预算管理、成本记录、告警规则、模型定价
 */

import { v4 as uuidv4 } from 'uuid';

// ==================== Budget ====================

export type BudgetType = 'tenant' | 'project' | 'user';
export type BudgetPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type BudgetStatus = 'active' | 'paused' | 'exhausted' | 'deleted';

export interface BudgetThresholds {
  warning: number; // 0-1, 如 0.8 = 80%
  critical: number; // 0-1, 如 0.95 = 95%
  hardLimit: number; // 0-1, 如 1.0 = 100%
}

export interface Budget {
  id: string;
  name: string;
  type: BudgetType;
  scope: string; // tenantId / projectId / userId
  period: BudgetPeriod;
  amount: number; // 预算金额（元）
  thresholds: BudgetThresholds;
  status: BudgetStatus;
  spent: number; // 已消耗金额
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetCreateInput {
  name: string;
  type: BudgetType;
  scope: string;
  period: BudgetPeriod;
  amount: number;
  thresholds?: BudgetThresholds;
}

export interface BudgetUpdateInput {
  name?: string;
  amount?: number;
  thresholds?: BudgetThresholds;
  status?: BudgetStatus;
}

export function createBudget(input: BudgetCreateInput): Budget {
  const now = new Date();
  return {
    id: uuidv4(),
    name: input.name,
    type: input.type,
    scope: input.scope,
    period: input.period,
    amount: input.amount,
    thresholds: input.thresholds ?? { warning: 0.8, critical: 0.95, hardLimit: 1.0 },
    status: 'active',
    spent: 0,
    createdAt: now,
    updatedAt: now,
  };
}

// ==================== CostRecord ====================

export interface CostRecord {
  id: string;
  requestId: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  tenantId?: string;
  projectId?: string;
  userId?: string;
  moduleType: string;
  timestamp: Date;
}

export interface CostRecordCreateInput {
  requestId: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  tenantId?: string;
  projectId?: string;
  userId?: string;
  moduleType: string;
}

export function createCostRecord(input: CostRecordCreateInput): CostRecord {
  return {
    id: uuidv4(),
    requestId: input.requestId,
    model: input.model,
    provider: input.provider,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    inputCost: input.inputCost,
    outputCost: input.outputCost,
    totalCost: input.totalCost,
    tenantId: input.tenantId,
    projectId: input.projectId,
    userId: input.userId,
    moduleType: input.moduleType,
    timestamp: new Date(),
  };
}

// ==================== AlertRule ====================

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'active' | 'resolved' | 'acknowledged';

export interface AlertRule {
  id: string;
  name: string;
  budgetId?: string;
  condition: 'budget_percentage' | 'absolute_cost' | 'rate_of_change';
  threshold: number;
  severity: AlertSeverity;
  recipients: string[]; // 邮箱或 webhook URL
  status: AlertStatus;
  lastTriggered?: Date;
  createdAt: Date;
}

export interface AlertRuleCreateInput {
  name: string;
  budgetId?: string;
  condition: 'budget_percentage' | 'absolute_cost' | 'rate_of_change';
  threshold: number;
  severity: AlertSeverity;
  recipients: string[];
}

export function createAlertRule(input: AlertRuleCreateInput): AlertRule {
  return {
    id: uuidv4(),
    name: input.name,
    budgetId: input.budgetId,
    condition: input.condition,
    threshold: input.threshold,
    severity: input.severity,
    recipients: input.recipients,
    status: 'active',
    createdAt: new Date(),
  };
}

// ==================== ModelPricing ====================

export interface ModelPricing {
  id: string;
  provider: string;
  model: string;
  inputPricePer1k: number; // 每 1K input tokens 价格（元）
  outputPricePer1k: number; // 每 1K output tokens 价格（元）
  currency: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  notes?: string;
}

export interface ModelPricingCreateInput {
  provider: string;
  model: string;
  inputPricePer1k: number;
  outputPricePer1k: number;
  currency?: string;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  notes?: string;
}

export function createModelPricing(input: ModelPricingCreateInput): ModelPricing {
  return {
    id: uuidv4(),
    provider: input.provider,
    model: input.model,
    inputPricePer1k: input.inputPricePer1k,
    outputPricePer1k: input.outputPricePer1k,
    currency: input.currency ?? 'CNY',
    effectiveFrom: input.effectiveFrom ?? new Date(),
    effectiveTo: input.effectiveTo,
    notes: input.notes,
  };
}
