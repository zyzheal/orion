/**
 * FinOpsService - Business logic layer for all FinOps operations
 *
 * Delegates all data operations to FinOpsRepository (PostgreSQL).
 * Covers: reports, cost tracking, budgets, ROI analysis, cost optimization.
 */
import { FinOpsRepository, FinOpsReport, ResourceCost, EntityCostRecord, BudgetRecord, AlertTriggerRecord, ROIAnalysisRecord, CostComparisonRecord, CostOptimizationRecord, SpendRecord, CloudCostRecord, K8sCostRecord, SaaSCostRecord, LegacyBudgetAlertRecord } from './FinOpsRepository';
import { CostEntityType, CostPeriod, OptimizationCategory, OptimizationPriority, OptimizationStatus, ResourceUtilization, RightSizingRecommendation, CloudProvider, CloudResourceType, BillingCycle, CostSummary, CostBreakdown } from './types';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';

export class FinOpsServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'FinOpsServiceError'; }
}

// ==================== Input/Output types ====================

export interface CostRecordInput {
  entityType: CostEntityType;
  entityId: string;
  amount: number;
  category: string;
  environment?: string;
  tags?: Record<string, string>;
  currency?: string;
  timestamp?: Date;
}

export interface BudgetInput {
  entityType: CostEntityType;
  entityId: string;
  amount: number;
  period: CostPeriod;
  currency?: string;
  alerts?: { percentage: number }[];
  environment?: string;
  description?: string;
}

export interface BudgetUpdateInput {
  amount?: number;
  period?: CostPeriod;
  alerts?: { percentage: number }[];
  environment?: string;
  description?: string;
}

export interface ROIInput {
  investmentType: string;
  name: string;
  cost: number;
  monthlySavings: number;
  timeSavingsHours?: number;
  description?: string;
  details?: Record<string, any>;
}

export interface PeriodComparisonInput {
  description: string;
  beforeCost: number;
  afterCost: number;
  timeSavingsHours?: number;
  period: CostPeriod;
}

export interface EntityCostSummary {
  entityType: CostEntityType;
  entityId: string;
  totalCost: number;
  breakdown: Record<string, number>;
  period: CostPeriod;
  currency: string;
  recordCount: number;
}

export interface ChargebackReport {
  id: string;
  generatedAt: Date;
  period: CostPeriod;
  totalCost: number;
  entities: {
    entityType: CostEntityType;
    entityId: string;
    cost: number;
    percentage: number;
    breakdown: Record<string, number>;
  }[];
  currency: string;
}

export interface CostTrendPoint {
  date: Date;
  cost: number;
  changeRate: number;
}

export interface CostTrend {
  points: CostTrendPoint[];
  overallChangeRate: number;
  averageCost: number;
  maxCost: number;
  minCost: number;
}

export interface BudgetStatus {
  budgetId: string;
  entityType: CostEntityType;
  entityId: string;
  budgetAmount: number;
  currentSpend: number;
  usagePercent: number;
  remaining: number;
  period: CostPeriod;
  overBudget: boolean;
  triggeredAlerts: AlertTriggerRecord[];
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
  history: { date: Date; cumulativeCost: number }[];
}

// ==================== Cloud Cost Collection ====================

export interface CloudCostInput {
  provider: CloudProvider;
  resourceType: CloudResourceType;
  resourceId: string;
  resourceName?: string;
  region: string;
  cost: number;
  currency?: string;
  tags?: Record<string, string>;
  timestamp?: Date;
  tenantId?: string;
  environment?: string;
  billingPeriod?: string;
}

// ==================== K8s Cost Allocation ====================

export interface K8sCostInput {
  namespace: string;
  deployment: string;
  podName?: string;
  cpuCost: number;
  memoryCost: number;
  storageCost: number;
  networkCost: number;
  totalCost: number;
  tenantId?: string;
  timestamp?: Date;
  clusterName?: string;
  nodeName?: string;
}

// ==================== SaaS Cost ====================

export interface SaaSCostInput {
  tool: string;
  subscription: string;
  seats: number;
  unitCost: number;
  billingCycle: BillingCycle;
  startDate: Date;
  endDate: Date;
  tenantId?: string;
  notes?: string;
}

export interface SaaSCostUpdate {
  seats?: number;
  unitCost?: number;
  totalCost?: number;
  billingCycle?: BillingCycle;
  startDate?: Date;
  endDate?: Date;
  status?: 'active' | 'cancelled' | 'expired';
  notes?: string;
}

// ==================== Legacy Budget Alert ====================

export interface LegacyBudgetAlertInput {
  budgetAmount: number;
  thresholdPercent: number;
  tenantId?: string;
  environment?: string;
  currency?: string;
  period?: CostPeriod;
}

export class FinOpsService {
  private repository: FinOpsRepository;
  private readonly logger = createLogger('finops-service');

  constructor(repository: FinOpsRepository) {
    this.repository = repository;
  }

  // ==================== Reports ====================

  async generateReport(tenantId: string, period: string): Promise<FinOpsReport> {
    const breakdown = { compute: 1000, storage: 500, network: 200 };
    const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
    return this.repository.createReport(tenantId, period, total, breakdown);
  }

