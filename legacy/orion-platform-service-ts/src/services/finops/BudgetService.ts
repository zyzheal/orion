/**
 * TASK-502: 预算管理服务
 *
 * 按实体配置预算、阈值告警检查、预算预测
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CostBudget,
  BudgetThreshold,
  BudgetAlertTrigger,
  CostEntityType,
  CostPeriod,
} from './types';
import { BudgetRepository, BudgetEntity } from '../../repositories/BudgetRepository';
import { BudgetSpendRepository } from '../../repositories/BudgetSpendRepository';
import { BudgetAlertTriggerRepository } from '../../repositories/BudgetAlertTriggerRepository';
import { OrionError, ErrorCode } from '../../errors';

/**
 * 预算状态
 */
export interface BudgetStatus {
  /** 预算 ID */
  budgetId: string;
  /** 实体类型 */
  entityType: CostEntityType;
  /** 实体 ID */
  entityId: string;
  /** 预算金额 */
  budgetAmount: number;
  /** 当前已用 */
  currentSpend: number;
  /** 使用率百分比 */
  usagePercent: number;
  /** 剩余金额 */
  remaining: number;
  /** 周期 */
  period: CostPeriod;
  /** 是否超预算 */
  overBudget: boolean;
  /** 已触发的告警 */
  triggeredAlerts: BudgetAlertTrigger[];
  /** 预测月末花费 */
  forecastedSpend?: number;
}

/**
 * 预算预测结果
 */
export interface BudgetForecast {
  /** 预算 ID */
  budgetId: string;
  /** 当前已用 */
  currentSpend: number;
  /** 预测周期结束时的花费 */
  forecastedSpend: number;
  /** 预测超支金额 */
  projectedOverage: number;
  /** 日均花费 */
  dailySpendRate: number;
  /** 距离预算耗尽天数 */
  daysUntilExhausted: number;
  /** 是否在预算内 */
  withinBudget: boolean;
  /** 历史数据点 */
  history: { date: Date; cumulativeCost: number }[];
}

/**
 * 预算管理参数
 */
export interface CreateBudgetParams {
  entityType: CostEntityType;
  entityId: string;
  amount: number;
  period: CostPeriod;
  currency?: string;
  alerts?: { percentage: number }[];
  environment?: string;
  description?: string;
}

/**
 * 预算管理参数
 */
export interface UpdateBudgetParams {
  amount?: number;
  period?: CostPeriod;
  alerts?: { percentage: number }[];
  environment?: string;
  description?: string;
}

/**
 * 预算管理
 *
 * 提供预算 CRUD、阈值告警检查、预算预测功能
 */
