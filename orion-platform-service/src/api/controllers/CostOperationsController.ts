/**
 * CostOperationsController - 成本运营控制器
 *
 * Phase 2: 处理预算门禁、成本异常检测、成本优化建议相关的 HTTP 请求。
 */
import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import { CostBudgetGuardService, BudgetGuardInput, EvaluationResult } from '../../services/cost/CostBudgetGuardService';
import { CostAnomalyDetectionService, AnomalyDetectionResult, CostTrendResult, CostForecastResult } from '../../services/cost/CostAnomalyDetectionService';
import { CostOptimizationService, UtilizationAnalysis, OptimizationCategory } from '../../services/cost/CostOptimizationService';

export class CostOperationsController extends BaseController {
  private budgetGuardService: CostBudgetGuardService;
  private anomalyDetectionService: CostAnomalyDetectionService;
  private optimizationService: CostOptimizationService;

  constructor(
    budgetGuardService: CostBudgetGuardService,
    anomalyDetectionService: CostAnomalyDetectionService,
    optimizationService: CostOptimizationService,
  ) {
    super();
    this.budgetGuardService = budgetGuardService;
    this.anomalyDetectionService = anomalyDetectionService;
    this.optimizationService = optimizationService;
  }

  // ==================== Budget Guard ====================

  /**
   * 创建预算门禁
   * POST /api/v1/cost-operations/budget-guards
   */
  async createBudgetGuard(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any;
      const { name, description, budgetAmount, currency, action, scope } = body;

      if (!name || !budgetAmount || !action) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, budgetAmount, action',
        });
      }

      if (!['allow', 'block', 'warn'].includes(action)) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'action must be "allow", "block", or "warn"',
        });
      }

      const tenantId = this.getTenantId(request);

      const input: BudgetGuardInput = {
        name,
        description,
        budgetAmount,
        currency,
        action,
        scope,
      };

      const guard = await this.budgetGuardService.createBudgetGuard(tenantId, input);
      return reply.status(201).send({ success: true, data: guard });
    } catch (error: any) {
      return reply.status(500).send({ error: 'CREATE_GUARD_ERROR', message: error.message });
    }
  }

  /**
   * 获取预算门禁列表
   * GET /api/v1/cost-operations/budget-guards
   */
  async getBudgetGuards(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const tenantId = this.getTenantId(request);

      const guards = await this.budgetGuardService.getBudgetGuards(tenantId);
      return reply.status(200).send({ success: true, data: guards });
    } catch (error: any) {
      return reply.status(500).send({ error: 'GET_GUARDS_ERROR', message: error.message });
    }
  }

  /**
   * 评估成本
   * POST /api/v1/cost-operations/evaluate
   */
  async evaluateCost(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any;
      const { pipelineId, estimatedCost, projectId, environment } = body;

      if (!pipelineId || estimatedCost === undefined || estimatedCost === null) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: pipelineId, estimatedCost',
        });
      }

      const tenantId = this.getTenantId(request);

      const result: EvaluationResult = await this.budgetGuardService.evaluateCostGuard(
        pipelineId,
        estimatedCost,
        { tenantId, projectId, environment },
      );

      const statusCode = result.passed ? 200 : 403;
      return reply.status(statusCode).send({
        success: result.passed,
        data: result,
      });
    } catch (error: any) {
      return reply.status(500).send({ error: 'EVALUATION_ERROR', message: error.message });
    }
  }

  // ==================== Cost Anomaly Detection ====================

  /**
   * 检测异常
   * POST /api/v1/cost-operations/anomalies
   */
  async detectAnomalies(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any;
      const tenantId = this.getTenantId(request);

      let timeWindow: { start: Date; end: Date };

      if (body.days) {
        const end = new Date();
        const start = new Date(end.getTime() - body.days * 24 * 60 * 60 * 1000);
        timeWindow = { start, end };
      } else if (body.start && body.end) {
        timeWindow = { start: new Date(body.start), end: new Date(body.end) };
      } else {
        // Default: last 30 days
        const end = new Date();
        const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        timeWindow = { start, end };
      }

      const result: AnomalyDetectionResult = await this.anomalyDetectionService.detectAnomalies(tenantId, timeWindow);
      return reply.status(200).send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(500).send({ error: 'ANOMALY_DETECTION_ERROR', message: error.message });
    }
  }

  /**
   * 获取成本趋势
   * GET /api/v1/cost-operations/trend
   */
  async getCostTrend(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const tenantId = this.getTenantId(request);
      const days = parseInt(query.days, 10) || 30;

      const result: CostTrendResult = await this.anomalyDetectionService.getCostTrend(tenantId, days);
      return reply.status(200).send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(500).send({ error: 'TREND_ERROR', message: error.message });
    }
  }

  /**
   * 成本预测 - 预测月末花费
   * GET /api/v1/cost-operations/forecast
   */
  async forecastCost(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const tenantId = this.getTenantId(request);
      const days = parseInt(query.days, 10) || 30;

      const result: CostForecastResult = await this.anomalyDetectionService.forecastCost(tenantId, days);
      return reply.status(200).send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(500).send({ error: 'FORECAST_ERROR', message: error.message });
    }
  }

  // ==================== Cost Optimization ====================

  /**
   * 获取优化建议
   * GET /api/v1/cost-operations/suggestions
   */
  async getOptimizationSuggestions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const tenantId = this.getTenantId(request);

      const options: { category?: OptimizationCategory; minSavings?: number } = {};
      if (query.category) options.category = query.category as OptimizationCategory;
      if (query.minSavings) options.minSavings = parseFloat(query.minSavings);

      const suggestions = await this.optimizationService.getOptimizationSuggestions(tenantId, options);
      return reply.status(200).send({ success: true, data: suggestions });
    } catch (error: any) {
      return reply.status(500).send({ error: 'OPTIMIZATION_ERROR', message: error.message });
    }
  }

  /**
   * 分析资源利用率
   * POST /api/v1/cost-operations/analyze-utilization
   */
  /**
   * 删除预算门禁
   * DELETE /api/v1/cost-operations/budget-guards/:id
   */
  async deleteBudgetGuard(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      const tenantId = this.getTenantId(request);
      const deleted = await this.budgetGuardService.deleteBudgetGuard(params.id, tenantId);

      if (!deleted) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Budget guard ' + params.id + ' not found',
        });
      }

      return reply.status(200).send({
        success: true,
        message: 'Budget guard deleted',
      });
    } catch (error: any) {
      return reply.status(500).send({ error: 'DELETE_GUARD_ERROR', message: error.message });
    }
  }

  /**
   * 应用优化建议
   * POST /api/v1/cost-operations/optimizations/:id/apply
   */
  async applyOptimization(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      const tenantId = this.getTenantId(request);

      const updated = await this.optimizationService.applySuggestion(tenantId, params.id);

      if (!updated) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Optimization ' + params.id + ' not found',
        });
      }

      return reply.status(200).send({
        success: true,
        data: { optimization: updated },
        message: 'Optimization applied',
      });
    } catch (error: any) {
      return reply.status(500).send({ error: 'APPLY_OPTIMIZATION_ERROR', message: error.message });
    }
  }

  /**
   * 拒绝优化建议
   * POST /api/v1/cost-operations/optimizations/:id/reject
   */
  async rejectOptimization(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as any;
      const tenantId = this.getTenantId(request);

      const updated = await this.optimizationService.rejectSuggestion(tenantId, params.id);

      if (!updated) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Optimization ' + params.id + ' not found',
        });
      }

      return reply.status(200).send({
        success: true,
        data: { optimization: updated },
        message: 'Optimization rejected',
      });
    } catch (error: any) {
      return reply.status(500).send({ error: 'REJECT_OPTIMIZATION_ERROR', message: error.message });
    }
  }

  async analyzeUtilization(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any;
      const tenantId = this.getTenantId(request);

      // If resources are provided, record them first
      if (body.resources && Array.isArray(body.resources)) {
        for (const resource of body.resources) {
          await this.optimizationService.recordUtilization(tenantId, {
            resourceId: resource.resourceId,
            resourceType: resource.resourceType,
            resourceName: resource.resourceName,
            cpuUtilization: resource.cpuUtilization,
            memoryUtilization: resource.memoryUtilization,
            storageUtilization: resource.storageUtilization,
            monthlyCost: resource.monthlyCost,
            tenantId,
            environment: resource.environment,
          });
        }
      }

      const analysis: UtilizationAnalysis = await this.optimizationService.analyzeResourceUtilization(tenantId);
      return reply.status(200).send({ success: true, data: analysis });
    } catch (error: any) {
      return reply.status(500).send({ error: 'UTILIZATION_ANALYSIS_ERROR', message: error.message });
    }
  }
}
