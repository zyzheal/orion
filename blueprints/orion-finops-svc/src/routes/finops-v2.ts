/**
 * TASK-502: FinOps 成本追踪与 ROI API 路由
 *
 * 提供成本追踪、ROI 分析、预算管理、成本优化等端点
 * 注册在 /api/v1/finops 前缀下
 *
 * Uses PostgreSQL Repository pattern via FinOpsService
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../utils/database';
import { FinOpsRepository } from '../services/FinOpsRepository';
import { FinOpsService } from '../services/FinOpsService';
import { FinOpsV2Controller } from '../controllers/FinOpsV2Controller';

export default async function finopsV2Routes(
  app: FastifyInstance,
  options?: { database?: DatabasePool }
): Promise<void> {
  // Create repository with database pool (falls back to undefined for dev/testing)
  const repository = options?.database
    ? new FinOpsRepository(options.database)
    : undefined;

  // If no database, create a minimal in-memory fallback repository is not available
  // In production, database should always be provided
  const service = repository
    ? new FinOpsService(repository)
    : undefined;

  if (!service) {
    // Fallback: register routes that return 503 Service Unavailable
    app.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
      await reply.status(503).send({
        success: false,
        error: 'DATABASE_NOT_CONFIGURED',
        message: 'FinOps service requires PostgreSQL database connection',
      });
    });
    return;
  }

  const controller = new FinOpsV2Controller(service);

  // ==================== 成本追踪 ====================

  // POST /track/project - 记录项目成本
  app.post('/track/project', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.trackProjectCost(request, reply);
  });

  // POST /track/tenant - 记录租户成本
  app.post('/track/tenant', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.trackTenantCost(request, reply);
  });

  // POST /track/team - 记录团队成本
  app.post('/track/team', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.trackTeamCost(request, reply);
  });

  // GET /track/:entityType/:entityId - 获取实体成本汇总
  app.get('/track/:entityType/:entityId', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getCostByEntity(request, reply);
  });

  // GET /track/:entityType/:entityId/trend - 获取实体成本趋势
  app.get('/track/:entityType/:entityId/trend', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getEntityCostTrend(request, reply);
  });

  // GET /chargeback - 获取成本分摊报告
  app.get('/chargeback', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getChargebackReport(request, reply);
  });

  // ==================== ROI 分析 ====================

  // POST /roi/calculate - 计算 ROI
  app.post('/roi/calculate', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.calculateROI(request, reply);
  });

  // POST /roi/automation - 分析自动化节省
  app.post('/roi/automation', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.analyzeAutomationSavings(request, reply);
  });

  // POST /roi/compare - 对比前后周期成本
  app.post('/roi/compare', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.comparePeriods(request, reply);
  });

  // GET /roi/history - 获取 ROI 历史
  app.get('/roi/history', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getROIHistory(request, reply);
  });

  // GET /roi/summary - 获取 ROI 汇总
  app.get('/roi/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getROISummary(request, reply);
  });

  // ==================== 预算管理 ====================

  // POST /budget - 创建预算
  app.post('/budget', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createBudget(request, reply);
  });

  // GET /budget - 获取预算列表
  app.get('/budget', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listBudgets(request, reply);
  });

  // PUT /budget/:id - 更新预算
  app.put('/budget/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateBudget(request, reply);
  });

  // DELETE /budget/:id - 删除预算
  app.delete('/budget/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deleteBudget(request, reply);
  });

  // POST /budget/:id/spend - 更新实体花费
  app.post('/budget/:id/spend', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateSpend(request, reply);
  });

  // POST /budget/check-alerts - 检查预算告警
  app.post('/budget/check-alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.checkBudgetAlerts(request, reply);
  });

  // GET /budget/:id/status - 获取预算状态
  app.get('/budget/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getBudgetStatus(request, reply);
  });

  // GET /budget/:id/forecast - 预算预测
  app.get('/budget/:id/forecast', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.forecastBudget(request, reply);
  });

  // GET /budget/alert-triggers - 获取告警触发记录
  app.get('/budget/alert-triggers', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAlertTriggers(request, reply);
  });

  // ==================== 成本优化 ====================

  // POST /optimize/analyze - 分析优化机会
  app.post('/optimize/analyze', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.analyzeOptimization(request, reply);
  });

  // GET /optimize/right-sizing - 获取资源调整大小建议
  app.get('/optimize/right-sizing', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getRightSizingRecommendations(request, reply);
  });

  // GET /optimize/unused - 检测闲置资源
  app.get('/optimize/unused', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.detectUnusedResources(request, reply);
  });

  // GET /optimize/savings - 预估节省金额
  app.get('/optimize/savings', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.estimateSavings(request, reply);
  });

  // GET /optimize/suggestions - 获取优化建议列表
  app.get('/optimize/suggestions', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getOptimizations(request, reply);
  });

  // PATCH /optimize/:id/status - 更新优化建议状态
  app.patch('/optimize/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateOptimizationStatus(request, reply);
  });

  // DELETE /optimize/:id - 删除优化建议
  app.delete('/optimize/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deleteOptimization(request, reply);
  });

  // ==================== 健康检查 ====================

  // GET /health - 健康检查
  app.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.healthCheck(request, reply);
  });
}
