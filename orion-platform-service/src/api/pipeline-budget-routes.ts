/**
 * Pipeline Budget Management API Routes
 *
 * Routes under /api/v1/pipelines/:id/budget for managing pipeline budgets,
 * tracking usage, and checking budget eligibility.
 *
 * Endpoints:
 *   POST   /pipelines/:id/budget        — Set/update budget
 *   GET    /pipelines/:id/budget        — Query budget
 *   PUT    /pipelines/:id/budget        — Update budget (adjust limit)
 *   DELETE /pipelines/:id/budget        — Delete budget
 *   POST   /pipelines/:id/budget/check  — Check if run is allowed
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PipelineBudgetService } from '../services/PipelineBudgetService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { createLogger } from '../utils/logger';
import { OrionError, ValidationError, NotFoundError, ErrorCode, handleError } from '../errors';

const logger = pino({ name: 'pipeline-budget-routes' });

export function registerBudgetRoutes(
  app: FastifyInstance,
  budgetService: PipelineBudgetService,
): void {
  if (!budgetService) {
    logger.warn('[BudgetRoutes] No budget service provided, budget routes will not be functional');
    return;
  }

  const prefix = '/pipelines/:id/budget';

  // POST /pipelines/:id/budget — Set/update budget
  app.post(
    prefix,
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const maxCost = typeof body.maxCost === 'number' ? body.maxCost : undefined;
    if (maxCost === undefined || maxCost < 0) {
      return handleError(reply, new ValidationError('maxCost is required and must be >= 0'));
    }

    const currency = typeof body.currency === 'string' ? body.currency : 'USD';
    const createdBy = typeof body.createdBy === 'string' ? body.createdBy : 'system';

    try {
      const budget = await budgetService.setBudget({
        pipelineId: id,
        maxCost,
        currency,
        createdBy,
      });
      return reply.code(201).send(budget);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return handleError(reply, new OrionError(message, ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /pipelines/:id/budget — Query budget
  app.get(
    prefix,
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const budget = await budgetService.getBudget(id);
      if (!budget) {
        return handleError(reply, new NotFoundError('Unknown error'));
      }
      return reply.send(budget);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return handleError(reply, new OrionError(message, ErrorCode.INTERNAL_ERROR));
    }
  });

  // PUT /pipelines/:id/budget — Update budget (adjust limit)
  app.put(
    prefix,
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const maxCost = typeof body.maxCost === 'number' ? body.maxCost : undefined;
    if (maxCost === undefined || maxCost < 0) {
      return handleError(reply, new ValidationError('maxCost is required and must be >= 0'));
    }

    const currency = typeof body.currency === 'string' ? body.currency : undefined;
    const createdBy = typeof body.updatedBy === 'string' ? body.updatedBy : 'system';

    try {
      const existing = await budgetService.getBudget(id);
      if (!existing) {
        return handleError(reply, new NotFoundError('Unknown error'));
      }

      const budget = await budgetService.setBudget({
        pipelineId: id,
        maxCost,
        currency: currency ?? existing.currency,
        createdBy,
      });
      return reply.send(budget);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return handleError(reply, new OrionError(message, ErrorCode.INTERNAL_ERROR));
    }
  });

  // DELETE /pipelines/:id/budget — Delete budget
  app.delete(
    prefix,
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const deleted = await budgetService.deleteBudget(id);
      if (!deleted) {
        return handleError(reply, new NotFoundError('Unknown error'));
      }
      return reply.code(204).send();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return handleError(reply, new OrionError(message, ErrorCode.INTERNAL_ERROR));
    }
  });

  // POST /pipelines/:id/budget/check — Check if run is allowed
  app.post(
    `${prefix}/check`,
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'write' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await budgetService.checkBudget(id);
      return reply.send(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return handleError(reply, new OrionError(message, ErrorCode.INTERNAL_ERROR));
    }
  });
}
