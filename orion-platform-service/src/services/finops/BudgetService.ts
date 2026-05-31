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
import { BudgetRepository } from '../../repositories/BudgetRepository';
import { BudgetSpendRepository } from '../../repositories/BudgetSpendRepository';

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
  /** 预算存储 */
  private budgets: CostBudget[] = [];

  /** 告警触发记录 */
  private alertTriggers: BudgetAlertTrigger[] = [];

  /** 实体当前花费 */
  private entitySpend: Map<string, number> = new Map();

  /** 实体花费历史 */
  private spendHistory: Map<
    string,
    { date: Date; cumulativeCost: number }[]
  > = new Map();

  private budgetRepo?: BudgetRepository;
  private spendRepo?: BudgetSpendRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.budgetRepo = new BudgetRepository(db);
      this.spendRepo = new BudgetSpendRepository(db);
    }
  }

  /**
   * 创建预算
   */
  createBudget(params: CreateBudgetParams): CostBudget {
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

    const budget: CostBudget = {
      id: uuidv4(),
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

    this.budgets.push(budget);
    return budget;
  }

  /**
   * 更新预算
   */
  updateBudget(budgetId: string, params: UpdateBudgetParams): CostBudget | null {
    const budget = this.budgets.find((b) => b.id === budgetId);
    if (!budget) return null;

    if (params.amount !== undefined) {
      budget.amount = params.amount;
    }
    if (params.period !== undefined) {
      budget.period = params.period;
    }
    if (params.alerts !== undefined) {
      budget.alerts = params.alerts.map((t) => ({
        id: uuidv4(),
        percentage: t.percentage,
        triggered: false,
      }));
    }
    if (params.environment !== undefined) {
      budget.environment = params.environment;
    }
    if (params.description !== undefined) {
      budget.description = params.description;
    }

    budget.updatedAt = new Date();
    return budget;
  }

  /**
   * 删除预算
   */
  deleteBudget(budgetId: string): boolean {
    const index = this.budgets.findIndex((b) => b.id === budgetId);
    if (index === -1) return false;
    this.budgets.splice(index, 1);
    return true;
  }

  /**
   * 获取预算
   */
  getBudget(budgetId: string): CostBudget | undefined {
    return this.budgets.find((b) => b.id === budgetId);
  }

  /**
   * 获取所有预算
   */
  listBudgets(filter?: {
    entityType?: CostEntityType;
    entityId?: string;
  }): CostBudget[] {
    let budgets = [...this.budgets];

    if (filter?.entityType) {
      budgets = budgets.filter((b) => b.entityType === filter.entityType);
    }
    if (filter?.entityId) {
      budgets = budgets.filter((b) => b.entityId === filter.entityId);
    }

    return budgets;
  }

  /**
   * 更新实体花费
   */
  updateEntitySpend(entityType: CostEntityType, entityId: string, amount: number): void {
    const key = `${entityType}:${entityId}`;
    this.entitySpend.set(key, amount);

    // 记录历史
    if (!this.spendHistory.has(key)) {
      this.spendHistory.set(key, []);
    }
    this.spendHistory.get(key)!.push({
      date: new Date(),
      cumulativeCost: amount,
    });
  }

  /**
   * 检查预算告警
   *
   * 检查所有预算是否触发阈值告警
   *
   * @returns 触发的告警列表
   */
  checkBudgetAlerts(): BudgetAlertTrigger[] {
    const triggered: BudgetAlertTrigger[] = [];

    for (const budget of this.budgets) {
      const key = `${budget.entityType}:${budget.entityId}`;
      const currentSpend = this.entitySpend.get(key) || 0;
      const usagePercent =
        budget.amount > 0 ? (currentSpend / budget.amount) * 100 : 0;

      for (const threshold of budget.alerts) {
        if (usagePercent >= threshold.percentage && !threshold.triggered) {
          threshold.triggered = true;
          threshold.triggeredAt = new Date();

          const alert: BudgetAlertTrigger = {
            id: uuidv4(),
            budgetId: budget.id,
            threshold: threshold.percentage,
            actual: Math.round(currentSpend * 100) / 100,
            percentage: Math.round(usagePercent * 100) / 100,
            triggeredAt: new Date(),
            entityType: budget.entityType,
            entityId: budget.entityId,
          };

          triggered.push(alert);
          this.alertTriggers.push(alert);
        }
      }
    }

    return triggered;
  }

  /**
   * 获取预算状态
   */
  getBudgetStatus(budgetId: string): BudgetStatus | null {
    const budget = this.budgets.find((b) => b.id === budgetId);
    if (!budget) return null;

    const key = `${budget.entityType}:${budget.entityId}`;
    const currentSpend = this.entitySpend.get(key) || 0;
    const usagePercent =
      budget.amount > 0 ? (currentSpend / budget.amount) * 100 : 0;
    const remaining = budget.amount - currentSpend;

    const triggeredAlerts = this.alertTriggers.filter(
      (a) => a.budgetId === budgetId
    );

    // 尝试获取预测
    const forecast = this.forecastBudget(budgetId);

    return {
      budgetId: budget.id,
      entityType: budget.entityType,
      entityId: budget.entityId,
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

  /**
   * 预算预测
   *
   * 基于历史花费数据预测周期结束时的总花费
   */
  forecastBudget(budgetId: string): BudgetForecast | null {
    const budget = this.budgets.find((b) => b.id === budgetId);
    if (!budget) return null;

    const key = `${budget.entityType}:${budget.entityId}`;
    const history = this.spendHistory.get(key) || [];
    const currentSpend = this.entitySpend.get(key) || 0;

    // 计算日均花费
    let dailySpendRate = 0;
    if (history.length >= 2) {
      const first = history[0];
      const last = history[history.length - 1];
      const daysDiff =
        (last.date.getTime() - first.date.getTime()) / (24 * 60 * 60 * 1000);
      const costDiff = last.cumulativeCost - first.cumulativeCost;
      dailySpendRate = daysDiff > 0 ? costDiff / daysDiff : 0;
    } else if (currentSpend > 0) {
      // 只有一条记录，用当前花费估算
      const periodDays = this.getPeriodDays(budget.period);
      dailySpendRate = currentSpend / Math.max(periodDays, 1);
    }

    // 预测剩余天数
    const periodDays = this.getPeriodDays(budget.period);
    const elapsedDays = history.length > 1
      ? (history[history.length - 1].date.getTime() - history[0].date.getTime()) /
        (24 * 60 * 60 * 1000)
      : 0;
    const remainingDays = Math.max(periodDays - elapsedDays, 0);

    const forecastedSpend = currentSpend + dailySpendRate * remainingDays;
    const projectedOverage = Math.max(forecastedSpend - budget.amount, 0);

    // 距离预算耗尽天数
    const daysUntilExhausted =
      dailySpendRate > 0
        ? (budget.amount - currentSpend) / dailySpendRate
        : Infinity;

    return {
      budgetId: budget.id,
      currentSpend: Math.round(currentSpend * 100) / 100,
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
  getAlertTriggers(filter?: {
    budgetId?: string;
    entityType?: CostEntityType;
  }): BudgetAlertTrigger[] {
    let triggers = [...this.alertTriggers];

    if (filter?.budgetId) {
      triggers = triggers.filter((t) => t.budgetId === filter.budgetId);
    }
    if (filter?.entityType) {
      triggers = triggers.filter((t) => t.entityType === filter.entityType);
    }

    return triggers.sort(
      (a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime()
    );
  }

  /**
   * 清空所有数据
   */
  clearAll(): void {
    this.budgets = [];
    this.alertTriggers = [];
    this.entitySpend.clear();
    this.spendHistory.clear();
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
