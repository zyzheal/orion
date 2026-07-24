/**
 * Pipeline 预算配置 API 路由
 *
 * 提供 Pipeline 预算管理功能：
 * - GET /api/v1/pipelines/:id/budget - 获取预算配置
 * - PUT /api/v1/pipelines/:id/budget - 更新预算配置
 * - GET /api/v1/pipelines/:id/budget/usage - 获取预算使用情况
 * - GET /api/v1/pipelines/:id/budget/alerts - 获取预算告警
 * - POST /api/v1/pipelines/:id/budget/alerts - 创建预算告警规则
 * - PUT /api/v1/pipelines/:id/budget/alerts/:alertId - 更新告警规则
 * - DELETE /api/v1/pipelines/:id/budget/alerts/:alertId - 删除告警规则
 * - GET /api/v1/pipelines/:id/budget/history - 获取预算历史
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ErrorCodes, ErrorFactory } from '../errors/error-codes';
import { PaginationHelper, OffsetPaginationParams } from '../utils/pagination';

/**
 * 预算类型枚举
 */
export enum BudgetType {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  PER_RUN = 'per_run',
}

/**
 * 预算资源类型枚举
 */
export enum BudgetResourceType {
  CPU = 'cpu',
  MEMORY = 'memory',
  STORAGE = 'storage',
  NETWORK = 'network',
  GPU = 'gpu',
  CUSTOM = 'custom',
}

/**
 * 告警级别枚举
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

/**
 * 预算配置
 */
