/**
 * [ARCHIVED] This module has been migrated to orion-platform-svc-go.
 * Go service: internal/finops-v2/handler/handler.go
 * DO NOT modify this file. All changes should be made to the Go implementation.
 * Migration completed: 2026-07-13
 */

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
import { CloudCostCollector, CloudProvider } from '../services/finops';
import { createLogger } from '../utils/logger';
import { NotFoundError, handleError } from '../errors';

const logger = createLogger('finops-v2-routes');

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

  // Task 5.8: CloudCostCollector for auto-collection
  const cloudCollector = options.database ? new CloudCostCollector(options.database) : undefined;

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
    return handleError(reply, new NotFoundError('NOT_FOUND'));
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
    const tenantId = query.tenantId || (request as any).user?.tenantId;
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

  // ============================================================================
  // Cost Auto-Collection (Task 5.8)
  // ============================================================================

  if (cloudCollector) {
    // POST /finops/collect - Trigger cloud cost collection
    app.post('/finops/collect', {
      onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'write' })],
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as any || {};
        const { provider, days = 30 } = body;

        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

        let resources;
        if (provider) {
          resources = await cloudCollector.collectFromProvider(provider, startDate, endDate);
        } else {
          resources = await cloudCollector.collectAll(startDate, endDate);
        }

        const totalCost = resources.reduce((sum: number, r: any) => sum + r.cost, 0);

        return reply.send({
          success: true,
          data: {
            collected: resources.length,
            totalCost: Math.round(totalCost * 100) / 100,
            provider: provider || 'all',
            periodStart: startDate.toISOString(),
            periodEnd: endDate.toISOString(),
          },
        });
      } catch (error: any) {
        logger.error('[FinOpsV2] Collection error:', error);
        return reply.status(500).send({
          success: false,
          error: 'COLLECTION_ERROR',
          message: error.message,
        });
      }
    });

    // GET /finops/collect/providers - List registered cloud providers
    app.get('/finops/collect/providers', {
      onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const providers = cloudCollector.getRegisteredProviders();
        return reply.send({ success: true, data: { providers } });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: 'PROVIDER_LIST_ERROR',
          message: error.message,
        });
      }
    });

    // POST /finops/collect/schedule - Set collection schedule for a provider
    app.post('/finops/collect/schedule', {
      onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'write' })],
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as any || {};
        const { provider, cronExpression, enabled = true } = body;

        if (!provider || !cronExpression) {
          return reply.status(400).send({
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'provider and cronExpression are required',
          });
        }

        await cloudCollector.setSchedule(provider, { provider: provider as CloudProvider, cronExpression, enabled });

        return reply.send({
          success: true,
          message: `Collection schedule updated for ${provider}`,
        });
      } catch (error: any) {
        logger.error('[FinOpsV2] Schedule error:', error);
        return reply.status(500).send({
          success: false,
          error: 'SCHEDULE_ERROR',
          message: error.message,
        });
      }
    });

    // GET /finops/collect/schedule/:provider - Get collection schedule
    app.get('/finops/collect/schedule/:provider', {
      onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const params = request.params as { provider: string };
        const schedule = await cloudCollector.getSchedule(params.provider as any);

        if (!schedule) {
          return reply.status(404).send({
            success: false,
            error: 'SCHEDULE_NOT_FOUND',
            message: `No schedule found for provider: ${params.provider}`,
          });
        }

        return reply.send({ success: true, data: schedule });
      } catch (error: any) {
        return reply.status(500).send({
          success: false,
          error: 'SCHEDULE_GET_ERROR',
          message: error.message,
        });
      }
    });
  }
}