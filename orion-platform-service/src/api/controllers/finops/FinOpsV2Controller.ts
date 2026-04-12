/**
 * TASK-502: FinOps 成本追踪与 ROI 控制器
 *
 * 处理成本追踪、ROI 分析、预算管理、成本优化等 API 请求
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  CostTrackingService,
  ROIAnalyzer,
  BudgetService,
  CostOptimizer,
} from '../../../services/finops';
import {
  CostEntityType,
  CostPeriod,
  OptimizationCategory,
  OptimizationPriority,
  OptimizationStatus,
  ROIInvestmentType,
} from '../../../services/finops/types';
import {
  EntityCostSummary,
  ChargebackReport,
  CostTrendQuery,
  OptimizationQuery,
} from '../../../services/finops';

export class FinOpsV2Controller {
  private trackingService: CostTrackingService;
  private roiAnalyzer: ROIAnalyzer;
  private budgetService: BudgetService;
  private costOptimizer: CostOptimizer;

  constructor() {
    this.trackingService = new CostTrackingService();
    this.roiAnalyzer = new ROIAnalyzer();
    this.budgetService = new BudgetService();
    this.costOptimizer = new CostOptimizer();
  }

  // ==================== 成本追踪 ====================

  /**
   * 记录项目成本
   * POST /api/v1/finops/track/project
   */
  async trackProjectCost(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { projectId, amount, category, environment, tags, currency } = body;

      if (!projectId || amount === undefined || !category) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: projectId, amount, category',
        });
        return;
      }

      const record = this.trackingService.trackProjectCost({
        projectId,
        amount,
        category,
        environment,
        tags,
        currency,
      });

      await reply.status(201).send({
        success: true,
        data: { record },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'TRACKING_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * 记录租户成本
   * POST /api/v1/finops/track/tenant
   */
  async trackTenantCost(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { tenantId, amount, category, environment, tags, currency } = body;

      if (!tenantId || amount === undefined || !category) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: tenantId, amount, category',
        });
        return;
      }

      const record = this.trackingService.trackTenantCost({
        tenantId,
        amount,
        category,
        environment,
        tags,
        currency,
      });

      await reply.status(201).send({
        success: true,
        data: { record },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'TRACKING_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * 记录团队成本
   * POST /api/v1/finops/track/team
   */
  async trackTeamCost(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { teamId, amount, category, environment, tags, currency } = body;

      if (!teamId || amount === undefined || !category) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: teamId, amount, category',
        });
        return;
      }

      const record = this.trackingService.trackTeamCost({
        teamId,
        amount,
        category,
        environment,
        tags,
        currency,
      });

      await reply.status(201).send({
        success: true,
        data: { record },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'TRACKING_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * 获取实体成本汇总
   * GET /api/v1/finops/track/:entityType/:entityId
   */
  async getCostByEntity(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const query = request.query as any;

    const { entityType, entityId } = params;
    const validTypes: CostEntityType[] = ['project', 'tenant', 'team'];

    if (!validTypes.includes(entityType)) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: `Invalid entityType. Must be one of: ${validTypes.join(', ')}`,
      });
      return;
    }

    const summary = this.trackingService.getCostByEntity(
      entityType,
      entityId,
      (query.period as CostPeriod) || 'monthly'
    );

    await reply.status(200).send({
      success: true,
      data: { summary },
    });
  }

  /**
   * 获取实体成本趋势
   * GET /api/v1/finops/track/:entityType/:entityId/trend
   */
  async getEntityCostTrend(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const query = request.query as any;

    const trendQuery: CostTrendQuery = {
      entityType: params.entityType,
      entityId: params.entityId,
      period: (query.period as CostPeriod) || 'monthly',
      category: query.category,
    };

    const trend = this.trackingService.getCostTrend(trendQuery);

    await reply.status(200).send({
      success: true,
      data: { trend },
    });
  }

  /**
   * 获取成本分摊报告
   * GET /api/v1/finops/chargeback
   */
  async getChargebackReport(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const report: ChargebackReport = this.trackingService.getChargebackReport(
      (query.period as CostPeriod) || 'monthly'
    );

    await reply.status(200).send({
      success: true,
      data: { report },
    });
  }

  // ==================== ROI 分析 ====================

  /**
   * 计算 ROI
   * POST /api/v1/finops/roi/calculate
   */
  async calculateROI(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const {
        investmentType,
        name,
        cost,
        monthlySavings,
        timeSavingsHours,
        description,
        details,
      } = body;

      if (!investmentType || !name || cost === undefined || monthlySavings === undefined) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: investmentType, name, cost, monthlySavings',
        });
        return;
      }

      const validTypes: ROIInvestmentType[] = [
        'infrastructure',
        'automation',
        'tooling',
        'training',
        'migration',
      ];
      if (!validTypes.includes(investmentType)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: `Invalid investmentType. Must be one of: ${validTypes.join(', ')}`,
        });
        return;
      }

      const analysis = this.roiAnalyzer.calculateROI({
        investmentType,
        name,
        cost,
        monthlySavings,
        timeSavingsHours,
        description,
        details,
      });

      await reply.status(201).send({
        success: true,
        data: { analysis },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'ROI_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * 分析自动化节省
   * POST /api/v1/finops/roi/automation
   */
  async analyzeAutomationSavings(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const {
        name,
        manualHoursPerMonth,
        hourlyRate,
        automationCost,
        automationMaintenancePerMonth,
        timeSavingsPercent,
        description,
      } = body;

      if (
        !name ||
        manualHoursPerMonth === undefined ||
        hourlyRate === undefined ||
        automationCost === undefined ||
        timeSavingsPercent === undefined
      ) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, manualHoursPerMonth, hourlyRate, automationCost, timeSavingsPercent',
        });
        return;
      }

      const analysis = this.roiAnalyzer.analyzeAutomationSavings({
        name,
        manualHoursPerMonth,
        hourlyRate,
        automationCost,
        automationMaintenancePerMonth,
        timeSavingsPercent,
        description,
      });

      await reply.status(201).send({
        success: true,
        data: { analysis },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'ROI_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * 对比前后周期成本
   * POST /api/v1/finops/roi/compare
   */
  async comparePeriods(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const {
        description,
        beforeCost,
        afterCost,
        timeSavingsHours,
        period,
      } = body;

      if (
        !description ||
        beforeCost === undefined ||
        afterCost === undefined
      ) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: description, beforeCost, afterCost',
        });
        return;
      }

      const comparison = this.roiAnalyzer.comparePeriods({
        description,
        beforeCost,
        afterCost,
        timeSavingsHours,
        period: (period as CostPeriod) || 'monthly',
      });

      await reply.status(201).send({
        success: true,
        data: { comparison },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'ROI_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * 获取 ROI 历史
   * GET /api/v1/finops/roi/history
   */
  async getROIHistory(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const history = this.roiAnalyzer.getROIHistory({
      investmentType: query.investmentType as ROIInvestmentType,
      minROI: query.minROI ? parseFloat(query.minROI) : undefined,
    });

    await reply.status(200).send({
      success: true,
      data: { history },
    });
  }

  /**
   * 获取 ROI 汇总
   * GET /api/v1/finops/roi/summary
   */
  async getROISummary(request: FastifyRequest, reply: FastifyReply) {
    const summary = this.roiAnalyzer.getSummary();

    await reply.status(200).send({
      success: true,
      data: { summary },
    });
  }

  // ==================== 预算管理 ====================

  /**
   * 创建预算
   * POST /api/v1/finops/budget
   */
  async createBudget(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const {
        entityType,
        entityId,
        amount,
        period,
        currency,
        alerts,
        environment,
        description,
      } = body;

      if (!entityType || !entityId || amount === undefined || !period) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: entityType, entityId, amount, period',
        });
        return;
      }

      const budget = this.budgetService.createBudget({
        entityType,
        entityId,
        amount,
        period,
        currency,
        alerts,
        environment,
        description,
      });

      await reply.status(201).send({
        success: true,
        data: { budget },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'BUDGET_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * 更新预算
   * PUT /api/v1/finops/budget/:id
   */
  async updateBudget(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const body = request.body as any || {};

    const budget = this.budgetService.updateBudget(params.id, body);

    if (!budget) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Budget ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { budget },
    });
  }

  /**
   * 删除预算
   * DELETE /api/v1/finops/budget/:id
   */
  async deleteBudget(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const deleted = this.budgetService.deleteBudget(params.id);

    if (!deleted) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Budget ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      message: 'Budget deleted',
    });
  }

  /**
   * 获取预算列表
   * GET /api/v1/finops/budget
   */
  async listBudgets(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const budgets = this.budgetService.listBudgets({
      entityType: query.entityType as CostEntityType,
      entityId: query.entityId,
    });

    await reply.status(200).send({
      success: true,
      data: { budgets },
    });
  }

  /**
   * 更新实体花费
   * POST /api/v1/finops/budget/:id/spend
   */
  async updateSpend(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const body = request.body as any || {};
    const { entityType, entityId, amount } = body;

    if (!entityType || !entityId || amount === undefined) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: entityType, entityId, amount',
      });
      return;
    }

    this.budgetService.updateEntitySpend(entityType, entityId, amount);

    // 自动检查告警
    const triggered = this.budgetService.checkBudgetAlerts();

    await reply.status(200).send({
      success: true,
      data: {
        triggered,
        triggeredCount: triggered.length,
      },
    });
  }

  /**
   * 检查预算告警
   * POST /api/v1/finops/budget/check-alerts
   */
  async checkBudgetAlerts(request: FastifyRequest, reply: FastifyReply) {
    const triggered = this.budgetService.checkBudgetAlerts();

    await reply.status(200).send({
      success: true,
      data: { triggered, count: triggered.length },
    });
  }

  /**
   * 获取预算状态
   * GET /api/v1/finops/budget/:id/status
   */
  async getBudgetStatus(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const status = this.budgetService.getBudgetStatus(params.id);

    if (!status) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Budget ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { status },
    });
  }

  /**
   * 预算预测
   * GET /api/v1/finops/budget/:id/forecast
   */
  async forecastBudget(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const forecast = this.budgetService.forecastBudget(params.id);

    if (!forecast) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Budget ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { forecast },
    });
  }

  /**
   * 获取告警触发记录
   * GET /api/v1/finops/budget/alert-triggers
   */
  async getAlertTriggers(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const triggers = this.budgetService.getAlertTriggers({
      budgetId: query.budgetId,
      entityType: query.entityType as CostEntityType,
    });

    await reply.status(200).send({
      success: true,
      data: { triggers },
    });
  }

  // ==================== 成本优化 ====================

  /**
   * 分析优化机会
   * POST /api/v1/finops/optimize/analyze
   */
  async analyzeOptimization(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any || {};
      const { utilizations } = body;

      if (!utilizations || !Array.isArray(utilizations)) {
        await reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required field: utilizations (array)',
        });
        return;
      }

      const suggestions = this.costOptimizer.analyzeOptimization(utilizations);

      await reply.status(200).send({
        success: true,
        data: { suggestions, count: suggestions.length },
      });
    } catch (error: any) {
      await reply.status(500).send({
        error: 'OPTIMIZATION_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * 获取资源调整大小建议
   * GET /api/v1/finops/optimize/right-sizing
   */
  async getRightSizingRecommendations(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const recommendations = this.costOptimizer.getRightSizingRecommendations({
      tenantId: query.tenantId,
      environment: query.environment,
    });

    await reply.status(200).send({
      success: true,
      data: { recommendations },
    });
  }

  /**
   * 检测闲置资源
   * GET /api/v1/finops/optimize/unused
   */
  async detectUnusedResources(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const unused = this.costOptimizer.detectUnusedResources({
      tenantId: query.tenantId,
      environment: query.environment,
    });

    await reply.status(200).send({
      success: true,
      data: { unused, count: unused.length },
    });
  }

  /**
   * 预估节省金额
   * GET /api/v1/finops/optimize/savings
   */
  async estimateSavings(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const savings = this.costOptimizer.estimateSavings({
      category: query.category as OptimizationCategory,
      status: query.status as OptimizationStatus,
    });

    await reply.status(200).send({
      success: true,
      data: { savings },
    });
  }

  /**
   * 获取优化建议列表
   * GET /api/v1/finops/optimize/suggestions
   */
  async getOptimizations(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const optimizations = this.costOptimizer.getOptimizations({
      category: query.category as OptimizationCategory,
      priority: query.priority as OptimizationPriority,
      status: query.status as OptimizationStatus,
      entityType: query.entityType as CostEntityType,
      entityId: query.entityId,
    });

    await reply.status(200).send({
      success: true,
      data: { optimizations },
    });
  }

  /**
   * 更新优化建议状态
   * PATCH /api/v1/finops/optimize/:id/status
   */
  async updateOptimizationStatus(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const body = request.body as any || {};
    const { status } = body;

    if (!status) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Missing required field: status',
      });
      return;
    }

    const validStatuses: OptimizationStatus[] = [
      'identified',
      'reviewing',
      'approved',
      'in-progress',
      'completed',
      'rejected',
    ];
    if (!validStatuses.includes(status)) {
      await reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
      return;
    }

    const updated = this.costOptimizer.updateOptimizationStatus(
      params.id,
      status
    );

    if (!updated) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Optimization ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      data: { optimization: updated },
    });
  }

  /**
   * 删除优化建议
   * DELETE /api/v1/finops/optimize/:id
   */
  async deleteOptimization(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const deleted = this.costOptimizer.deleteOptimization(params.id);

    if (!deleted) {
      await reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Optimization ${params.id} not found`,
      });
      return;
    }

    await reply.status(200).send({
      success: true,
      message: 'Optimization suggestion deleted',
    });
  }

  // ==================== 健康检查 ====================

  /**
   * 健康检查
   * GET /api/v1/finops/health
   */
  async healthCheck(request: FastifyRequest, reply: FastifyReply) {
    await reply.status(200).send({
      success: true,
      data: {
        status: 'healthy',
        services: {
          costTracking: true,
          roiAnalyzer: true,
          budgetService: true,
          costOptimizer: true,
        },
      },
    });
  }
}
