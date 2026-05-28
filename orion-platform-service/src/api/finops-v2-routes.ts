/**
 * FinOps V2 API Routes - 完整 FinOps 成本管理
 *
 * Routes under /api/v1/finops
 * Cost tracking, budget management, forecasting, optimization recommendations
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { FinOpsV2Controller } from './controllers/finops/FinOpsV2Controller';
import { FinOpsService } from '../services/finops/FinOpsService';
import { FinOpsRepository } from '../services/finops/FinOpsRepository';
import pino from 'pino';

const logger = pino({ name: 'finops-v2-routes' });

interface FinOpsRoutesOptions {
  database?: DatabasePool;
}

export default async function finOpsV2Routes(
  app: FastifyInstance,
  options: FinOpsRoutesOptions
): Promise<void> {
  // Initialize Repository and Service with database pool
  const repository = options.database
    ? new FinOpsRepository(options.database)
    : undefined;

  if (!repository) {
    logger.warn('[FinOpsRoutes] No database pool provided, FinOps routes will not be functional');
    return;
  }

  const finOpsService = new FinOpsService(repository);
  const controller = new FinOpsV2Controller(finOpsService);

  // ============================================================================
  // Cost Tracking
  // ============================================================================

  app.post('/finops/track/project', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.trackProjectCost(request, reply));

  app.post('/finops/track/tenant', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.trackTenantCost(request, reply));

  app.post('/finops/track/team', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.trackTeamCost(request, reply));

  app.get('/finops/track/:entityType/:entityId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.getCostByEntity(request, reply));

  app.get('/finops/track/:entityType/:entityId/trend', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.getEntityCostTrend(request, reply));

  // ============================================================================
  // Cost Overview & Breakdown
  // ============================================================================

  app.get('/finops/cost-overview', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const summary = await finOpsService.getCostSummary(
      (query.period as any) || 'monthly',
      { tenantId: query.tenantId }
    );
    return reply.send({ success: true, data: { summary } });
  });

  app.get('/finops/cost-breakdown', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const dimension = query.dimension || 'category';
    const breakdown = await finOpsService.getCostBreakdown(dimension, { tenantId: query.tenantId });
    return reply.send({ success: true, data: { breakdown } });
  });

  app.get('/finops/chargeback', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.getChargebackReport(request, reply));

  // ============================================================================
  // Budget Management (Full CRUD)
  // ============================================================================

  app.get('/finops/budgets', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.listBudgets(request, reply));

  app.post('/finops/budgets', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.createBudget(request, reply));

  app.put('/finops/budgets/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.updateBudget(request, reply));

  app.delete('/finops/budgets/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.deleteBudget(request, reply));

  app.get('/finops/budgets/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const budget = await finOpsService.getBudget(params.id);
    if (!budget) return reply.status(404).send({ error: 'NOT_FOUND', message: `Budget ${params.id} not found` });
    return reply.send({ success: true, data: { budget } });
  });

  app.get('/finops/budgets/:id/status', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.getBudgetStatus(request, reply));

  app.get('/finops/budgets/:id/forecast', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.forecastBudget(request, reply));

  // ============================================================================
  // Budget Alerts
  // ============================================================================

  app.post('/finops/budgets/check-alerts', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.checkBudgetAlerts(request, reply));

  app.get('/finops/budgets/alert-triggers', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.getAlertTriggers(request, reply));

  // ============================================================================
  // Cost Forecasts
  // ============================================================================

  app.get('/finops/forecasts', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const entityType = (query.entityType as any) || 'project';
    const entityId = query.entityId || 'default';
    const period = (query.period as any) || 'monthly';

    // Get trend forecast for the entity
    const trend = await finOpsService.getCostTrend(entityType, entityId, period);
    const forecast = {
      points: trend.points,
      overallChangeRate: trend.overallChangeRate,
      averageCost: trend.averageCost,
      maxCost: trend.maxCost,
      minCost: trend.minCost,
      // Simple linear extrapolation for next period
      nextPeriodForecast: trend.points.length > 0
        ? trend.points[trend.points.length - 1].cost * (1 + trend.overallChangeRate / 100)
        : 0,
    };

    return reply.send({ success: true, data: { forecasts: [forecast], count: 1 } });
  });

  // ============================================================================
  // Optimization Recommendations
  // ============================================================================

  app.get('/finops/recommendations', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.getOptimizations(request, reply));

  app.patch('/finops/recommendations/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.updateOptimizationStatus(request, reply));

  app.delete('/finops/recommendations/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.deleteOptimization(request, reply));

  app.get('/finops/recommendations/right-sizing', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.getRightSizingRecommendations(request, reply));

  app.get('/finops/recommendations/unused', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.detectUnusedResources(request, reply));

  app.get('/finops/recommendations/savings', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.estimateSavings(request, reply));

  // ============================================================================
  // Reports
  // ============================================================================

  app.get('/finops/reports', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = query.tenantId || 'default';
    const reports = await finOpsService.getReportHistory(tenantId);
    return reply.send({ success: true, data: { reports } });
  });

  // ============================================================================
  // ROI
  // ============================================================================

  app.get('/finops/roi/history', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.getROIHistory(request, reply));

  app.get('/finops/roi/summary', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.getROISummary(request, reply));

  // ============================================================================
  // Metrics (FinOps KPIs)
  // ============================================================================

  app.get('/finops/metrics', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const [summary, roiSummary, savings] = await Promise.all([
      finOpsService.getCostSummary('monthly'),
      finOpsService.getROISummary(),
      finOpsService.estimateSavings(),
    ]);

    return reply.send({
      success: true,
      data: {
        costMetrics: summary,
        roiMetrics: roiSummary,
        savingsMetrics: savings,
      },
    });
  });

  // ============================================================================
  // Health Check
  // ============================================================================

  app.get('/finops/health', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.healthCheck(request, reply));
}
