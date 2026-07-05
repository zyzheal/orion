/**
 * Pipeline Batch Operations API Routes
 *
 * Endpoints:
 *   POST /pipelines/batch/start   — Batch start pipelines
 *   POST /pipelines/batch/stop    — Batch stop pipeline runs
 *   POST /pipelines/batch/delete  — Batch delete pipelines
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PipelineService } from '../services/pipeline/PipelineService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { createLogger } from '../utils/logger';
import { OrionError, ValidationError, ErrorCode, handleError } from '../errors';

const logger = createLogger('pipeline-batch-operations');

interface PipelineBatchOperationsRoutesOptions {
  pipelineService: PipelineService;
}

export default async function pipelineBatchOperationsRoutes(
  app: FastifyInstance,
  options: PipelineBatchOperationsRoutesOptions
): Promise<void> {
  const { pipelineService } = options;

  // POST /start — Batch start pipelines
  app.post(
    '/start',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'execute' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as Record<string, unknown>;
        const pipelineIds = body.pipelineIds as string[];

        if (!Array.isArray(pipelineIds) || pipelineIds.length === 0) {
        return handleError(reply, new ValidationError('pipelineIds must be a non-empty array'));
        }

        if (pipelineIds.length > 50) {
        return handleError(reply, new ValidationError('Maximum 50 pipelines can be started in a single batch'));
        }

        const results = await pipelineService.batchStart(pipelineIds, {
          triggeredBy: body.triggeredBy as string | undefined,
          parameters: body.parameters as Record<string, unknown> | undefined,
          branch: body.branch as string | undefined,
          environment: body.environment as string | undefined,
        });

        const succeeded = results.filter(r => r.status !== 'error');
        const failed = results.filter(r => r.status === 'error');

        await reply.send({
          data: results,
          total: results.length,
          succeeded: succeeded.length,
          failed: failed.length,
        });
      } catch (error) {
        logger.error({ err: error }, 'Failed to batch start pipelines');
        return handleError(reply, new OrionError('Failed to batch start pipelines', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // POST /stop — Batch stop pipeline runs
  app.post(
    '/stop',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'execute' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as Record<string, unknown>;
        const executionIds = body.executionIds as string[];

        if (!Array.isArray(executionIds) || executionIds.length === 0) {
        return handleError(reply, new ValidationError('executionIds must be a non-empty array'));
        }

        if (executionIds.length > 50) {
        return handleError(reply, new ValidationError('Maximum 50 executions can be stopped in a single batch'));
        }

        const results = await pipelineService.batchStop(executionIds);

        const succeeded = results.filter(r => r.status === 'cancelled');
        const failed = results.filter(r => r.status === 'error');
        const skipped = results.filter(r => r.status === 'skipped');

        await reply.send({
          data: results,
          total: results.length,
          succeeded: succeeded.length,
          failed: failed.length,
          skipped: skipped.length,
        });
      } catch (error) {
        logger.error({ err: error }, 'Failed to batch stop pipelines');
        return handleError(reply, new OrionError('Failed to batch stop pipelines', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // POST /delete — Batch delete pipelines
  app.post(
    '/delete',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'delete' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as Record<string, unknown>;
        const pipelineIds = body.pipelineIds as string[];

        if (!Array.isArray(pipelineIds) || pipelineIds.length === 0) {
        return handleError(reply, new ValidationError('pipelineIds must be a non-empty array'));
        }

        if (pipelineIds.length > 50) {
        return handleError(reply, new ValidationError('Maximum 50 pipelines can be deleted in a single batch'));
        }

        const results = await pipelineService.batchDelete(pipelineIds);

        const succeeded = results.filter(r => r.deleted);
        const failed = results.filter(r => !r.deleted);

        await reply.send({
          data: results,
          total: results.length,
          succeeded: succeeded.length,
          failed: failed.length,
        });
      } catch (error) {
        logger.error({ err: error }, 'Failed to batch delete pipelines');
        return handleError(reply, new OrionError('Failed to batch delete pipelines', ErrorCode.INTERNAL_ERROR));
      }
    }
  );
}
