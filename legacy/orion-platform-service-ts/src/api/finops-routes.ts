/**
 * FinOps Cost Operations API Routes (Phase 4 Batch 2)
 *
 * Routes under /api/v1/cost-operations
 * Budget guard, cost anomaly detection, optimization suggestions
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { CostOperationsController } from './controllers/CostOperationsController';
import { CostBudgetGuardService } from '../services/cost/CostBudgetGuardService';
import { CostAnomalyDetectionService } from '../services/cost/CostAnomalyDetectionService';
import { CostOptimizationService } from '../services/cost/CostOptimizationService';
import { DatabasePool } from '../services/database';
import { OrionError, ErrorCode, handleError } from '../errors';
import { FinOpsRepository } from '../services/finops/FinOpsRepository';
import { FinOpsService } from '../services/finops/FinOpsService';

interface FinOpsRoutesOptions {
  database?: DatabasePool;
}

export default async function finOpsRoutes(
  app: FastifyInstance,
  options: FinOpsRoutesOptions = {}
): Promise<void> {
  const db = options.database;
  const controller = new CostOperationsController(
    new CostBudgetGuardService(db || ({} as any)),
    new CostAnomalyDetectionService(db || ({} as any)),
    new CostOptimizationService(db || ({} as any)),
  );

  // FinOpsService for cost comparison and service-level operations
  const finOpsRepository = db ? new FinOpsRepository(db) : undefined;
  const finOpsService = finOpsRepository ? new FinOpsService(finOpsRepository) : undefined;

  // Budget Guard
  app.post('/cost-operations/budget-guards', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.createBudgetGuard(request, reply));

  app.get('/cost-operations/budget-guards', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.getBudgetGuards(request, reply));

  app.delete('/cost-operations/budget-guards/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.deleteBudgetGuard(request, reply));

  app.post('/cost-operations/evaluate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.evaluateCost(request, reply));

  // Budget Guards (legacy alias)
  app.get('/cost-operations/budgets', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.getBudgetGuards(request, reply));

  // Cost Anomaly Detection
  app.get('/cost-operations/anomalies', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.detectAnomalies(request, reply));

  // Cost Trend
  app.get('/cost-operations/trend', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.getCostTrend(request, reply));

  // Cost Overview
  app.get('/cost-operations/overview', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Simple overview response
    return reply.send({
      success: true,
      data: {
        totalCost: 0,
        currentMonthCost: 0,
        previousMonthCost: 0,
        monthOverMonthChange: 0,
        projectedMonthlyCost: 0,
        budgetRemaining: 0,
        budgetTotal: 0,
        budgetUsagePercent: 0,
      },
    });
  });

  // Optimization Suggestions
  app.get('/cost-operations/optimizations', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.getOptimizationSuggestions(request, reply));

  app.post('/cost-operations/optimizations/:id/apply', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.applyOptimization(request, reply));

  app.post('/cost-operations/optimizations/:id/reject', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.rejectOptimization(request, reply));

  // ==================== Cost Comparison (4.40) ====================
  app.post('/cost-operations/compare', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!finOpsService) {
      return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'FinOps service not initialized' });
    }
    try {
      const body = request.body as any;
      const tenantId = (request as any).tenantId || body.tenantId;
      const { serviceA, serviceB, period } = body;

      if (!serviceA || !serviceB || !period) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: serviceA, serviceB, period',
        });
      }

      const result = await finOpsService.compareCosts(tenantId, serviceA, serviceB, period as any);
      return reply.status(200).send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(500).send({ error: 'COMPARE_ERROR', message: error.message });
    }
  });

  // ==================== Service Cost Trend (4.40) ====================
  app.get('/cost-operations/service-trend', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!finOpsService) {
      return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'FinOps service not initialized' });
    }
    try {
      const query = request.query as any;
      const tenantId = query.tenantId || (request as any).tenantId;
      const serviceId = query.serviceId || 'default';
      const period = (query.period as any) || 'monthly';
      const category = query.category;

      const result = await finOpsService.getServiceCostTrend(serviceId, period, category);
      return reply.status(200).send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(500).send({ error: 'TREND_ERROR', message: error.message });
    }
  });

  // ==================== Service Optimization Suggestions (4.40) ====================
  app.get('/cost-operations/suggestions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!finOpsService) {
      return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'FinOps service not initialized' });
    }
    try {
      const query = request.query as any;
      const tenantId = query.tenantId || (request as any).tenantId;
      const serviceId = query.serviceId || 'default';
      const entityType = (query.entityType as any) || 'project';

      const result = await finOpsService.getServiceOptimizationSuggestions(serviceId, entityType);
      return reply.status(200).send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(500).send({ error: 'SUGGESTIONS_ERROR', message: error.message });
    }
  });
}
