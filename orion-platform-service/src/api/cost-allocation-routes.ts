/**
 * Cost Allocation API Routes
 *
 * K8s cost allocation, budget management, and cost alerting.
 *
 * Prefix: /api/v1/cost-allocation
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { success, created, badRequest, notFound, internalError } from '../utils/replyHelper';
import { ErrorCodes } from '../types/error-codes';
import { DatabasePool } from '../services/database';
import { K8sCostRepository } from '../services/finops/k8s-cost/K8sCostRepository';
import { BudgetRepository } from '../services/finops/k8s-cost/BudgetRepository';
import { CostAllocationService } from '../services/finops/k8s-cost/CostAllocationService';
import pino from 'pino';

const logger = pino({ name: 'cost-allocation-routes' });

interface CostAllocationRoutesOptions {
  database: DatabasePool;
}

export default async function costAllocationRoutes(
  app: FastifyInstance,
  options: CostAllocationRoutesOptions,
): Promise<void> {
  const clusterCostRepo = new K8sCostRepository(options.database);
  const budgetRepo = new BudgetRepository(options.database);
  const service = new CostAllocationService(clusterCostRepo, budgetRepo);

  // ── GET /summary - Cost summary ────────────────────────────────────────
  app.get('/summary', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { month?: string };
      const summary = await service.getCostSummary(query.month);
      return success(reply, request, summary);
    } catch (err: any) {
      logger.error({ err }, 'Failed to get cost summary');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /trend - Cost trend ────────────────────────────────────────────
  app.get('/trend', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { months?: string };
      const months = parseInt(query.months || '6', 10);
      if (isNaN(months) || months < 1 || months > 24) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'months must be between 1 and 24');
      }
      const trend = await service.getCostTrend(months);
      return success(reply, request, trend);
    } catch (err: any) {
      logger.error({ err }, 'Failed to get cost trend');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /namespaces/top - Top expensive namespaces ─────────────────────
  app.get('/namespaces/top', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { month?: string; limit?: string };
      const limit = parseInt(query.limit || '10', 10);
      const namespaces = await service.getTopExpensiveNamespaces(query.month, limit);
      return success(reply, request, namespaces);
    } catch (err: any) {
      logger.error({ err }, 'Failed to get top namespaces');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /budgets - List budgets ────────────────────────────────────────
  app.get('/budgets', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const budgets = await budgetRepo.getBudgets();
      return success(reply, request, budgets);
    } catch (err: any) {
      logger.error({ err }, 'Failed to list budgets');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST /budgets - Create budget ──────────────────────────────────────
  app.post('/budgets', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.name || !body.scope_type || !body.scope_value || body.monthly_limit === undefined) {
        return badRequest(reply, request, ErrorCodes.CLIENT_PARAM_INVALID, 'name, scope_type, scope_value, and monthly_limit are required');
      }
      const budget = await budgetRepo.createBudget({
        name: body.name,
        scope_type: body.scope_type,
        scope_value: body.scope_value,
        monthly_limit: body.monthly_limit,
        alert_threshold: body.alert_threshold,
        currency: body.currency,
        enabled: body.enabled,
      });
      return created(reply, request, budget);
    } catch (err: any) {
      logger.error({ err }, 'Failed to create budget');
      return internalError(reply, request, err.message);
    }
  });

  // ── PUT /budgets/:id - Update budget ───────────────────────────────────
  app.put('/budgets/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const existing = await budgetRepo.getBudget(id);
      if (!existing) {
        return notFound(reply, request, undefined, 'Budget not found');
      }
      const budget = await budgetRepo.updateBudget(id, {
        name: body.name,
        scope_type: body.scope_type,
        scope_value: body.scope_value,
        monthly_limit: body.monthly_limit,
        alert_threshold: body.alert_threshold,
        currency: body.currency,
        enabled: body.enabled,
      });
      return success(reply, request, budget);
    } catch (err: any) {
      logger.error({ err, budgetId: (request.params as any).id }, 'Failed to update budget');
      return internalError(reply, request, err.message);
    }
  });

  // ── DELETE /budgets/:id - Delete budget ────────────────────────────────
  app.delete('/budgets/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const existing = await budgetRepo.getBudget(id);
      if (!existing) {
        return notFound(reply, request, undefined, 'Budget not found');
      }
      await budgetRepo.deleteBudget(id);
      return success(reply, request, { deleted: true });
    } catch (err: any) {
      logger.error({ err, budgetId: (request.params as any).id }, 'Failed to delete budget');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /budgets/alerts - Check budget alerts ──────────────────────────
  app.get('/budgets/alerts', {
    onRequest: [authenticateUser, requirePermission({ resource: 'finops', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const alerts = await service.checkBudgetAlerts();
      return success(reply, request, alerts);
    } catch (err: any) {
      logger.error({ err }, 'Failed to check budget alerts');
      return internalError(reply, request, err.message);
    }
  });
}