  async getReportHistory(tenantId: string, limit?: number): Promise<FinOpsReport[]> {
    return this.repository.getReports(tenantId, limit);
  }

  async analyzeCosts(tenantId: string, startDate: Date, endDate: Date): Promise<ResourceCost[]> {
    return this.repository.getResourceCosts(tenantId, startDate, endDate);
  }

  // ==================== Cost Tracking ====================

  async trackCost(input: CostRecordInput): Promise<EntityCostRecord> {
    return this.repository.insertCostRecord({
      entityType: input.entityType,
      entityId: input.entityId,
      amount: input.amount,
      category: input.category,
      environment: input.environment,
      tags: input.tags,
      currency: input.currency || 'USD',
      timestamp: input.timestamp,
    });
  }

  async getCostByEntity(entityType: CostEntityType, entityId: string, period: CostPeriod = 'monthly'): Promise<EntityCostSummary> {
    const { startDate, endDate } = this.getPeriodDates(period);
    const records = await this.repository.getCostByEntity(entityType, entityId, startDate, endDate);

    const breakdown: Record<string, number> = {};
    let totalCost = 0;
    for (const r of records) {
      totalCost += r.amount;
      breakdown[r.category] = (breakdown[r.category] || 0) + r.amount;
    }

    // Round values
    const roundedBreakdown: Record<string, number> = {};
    for (const [k, v] of Object.entries(breakdown)) {
      roundedBreakdown[k] = Math.round(v * 100) / 100;
    }

    return {
      entityType,
      entityId,
      totalCost: Math.round(totalCost * 100) / 100,
      breakdown: roundedBreakdown,
      period,
      currency: 'USD',
      recordCount: records.length,
    };
  }

  async getCostTrend(entityType: CostEntityType, entityId: string, period: CostPeriod, category?: string): Promise<CostTrend> {
    const { startDate, endDate } = this.getPeriodDates(period);
    let records = await this.repository.getCostByEntity(entityType, entityId, startDate, endDate);

    if (category) {
      records = records.filter(r => r.category === category);
    }

    if (records.length === 0) {
      return { points: [], overallChangeRate: 0, averageCost: 0, maxCost: 0, minCost: 0 };
    }

    // Group by date
    const dateMap = new Map<string, number>();
    for (const r of records) {
      const dateKey = new Date(r.timestamp).toISOString().split('T')[0];
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + r.amount);
    }

