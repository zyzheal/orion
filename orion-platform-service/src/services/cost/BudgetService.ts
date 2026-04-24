/**
 * Budget Service - 预算管理、成本追踪、配额限制
 */

import {
  Budget,
  BudgetCreateInput,
  BudgetUpdateInput,
  createBudget,
  CostRecord,
  CostRecordCreateInput,
  createCostRecord,
  AlertRule,
  AlertRuleCreateInput,
  createAlertRule,
  ModelPricing,
  ModelPricingCreateInput,
  createModelPricing,
  AlertStatus,
  BudgetStatus,
} from '../../models/CostRecord';
import { BudgetRepository, BudgetEntity } from '../../repositories/BudgetRepository';

export interface BudgetListFilter {
  type?: string;
  scope?: string;
  status?: BudgetStatus;
  page?: number;
  perPage?: number;
}

export interface CostQueryFilter {
  tenantId?: string;
  projectId?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  model?: string;
  provider?: string;
  moduleType?: string;
  page?: number;
  perPage?: number;
}

export interface CostSummary {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  costByModel: Record<string, number>;
  costByProvider: Record<string, number>;
  costByTenant: Record<string, number>;
  costByModule: Record<string, number>;
}

export class BudgetService {
  private budgetRepository?: BudgetRepository;
  private costRecords: Map<string, CostRecord> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private modelPricing: Map<string, ModelPricing> = new Map();

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.budgetRepository = new BudgetRepository(db);
    }
  }

  // ==================== Budget CRUD ====================

  async createBudget(input: BudgetCreateInput): Promise<Budget> {
    const budget = createBudget(input);
    if (this.budgetRepository) {
      const entity = await this.budgetRepository.create({
        id: budget.id,
        name: budget.name,
        type: budget.type,
        scope: budget.scope,
        period: budget.period,
        amount: budget.amount,
        thresholds: budget.thresholds,
        status: budget.status,
        spent: budget.spent,
        createdAt: budget.createdAt,
        updatedAt: budget.updatedAt,
      });
      return this.mapEntityToBudget(entity);
    }
    return budget;
  }

  async getBudgetById(id: string): Promise<Budget | undefined> {
    if (this.budgetRepository) {
      const entity = await this.budgetRepository.findById(id);
      return entity ? this.mapEntityToBudget(entity) : undefined;
    }
    // Memory fallback removed - use Repository
    return undefined;
  }

  async listBudgets(filter: BudgetListFilter = {}): Promise<{ budgets: Budget[]; total: number }> {
    if (this.budgetRepository) {
      let items = await this.budgetRepository.findAll();

      if (filter.type) {
        items = items.filter((b) => b.type === filter.type);
      }
      if (filter.scope) {
        items = items.filter((b) => b.scope === filter.scope);
      }
      if (filter.status) {
        items = items.filter((b) => b.status === filter.status);
      }

      const total = items.length;
      const page = filter.page ?? 1;
      const perPage = filter.perPage ?? 20;
      const start = (page - 1) * perPage;
      const paged = items.slice(start, start + perPage);

      return { budgets: paged.map(e => this.mapEntityToBudget(e)), total };
    }
    return { budgets: [], total: 0 };
  }

  async updateBudget(id: string, input: BudgetUpdateInput): Promise<Budget | undefined> {
    if (this.budgetRepository) {
      const entity = await this.budgetRepository.findById(id);
      if (!entity) return undefined;

      const updates: Partial<BudgetEntity> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.amount !== undefined) updates.amount = input.amount;
      if (input.thresholds !== undefined) updates.thresholds = input.thresholds;
      if (input.status !== undefined) updates.status = input.status;
      updates.updatedAt = new Date();

      const updated = await this.budgetRepository.update(id, updates);
      return updated ? this.mapEntityToBudget(updated) : undefined;
    }
    return undefined;
  }

  async deleteBudget(id: string): Promise<boolean> {
    if (this.budgetRepository) {
      return await this.budgetRepository.delete(id);
    }
    return false;
  }

  async restoreBudget(id: string): Promise<Budget | undefined> {
    if (this.budgetRepository) {
      const updated = await this.budgetRepository.update(id, { status: 'active', updatedAt: new Date() });
      return updated ? this.mapEntityToBudget(updated) : undefined;
    }
    return undefined;
  }

  private mapEntityToBudget(entity: BudgetEntity): Budget {
    return {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      scope: entity.scope,
      period: entity.period,
      amount: entity.amount,
      thresholds: entity.thresholds,
      status: entity.status as BudgetStatus,
      spent: entity.spent,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  // ==================== Cost Tracking ====================

  async recordCost(input: CostRecordCreateInput): Promise<CostRecord> {
    const record = createCostRecord(input);
    this.costRecords.set(record.id, record);

    // 更新相关预算的已消耗金额
    if (input.tenantId) {
      await this._updateBudgetSpent('tenant', input.tenantId, input.totalCost);
    }
    if (input.projectId) {
      await this._updateBudgetSpent('project', input.projectId, input.totalCost);
    }
    if (input.userId) {
      await this._updateBudgetSpent('user', input.userId, input.totalCost);
    }

    return record;
  }

  async queryCosts(filter: CostQueryFilter = {}): Promise<{ records: CostRecord[]; total: number }> {
    let items = Array.from(this.costRecords.values());

    if (filter.tenantId) {
      items = items.filter((r) => r.tenantId === filter.tenantId);
    }
    if (filter.projectId) {
      items = items.filter((r) => r.projectId === filter.projectId);
    }
    if (filter.userId) {
      items = items.filter((r) => r.userId === filter.userId);
    }
    if (filter.model) {
      items = items.filter((r) => r.model === filter.model);
    }
    if (filter.provider) {
      items = items.filter((r) => r.provider === filter.provider);
    }
    if (filter.moduleType) {
      items = items.filter((r) => r.moduleType === filter.moduleType);
    }
    if (filter.dateFrom) {
      const from = new Date(filter.dateFrom);
      items = items.filter((r) => r.timestamp >= from);
    }
    if (filter.dateTo) {
      const to = new Date(filter.dateTo);
      items = items.filter((r) => r.timestamp <= to);
    }

    const total = items.length;
    const page = filter.page ?? 1;
    const perPage = filter.perPage ?? 50;
    const start = (page - 1) * perPage;
    const paged = items.slice(start, start + perPage);

    return { records: paged, total };
  }

  async getCostSummary(
    filter: Omit<CostQueryFilter, 'page' | 'perPage'> = {}
  ): Promise<CostSummary> {
    const { records } = await this.queryCosts({ ...filter, page: 1, perPage: 100000 });

    const summary: CostSummary = {
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalRequests: 0,
      costByModel: {},
      costByProvider: {},
      costByTenant: {},
      costByModule: {},
    };

    for (const r of records) {
      summary.totalCost += r.totalCost;
      summary.totalInputTokens += r.inputTokens;
      summary.totalOutputTokens += r.outputTokens;
      summary.totalRequests += 1;

      // 按模型聚合
      const modelKey = `${r.provider}/${r.model}`;
      summary.costByModel[modelKey] = (summary.costByModel[modelKey] ?? 0) + r.totalCost;

      // 按提供商聚合
      summary.costByProvider[r.provider] =
        (summary.costByProvider[r.provider] ?? 0) + r.totalCost;

      // 按租户聚合
      if (r.tenantId) {
        summary.costByTenant[r.tenantId] =
          (summary.costByTenant[r.tenantId] ?? 0) + r.totalCost;
      }

      // 按模块聚合
      summary.costByModule[r.moduleType] =
        (summary.costByModule[r.moduleType] ?? 0) + r.totalCost;
    }

    // 保留两位小数
    summary.totalCost = Math.round(summary.totalCost * 100) / 100;
    for (const key of Object.keys(summary.costByModel)) {
      summary.costByModel[key] = Math.round(summary.costByModel[key] * 100) / 100;
    }
    for (const key of Object.keys(summary.costByProvider)) {
      summary.costByProvider[key] = Math.round(summary.costByProvider[key] * 100) / 100;
    }
    for (const key of Object.keys(summary.costByTenant)) {
      summary.costByTenant[key] = Math.round(summary.costByTenant[key] * 100) / 100;
    }
    for (const key of Object.keys(summary.costByModule)) {
      summary.costByModule[key] = Math.round(summary.costByModule[key] * 100) / 100;
    }

    return summary;
  }

  // ==================== Budget Health Check ====================

  async checkBudgetHealth(budgetId: string): Promise<{
    budget: Budget;
    usagePercent: number;
    status: 'ok' | 'warning' | 'critical' | 'exceeded';
    remaining: number;
  }> {
    const budget = await this.getBudgetById(budgetId);
    if (!budget) {
      throw new Error(`Budget ${budgetId} not found`);
    }

    const usagePercent = budget.amount > 0 ? budget.spent / budget.amount : 0;
    const remaining = budget.amount - budget.spent;

    let status: 'ok' | 'warning' | 'critical' | 'exceeded' = 'ok';
    if (usagePercent >= budget.thresholds.hardLimit) {
      status = 'exceeded';
    } else if (usagePercent >= budget.thresholds.critical) {
      status = 'critical';
    } else if (usagePercent >= budget.thresholds.warning) {
      status = 'warning';
    }

    return { budget, usagePercent, status, remaining };
  }

  // ==================== Alert Rules ====================

  async createAlertRule(input: AlertRuleCreateInput): Promise<AlertRule> {
    const rule = createAlertRule(input);
    this.alertRules.set(rule.id, rule);
    return rule;
  }

  async listAlertRules(status?: AlertStatus): Promise<AlertRule[]> {
    let items = Array.from(this.alertRules.values());
    if (status) {
      items = items.filter((r) => r.status === status);
    }
    return items;
  }

  async getActiveAlerts(): Promise<AlertRule[]> {
    return this.listAlertRules('active');
  }

  async updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule | undefined> {
    const rule = this.alertRules.get(id);
    if (!rule) return undefined;

    if (updates.name !== undefined) rule.name = updates.name;
    if (updates.threshold !== undefined) rule.threshold = updates.threshold;
    if (updates.severity !== undefined) rule.severity = updates.severity;
    if (updates.recipients !== undefined) rule.recipients = updates.recipients;
    if (updates.status !== undefined) rule.status = updates.status;
    if (updates.lastTriggered !== undefined) rule.lastTriggered = updates.lastTriggered;

    this.alertRules.set(id, rule);
    return rule;
  }

  async deleteAlertRule(id: string): Promise<boolean> {
    return this.alertRules.delete(id);
  }

  // ==================== Model Pricing ====================

  async addModelPricing(input: ModelPricingCreateInput): Promise<ModelPricing> {
    const pricing = createModelPricing(input);
    this.modelPricing.set(pricing.id, pricing);
    return pricing;
  }

  async getModelPricing(): Promise<ModelPricing[]> {
    return Array.from(this.modelPricing.values());
  }

  async getPricingForModel(provider: string, model: string): Promise<ModelPricing | undefined> {
    return Array.from(this.modelPricing.values()).find(
      (p) =>
        p.provider === provider &&
        p.model === model &&
        (!p.effectiveTo || p.effectiveTo > new Date())
    );
  }

  async deleteModelPricing(id: string): Promise<boolean> {
    return this.modelPricing.delete(id);
  }

  // ==================== Dashboard ====================

  async getDashboardData(): Promise<{
    totalCost: number;
    totalRequests: number;
    activeBudgets: number;
    activeAlerts: number;
    topModels: { model: string; cost: number }[];
    recentCosts: CostRecord[];
    budgetHealth: { budgetId: string; name: string; usagePercent: number; status: string }[];
  }> {
    const summary = await this.getCostSummary();
    const { budgets: activeBudgets } = await this.listBudgets({ status: 'active' });
    const activeAlerts = await this.getActiveAlerts();

    // Top 5 模型按成本排序
    const topModels = Object.entries(summary.costByModel)
      .map(([model, cost]) => ({ model, cost }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    // 最近 10 条成本记录
    const recentCosts = Array.from(this.costRecords.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    // 预算健康状态
    const budgetHealth = activeBudgets.map((b) => {
      const usagePercent = b.amount > 0 ? b.spent / b.amount : 0;
      let status = 'ok';
      if (usagePercent >= b.thresholds.hardLimit) status = 'exceeded';
      else if (usagePercent >= b.thresholds.critical) status = 'critical';
      else if (usagePercent >= b.thresholds.warning) status = 'warning';
      return {
        budgetId: b.id,
        name: b.name,
        usagePercent: Math.round(usagePercent * 10000) / 100,
        status,
      };
    });

    return {
      totalCost: summary.totalCost,
      totalRequests: summary.totalRequests,
      activeBudgets: activeBudgets.length,
      activeAlerts: activeAlerts.length,
      topModels,
      recentCosts,
      budgetHealth,
    };
  }

  // ==================== Internal Helpers ====================

  private async _updateBudgetSpent(type: string, scope: string, cost: number): Promise<void> {
    if (!this.budgetRepository) return;

    const entity = await this.budgetRepository.findByEntity(type, scope);
    if (entity && entity.status === 'active') {
      const newSpent = entity.spent + cost;
      await this.budgetRepository.updateSpent(entity.id, newSpent);

      // 检查是否超出预算
      if (newSpent >= entity.amount) {
        await this.budgetRepository.update(entity.id, { status: 'exhausted', updatedAt: new Date() });
      }
    }
  }
}
