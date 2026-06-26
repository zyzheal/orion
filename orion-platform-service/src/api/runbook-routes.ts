/**
 * Runbook Management API Routes
 *
 * CRUD for runbook definitions, execution, and execution history.
 *
 * Prefix: /api/v1/runbooks
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { success, created, badRequest, notFound, internalError } from '../utils/replyHelper';
import { ErrorCodes } from '../types/error-codes';
import { DatabasePool } from '../services/database';
import { RunbookDefinitionRepository, RunbookExecutionRepository } from '../services/runbook/RunbookRepository';
import { RunbookService } from '../services/runbook/RunbookService';
import pino from 'pino';

const logger = pino({ name: 'runbook-routes' });

interface RunbookRoutesOptions {
  database: DatabasePool;
}

export default async function runbookRoutes(
  app: FastifyInstance,
  options: RunbookRoutesOptions,
): Promise<void> {
  const definitionRepo = new RunbookDefinitionRepository(options.database);
  const executionRepo = new RunbookExecutionRepository(options.database);
  const service = new RunbookService(definitionRepo, executionRepo);

  // ── POST / — Create runbook definition ──────────────────────────────────
  app.post('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'runbook', action: 'create' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.name || !body.category) {
        return badRequest(reply, request, undefined, 'name and category are required');
      }
      const runbook = await service.create(body);
      return created(reply, request, runbook);
    } catch (err: any) {
      logger.error({ err }, 'Failed to create runbook');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET / — List runbook definitions ────────────────────────────────────
  app.get('/', {
    onRequest: [authenticateUser, requirePermission({ resource: 'runbook', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const runbooks = await service.list({
        category: query.category,
        enabled: query.enabled === 'true' ? true : query.enabled === 'false' ? false : undefined,
      });
      return success(reply, request, runbooks);
    } catch (err: any) {
      logger.error({ err }, 'Failed to list runbooks');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /:id — Get runbook by ID ────────────────────────────────────────
  app.get('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'runbook', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const runbook = await service.get(id);
      return success(reply, request, runbook);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, runbookId: (request.params as any).id }, 'Failed to get runbook');
      return internalError(reply, request, err.message);
    }
  });

  // ── PUT /:id — Update runbook ───────────────────────────────────────────
  app.put('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'runbook', action: 'update' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const runbook = await service.update(id, body);
      return success(reply, request, runbook);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, runbookId: (request.params as any).id }, 'Failed to update runbook');
      return internalError(reply, request, err.message);
    }
  });

  // ── DELETE /:id — Delete runbook ────────────────────────────────────────
  app.delete('/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'runbook', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await service.delete(id);
      return success(reply, request, { deleted: true });
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, runbookId: (request.params as any).id }, 'Failed to delete runbook');
      return internalError(reply, request, err.message);
    }
  });

  // ── POST /:id/execute — Execute runbook ─────────────────────────────────
  app.post('/:id/execute', {
    onRequest: [authenticateUser, requirePermission({ resource: 'runbook', action: 'execute' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const execution = await service.execute({
        runbookId: id,
        triggeredBy: body.triggeredBy ?? 'api',
        context: body.context,
      });
      return created(reply, request, execution);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, runbookId: (request.params as any).id }, 'Failed to execute runbook');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /:id/executions — Get execution history ─────────────────────────
  app.get('/:id/executions', {
    onRequest: [authenticateUser, requirePermission({ resource: 'runbook', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const query = request.query as any;
      const executions = await service.getExecutionHistory(id, query.limit ? parseInt(query.limit, 10) : 20);
      return success(reply, request, executions);
    } catch (err: any) {
      logger.error({ err, runbookId: (request.params as any).id }, 'Failed to get execution history');
      return internalError(reply, request, err.message);
    }
  });

  // ── GET /executions/:executionId — Get execution details ────────────────
  app.get('/executions/:executionId', {
    onRequest: [authenticateUser, requirePermission({ resource: 'runbook', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { executionId } = request.params as { executionId: string };
      const execution = await service.getExecution(executionId);
      return success(reply, request, execution);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') return notFound(reply, request, undefined, err.message);
      logger.error({ err, executionId: (request.params as any).executionId }, 'Failed to get execution details');
      return internalError(reply, request, err.message);
    }
  });
}
