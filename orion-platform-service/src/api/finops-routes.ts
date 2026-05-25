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

const controller = new CostOperationsController(
  new CostBudgetGuardService(),
  new CostAnomalyDetectionService(),
  new CostOptimizationService(),
);

export default async function finOpsRoutes(app: FastifyInstance): Promise<void> {
  // Budget Guard
  app.post('/cost-operations/budget-guards', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.createBudgetGuard(request, reply));

  app.get('/cost-operations/budget-guards', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => controller.getBudgetGuards(request, reply));

  app.delete('/cost-operations/budget-guards/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Implement deleteBudgetGuard in CostOperationsController
    return reply.status(501).send({ error: 'NOT_IMPLEMENTED', message: 'Delete budget guard not yet implemented' });
  });

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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Implement applyOptimization in CostOperationsController
    return reply.status(501).send({ error: 'NOT_IMPLEMENTED', message: 'Apply optimization not yet implemented' });
  });

  app.post('/cost-operations/optimizations/:id/reject', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Implement rejectOptimization in CostOperationsController
    return reply.status(501).send({ error: 'NOT_IMPLEMENTED', message: 'Reject optimization not yet implemented' });
  });
}
