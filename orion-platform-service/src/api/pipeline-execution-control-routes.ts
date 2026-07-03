/**
 * Pipeline Execution Control API Routes
 *
 * Routes for managing pipeline run execution control: pause, resume, abort,
 * retry, restart, and checkpoint management.
 *
 * Endpoints:
 *   POST /pipelines/runs/:runId/pause       — Pause pipeline run
 *   POST /pipelines/runs/:runId/resume      — Resume pipeline run
 *   POST /pipelines/runs/:runId/abort       — Abort pipeline run
 *   POST /pipelines/runs/:runId/retry       — Retry from checkpoint or beginning
 *   POST /pipelines/runs/:runId/restart     — Restart from beginning
 *   GET  /pipelines/runs/:runId/checkpoints — List checkpoints
 *   GET  /pipelines/runs/:runId/control-logs — List pause/resume logs
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { PipelineExecutionControlRepository } from '../services/pipeline/PipelineExecutionControlRepository';
import { PipelineExecutionControlService } from '../services/pipeline/PipelineExecutionControlService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { createLogger } from '../utils/logger';
import { OrionError, ValidationError, NotFoundError, ConflictError, ErrorCode, handleError } from '../errors';

const logger = pino({ name: 'pipeline-execution-control-routes' });

interface PipelineExecutionControlRoutesOptions {
  database?: DatabasePool;
}

export default async function pipelineExecutionControlRoutes(
  app: FastifyInstance,
  options: PipelineExecutionControlRoutesOptions
): Promise<void> {
  if (!options.database) {
    logger.warn('[PipelineExecutionControlRoutes] No database pool available, routes will not be functional');
    return;
  }

  const repository = new PipelineExecutionControlRepository(options.database);
  const service = new PipelineExecutionControlService(repository);

  // Helper to update run status (bridges to existing pipeline_runs table)
  const updateRunStatus = async (runId: string, status: string, data?: Record<string, unknown>): Promise<void> => {
    const setClauses: string[] = ['status = $1'];
    const params: unknown[] = [status];
    let paramIndex = 2;

    if (data) {
      for (const [key, value] of Object.entries(data)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        params.push(value);
        setClauses.push(`${snakeKey} = $${paramIndex++}`);
      }
    }

    params.push(runId);
    await options.database!.query(
      `UPDATE pipeline_runs SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}`,
      params
    );
  };

  const getRunStatus = async (runId: string) => {
    const result = await options.database!.query(
      'SELECT * FROM pipeline_runs WHERE id = $1',
      [runId]
    );
    if (result.rows.length === 0) {
      throw new OrionError('Pipeline run not found', 'NOT_FOUND');
    }
    return result.rows[0];
  };

  // POST /pipelines/runs/:runId/pause — Pause pipeline run
  app.post(
    '/pipelines/runs/:runId/pause',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'execute' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { runId } = request.params as { runId: string };
        const body = (request.body || {}) as Record<string, unknown>;
        const log = await service.pause(
          runId,
          {
            reason: (body.reason as string) || 'Manual pause',
            operator: (body.operator as string) || 'user',
          },
          updateRunStatus,
        );
        return reply.send({ success: true, log });
      } catch (error: unknown) {
        const err = error as Error;
        const code = (error as { code?: string }).code;
        return handleError(reply, new NotFoundError(err.message));
        return handleError(reply, new ConflictError(err.message));
        logger.error({ error: err.message }, 'Failed to pause pipeline run');
        return handleError(reply, new OrionError(err.message, ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // POST /pipelines/runs/:runId/resume — Resume pipeline run
  app.post(
    '/pipelines/runs/:runId/resume',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'execute' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { runId } = request.params as { runId: string };
        const body = (request.body || {}) as Record<string, unknown>;
        const log = await service.resume(
          runId,
          {
            reason: (body.reason as string) || 'Resume execution',
            operator: (body.operator as string) || 'user',
          },
          updateRunStatus,
        );
        return reply.send({ success: true, log });
      } catch (error: unknown) {
        const err = error as Error;
        const code = (error as { code?: string }).code;
        return handleError(reply, new NotFoundError(err.message));
        return handleError(reply, new ConflictError(err.message));
        logger.error({ error: err.message }, 'Failed to resume pipeline run');
        return handleError(reply, new OrionError(err.message, ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // POST /pipelines/runs/:runId/abort — Abort pipeline run
  app.post(
    '/pipelines/runs/:runId/abort',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'execute' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { runId } = request.params as { runId: string };
        const body = (request.body || {}) as Record<string, unknown>;
        const log = await service.abort(
          runId,
          {
            reason: (body.reason as string) || 'Manual abort',
            operator: (body.operator as string) || 'user',
            timeoutSeconds: body.timeoutSeconds as number | undefined,
          },
          updateRunStatus,
        );
        return reply.send({ success: true, log });
      } catch (error: unknown) {
        const err = error as Error;
        const code = (error as { code?: string }).code;
        return handleError(reply, new NotFoundError(err.message));
        return handleError(reply, new ConflictError(err.message));
        logger.error({ error: err.message }, 'Failed to abort pipeline run');
        return handleError(reply, new OrionError(err.message, ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // POST /pipelines/runs/:runId/retry — Retry from checkpoint or beginning
  app.post(
    '/pipelines/runs/:runId/retry',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'execute' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { runId } = request.params as { runId: string };
        const body = (request.body || {}) as Record<string, unknown>;
        const result = await service.retry(
          runId,
          {
            fromCheckpoint: body.fromCheckpoint as boolean | undefined,
            operator: (body.operator as string) || 'user',
          },
          getRunStatus,
          updateRunStatus,
        );
        return reply.send({
          success: true,
          fromCheckpoint: result.fromCheckpoint,
          log: result.log,
        });
      } catch (error: unknown) {
        const err = error as Error;
        const code = (error as { code?: string }).code;
        return handleError(reply, new NotFoundError(err.message));
        return handleError(reply, new ValidationError(err.message));
        logger.error({ error: err.message }, 'Failed to retry pipeline run');
        return handleError(reply, new OrionError(err.message, ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // POST /pipelines/runs/:runId/restart — Restart from beginning
  app.post(
    '/pipelines/runs/:runId/restart',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'execute' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { runId } = request.params as { runId: string };
        const body = (request.body || {}) as Record<string, unknown>;
        const log = await service.restart(
          runId,
          {
            reason: (body.reason as string) || 'Restart from beginning',
            operator: (body.operator as string) || 'user',
          },
          updateRunStatus,
        );
        return reply.send({ success: true, log });
      } catch (error: unknown) {
        const err = error as Error;
        const code = (error as { code?: string }).code;
        return handleError(reply, new NotFoundError(err.message));
        logger.error({ error: err.message }, 'Failed to restart pipeline run');
        return handleError(reply, new OrionError(err.message, ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // GET /pipelines/runs/:runId/checkpoints — List checkpoints
  app.get(
    '/pipelines/runs/:runId/checkpoints',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { runId } = request.params as { runId: string };
        const checkpoints = await service.getCheckpoints(runId);
        return reply.send({ data: checkpoints, total: checkpoints.length });
      } catch (error: unknown) {
        const err = error as Error;
        logger.error({ error: err.message }, 'Failed to list checkpoints');
        return handleError(reply, new OrionError(err.message, ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // GET /pipelines/runs/:runId/control-logs — List pause/resume logs
  app.get(
    '/pipelines/runs/:runId/control-logs',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { runId } = request.params as { runId: string };
        const logs = await service.getPauseResumeLogs(runId);
        return reply.send({ data: logs, total: logs.length });
      } catch (error: unknown) {
        const err = error as Error;
        logger.error({ error: err.message }, 'Failed to list control logs');
        return handleError(reply, new OrionError(err.message, ErrorCode.INTERNAL_ERROR));
      }
    }
  );
}

// Inline OrionError
class OrionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'OrionError';
  }
}