export class BudgetService {
  private budgetRepo: BudgetRepository;
  private spendRepo: BudgetSpendRepository;
  private alertTriggerRepo: BudgetAlertTriggerRepository;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.budgetRepo = new BudgetRepository(db);
    this.spendRepo = new BudgetSpendRepository(db);
    this.alertTriggerRepo = new BudgetAlertTriggerRepository(db);
  }

  /**
   * 创建预算
   */
  async createBudget(params: CreateBudgetParams): Promise<CostBudget> {
    const defaultThresholds = params.alerts || [
      { percentage: 50 },
      { percentage: 75 },
      { percentage: 90 },
      { percentage: 100 },
    ];

    const thresholds: BudgetThreshold[] = defaultThresholds.map((t) => ({
      id: uuidv4(),
      percentage: t.percentage,
      triggered: false,
    }));

    const id = uuidv4();
    await this.budgetRepo.create({
      id,
      name: `${params.entityType}:${params.entityId}`,
      type: params.entityType,
      scope: params.entityId,
      period: params.period,
      amount: params.amount,
      thresholds: thresholds.reduce((acc, t) => {
        acc[t.id] = t.percentage;
        return acc;
      }, {} as Record<string, number>),
      status: 'active',
      spent: 0,
    } as any);

    const budget: CostBudget = {
      id,
      entityType: params.entityType,
      entityId: params.entityId,
      amount: params.amount,
      period: params.period,
      currency: params.currency || 'USD',
      alerts: thresholds,
      createdAt: new Date(),
      environment: params.environment,
      description: params.description,
    };

    return budget;
  }

  /**
   * 更新预算
   */
  async updateBudget(budgetId: string, params: UpdateBudgetParams): Promise<CostBudget | null> {
    const existing = await this.budgetRepo.findById(budgetId);
    if (!existing) return null;

    const updates: any = {};
    if (params.amount !== undefined) {
      updates.amount = params.amount;
    }
    if (params.period !== undefined) {
      updates.period = params.period;
    }
    if (params.alerts !== undefined) {
      const thresholds: BudgetThreshold[] = params.alerts.map((t) => ({
        id: uuidv4(),
        percentage: t.percentage,
        triggered: false,
      }));
      updates.thresholds = thresholds.reduce((acc, t) => {
        acc[t.id] = t.percentage;
        return acc;
      }, {} as Record<string, number>);
    }

    const updated = await this.budgetRepo.update(budgetId, updates);
    if (!updated) {
      throw new OrionError(`Budget not found: ${budgetId}`, ErrorCode.NOT_FOUND);
    }

    return {
      id: updated.id,
      entityType: updated.type as CostEntityType,
      entityId: updated.scope,
      amount: updated.amount,
      period: updated.period as CostPeriod,
      currency: 'USD',
      alerts: Object.entries(updated.thresholds).map(([id, percentage]) => ({
        id,
        percentage: percentage as number,
        triggered: false,
      })),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * 删除预算
   */
  async deleteBudget(budgetId: string): Promise<boolean> {
    return this.budgetRepo.delete(budgetId);
  }

  /**
   * 获取预算
   */
  async getBudget(budgetId: string): Promise<CostBudget | undefined> {
    const entity = await this.budgetRepo.findById(budgetId);
    if (!entity) return undefined;

    return {
      id: entity.id,
      entityType: entity.type as CostEntityType,
      entityId: entity.scope,
      amount: entity.amount,
      period: entity.period as CostPeriod,
      currency: 'USD',
      alerts: Object.entries(entity.thresholds).map(([id, percentage]) => ({
        id,
        percentage: percentage as number,
        triggered: false,
      })),
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /**
   * 获取所有预算
   */
  async listBudgets(filter?: {
    entityType?: CostEntityType;
    entityId?: string;
  }): Promise<CostBudget[]> {
    const where: Record<string, any> = {};
    if (filter?.entityType) {
      where.type = filter.entityType;
    }
    if (filter?.entityId) {
      where.scope = filter.entityId;
    }

    const { entities } = await this.budgetRepo.findAll({
      where,
      limit: 1000,
    });

    return entities.map((entity) => ({
      id: entity.id,
      entityType: entity.type as CostEntityType,
      entityId: entity.scope,
      amount: entity.amount,
      period: entity.period as CostPeriod,
      currency: 'USD',
      alerts: Object.entries(entity.thresholds).map(([id, percentage]) => ({
        id,
        percentage: percentage as number,
        triggered: false,
      })),
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    }));
  }

  /**
   * 更新实体花费
   */
  async updateEntitySpend(entityType: CostEntityType, entityId: string, amount: number): Promise<void> {
    await this.spendRepo.create({
      id: uuidv4(),
      entityType,
      entityId,
      amount,
      recordedAt: new Date(),
      windowStart: null,
      windowEnd: null,
    });
  }

  /**
   * 检查预算告警
   *
   * 检查所有预算是否触发阈值告警
   *
   * @returns 触发的告警列表
   */
  async checkBudgetAlerts(): Promise<BudgetAlertTrigger[]> {
    const triggered: BudgetAlertTrigger[] = [];
    const { entities: budgets } = await this.budgetRepo.findAll({ limit: 1000 });

    for (const budget of budgets) {
      const totalSpend = await this.spendRepo.getTotalSpend(budget.type, budget.scope);
      const usagePercent = budget.amount > 0 ? (totalSpend / budget.amount) * 100 : 0;

      const thresholds = budget.thresholds;
      for (const [thresholdId, percentage] of Object.entries(thresholds)) {
        const pct = percentage as number;
        if (usagePercent >= pct) {
          // Check if already triggered
          const existingTriggers = await this.alertTriggerRepo.findByBudgetId(budget.id);
          const alreadyTriggered = existingTriggers.some(
            (t) => t.threshold === pct && t.entityType === budget.type && t.entityId === budget.scope
          );

          if (!alreadyTriggered) {
            const alert: BudgetAlertTrigger = {
              id: uuidv4(),
              budgetId: budget.id,
              threshold: pct,
              actual: Math.round(totalSpend * 100) / 100,
              percentage: Math.round(usagePercent * 100) / 100,
              triggeredAt: new Date(),
              entityType: budget.type as CostEntityType,
              entityId: budget.scope,
            };

            await this.alertTriggerRepo.create({
              id: alert.id,
              budgetId: alert.budgetId,
              threshold: alert.threshold,
              actual: alert.actual,
              percentage: alert.percentage,
              entityType: alert.entityType,
              entityId: alert.entityId,
              triggeredAt: alert.triggeredAt,
            });

            triggered.push(alert);
          }
        }
      }
    }

    return triggered;
  }

  /**
   * 获取预算状态
   */
  async getBudgetStatus(budgetId: string): Promise<BudgetStatus | null> {
    const budget = await this.budgetRepo.findById(budgetId);
    if (!budget) return null;

    const totalSpend = await this.spendRepo.getTotalSpend(budget.type, budget.scope);
    const usagePercent = budget.amount > 0 ? (totalSpend / budget.amount) * 100 : 0;
    const remaining = budget.amount - totalSpend;

    const triggeredAlertEntities = await this.alertTriggerRepo.findByBudgetId(budgetId);
    const triggeredAlerts: BudgetAlertTrigger[] = triggeredAlertEntities.map((t) => ({
      id: t.id,
      budgetId: t.budgetId,
      threshold: t.threshold,
      actual: t.actual,
      percentage: t.percentage,
      triggeredAt: t.triggeredAt,
      entityType: t.entityType as CostEntityType,
      entityId: t.entityId,
    }));

    // 尝试获取预测
    const forecast = await this.forecastBudget(budgetId);

    return {
      budgetId: budget.id,
      entityType: budget.type as CostEntityType,
      entityId: budget.scope,
      budgetAmount: budget.amount,
      currentSpend: Math.round(totalSpend * 100) / 100,
      usagePercent: Math.round(usagePercent * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      period: budget.period as CostPeriod,
      overBudget: totalSpend > budget.amount,
      triggeredAlerts,
      forecastedSpend: forecast?.forecastedSpend,
    };
  }

  /**
   * 预算预测
   *
   * 基于历史花费数据预测周期结束时的总花费
   */
  async forecastBudget(budgetId: string): Promise<BudgetForecast | null> {
    const budget = await this.budgetRepo.findById(budgetId);
    if (!budget) return null;

    const spendRecords = await this.spendRepo.findByEntity(budget.type, budget.scope);
    const totalSpend = await this.spendRepo.getTotalSpend(budget.type, budget.scope);

    // Build history from spend records
    const history = spendRecords.map((r) => ({
      date: r.recordedAt,
      cumulativeCost: r.amount,
    }));

    // 计算日均花费
    let dailySpendRate = 0;
    if (history.length >= 2) {
      const first = history[0];
      const last = history[history.length - 1];
      const daysDiff =
        (last.date.getTime() - first.date.getTime()) / (24 * 60 * 60 * 1000);
      const costDiff = last.cumulativeCost - first.cumulativeCost;
      dailySpendRate = daysDiff > 0 ? costDiff / daysDiff : 0;
    } else if (totalSpend > 0) {
      const periodDays = this.getPeriodDays(budget.period as CostPeriod);
      dailySpendRate = totalSpend / Math.max(periodDays, 1);
    }

    // 预测剩余天数
    const periodDays = this.getPeriodDays(budget.period as CostPeriod);
    const elapsedDays = history.length > 1
      ? (history[history.length - 1].date.getTime() - history[0].date.getTime()) /
        (24 * 60 * 60 * 1000)
      : 0;
    const remainingDays = Math.max(periodDays - elapsedDays, 0);

    const forecastedSpend = totalSpend + dailySpendRate * remainingDays;
    const projectedOverage = Math.max(forecastedSpend - budget.amount, 0);

    // 距离预算耗尽天数
    const daysUntilExhausted =
      dailySpendRate > 0
        ? (budget.amount - totalSpend) / dailySpendRate
        : Infinity;

    return {
      budgetId: budget.id,
      currentSpend: Math.round(totalSpend * 100) / 100,
      forecastedSpend: Math.round(forecastedSpend * 100) / 100,
      projectedOverage: Math.round(projectedOverage * 100) / 100,
      dailySpendRate: Math.round(dailySpendRate * 100) / 100,
      daysUntilExhausted:
        daysUntilExhausted === Infinity ? -1 : Math.round(daysUntilExhausted),
      withinBudget: forecastedSpend <= budget.amount,
      history,
    };
  }

  /**
   * 获取所有告警触发记录
   */
  async getAlertTriggers(filter?: {
    budgetId?: string;
    entityType?: CostEntityType;
  }): Promise<BudgetAlertTrigger[]> {
    let entities;

    if (filter?.budgetId) {
      entities = await this.alertTriggerRepo.findByBudgetId(filter.budgetId);
    } else if (filter?.entityType) {
      entities = await this.alertTriggerRepo.findByEntityType(filter.entityType);
    } else {
      const { entities: all } = await this.alertTriggerRepo.findAll({ limit: 1000 });
      entities = all;
    }

    return entities
      .map((t) => ({
        id: t.id,
        budgetId: t.budgetId,
        threshold: t.threshold,
        actual: t.actual,
        percentage: t.percentage,
        triggeredAt: t.triggeredAt,
        entityType: t.entityType as CostEntityType,
        entityId: t.entityId,
      }))
      .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
  }

  // ==================== 私有方法 ====================

  /**
   * 获取周期对应的天数
   */
  private getPeriodDays(period: CostPeriod): number {
    switch (period) {
      case 'daily':
        return 1;
      case 'weekly':
        return 7;
      case 'monthly':
        return 30;
      case 'quarterly':
        return 90;
      case 'yearly':
        return 365;
      default:
        return 30;
    }
  }
}