export interface BudgetConfig {
  id: string;
  pipelineId: string;
  type: BudgetType;
  period: {
    start: string;
    end: string;
  };
  limits: {
    resourceType: BudgetResourceType;
    limit: number;
    unit: string;
    used: number;
  }[];
  costLimits?: {
    total: number;
    currency: string;
  };
  alerts: BudgetAlert[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 预算告警规则
 */
export interface BudgetAlert {
  id: string;
  name: string;
  threshold: number; // 百分比
  severity: AlertSeverity;
  channels: string[]; // 通知渠道
  enabled: boolean;
  lastTriggered?: string;
}

/**
 * 预算使用情况
 */
export interface BudgetUsage {
  pipelineId: string;
  period: {
    start: string;
    end: string;
  };
  resources: {
    type: BudgetResourceType;
    used: number;
    limit: number;
    unit: string;
    percentage: number;
  }[];
  cost: {
    used: number;
    limit: number;
    currency: string;
    percentage: number;
  };
  forecast?: {
    projectedUsage: number;
    projectedCost: number;
    daysRemaining: number;
  };
}

/**
 * 预算历史记录
 */
export interface BudgetHistoryRecord {
  id: string;
  pipelineId: string;
  timestamp: string;
  action: 'config_updated' | 'alert_triggered' | 'limit_exceeded' | 'period_reset';
  details: Record<string, unknown>;
  actor: string;
}

/**
 * 创建/更新预算请求
 */
export interface UpsertBudgetRequest {
  type: BudgetType;
  limits: {
    resourceType: BudgetResourceType;
    limit: number;
    unit: string;
  }[];
  costLimits?: {
    total: number;
    currency: string;
  };
}

/**
 * 创建告警规则请求
 */
export interface CreateAlertRequest {
  name: string;
  threshold: number;
  severity: AlertSeverity;
  channels: string[];
  enabled?: boolean;
}

/**
 * 更新告警规则请求
 */
export interface UpdateAlertRequest {
  name?: string;
  threshold?: number;
  severity?: AlertSeverity;
  channels?: string[];
  enabled?: boolean;
}

/**
 * Pipeline 预算服务类
 */
export class PipelineBudgetService {
  private budgets: Map<string, BudgetConfig> = new Map();
  private history: Map<string, BudgetHistoryRecord[]> = new Map();
  private alertCounter = 0;

  /**
   * 获取预算配置
   */
  async getBudget(pipelineId: string): Promise<BudgetConfig | null> {
    return this.budgets.get(pipelineId) || null;
  }

  /**
   * 创建或更新预算配置
   */
  async upsertBudget(pipelineId: string, data: UpsertBudgetRequest): Promise<BudgetConfig> {
    const now = new Date().toISOString();
    const existing = this.budgets.get(pipelineId);

    // 计算预算周期
    const period = this.calculatePeriod(data.type);

    const budget: BudgetConfig = {
      id: existing?.id || `budget_${Date.now()}`,
      pipelineId,
      type: data.type,
      period,
      limits: data.limits.map(l => ({
        ...l,
        used: existing?.limits.find(el => el.resourceType === l.resourceType)?.used || 0,
      })),
      costLimits: data.costLimits,
      alerts: existing?.alerts || [],
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.budgets.set(pipelineId, budget);

    // 记录历史
    this.addHistory(pipelineId, {
      action: 'config_updated',
      details: { type: data.type, limitsCount: data.limits.length },
      actor: 'system',
    });

    return budget;
  }

  /**
   * 获取预算使用情况
   */
  async getBudgetUsage(pipelineId: string): Promise<BudgetUsage | null> {
    const budget = await this.getBudget(pipelineId);
    if (!budget) {
      return null;
    }

    // 模拟使用数据
    const resources = budget.limits.map(limit => ({
      type: limit.resourceType,
      used: limit.used,
      limit: limit.limit,
      unit: limit.unit,
      percentage: Math.round((limit.used / limit.limit) * 100),
    }));

    const usedCost = Math.round(Math.random() * (budget.costLimits?.total || 1000));

    // 计算预测
    const periodDays = Math.ceil(
      (new Date(budget.period.end).getTime() - new Date(budget.period.start).getTime()) / (1000 * 60 * 60 * 24)
    );
    const elapsedDays = Math.ceil(
      (Date.now() - new Date(budget.period.start).getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysRemaining = periodDays - elapsedDays;

    return {
      pipelineId,
      period: budget.period,
      resources,
      cost: {
        used: usedCost,
        limit: budget.costLimits?.total || 0,
        currency: budget.costLimits?.currency || 'USD',
        percentage: budget.costLimits ? Math.round((usedCost / budget.costLimits.total) * 100) : 0,
      },
      forecast: {
        projectedUsage: Math.round(usedCost * (periodDays / Math.max(elapsedDays, 1))),
        projectedCost: Math.round(usedCost * (periodDays / Math.max(elapsedDays, 1))),
        daysRemaining: Math.max(daysRemaining, 0),
      },
    };
  }

  /**
   * 获取告警规则列表
   */
  async getAlerts(pipelineId: string): Promise<BudgetAlert[]> {
    const budget = await this.getBudget(pipelineId);
    return budget?.alerts || [];
  }

  /**
   * 创建告警规则
   */
  async createAlert(pipelineId: string, data: CreateAlertRequest): Promise<BudgetAlert> {
    const budget = await this.getBudget(pipelineId);
    if (!budget) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'budget',
        identifier: pipelineId,
      });
    }

    this.alertCounter++;
    const alert: BudgetAlert = {
      id: `alert_${Date.now()}_${this.alertCounter}`,
      name: data.name,
      threshold: data.threshold,
      severity: data.severity,
      channels: data.channels,
      enabled: data.enabled ?? true,
    };

    budget.alerts.push(alert);
    budget.updatedAt = new Date().toISOString();
    this.budgets.set(pipelineId, budget);

    return alert;
  }

  /**
   * 更新告警规则
   */
  async updateAlert(pipelineId: string, alertId: string, data: UpdateAlertRequest): Promise<BudgetAlert> {
    const budget = await this.getBudget(pipelineId);
    if (!budget) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'budget',
        identifier: pipelineId,
      });
    }

