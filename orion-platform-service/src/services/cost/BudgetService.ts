/**
 * Budget Service - 预算管理、成本追踪、配额限制
 *
 * P1-14 Fix: Migrated costRecords, alertRules, and modelPricing from Map to PostgreSQL Repository pattern.
 */

import {
  Budget,
  BudgetThresholds,
  BudgetType,
  BudgetPeriod,
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
import { DatabasePool } from '../database';
import {
import pino from 'pino';

const logger = pino({ name: 'LBudget-LService' });
  CostRecordRepository,
  AlertRuleRepository,
  ModelPricingRepository,
  CostRecordFindFilter,
  CostSummaryParams,
} from '../../repositories/CostRepositories';

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
  private costRecordRepository?: CostRecordRepository;
  private alertRuleRepository?: AlertRuleRepository;
  private modelPricingRepository?: ModelPricingRepository;
  private dbPool?: { transaction: <T>(fn: (client: any) => Promise<T>) => Promise<T> };

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>; transaction?: <T>(fn: (client: any) => Promise<T>) => Promise<T> }) {
    if (db) {
      this.budgetRepository = new BudgetRepository(db);
      this.costRecordRepository = new CostRecordRepository(db);
      this.alertRuleRepository = new AlertRuleRepository(db);
      this.modelPricingRepository = new ModelPricingRepository(db);
      if ('transaction' in db && typeof db.transaction === 'function') {
        this.dbPool = db as any;
      }
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
        thresholds: budget.thresholds as unknown as Record<string, number>,
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
    return undefined;
  }

  async listBudgets(filter: BudgetListFilter = {}): Promise<{ budgets: Budget[]; total: number }> {
    if (this.budgetRepository) {
      const result = await this.budgetRepository.findAll();
      let items = result.entities;

      if (filter.type) {
        items = items.filter((b: BudgetEntity) => b.type === filter.type);
      }
      if (filter.scope) {
        items = items.filter((b: BudgetEntity) => b.scope === filter.scope);
      }
      if (filter.status) {
        items = items.filter((b: BudgetEntity) => b.status === filter.status);
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
      if (input.thresholds !== undefined) updates.thresholds = input.thresholds as unknown as Record<string, number>;
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
    const thresholdsRaw = entity.thresholds as Partial<BudgetThresholds>;
    return {
      id: entity.id,
      name: entity.name,
      type: entity.type as BudgetType,
      scope: entity.scope,
      period: entity.period as BudgetPeriod,
      amount: entity.amount,
      thresholds: {
        warning: thresholdsRaw.warning ?? 0.8,
        critical: thresholdsRaw.critical ?? 0.95,
        hardLimit: thresholdsRaw.hardLimit ?? 1.0,
      },
      status: entity.status as BudgetStatus,
      spent: entity.spent,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  // ==================== Cost Tracking ====================

  async recordCost(input: CostRecordCreateInput): Promise<CostRecord> {
    const record = createCostRecord(input);

    if (this.costRecordRepository) {
      const costData = {
        requestId: record.requestId,
        model: record.model,
        provider: record.provider,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        inputCost: record.inputCost,
        outputCost: record.outputCost,
        totalCost: record.totalCost,
        tenantId: record.tenantId,
        projectId: record.projectId,
        userId: record.userId,
        moduleType: record.moduleType,
      };

      if (this.dbPool) {
        // Use transaction to ensure atomicity of cost record + budget updates
        return this.dbPool.transaction(async (client) => {
          const entity = await this.costRecordRepository!.createWithClient(costData, client);

          // 更新相关预算的已消耗金额
          if (input.tenantId) {
            await this._updateBudgetSpentWithClient('tenant', input.tenantId, input.totalCost, client);
          }
          if (input.projectId) {
            await this._updateBudgetSpentWithClient('project', input.projectId, input.totalCost, client);
          }
          if (input.userId) {
            await this._updateBudgetSpentWithClient('user', input.userId, input.totalCost, client);
          }

          return this.mapCostRecordEntityToRecord(entity);
        });
      }

      // Fallback: non-transactional (DB pool without transaction support)
      const entity = await this.costRecordRepository.create(costData);
      // Best-effort budget updates; if these fail, cost record still exists
      try {
        if (input.tenantId) await this._updateBudgetSpent('tenant', input.tenantId, input.totalCost);
        if (input.projectId) await this._updateBudgetSpent('project', input.projectId, input.totalCost);
        if (input.userId) await this._updateBudgetSpent('user', input.userId, input.totalCost);
      } catch (err) {
        logger.error('[BudgetService] Budget update failed after cost record created:', err);
      }
      return this.mapCostRecordEntityToRecord(entity);
    }

    // Fallback: return the record without persistence
    return record;
  }

  async queryCosts(filter: CostQueryFilter = {}): Promise<{ records: CostRecord[]; total: number }> {
    if (this.costRecordRepository) {
      const dbFilter: CostRecordFindFilter = {
        tenantId: filter.tenantId,
        projectId: filter.projectId,
        userId: filter.userId,
        model: filter.model,
        provider: filter.provider,
        moduleType: filter.moduleType,
        dateFrom: filter.dateFrom,
        dateTo: filter.dateTo,
        limit: filter.perPage ?? 50,
        offset: ((filter.page ?? 1) - 1) * (filter.perPage ?? 50),
      };

      const records = await this.costRecordRepository.findAll(dbFilter);
      const mapped = records.map(r => this.mapCostRecordEntityToRecord(r));
      return { records: mapped, total: mapped.length };
    }
    return { records: [], total: 0 };
  }

  async getCostSummary(
    filter: Omit<CostQueryFilter, 'page' | 'perPage'> = {}
  ): Promise<CostSummary> {
    if (this.costRecordRepository) {
      const params: CostSummaryParams = {
        tenantId: filter.tenantId,
        projectId: filter.projectId,
        userId: filter.userId,
        model: filter.model,
        provider: filter.provider,
        moduleType: filter.moduleType,
        dateFrom: filter.dateFrom,
        dateTo: filter.dateTo,
      };

      return this.costRecordRepository.getSummary(params);
    }

    return {
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalRequests: 0,
      costByModel: {},
      costByProvider: {},
      costByTenant: {},
      costByModule: {},
    };
  }

  private mapCostRecordEntityToRecord(entity: any): CostRecord {
    return {
      id: entity.id,
      requestId: entity.requestId,
      model: entity.model,
      provider: entity.provider,
      inputTokens: entity.inputTokens,
      outputTokens: entity.outputTokens,
      inputCost: entity.inputCost,
      outputCost: entity.outputCost,
      totalCost: entity.totalCost,
      tenantId: entity.tenantId,
      projectId: entity.projectId,
      userId: entity.userId,
      moduleType: entity.moduleType,
      timestamp: entity.timestamp,
    };
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

    if (this.alertRuleRepository) {
      const entity = await this.alertRuleRepository.create({
        name: rule.name,
        budgetId: rule.budgetId,
        condition: rule.condition,
        threshold: rule.threshold,
        severity: rule.severity,
        recipients: rule.recipients,
        status: rule.status,
        lastTriggered: rule.lastTriggered,
      });
      return this.mapAlertRuleEntityToRule(entity);
    }

    return rule;
  }

  async listAlertRules(status?: AlertStatus): Promise<AlertRule[]> {
    if (this.alertRuleRepository) {
      const entities = await this.alertRuleRepository.findAll(status);
      return entities.map(e => this.mapAlertRuleEntityToRule(e));
    }
    return [];
  }

  async getActiveAlerts(): Promise<AlertRule[]> {
    return this.listAlertRules('active');
  }

  async updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule | undefined> {
    if (this.alertRuleRepository) {
      const dbUpdates: { name?: string; threshold?: number; severity?: string; status?: string; recipients?: string[]; last_triggered?: Date } = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.threshold !== undefined) dbUpdates.threshold = updates.threshold;
      if (updates.severity !== undefined) dbUpdates.severity = updates.severity;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.recipients !== undefined) dbUpdates.recipients = updates.recipients;
      if (updates.lastTriggered !== undefined) dbUpdates.last_triggered = updates.lastTriggered;

      const entity = await this.alertRuleRepository.update(id, dbUpdates);
      return entity ? this.mapAlertRuleEntityToRule(entity) : undefined;
    }
    return undefined;
  }

  async deleteAlertRule(id: string): Promise<boolean> {
    if (this.alertRuleRepository) {
      return this.alertRuleRepository.delete(id);
    }
    return false;
  }

  private mapAlertRuleEntityToRule(entity: any): AlertRule {
    return {
      id: entity.id,
      name: entity.name,
      budgetId: entity.budgetId,
      condition: entity.condition,
      threshold: entity.threshold,
      severity: entity.severity,
      recipients: entity.recipients,
      status: entity.status,
      lastTriggered: entity.lastTriggered,
      createdAt: entity.createdAt,
    };
  }

  // ==================== Model Pricing ====================

  async addModelPricing(input: ModelPricingCreateInput): Promise<ModelPricing> {
    const pricing = createModelPricing(input);

    if (this.modelPricingRepository) {
      const entity = await this.modelPricingRepository.create({
        provider: pricing.provider,
        model: pricing.model,
        inputPricePer1k: pricing.inputPricePer1k,
        outputPricePer1k: pricing.outputPricePer1k,
        currency: pricing.currency,
        effectiveTo: pricing.effectiveTo,
        notes: pricing.notes,
      });
      return this.mapModelPricingEntityToPricing(entity);
    }

    return pricing;
  }

  async getModelPricing(): Promise<ModelPricing[]> {
    if (this.modelPricingRepository) {
      const entities = await this.modelPricingRepository.findAll();
      return entities.map(e => this.mapModelPricingEntityToPricing(e));
    }
    return [];
  }

  async getPricingForModel(provider: string, model: string): Promise<ModelPricing | undefined> {
    if (this.modelPricingRepository) {
      const entity = await this.modelPricingRepository.findByProviderModel(provider, model);
      return entity ? this.mapModelPricingEntityToPricing(entity) : undefined;
    }
    return undefined;
  }

  async deleteModelPricing(id: string): Promise<boolean> {
    if (this.modelPricingRepository) {
      return this.modelPricingRepository.delete(id);
    }
    return false;
  }

  private mapModelPricingEntityToPricing(entity: any): ModelPricing {
    return {
      id: entity.id,
      provider: entity.provider,
      model: entity.model,
      inputPricePer1k: entity.inputPricePer1k,
      outputPricePer1k: entity.outputPricePer1k,
      currency: entity.currency,
      effectiveFrom: entity.effectiveFrom,
      effectiveTo: entity.effectiveTo,
      notes: entity.notes,
    };
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
    const recentCosts = this.costRecordRepository
      ? (await this.costRecordRepository.findAll({ limit: 10 })).map(r => this.mapCostRecordEntityToRecord(r))
      : [];

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

  private async _updateBudgetSpentWithClient(type: string, scope: string, cost: number, client: any): Promise<void> {
    if (!this.budgetRepository) return;

    const entity = await this.budgetRepository.findByEntity(type, scope);
    if (entity && entity.status === 'active') {
      const newSpent = entity.spent + cost;
      await this.budgetRepository.updateSpentWithClient(entity.id, newSpent, client);

      if (newSpent >= entity.amount) {
        await this.budgetRepository.updateWithClient(entity.id, { status: 'exhausted', updatedAt: new Date() }, client);
      }
    }
  }
}
