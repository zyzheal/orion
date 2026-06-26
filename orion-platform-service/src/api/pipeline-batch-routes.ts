/**
 * Pipeline Batch Execution API Routes
 *
 * Routes under /api/v1/pipeline/phase-groups for managing phase groups
 * and batch runs for progressive/gradual pipeline execution.
 *
 * Endpoints:
 *   POST   /pipeline/phase-groups                — Create phase group
 *   GET    /pipeline/phase-groups                — List phase groups
 *   GET    /pipeline/phase-groups/:id            — Get phase group detail
 *   PUT    /pipeline/phase-groups/:id            — Update phase group
 *   DELETE /pipeline/phase-groups/:id            — Delete phase group
 *   POST   /pipeline/phase-groups/:id/execute    — Start batch execution
 *   POST   /pipeline/phase-groups/:id/pause      — Pause execution
 *   POST   /pipeline/phase-groups/:id/resume     — Resume execution
 *   POST   /pipeline/phase-groups/:id/advance    — Advance to next batch
 *   POST   /pipeline/phase-groups/:id/rollback   — Rollback execution
 *   GET    /pipeline/phase-groups/:id/batches    — List batch runs
 *   POST   /pipeline/phase-groups/:id/batches/:batchId/complete — Complete batch
 *   POST   /pipeline/phase-groups/:id/batches/:batchId/fail     — Fail batch
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { PipelineBatchRepository } from '../services/pipeline/PipelineBatchRepository';
import { PipelineBatchService } from '../services/pipeline/PipelineBatchService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import pino from 'pino';

const logger = pino({ name: 'pipeline-batch-routes' });

interface PipelineBatchRoutesOptions {
  database?: DatabasePool;
}

export default async function pipelineBatchRoutes(
  app: FastifyInstance,
  options: PipelineBatchRoutesOptions
): Promise<void> {
  if (!options.database) {
    logger.warn('[PipelineBatchRoutes] No database pool available, routes will not be functional');
    return;
  }

  const repository = new PipelineBatchRepository(options.database);
  const service = new PipelineBatchService(repository);

  // POST /pipeline/phase-groups — Create phase group
  app.post(
    '/pipeline/phase-groups',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'create' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as Record<string, unknown>;
        const group = await service.createPhaseGroup({
          pipeline_id: body.pipeline_id as string,
          name: body.name as string,
          batch_strategy: body.batch_strategy as string,
          batch_config: body.batch_config as Record<string, unknown>,
          gate_type: body.gate_type as string | undefined,
          created_by: body.created_by as string | undefined,
        });
        return reply.code(201).send(group);
      } catch (error: unknown) {
        const err = error as Error;
        logger.error({ error: err.message }, 'Failed to create phase group');
        const statusCode = (error as { code?: string }).code === 'VALIDATION_ERROR' ? 400 : 500;
        return reply.code(statusCode).send({ error: err.message });
      }
    }
  );

  // GET /pipeline/phase-groups — List phase groups
  app.get(
    '/pipeline/phase-groups',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as Record<string, string>;
        const groups = await service.listPhaseGroups({
          pipelineId: query.pipelineId,
          status: query.status,
          limit: query.limit ? parseInt(query.limit, 10) : undefined,
          offset: query.offset ? parseInt(query.offset, 10) : undefined,
        });
        return reply.send({ data: groups, total: groups.length });
      } catch (error: unknown) {
        const err = error as Error;
        logger.error({ error: err.message }, 'Failed to list phase groups');
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // GET /pipeline/phase-groups/:id — Get phase group detail
  app.get(
    '/pipeline/phase-groups/:id',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const group = await service.getPhaseGroup(id);
        return reply.send(group);
      } catch (error: unknown) {
        const err = error as Error;
        if ((error as { code?: string }).code === 'NOT_FOUND') {
          return reply.code(404).send({ error: err.message });
        }
        logger.error({ error: err.message }, 'Failed to get phase group');
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // PUT /pipeline/phase-groups/:id — Update phase group
  app.put(
    '/pipeline/phase-groups/:id',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'update' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = request.body as Record<string, unknown>;
        const group = await service.updatePhaseGroup(id, {
          name: body.name as string | undefined,
          batch_strategy: body.batch_strategy as string | undefined,
          batch_config: body.batch_config as Record<string, unknown> | undefined,
          gate_type: body.gate_type as string | undefined,
        });
        return reply.send(group);
      } catch (error: unknown) {
        const err = error as Error;
        const code = (error as { code?: string }).code;
        if (code === 'NOT_FOUND') return reply.code(404).send({ error: err.message });
        if (code === 'STATE_CONFLICT') return reply.code(409).send({ error: err.message });
        if (code === 'VALIDATION_ERROR') return reply.code(400).send({ error: err.message });
        logger.error({ error: err.message }, 'Failed to update phase group');
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // DELETE /pipeline/phase-groups/:id — Delete phase group
  app.delete(
    '/pipeline/phase-groups/:id',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'delete' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        await service.deletePhaseGroup(id);
        return reply.code(204).send();
      } catch (error: unknown) {
        const err = error as Error;
        const code = (error as { code?: string }).code;
        if (code === 'NOT_FOUND') return reply.code(404).send({ error: err.message });
        if (code === 'STATE_CONFLICT') return reply.code(409).send({ error: err.message });
        logger.error({ error: err.message }, 'Failed to delete phase group');
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // POST /pipeline/phase-groups/:id/execute — Start batch execution
  app.post(
    '/pipeline/phase-groups/:id/execute',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'execute' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const group = await service.startExecution(id);
        return reply.send(group);
      } catch (error: unknown) {
        const err = error as Error;
        const code = (error as { code?: string }).code;
        if (code === 'NOT_FOUND') return reply.code(404).send({ error: err.message });
        if (code === 'STATE_CONFLICT') return reply.code(409).send({ error: err.message });
        if (code === 'VALIDATION_ERROR') return reply.code(400).send({ error: err.message });
        logger.error({ error: err.message }, 'Failed to start execution');
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // POST /pipeline/phase-groups/:id/pause — Pause execution
  app.post(
    '/pipeline/phase-groups/:id/pause',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'execute' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const group = await service.pauseExecution(id);
        return reply.send(group);
      } catch (error: unknown) {
        const err = error as Error;
        const code = (error as { code?: string }).code;
        if (code === 'NOT_FOUND') return reply.code(404).send({ error: err.message });
        if (code === 'STATE_CONFLICT') return reply.code(409).send({ error: err.message });
        logger.error({ error: err.message }, 'Failed to pause execution');
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // POST /pipeline/phase-groups/:id/resume — Resume execution
  app.post(
    '/pipeline/phase-groups/:id/resume',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'execute' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const group = await service.resumeExecution(id);
        return reply.send(group);
      } catch (error: unknown) {
        const err = error as Error;
        const code = (error as { code?: string }).code;
        if (code === 'NOT_FOUND') return reply.code(404).send({ error: err.message });
        if (code === 'STATE_CONFLICT') return reply.code(409).send({ error: err.message });
        logger.error({ error: err.message }, 'Failed to resume execution');
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // POST /pipeline/phase-groups/:id/advance — Advance to next batch
  app.post(
    '/pipeline/phase-groups/:id/advance',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'execute' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const group = await service.advanceToNextBatch(id);
        return reply.send(group);
      } catch (error: unknown) {
        const err = error as Error;
        const code = (error as { code?: string }).code;
        if (code === 'NOT_FOUND') return reply.code(404).send({ error: err.message });
        if (code === 'STATE_CONFLICT') return reply.code(409).send({ error: err.message });
        logger.error({ error: err.message }, 'Failed to advance to next batch');
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // POST /pipeline/phase-groups/:id/rollback — Rollback execution
  app.post(
    '/pipeline/phase-groups/:id/rollback',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'execute' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const group = await service.rollbackExecution(id);
        return reply.send(group);
      } catch (error: unknown) {
        const err = error as Error;
        const code = (error as { code?: string }).code;
        if (code === 'NOT_FOUND') return reply.code(404).send({ error: err.message });
        if (code === 'STATE_CONFLICT') return reply.code(409).send({ error: err.message });
        logger.error({ error: err.message }, 'Failed to rollback execution');
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // GET /pipeline/phase-groups/:id/batches — List batch runs
  app.get(
    '/pipeline/phase-groups/:id/batches',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const batches = await service.listBatchRuns(id);
        return reply.send({ data: batches, total: batches.length });
      } catch (error: unknown) {
        const err = error as Error;
        logger.error({ error: err.message }, 'Failed to list batch runs');
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // POST /pipeline/phase-groups/:id/batches/:batchId/complete — Complete batch
  app.post(
    '/pipeline/phase-groups/:id/batches/:batchId/complete',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'execute' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id, batchId } = request.params as { id: string; batchId: string };
        const body = request.body as Record<string, unknown> | undefined;
        const batch = await service.completeBatch(id, batchId, body?.result as Record<string, unknown> | undefined);
        return reply.send(batch);
      } catch (error: unknown) {
        const err = error as Error;
        const code = (error as { code?: string }).code;
        if (code === 'NOT_FOUND') return reply.code(404).send({ error: err.message });
        if (code === 'VALIDATION_ERROR') return reply.code(400).send({ error: err.message });
        logger.error({ error: err.message }, 'Failed to complete batch');
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // POST /pipeline/phase-groups/:id/batches/:batchId/fail — Fail batch
  app.post(
    '/pipeline/phase-groups/:id/batches/:batchId/fail',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'execute' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id, batchId } = request.params as { id: string; batchId: string };
        const body = request.body as Record<string, unknown> | undefined;
        const batch = await service.failBatch(id, batchId, body?.result as Record<string, unknown> | undefined);
        return reply.send(batch);
      } catch (error: unknown) {
        const err = error as Error;
        const code = (error as { code?: string }).code;
        if (code === 'NOT_FOUND') return reply.code(404).send({ error: err.message });
        if (code === 'VALIDATION_ERROR') return reply.code(400).send({ error: err.message });
        logger.error({ error: err.message }, 'Failed to fail batch');
        return reply.code(500).send({ error: err.message });
      }
    }
  );
}