    const dataPoints = Array.from(dateMap.entries())
      .map(([date, cost]) => ({ date: new Date(date), cost: Math.round(cost * 100) / 100 }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return this.computeTrend(dataPoints);
  }

  /**
   * 获取服务成本趋势（简化版，默认 entityType 为 'project'）
   * @param serviceId 服务 ID
   * @param period 统计周期
   * @param category 可选的类别过滤
   * @returns 成本趋势
   */
  async getServiceCostTrend(serviceId: string, period: CostPeriod, category?: string): Promise<CostTrend> {
    this.logger.debug({ serviceId, period, category }, '[FinOpsService] Getting service cost trend');
    return this.getCostTrend('project', serviceId, period, category);
  }

  async getChargebackReport(period: CostPeriod = 'monthly'): Promise<ChargebackReport> {
    const { startDate, endDate } = this.getPeriodDates(period);
    const allRecords = await this.repository.getAllCostRecords();
    const filtered = allRecords.filter(r => {
      const ts = new Date(r.timestamp);
      return ts >= startDate && ts <= endDate;
    });

    // Group by entity
    const entityMap = new Map<string, { entityType: CostEntityType; entityId: string; cost: number; breakdown: Record<string, number> }>();
    for (const r of filtered) {
      const key = `${r.entity_type}:${r.entity_id}`;
      if (!entityMap.has(key)) {
        entityMap.set(key, { entityType: r.entity_type, entityId: r.entity_id, cost: 0, breakdown: {} });
      }
      const entry = entityMap.get(key)!;
      entry.cost += r.amount;
      entry.breakdown[r.category] = (entry.breakdown[r.category] || 0) + r.amount;
    }

    const totalCost = Array.from(entityMap.values()).reduce((sum, e) => sum + e.cost, 0);

    const entities = Array.from(entityMap.values())
      .map(e => ({
        entityType: e.entityType,
        entityId: e.entityId,
        cost: Math.round(e.cost * 100) / 100,
        percentage: totalCost > 0 ? Math.round((e.cost / totalCost) * 10000) / 100 : 0,
        breakdown: Object.fromEntries(Object.entries(e.breakdown).map(([k, v]) => [k, Math.round(v * 100) / 100])),
      }))
      .sort((a, b) => b.cost - a.cost);

    return {
      id: uuidv4(),
      generatedAt: new Date(),
      period,
      totalCost: Math.round(totalCost * 100) / 100,
      entities,
      currency: 'USD',
    };
  }

  async getAllCostRecords(filter?: { entityType?: CostEntityType; entityId?: string; category?: string }): Promise<EntityCostRecord[]> {
    return this.repository.getAllCostRecords(filter);
  }

  // ==================== Budget Management ====================

  async createBudget(input: BudgetInput): Promise<BudgetRecord> {
    const defaultAlerts = input.alerts || [
      { percentage: 50 }, { percentage: 75 }, { percentage: 90 }, { percentage: 100 },
    ];
    const alerts = defaultAlerts.map(t => ({ id: uuidv4(), percentage: t.percentage, triggered: false }));

    return this.repository.createBudget({
      entityType: input.entityType,
      entityId: input.entityId,
      amount: input.amount,
      period: input.period,
      currency: input.currency || 'USD',
      alerts,
      environment: input.environment,
      description: input.description,
    });
  }

  async updateBudget(budgetId: string, input: BudgetUpdateInput): Promise<BudgetRecord | null> {
    const updates: any = {};
    if (input.amount !== undefined) updates.amount = input.amount;
    if (input.period !== undefined) updates.period = input.period;
    if (input.alerts !== undefined) {
      updates.alerts = input.alerts.map(t => ({ id: uuidv4(), percentage: t.percentage, triggered: false }));
    }
    if (input.environment !== undefined) updates.environment = input.environment;
    if (input.description !== undefined) updates.description = input.description;

    if (Object.keys(updates).length === 0) return null;
    return this.repository.updateBudget(budgetId, updates);
  }

  async deleteBudget(budgetId: string): Promise<boolean> {
    return this.repository.deleteBudget(budgetId);
  }

  async getBudget(budgetId: string): Promise<BudgetRecord | null> {
    return this.repository.getBudget(budgetId);
  }

  async listBudgets(filter?: { entityType?: CostEntityType; entityId?: string }): Promise<BudgetRecord[]> {
    return this.repository.listBudgets(filter);
  }

  async updateEntitySpend(entityType: CostEntityType, entityId: string, amount: number): Promise<SpendRecord> {
    return this.repository.recordSpend(entityType, entityId, amount);
  }

  async checkBudgetAlerts(): Promise<AlertTriggerRecord[]> {
    const budgets = await this.repository.listBudgets();
    const triggered: AlertTriggerRecord[] = [];

    for (const budget of budgets) {
      const key = `${budget.entity_type}:${budget.entity_id}`;
      const currentSpend = await this.repository.getCurrentSpend(budget.entity_type, budget.entity_id);
      const usagePercent = budget.amount > 0 ? (currentSpend / budget.amount) * 100 : 0;

      // Check thresholds (alerts stored as JSON)
      const alerts: Array<{ id: string; percentage: number; triggered: boolean }> =
        typeof budget.alerts === 'string' ? JSON.parse(budget.alerts as any) : (budget.alerts as any) || [];

      for (const threshold of alerts) {
        if (usagePercent >= threshold.percentage && !threshold.triggered) {
          const trigger = await this.repository.insertAlertTrigger({
            budgetId: budget.id,
            threshold: threshold.percentage,
            actual: Math.round(currentSpend * 100) / 100,
            percentage: Math.round(usagePercent * 100) / 100,
            entityType: budget.entity_type,
            entityId: budget.entity_id,
          });
          triggered.push(trigger);
        }
      }
    }

    return triggered;
  }

  async getBudgetStatus(budgetId: string): Promise<BudgetStatus | null> {
    const budget = await this.repository.getBudget(budgetId);
    if (!budget) return null;

    const currentSpend = await this.repository.getCurrentSpend(budget.entity_type, budget.entity_id);
    const usagePercent = budget.amount > 0 ? (currentSpend / budget.amount) * 100 : 0;
    const remaining = budget.amount - currentSpend;
    const triggeredAlerts = await this.repository.getAlertTriggers({ budgetId });

    const forecast = await this.forecastBudget(budgetId);

    return {
      budgetId: budget.id,
      entityType: budget.entity_type,
      entityId: budget.entity_id,
      budgetAmount: budget.amount,
      currentSpend: Math.round(currentSpend * 100) / 100,
      usagePercent: Math.round(usagePercent * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      period: budget.period,
      overBudget: currentSpend > budget.amount,
      triggeredAlerts,
      forecastedSpend: forecast?.forecastedSpend,
    };
  }

  async forecastBudget(budgetId: string): Promise<BudgetForecast | null> {
    const budget = await this.repository.getBudget(budgetId);
    if (!budget) return null;

    const history = await this.repository.getSpendHistory(budget.entity_type, budget.entity_id);
    const currentSpend = await this.repository.getCurrentSpend(budget.entity_type, budget.entity_id);

    // Calculate daily spend rate
    let dailySpendRate = 0;
    if (history.length >= 2) {
      const first = history[0];
      const last = history[history.length - 1];
      const daysDiff = (last.date.getTime() - first.date.getTime()) / (24 * 60 * 60 * 1000);
      const costDiff = last.cumulativeCost - first.cumulativeCost;
      dailySpendRate = daysDiff > 0 ? costDiff / daysDiff : 0;
    } else if (currentSpend > 0) {
      const periodDays = this.getPeriodDays(budget.period);
      dailySpendRate = currentSpend / Math.max(periodDays, 1);
    }

    const periodDays = this.getPeriodDays(budget.period);
    const elapsedDays = history.length > 1
      ? (history[history.length - 1].date.getTime() - history[0].date.getTime()) / (24 * 60 * 60 * 1000)
      : 0;
    const remainingDays = Math.max(periodDays - elapsedDays, 0);

    const forecastedSpend = currentSpend + dailySpendRate * remainingDays;
    const projectedOverage = Math.max(forecastedSpend - budget.amount, 0);
    const daysUntilExhausted = dailySpendRate > 0
      ? (budget.amount - currentSpend) / dailySpendRate
      : Infinity;

    return {
      budgetId: budget.id,
      currentSpend: Math.round(currentSpend * 100) / 100,
      forecastedSpend: Math.round(forecastedSpend * 100) / 100,
      projectedOverage: Math.round(projectedOverage * 100) / 100,
      dailySpendRate: Math.round(dailySpendRate * 100) / 100,
      daysUntilExhausted: daysUntilExhausted === Infinity ? -1 : Math.round(daysUntilExhausted),
      withinBudget: forecastedSpend <= budget.amount,
      history,
    };
  }

  async getAlertTriggers(filter?: { budgetId?: string; entityType?: CostEntityType }): Promise<AlertTriggerRecord[]> {
    return this.repository.getAlertTriggers(filter);
  }

  // ==================== ROI Analysis ====================

  async calculateROI(input: ROIInput): Promise<ROIAnalysisRecord> {
    const annualSavings = input.monthlySavings * 12;
    const roiPercentage = input.cost > 0 ? ((annualSavings - input.cost) / input.cost) * 100 : 0;
    const paybackMonths = input.monthlySavings > 0 ? input.cost / input.monthlySavings : Infinity;

    return this.repository.insertROIAnalysis({
      investmentType: input.investmentType,
      name: input.name,
      cost: input.cost,
      savings: annualSavings,
      period: 'yearly',
      roiPercentage: Math.round(roiPercentage * 100) / 100,
      paybackMonths: paybackMonths === Infinity ? -1 : Math.round(paybackMonths * 100) / 100,
      description: input.description,
      details: {
        monthlySavings: input.monthlySavings,
        annualSavings,
        timeSavingsHours: input.timeSavingsHours,
        ...input.details,
      },
    });
  }

  async analyzeAutomationSavings(params: {
    name: string;
    manualHoursPerMonth: number;
    hourlyRate: number;
    automationCost: number;
    automationMaintenancePerMonth?: number;
    timeSavingsPercent: number;
    description?: string;
  }): Promise<ROIAnalysisRecord> {
    const maintenance = params.automationMaintenancePerMonth || 0;
    const manualCostPerMonth = params.manualHoursPerMonth * params.hourlyRate;
    const remainingHours = params.manualHoursPerMonth * (1 - params.timeSavingsPercent / 100);
    const automatedCostPerMonth = remainingHours * params.hourlyRate;
    const netMonthlySavings = manualCostPerMonth - automatedCostPerMonth - maintenance;
    const timeSavingsHours = params.manualHoursPerMonth * (params.timeSavingsPercent / 100);

    return this.calculateROI({
      investmentType: 'automation',
      name: params.name,
      cost: params.automationCost,
      monthlySavings: netMonthlySavings,
      timeSavingsHours,
      description: params.description,
      details: {
        manualHoursPerMonth: params.manualHoursPerMonth,
        hourlyRate: params.hourlyRate,
        manualCostPerMonth,
        automatedCostPerMonth,
        maintenancePerMonth: maintenance,
        timeSavingsPercent: params.timeSavingsPercent,
      },
    });
  }

  async comparePeriods(input: PeriodComparisonInput): Promise<CostComparisonRecord> {
    const savings = input.beforeCost - input.afterCost;
    const savingsPercent = input.beforeCost > 0 ? (savings / input.beforeCost) * 100 : 0;

    return this.repository.insertCostComparison({
      description: input.description,
      beforeCost: Math.round(input.beforeCost * 100) / 100,
      afterCost: Math.round(input.afterCost * 100) / 100,
      savings: Math.round(savings * 100) / 100,
      savingsPercent: Math.round(savingsPercent * 100) / 100,
      timeSavingsHours: input.timeSavingsHours,
      period: input.period,
    });
  }

  // ==================== Cost Comparison ====================

  /**
   * 对比两个服务的成本
   * @param tenantId 租户 ID
   * @param serviceA 服务 A 的 ID
   * @param serviceB 服务 B 的 ID
   * @param period 统计周期
   * @returns 成本对比记录
   */
  async compareCosts(tenantId: string, serviceA: string, serviceB: string, period: CostPeriod): Promise<CostComparisonRecord> {
    this.logger.info({ tenantId, serviceA, serviceB, period }, '[FinOpsService] Comparing costs between two services');

    const { startDate, endDate } = this.getPeriodDates(period);

    // 从云成本记录中获取两个服务的成本
    const costsA = await this.repository.getCloudCosts({ tenantId, startDate, endDate });
    const costsB = await this.repository.getCloudCosts({ tenantId, startDate, endDate });

    // 按 resource_id（服务 ID）聚合成本
    const sumCosts = (records: CloudCostRecord[], serviceId: string): number => {
      return records
        .filter(r => r.resource_id === serviceId)
        .reduce((sum, r) => sum + r.cost, 0);
    };

    const costA = sumCosts(costsA, serviceA);
    const costB = sumCosts(costsB, serviceB);

    const savings = costA - costB;
    const savingsPercent = costA > 0 ? (savings / costA) * 100 : 0;
    const description = `Cost comparison between ${serviceA} and ${serviceB} for ${period} period`;

    this.logger.info({ tenantId, serviceA, serviceB, costA, costB, savings, savingsPercent }, '[FinOpsService] Cost comparison completed');

    return this.repository.insertCostComparison({
      description,
      beforeCost: Math.round(costA * 100) / 100,
      afterCost: Math.round(costB * 100) / 100,
      savings: Math.round(savings * 100) / 100,
      savingsPercent: Math.round(savingsPercent * 100) / 100,
      period,
    });
  }

  async getROIHistory(filter?: { investmentType?: string; minROI?: number }): Promise<ROIAnalysisRecord[]> {
    return this.repository.getROIHistory(filter);
  }

  async getCostComparisons(filter?: { period?: CostPeriod }): Promise<CostComparisonRecord[]> {
    return this.repository.getCostComparisons(filter);
  }

  async getROISummary(): Promise<{
    totalAnalyses: number;
    averageROI: number;
    averagePaybackMonths: number;
    totalComparisons: number;
    totalSavings: number;
  }> {
    return this.repository.getROISummary();
  }

  // ==================== Cost Optimization ====================

  async analyzeOptimization(utilizations: ResourceUtilization[]): Promise<CostOptimizationRecord[]> {
    const suggestions: Array<{
      category: OptimizationCategory;
      description: string;
      estimatedSavings: number;
      effort: number;
      priority: OptimizationPriority;
      status: OptimizationStatus;
      resourceIds?: string[];
      entityId?: string;
      entityType?: CostEntityType;
      notes?: string;
    }> = [];

    for (const util of utilizations) {
      if (this.isUnused(util)) {
        suggestions.push(this.createUnusedResourceSuggestion(util));
      }
      if (this.isUnderutilized(util)) {
        suggestions.push(this.createRightSizingSuggestion(util));
      }
      if (this.isSchedulable(util)) {
        suggestions.push(this.createSchedulingSuggestion(util));
      }
    }

    return this.repository.batchInsertOptimizations(suggestions);
  }

  async getRightSizingRecommendations(filter?: { tenantId?: string; environment?: string }): Promise<RightSizingRecommendation[]> {
    // With DB-backed data, we analyze stored optimizations to generate recommendations
    const opts = await this.repository.getOptimizations({ category: 'right-sizing' });
    const recommendations: RightSizingRecommendation[] = [];

    for (const opt of opts) {
      if (filter?.tenantId && opt.entity_id !== filter.tenantId) continue;

      recommendations.push({
        id: opt.id,
        resourceId: opt.resource_ids?.[0] || opt.id,
        resourceType: opt.category,
        currentSpec: {},
        recommendedSpec: {},
        currentCost: 0,
        estimatedCost: 0,
        estimatedSavings: opt.estimated_savings,
        reason: opt.description,
        tenantId: opt.entity_id || undefined,
      });
    }

    return recommendations.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
  }

  async detectUnusedResources(filter?: { tenantId?: string; environment?: string }): Promise<any[]> {
    const opts = await this.repository.getOptimizations({ category: 'unused-resources' });

    if (filter?.tenantId) {
      return opts.filter(o => o.entity_id === filter.tenantId);
    }
    return opts;
  }

  async estimateSavings(filter?: { category?: OptimizationCategory; status?: OptimizationStatus }): Promise<{
    totalMonthlySavings: number;
    totalAnnualSavings: number;
    byCategory: Record<string, number>;
    suggestionCount: number;
  }> {
    const suggestions = await this.repository.getOptimizations(filter);

    const byCategory: Record<string, number> = {};
    let totalMonthlySavings = 0;

    for (const opt of suggestions) {
      totalMonthlySavings += opt.estimated_savings;
      byCategory[opt.category] = (byCategory[opt.category] || 0) + opt.estimated_savings;
    }

    const rounded = Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, Math.round(v * 100) / 100]));

