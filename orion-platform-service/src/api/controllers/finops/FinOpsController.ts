/**
 * FinOps 成本控制器 (Fastify 版本)
 *
 * 处理成本管理相关的 HTTP 请求
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { CloudCostCollector, K8sCostAllocator, SaaSCostTracker, CostService, CostEventPublisher } from '../../../services/finops';
import { CostPeriod, BillingCycle } from '../../../services/finops/types';

export class FinOpsController {
  private cloudCollector: CloudCostCollector;
  private k8sAllocator: K8sCostAllocator;
  private saasTracker: SaaSCostTracker;
  private costService: CostService;
  private eventPublisher: CostEventPublisher;

  constructor() {
    this.cloudCollector = new CloudCostCollector();
    this.k8sAllocator = new K8sCostAllocator();
    this.saasTracker = new SaaSCostTracker();
    this.costService = new CostService();
    this.eventPublisher = new CostEventPublisher();
  }

  // ==================== 云资源成本采集 ====================

  /**
   * 采集云资源成本
   * POST /api/v1/cost/collect/cloud
   */
  async collectCloudCosts(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { provider, days = 30 } = body;

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      let resources;
      if (provider) {
        resources = await this.cloudCollector.collectFromProvider(provider, startDate, endDate);
      } else {
        resources = await this.cloudCollector.collectAll(startDate, endDate);
      }

      // 标准化成本
      const normalized = this.cloudCollector.normalizeCost(resources);

      // 添加到聚合服务
      this.costService.addCloudCosts(normalized);

      // 发布事件
      const groupedByType = this.cloudCollector.groupByResourceType(resources);
      const groupedByTenant = this.cloudCollector.groupByTenant(resources);
      const totalCost = resources.reduce((sum, r) => sum + r.cost, 0);

      await this.eventPublisher.publishCostCollected({
        source: provider || 'all',
        recordCount: resources.length,
        totalCost: Math.round(totalCost * 100) / 100,
        currency: 'USD',
        periodStart: startDate.toISOString(),
        periodEnd: endDate.toISOString(),
        costByType: groupedByType,
        costByTenant: groupedByTenant,
      });

      await reply.status(200).send({
        success: true,
        data: {
          collected: resources.length,
          totalCost: Math.round(totalCost * 100) / 100,
          resources,
        },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'COLLECTION_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * 获取已注册的云厂商
   * GET /api/v1/cost/providers
   */
  async getProviders(request: FastifyRequest, reply: FastifyReply) {
    const providers = this.cloudCollector.getRegisteredProviders();
    await reply.status(200).send({
      success: true,
      data: { providers },
    });
  }

  // ==================== K8s 成本 ====================

  /**
   * 分配 K8s 集群成本
   * POST /api/v1/cost/k8s/allocate
   */
  async allocateK8sCosts(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { clusterUsage, podUsage } = body;

      if (!clusterUsage || !podUsage || !Array.isArray(podUsage)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: clusterUsage, podUsage',
        });
        return;
      }

      const records = this.k8sAllocator.allocateClusterCosts(
        clusterUsage,
        podUsage,
        new Date()
      );

      this.costService.addK8sCosts(records);

      await reply.status(200).send({
        success: true,
        data: {
          allocated: records.length,
          records,
        },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'ALLOCATION_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * 获取 K8s 命名空间成本
   * GET /api/v1/cost/k8s/namespaces
   */
  async getNamespaceCosts(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any || {};
    const costs = this.k8sAllocator.getNamespaceCosts({
      namespace: query.namespace,
    });

    await reply.status(200).send({
      success: true,
      data: { namespaces: costs },
    });
  }

  /**
   * 获取 K8s Pod 成本
   * GET /api/v1/cost/k8s/pods
   */
  async getPodCosts(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any || {};
    const costs = this.k8sAllocator.getPodCosts({
      namespace: query.namespace,
      deployment: query.deployment,
    });

    await reply.status(200).send({
      success: true,
      data: { pods: costs },
    });
  }

  /**
   * 获取 K8s 租户成本
   * GET /api/v1/cost/k8s/tenants
   */
  async getTenantCosts(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any || {};
    const costs = this.k8sAllocator.getTenantCosts({
      tenantId: query.tenantId,
    });

    await reply.status(200).send({
      success: true,
      data: { tenants: costs },
    });
  }

  // ==================== SaaS 成本 ====================

  /**
   * 添加 SaaS 订阅
   * POST /api/v1/cost/saas
   */
  async addSaaSSubscription(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { tool, subscription, seats, unitCost, billingCycle, startDate, endDate, tenantId, notes } = body;

      if (!tool || !subscription || !seats || !unitCost || !billingCycle || !startDate || !endDate) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: tool, subscription, seats, unitCost, billingCycle, startDate, endDate',
        });
        return;
      }

      const validCycles: BillingCycle[] = ['monthly', 'quarterly', 'annually'];
      if (!validCycles.includes(billingCycle)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: `Invalid billingCycle. Must be one of: ${validCycles.join(', ')}`,
        });
        return;
      }

      const sub = this.saasTracker.addSubscription({
        tool,
        subscription,
        seats,
        unitCost,
        billingCycle,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        tenantId,
        notes,
      });

      this.costService.addSaaSCosts([sub]);

      await reply.status(201).send({
        success: true,
        data: { subscription: sub },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'SUBSCRIPTION_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * 更新 SaaS 订阅
   * PUT /api/v1/cost/saas/:id
   */
  async updateSaaSSubscription(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const body = request.body as any || {};

    const updated = this.saasTracker.updateSubscription(params.id, body);

    if (!updated) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Subscription ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { subscription: updated },
    });
  }

  /**
   * 获取 SaaS 订阅列表
   * GET /api/v1/cost/saas
   */
  async getSaaSSubscriptions(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any || {};
    const subscriptions = this.saasTracker.getSubscriptions({
      tool: query.tool,
      status: query.status,
      tenantId: query.tenantId,
    });

    await reply.status(200).send({
      success: true,
      data: { subscriptions },
    });
  }

  /**
   * 获取 SaaS 月度成本
   * GET /api/v1/cost/saas/monthly-cost
   */
  async getSaaSMonthlyCost(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any || {};
    const monthlyCost = this.saasTracker.getMonthlyCost({
      tool: query.tool,
      tenantId: query.tenantId,
    });

    await reply.status(200).send({
      success: true,
      data: { monthlyCost, currency: 'USD' },
    });
  }

  /**
   * 获取 SaaS 年度预测
   * GET /api/v1/cost/saas/annual-projection
   */
  async getSaaSAnnualProjection(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any || {};
    const annualCost = this.saasTracker.getAnnualProjection({
      tool: query.tool,
      tenantId: query.tenantId,
    });

    await reply.status(200).send({
      success: true,
      data: { annualCost, currency: 'USD' },
    });
  }

  /**
   * 获取许可证使用率
   * GET /api/v1/cost/saas/license-utilization
   */
  async getLicenseUtilization(request: FastifyRequest, reply: FastifyReply) {
    const utilization = this.saasTracker.getLicenseUtilization();

    await reply.status(200).send({
      success: true,
      data: { utilization },
    });
  }

  // ==================== 成本汇总与分析 ====================

  /**
   * 获取成本汇总
   * GET /api/v1/cost/summary
   */
  async getCostSummary(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any || {};
    const summary = this.costService.getCostSummary(
      (query.period as CostPeriod) || 'monthly',
      { tenantId: query.tenantId }
    );

    await reply.status(200).send({
      success: true,
      data: { summary },
    });
  }

  /**
   * 获取成本分解
   * GET /api/v1/cost/breakdown
   */
  async getCostBreakdown(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any || {};
    const dimension = query.dimension || 'category';
    const validDimensions = ['category', 'tenant', 'environment', 'provider', 'namespace'];

    if (!validDimensions.includes(dimension)) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: `Invalid dimension. Must be one of: ${validDimensions.join(', ')}`,
      });
      return;
    }

    const breakdown = this.costService.getCostBreakdown(dimension, {
      tenantId: query.tenantId,
    });

    await reply.status(200).send({
      success: true,
      data: { dimension, breakdown },
    });
  }

  /**
   * 获取成本趋势
   * POST /api/v1/cost/trend
   */
  async getCostTrend(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any || {};
    const { dataPoints } = body;

    if (!dataPoints || !Array.isArray(dataPoints)) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Missing required field: dataPoints (array of {date, cost})',
      });
      return;
    }

    const trend = this.costService.getCostTrend(
      dataPoints.map((p: any) => ({
        date: new Date(p.date),
        cost: p.cost,
      }))
    );

    await reply.status(200).send({
      success: true,
      data: { trend },
    });
  }

  // ==================== 预算告警 ====================

  /**
   * 创建预算告警
   * POST /api/v1/cost/budget-alerts
   */
  async createBudgetAlert(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { budgetAmount, thresholdPercent, tenantId, environment, currency = 'USD', period = 'monthly' as CostPeriod } = body;

      if (!budgetAmount || !thresholdPercent) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: budgetAmount, thresholdPercent',
        });
        return;
      }

      const alert = this.costService.createBudgetAlert({
        budgetAmount,
        thresholdPercent,
        tenantId,
        environment,
        currency,
        period,
      });

      await reply.status(201).send({
        success: true,
        data: { alert },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'BUDGET_ALERT_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * 获取预算告警
   * GET /api/v1/cost/budget-alerts
   */
  async getBudgetAlerts(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any || {};
    const alerts = this.costService.getBudgetAlerts({
      tenantId: query.tenantId,
      environment: query.environment,
    });

    await reply.status(200).send({
      success: true,
      data: { alerts },
    });
  }

  /**
   * 删除预算告警
   * DELETE /api/v1/cost/budget-alerts/:id
   */
  async deleteBudgetAlert(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const deleted = this.costService.deleteBudgetAlert(params.id);

    if (!deleted) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Budget alert ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      message: 'Budget alert deleted',
    });
  }

  /**
   * 检查预算告警
   * POST /api/v1/cost/budget-alerts/check
   */
  async checkBudgetAlerts(request: FastifyRequest, reply: FastifyReply) {
    const triggered = this.costService.checkBudgetAlerts();

    await reply.status(200).send({
      success: true,
      data: { triggered, count: triggered.length },
    });
  }

  // ==================== 事件发布测试 ====================

  /**
   * 手动触发成本采集事件发布
   * POST /api/v1/cost/events/publish-collected
   */
  async publishCostCollectedEvent(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any || {};

    const eventId = await this.eventPublisher.publishCostCollected(body);

    await reply.status(200).send({
      success: true,
      data: { eventId },
    });
  }

  /**
   * 手动触发成本异常事件发布
   * POST /api/v1/cost/events/publish-anomaly
   */
  async publishCostAnomalyEvent(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any || {};

    const eventId = await this.eventPublisher.publishCostAnomaly(body);

    await reply.status(200).send({
      success: true,
      data: { eventId },
    });
  }

  /**
   * 获取事件发布统计
   * GET /api/v1/cost/events/stats
   */
  async getEventStats(request: FastifyRequest, reply: FastifyReply) {
    const stats = this.eventPublisher.getEventStats();

    await reply.status(200).send({
      success: true,
      data: { stats },
    });
  }

  /**
   * 健康检查
   * GET /api/v1/cost/health
   */
  async healthCheck(request: FastifyRequest, reply: FastifyReply) {
    await reply.status(200).send({
      success: true,
      data: {
        status: 'healthy',
        services: {
          cloudCollector: true,
          k8sAllocator: true,
          saasTracker: true,
          costService: true,
          eventPublisher: true,
        },
      },
    });
  }
}
