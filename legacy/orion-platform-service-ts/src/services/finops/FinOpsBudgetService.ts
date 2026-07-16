/**
 * FinOpsBudgetService - Budget management, ROI analysis, and cost comparison
 *
 * Extracted from FinOpsService. Handles:
 * - Budget CRUD with default alerts
 * - ROI calculation and automation savings analysis
 * - Period-over-period cost comparison
 * - ROI history and summary queries
 *
 * Stateless service: takes repository, returns results.
 */

import { FinOpsRepository } from './FinOpsRepository';
import type {
  BudgetInput,
  BudgetUpdateInput,
  ROIInput,
  PeriodComparisonInput,
  CostPeriod,
  CostEntityType,
} from './types';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';

export class FinOpsBudgetService {
  private repository: FinOpsRepository;
  private readonly logger = createLogger('finops-budget-service');

  constructor(repository: FinOpsRepository) {
    this.repository = repository;
  }

  // ==================== Budget Management ====================

  async createBudget(input: BudgetInput): Promise<any> {
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

  async updateBudget(budgetId: string, input: BudgetUpdateInput): Promise<any> {
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

  async getBudget(budgetId: string): Promise<any> {
    return this.repository.getBudget(budgetId);
  }

  async listBudgets(filter?: { entityType?: CostEntityType; entityId?: string }): Promise<any[]> {
    return this.repository.listBudgets(filter);
  }

  async updateEntitySpend(entityType: CostEntityType, entityId: string, amount: number): Promise<any> {
    return this.repository.recordSpend(entityType, entityId, amount);
  }

  // ==================== ROI Analysis ====================

  async calculateROI(input: ROIInput): Promise<any> {
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
  }): Promise<any> {
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

  async comparePeriods(input: PeriodComparisonInput): Promise<any> {
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

  async compareCosts(tenantId: string, serviceA: string, serviceB: string, period: CostPeriod): Promise<any> {
    this.logger.info({ tenantId, serviceA, serviceB, period }, '[FinOpsBudgetService] Comparing costs between two services');

    const { startDate, endDate } = this.getPeriodDates(period);

    const costsA = await this.repository.getCloudCosts({ tenantId, startDate, endDate });
    const costsB = await this.repository.getCloudCosts({ tenantId, startDate, endDate });

    const sumCosts = (records: any[], serviceId: string): number => {
      return records
        .filter((r: any) => r.resource_id === serviceId)
        .reduce((sum: number, r: any) => sum + r.cost, 0);
    };

    const costA = sumCosts(costsA, serviceA);
    const costB = sumCosts(costsB, serviceB);

    const savings = costA - costB;
    const savingsPercent = costA > 0 ? (savings / costA) * 100 : 0;
    const description = `Cost comparison between ${serviceA} and ${serviceB} for ${period} period`;

    this.logger.info({ tenantId, serviceA, serviceB, costA, costB, savings, savingsPercent }, '[FinOpsBudgetService] Cost comparison completed');

    return this.repository.insertCostComparison({
      description,
      beforeCost: Math.round(costA * 100) / 100,
      afterCost: Math.round(costB * 100) / 100,
      savings: Math.round(savings * 100) / 100,
      savingsPercent: Math.round(savingsPercent * 100) / 100,
      period,
    });
  }

  async getROIHistory(filter?: { investmentType?: string; minROI?: number }): Promise<any[]> {
    return this.repository.getROIHistory(filter);
  }

  async getCostComparisons(filter?: { period?: CostPeriod }): Promise<any[]> {
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

  // ==================== Private helpers ====================

  private getPeriodDates(period: CostPeriod): { startDate: Date; endDate: Date } {
    const { getPeriodDates } = require('./FinOpsUtils');
    return getPeriodDates(period);
  }
}