    return {
      totalMonthlySavings: Math.round(totalMonthlySavings * 100) / 100,
      totalAnnualSavings: Math.round(totalMonthlySavings * 12 * 100) / 100,
      byCategory: rounded,
      suggestionCount: suggestions.length,
    };
  }

  async getOptimizations(query?: {
    category?: OptimizationCategory;
    priority?: OptimizationPriority;
    status?: OptimizationStatus;
    entityType?: CostEntityType;
    entityId?: string;
  }): Promise<CostOptimizationRecord[]> {
    return this.repository.getOptimizations(query);
  }

  /**
   * 获取服务的优化建议（简化版）
   * @param serviceId 服务 ID
   * @param entityType 实体类型，默认为 'project'
   * @returns 优化建议列表
   */
  async getServiceOptimizationSuggestions(serviceId: string, entityType: CostEntityType = 'project'): Promise<CostOptimizationRecord[]> {
    this.logger.debug({ serviceId, entityType }, '[FinOpsService] Getting service optimization suggestions');
    return this.getOptimizations({ entityType, entityId: serviceId });
  }

  async updateOptimizationStatus(optimizationId: string, status: OptimizationStatus): Promise<CostOptimizationRecord | null> {
    return this.repository.updateOptimizationStatus(optimizationId, status);
  }

  async deleteOptimization(optimizationId: string): Promise<boolean> {
    return this.repository.deleteOptimization(optimizationId);
  }

  // ==================== Cloud Cost Collection ====================

  async collectCloudCosts(costs: CloudCostInput[]): Promise<CloudCostRecord[]> {
    const records = costs.map(c => ({
      provider: c.provider,
      resourceType: c.resourceType,
      resourceId: c.resourceId,
      resourceName: c.resourceName,
      region: c.region,
      cost: c.cost,
      currency: c.currency || 'USD',
      tags: c.tags,
      timestamp: c.timestamp,
      tenantId: c.tenantId,
      environment: c.environment,
      billingPeriod: c.billingPeriod,
    }));
    return this.repository.batchInsertCloudCosts(records);
  }

  async getCloudCosts(filter?: {
    provider?: CloudProvider;
    resourceType?: CloudResourceType;
    tenantId?: string;
    environment?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<CloudCostRecord[]> {
    return this.repository.getCloudCosts(filter);
  }

  // ==================== K8s Cost Allocation ====================

  async allocateK8sCosts(costs: K8sCostInput[]): Promise<K8sCostRecord[]> {
    const records = costs.map(c => ({
      namespace: c.namespace,
      deployment: c.deployment,
      podName: c.podName,
      cpuCost: c.cpuCost,
      memoryCost: c.memoryCost,
      storageCost: c.storageCost,
      networkCost: c.networkCost,
      totalCost: c.totalCost,
      tenantId: c.tenantId,
      timestamp: c.timestamp,
      clusterName: c.clusterName,
      nodeName: c.nodeName,
    }));
    return this.repository.batchInsertK8sCosts(records);
  }

  async getK8sCosts(filter?: {
    namespace?: string;
    deployment?: string;
    tenantId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<K8sCostRecord[]> {
    return this.repository.getK8sCosts(filter);
  }

  async getK8sNamespaceCosts(filter?: { namespace?: string }): Promise<{ namespace: string; total_cost: number }[]> {
    return this.repository.getK8sNamespaceCosts(filter);
  }

  async getK8sPodCosts(filter?: { namespace?: string; deployment?: string }): Promise<K8sCostRecord[]> {
    return this.repository.getK8sPodCosts(filter);
  }

  async getK8sTenantCosts(filter?: { tenantId?: string }): Promise<{ tenant_id: string; total_cost: number }[]> {
    return this.repository.getK8sTenantCosts(filter);
  }

  // ==================== SaaS Cost Tracking ====================

  async addSaaSSubscription(input: SaaSCostInput): Promise<SaaSCostRecord> {
    return this.repository.insertSaaSCost({
      tool: input.tool,
      subscription: input.subscription,
      seats: input.seats,
      unitCost: input.unitCost,
      totalCost: input.unitCost * input.seats,
      billingCycle: input.billingCycle,
      startDate: input.startDate,
      endDate: input.endDate,
      tenantId: input.tenantId,
      status: 'active',
      notes: input.notes,
    });
  }

  async updateSaaSSubscription(id: string, input: SaaSCostUpdate): Promise<SaaSCostRecord | null> {
    const updates: SaaSCostUpdate = { ...input };
    if (input.seats !== undefined && input.unitCost !== undefined) {
      updates.totalCost = input.seats * input.unitCost;
    }
    return this.repository.updateSaaSCost(id, updates);
  }

  async deleteSaaSSubscription(id: string): Promise<boolean> {
    return this.repository.deleteSaaSCost(id);
  }

  async getSaaSSubscriptions(filter?: { tool?: string; status?: string; tenantId?: string }): Promise<SaaSCostRecord[]> {
    return this.repository.getSaaSCosts(filter);
  }

  // ==================== Cost Aggregation ====================

  async getCostSummary(period: CostPeriod = 'monthly', filter?: { tenantId?: string }): Promise<CostSummary> {
    const { startDate, endDate } = this.getPeriodDates(period);

    // Get cloud costs
    const cloudCosts = await this.repository.getCloudCosts({
      tenantId: filter?.tenantId,
      startDate,
      endDate,
    });

    // Get K8s costs
    const k8sCosts = await this.repository.getK8sCosts({
      tenantId: filter?.tenantId,
      startDate,
      endDate,
    });

    // Calculate compute/storage/network
    const computeCost = cloudCosts
      .filter(r => ['compute', 'container', 'serverless'].includes(r.resource_type))
      .reduce((sum, r) => sum + r.cost, 0);

    const storageCost = cloudCosts
      .filter(r => r.resource_type === 'storage')
      .reduce((sum, r) => sum + r.cost, 0)
      + k8sCosts.reduce((sum, r) => sum + r.storage_cost, 0);

    const networkCost = cloudCosts
      .filter(r => r.resource_type === 'network')
      .reduce((sum, r) => sum + r.cost, 0)
      + k8sCosts.reduce((sum, r) => sum + r.network_cost, 0);

    // SaaS cost (active subscriptions monthly amortized)
    const activeSaaS = (await this.repository.getSaaSCosts({ status: 'active' }))
      .filter(r => !filter?.tenantId || r.tenant_id === filter.tenantId);

    const saasMonthlyCost = activeSaaS.reduce((sum, s) => {
      const monthsDiff = (s.end_date.getTime() - s.start_date.getTime()) / (30.44 * 24 * 60 * 60 * 1000);
      return sum + s.total_cost / Math.max(monthsDiff, 1);
    }, 0);

    const totalCost = computeCost + storageCost + networkCost + saasMonthlyCost;

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      computeCost: Math.round(computeCost * 100) / 100,
      storageCost: Math.round(storageCost * 100) / 100,
      networkCost: Math.round(networkCost * 100) / 100,
      saasCost: Math.round(saasMonthlyCost * 100) / 100,
      period,
      currency: 'USD',
      tenantId: filter?.tenantId,
    };
  }

  async getCostBreakdown(dimension: 'category' | 'tenant' | 'environment' | 'provider' | 'namespace', filter?: { tenantId?: string }): Promise<CostBreakdown[]> {
    const { startDate, endDate } = this.getPeriodDates('monthly');

    const cloudCosts = await this.repository.getCloudCosts({
      tenantId: filter?.tenantId,
      startDate,
      endDate,
    });
    const k8sCosts = await this.repository.getK8sCosts({
      tenantId: filter?.tenantId,
      startDate,
      endDate,
    });
    const activeSaaS = (await this.repository.getSaaSCosts({ status: 'active' }))
      .filter(r => !filter?.tenantId || r.tenant_id === filter.tenantId);

    let totalCost = 0;
    const dimensionMap = new Map<string, number>();

    // Cloud costs
    for (const cost of cloudCosts) {
      totalCost += cost.cost;
      let key: string;
      switch (dimension) {
        case 'category': key = cost.resource_type; break;
        case 'tenant': key = cost.tenant_id || 'unknown'; break;
        case 'environment': key = cost.environment || 'unknown'; break;
        case 'provider': key = cost.provider; break;
        default: key = 'unknown';
      }
      dimensionMap.set(key, (dimensionMap.get(key) || 0) + cost.cost);
    }

    // K8s costs
    for (const cost of k8sCosts) {
      totalCost += cost.total_cost;
      let key: string;
      switch (dimension) {
        case 'namespace': key = cost.namespace; break;
        case 'tenant': key = cost.tenant_id || 'unknown'; break;
        default: key = 'k8s';
      }
      dimensionMap.set(key, (dimensionMap.get(key) || 0) + cost.total_cost);
    }

    // SaaS costs
    const saasCost = activeSaaS.reduce((sum, s) => {
      const monthsDiff = (s.end_date.getTime() - s.start_date.getTime()) / (30.44 * 24 * 60 * 60 * 1000);
      return sum + s.total_cost / Math.max(monthsDiff, 1);
    }, 0);
    if (dimension === 'category') {
      dimensionMap.set('saas', saasCost);
    }
    totalCost += saasCost;

    const breakdowns: CostBreakdown[] = [];
    for (const [key, cost] of dimensionMap) {
      breakdowns.push({
        dimension,
        dimensionValue: key,
        cost: Math.round(cost * 100) / 100,
        percentage: totalCost > 0 ? Math.round((cost / totalCost) * 10000) / 100 : 0,
        recordCount: 1,
      });
    }

    breakdowns.sort((a, b) => b.cost - a.cost);
    return breakdowns;
  }

  async computeCostTrendFromData(dataPoints: { date: Date; cost: number }[]): Promise<{ points: { date: Date; cost: number; changeRate: number }[]; overallChangeRate: number; averageCost: number; maxCost: number; minCost: number }> {
    const trend = this.computeTrend(dataPoints.map(d => ({ date: d.date, cost: d.cost })));
    return {
      points: trend.points,
      overallChangeRate: trend.overallChangeRate,
      averageCost: trend.averageCost,
      maxCost: trend.maxCost,
      minCost: trend.minCost,
    };
  }

  // ==================== Legacy Budget Alerts ====================

  async createLegacyBudgetAlert(input: LegacyBudgetAlertInput): Promise<LegacyBudgetAlertRecord> {
    return this.repository.createLegacyBudgetAlert({
      budgetAmount: input.budgetAmount,
      thresholdPercent: input.thresholdPercent,
      tenantId: input.tenantId,
      environment: input.environment,
      currency: input.currency || 'USD',
      period: input.period || 'monthly',
    });
  }

  async getLegacyBudgetAlerts(filter?: { tenantId?: string; environment?: string }): Promise<LegacyBudgetAlertRecord[]> {
    return this.repository.getLegacyBudgetAlerts(filter);
  }

  async deleteLegacyBudgetAlert(id: string): Promise<boolean> {
    return this.repository.deleteLegacyBudgetAlert(id);
  }

  async checkLegacyBudgetAlerts(): Promise<{
    alertId: string;
    tenantId?: string;
    budgetAmount: number;
    currentSpend: number;
    usagePercent: number;
    thresholdPercent: number;
    triggeredAt: Date;
  }[]> {
    const alerts = await this.repository.getLegacyBudgetAlerts();
    const triggered: any[] = [];

    for (const alert of alerts) {
      // Get current spend from cost summary
      const summary = await this.getCostSummary(alert.period as CostPeriod, { tenantId: alert.tenant_id || undefined });
      const currentSpend = summary.totalCost;
      const usagePercent = alert.budget_amount > 0 ? (currentSpend / alert.budget_amount) * 100 : 0;

      if (usagePercent >= alert.threshold_percent && !alert.triggered) {
        // Update the alert's current spend
        await this.repository.updateLegacyBudgetAlertSpend(alert.id, currentSpend);

        triggered.push({
          alertId: alert.id,
          tenantId: alert.tenant_id || undefined,
          budgetAmount: alert.budget_amount,
          currentSpend: Math.round(currentSpend * 100) / 100,
          usagePercent: Math.round(usagePercent * 100) / 100,
          thresholdPercent: alert.threshold_percent,
          triggeredAt: new Date(),
        });
      }
    }

    return triggered;
  }

  // ==================== Private helpers ====================

  private computeTrend(dataPoints: { date: Date; cost: number }[]): CostTrend {
    if (dataPoints.length === 0) {
      return { points: [], overallChangeRate: 0, averageCost: 0, maxCost: 0, minCost: 0 };
    }

    const sorted = [...dataPoints].sort((a, b) => a.date.getTime() - b.date.getTime());
    const points: CostTrendPoint[] = [];

    for (let i = 0; i < sorted.length; i++) {
      let changeRate = 0;
      if (i > 0 && sorted[i - 1].cost > 0) {
        changeRate = ((sorted[i].cost - sorted[i - 1].cost) / sorted[i - 1].cost) * 100;
      }
      points.push({
        date: sorted[i].date,
        cost: sorted[i].cost,
        changeRate: Math.round(changeRate * 100) / 100,
      });
    }

    const costs = sorted.map(p => p.cost);
    const totalCost = costs.reduce((sum, c) => sum + c, 0);
    const firstCost = sorted[0].cost;
    const lastCost = sorted[sorted.length - 1].cost;
    const overallChangeRate = firstCost > 0 ? ((lastCost - firstCost) / firstCost) * 100 : 0;

    return {
      points,
      overallChangeRate: Math.round(overallChangeRate * 100) / 100,
      averageCost: Math.round((totalCost / costs.length) * 100) / 100,
      maxCost: Math.max(...costs),
      minCost: Math.min(...costs),
    };
  }

  private getPeriodDates(period: CostPeriod): { startDate: Date; endDate: Date } {
    const now = new Date();
    const endDate = now;
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarterly':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'yearly':
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }

  private getPeriodDays(period: CostPeriod): number {
    switch (period) {
      case 'daily': return 1;
      case 'weekly': return 7;
      case 'monthly': return 30;
      case 'quarterly': return 90;
      case 'yearly': return 365;
      default: return 30;
    }
  }

  // CostOptimizer helpers
  private isUnused(util: ResourceUtilization): boolean {
    return util.cpuUtilization < 5 && util.memoryUtilization < 5 && util.storageUtilization < 5;
  }

  private isUnderutilized(util: ResourceUtilization): boolean {
    return util.cpuUtilization < 30 || util.memoryUtilization < 30;
  }

  private isSchedulable(util: ResourceUtilization): boolean {
    return util.environment !== 'production' && util.cpuUtilization < 50 && util.memoryUtilization < 50;
  }

  private createUnusedResourceSuggestion(util: ResourceUtilization): Parameters<FinOpsRepository['batchInsertOptimizations']>[0][0] {
    return {
      category: 'unused-resources',
      description: `Resource "${util.resourceName}" (${util.resourceId}) is unused. CPU: ${util.cpuUtilization}%, Memory: ${util.memoryUtilization}%, Storage: ${util.storageUtilization}%. Consider terminating or releasing this resource.`,
      estimatedSavings: util.monthlyCost,
      effort: 1,
      priority: 'critical',
      status: 'identified',
      resourceIds: [util.resourceId],
      entityId: util.tenantId,
      entityType: 'tenant',
      notes: `Environment: ${util.environment || 'unknown'}`,
    };
  }

  private createRightSizingSuggestion(util: ResourceUtilization): Parameters<FinOpsRepository['batchInsertOptimizations']>[0][0] {
    const savings = util.monthlyCost * 0.3;
    return {
      category: 'right-sizing',
      description: `Resource "${util.resourceName}" (${util.resourceId}) is underutilized. CPU: ${util.cpuUtilization}%, Memory: ${util.memoryUtilization}%. Right-sizing could save ~$${Math.round(savings)}/month.`,
      estimatedSavings: Math.round(savings * 100) / 100,
      effort: 2,
      priority: savings > 100 ? 'high' : 'medium',
      status: 'identified',
      resourceIds: [util.resourceId],
      entityId: util.tenantId,
      entityType: 'tenant',
      notes: undefined,
    };
  }

  private createSchedulingSuggestion(util: ResourceUtilization): Parameters<FinOpsRepository['batchInsertOptimizations']>[0][0] {
    const estimatedSavings = util.monthlyCost * 0.4;
    return {
      category: 'scheduling',
      description: `Resource "${util.resourceName}" in ${util.environment} environment has low utilization. Consider scheduling to run only during business hours.`,
      estimatedSavings: Math.round(estimatedSavings * 100) / 100,
      effort: 3,
      priority: 'medium',
      status: 'identified',
      resourceIds: [util.resourceId],
      entityId: util.tenantId,
      entityType: 'tenant',
      notes: `Estimated savings: ${Math.round(estimatedSavings)} USD/month by scheduling to business hours only.`,
    };
  }
}
