// @ts-nocheck
/**
 * FinOpsAlertService - 告警管理
 *
 * 职责：预算告警检查、预算状态查询、预算预测、遗留预算告警
 */
import { FinOpsRepository, AlertTriggerRecord, LegacyBudgetAlertRecord } from './FinOpsRepository';
import { CostPeriod, CostEntityType, BudgetStatus, BudgetForecast } from './types';
import { getPeriodDates, getPeriodDays } from './FinOpsUtils';
import { createLogger } from '../../utils/logger';

export interface LegacyBudgetAlertInput {
  budgetAmount: number;
  thresholdPercent: number;
  tenantId?: string;
  environment?: string;
  currency?: string;
  period?: CostPeriod;
}

export class FinOpsAlertService {
  private repository: FinOpsRepository;
  private readonly logger = createLogger('finops-alert-service');

  constructor(repository: FinOpsRepository) {
    this.repository = repository;
  }

  // ==================== Budget Alerts ====================

  async checkBudgetAlerts(): Promise<AlertTriggerRecord[]> {
    const budgets = await this.repository.listBudgets();
    const triggered: AlertTriggerRecord[] = [];

    for (const budget of budgets) {
      const currentSpend = await this.repository.getCurrentSpend(budget.entity_type, budget.entity_id);
      const usagePercent = budget.amount > 0 ? (currentSpend / budget.amount) * 100 : 0;

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

    let dailySpendRate = 0;
    if (history.length >= 2) {
      const first = history[0];
      const last = history[history.length - 1];
      const daysDiff = (last.date.getTime() - first.date.getTime()) / (24 * 60 * 60 * 1000);
      const costDiff = last.cumulativeCost - first.cumulativeCost;
      dailySpendRate = daysDiff > 0 ? costDiff / daysDiff : 0;
    } else if (currentSpend > 0) {
      const periodDays = getPeriodDays(budget.period);
      dailySpendRate = currentSpend / Math.max(periodDays, 1);
    }

    const periodDays = getPeriodDays(budget.period);
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

  async checkLegacyBudgetAlerts(): Promise<any[]> {
    const alerts = await this.repository.getLegacyBudgetAlerts();
    const triggered: any[] = [];

    for (const alert of alerts) {
      const summary = await this.getCostSummaryFromRepository(alert.period as CostPeriod, { tenantId: alert.tenant_id || undefined });
      const currentSpend = summary.totalCost;
      const usagePercent = alert.budget_amount > 0 ? (currentSpend / alert.budget_amount) * 100 : 0;

      if (usagePercent >= alert.threshold_percent && !alert.triggered) {
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

}