    const alertIndex = budget.alerts.findIndex(a => a.id === alertId);
    if (alertIndex === -1) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'alert',
        identifier: alertId,
      });
    }

    budget.alerts[alertIndex] = {
      ...budget.alerts[alertIndex],
      ...data,
    };
    budget.updatedAt = new Date().toISOString();
    this.budgets.set(pipelineId, budget);

    return budget.alerts[alertIndex];
  }

  /**
   * 删除告警规则
   */
  async deleteAlert(pipelineId: string, alertId: string): Promise<void> {
    const budget = await this.getBudget(pipelineId);
    if (!budget) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'budget',
        identifier: pipelineId,
      });
    }

    const alertIndex = budget.alerts.findIndex(a => a.id === alertId);
    if (alertIndex === -1) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'alert',
        identifier: alertId,
      });
    }

    budget.alerts.splice(alertIndex, 1);
    budget.updatedAt = new Date().toISOString();
    this.budgets.set(pipelineId, budget);
  }

  /**
   * 获取预算历史
   */
  async getBudgetHistory(
    pipelineId: string,
    params: OffsetPaginationParams
  ): Promise<{ data: BudgetHistoryRecord[]; total: number }> {
    const records = this.history.get(pipelineId) || [];
    const total = records.length;
    const offset = params.offset || 0;
    const limit = params.limit || 20;

    return {
      data: records.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * 计算预算周期
   */
  private calculatePeriod(type: BudgetType): { start: string; end: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);

    let end: Date;
    switch (type) {
      case BudgetType.MONTHLY:
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case BudgetType.QUARTERLY:
        const quarterEnd = Math.floor(now.getMonth() / 3) * 3 + 3;
        end = new Date(now.getFullYear(), quarterEnd, 0);
        break;
      case BudgetType.YEARLY:
        end = new Date(now.getFullYear(), 11, 31);
        break;
      case BudgetType.PER_RUN:
      default:
        end = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 默认1天
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  /**
   * 添加历史记录
   */
  private addHistory(pipelineId: string, data: Omit<BudgetHistoryRecord, 'id' | 'pipelineId' | 'timestamp'>): void {
    const records = this.history.get(pipelineId) || [];
    records.unshift({
      id: `hist_${Date.now()}`,
      pipelineId,
      timestamp: new Date().toISOString(),
      ...data,
    });
    this.history.set(pipelineId, records);
  }
}

// 单例服务实例
export const pipelineBudgetService = new PipelineBudgetService();

/**
 * Pipeline 预算路由类
 */
export class PipelineBudgetRoutes {
  constructor(private app: FastifyInstance) {}

  register(): void {
    // GET /api/v1/pipelines/:id/budget - 获取预算配置
    this.app.get('/api/v1/pipelines/:id/budget', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const budget = await pipelineBudgetService.getBudget(params.id);

      if (!budget) {
        return reply.code(404).send({
          error: 'NOT_FOUND',
          message: 'Budget configuration not found',
        });
      }

      return reply.send(budget);
    });

    // PUT /api/v1/pipelines/:id/budget - 创建/更新预算配置
    this.app.put('/api/v1/pipelines/:id/budget', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = request.body as UpsertBudgetRequest;

      const budget = await pipelineBudgetService.upsertBudget(params.id, body);
      return reply.send(budget);
    });

    // GET /api/v1/pipelines/:id/budget/usage - 获取预算使用情况
    this.app.get('/api/v1/pipelines/:id/budget/usage', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const usage = await pipelineBudgetService.getBudgetUsage(params.id);

      if (!usage) {
        return reply.code(404).send({
          error: 'NOT_FOUND',
          message: 'Budget usage not found',
        });
      }

      return reply.send(usage);
    });

    // GET /api/v1/pipelines/:id/budget/alerts - 获取告警规则列表
    this.app.get('/api/v1/pipelines/:id/budget/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const alerts = await pipelineBudgetService.getAlerts(params.id);
      return reply.send({ data: alerts, total: alerts.length });
    });

    // POST /api/v1/pipelines/:id/budget/alerts - 创建告警规则
    this.app.post('/api/v1/pipelines/:id/budget/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = request.body as CreateAlertRequest;

      const alert = await pipelineBudgetService.createAlert(params.id, body);
      return reply.code(201).send(alert);
    });

    // PUT /api/v1/pipelines/:id/budget/alerts/:alertId - 更新告警规则
    this.app.put('/api/v1/pipelines/:id/budget/alerts/:alertId', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string; alertId: string };
      const body = request.body as UpdateAlertRequest;

      const alert = await pipelineBudgetService.updateAlert(params.id, params.alertId, body);
      return reply.send(alert);
    });

    // DELETE /api/v1/pipelines/:id/budget/alerts/:alertId - 删除告警规则
    this.app.delete('/api/v1/pipelines/:id/budget/alerts/:alertId', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string; alertId: string };

      await pipelineBudgetService.deleteAlert(params.id, params.alertId);
      return reply.code(204).send();
    });

    // GET /api/v1/pipelines/:id/budget/history - 获取预算历史
    this.app.get('/api/v1/pipelines/:id/budget/history', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const query = request.query as OffsetPaginationParams;

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await pipelineBudgetService.getBudgetHistory(params.id, paginationParams);

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 20,
          total,
        })
      );
    });
  }
}