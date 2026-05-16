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

export function registerBudgetRoutes(
  app: FastifyInstance,
  budgetService: PipelineBudgetService,
): void {
  if (!budgetService) {
    console.warn('[BudgetRoutes] No budget service provided, budget routes will not be functional');
    return;
  }

  const prefix = '/pipelines/:id/budget';

  // POST /pipelines/:id/budget — Set/update budget
  app.post(prefix, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const maxCost = typeof body.maxCost === 'number' ? body.maxCost : undefined;
    if (maxCost === undefined || maxCost < 0) {
      return reply.code(400).send({ error: 'maxCost is required and must be >= 0' });
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
      return reply.code(500).send({ error: message });
    }
  });

  // GET /pipelines/:id/budget — Query budget
  app.get(prefix, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const budget = await budgetService.getBudget(id);
      if (!budget) {
        return reply.code(404).send({ error: `No budget set for pipeline ${id}` });
      }
      return reply.send(budget);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ error: message });
    }
  });

  // PUT /pipelines/:id/budget — Update budget (adjust limit)
  app.put(prefix, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const maxCost = typeof body.maxCost === 'number' ? body.maxCost : undefined;
    if (maxCost === undefined || maxCost < 0) {
      return reply.code(400).send({ error: 'maxCost is required and must be >= 0' });
    }

    const currency = typeof body.currency === 'string' ? body.currency : undefined;
    const createdBy = typeof body.updatedBy === 'string' ? body.updatedBy : 'system';

    try {
      const existing = await budgetService.getBudget(id);
      if (!existing) {
        return reply.code(404).send({ error: `No budget set for pipeline ${id}` });
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
      return reply.code(500).send({ error: message });
    }
  });

  // DELETE /pipelines/:id/budget — Delete budget
  app.delete(prefix, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const deleted = await budgetService.deleteBudget(id);
      if (!deleted) {
        return reply.code(404).send({ error: `No budget set for pipeline ${id}` });
      }
      return reply.code(204).send();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ error: message });
    }
  });

  // POST /pipelines/:id/budget/check — Check if run is allowed
  app.post(`${prefix}/check`, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await budgetService.checkBudget(id);
      return reply.send(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ error: message });
    }
  });
}
