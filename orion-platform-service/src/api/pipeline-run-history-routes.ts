/**
 * Pipeline Run History API Routes
 *
 * Endpoints:
 *   GET /pipelines/:id/run-history — Get run history aggregated by time period
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PipelineService } from '../../services/pipeline/PipelineService';
import { authenticateUser } from '../../middleware/authMiddleware';
import { requirePermission } from '../../middleware/requirePermission';
import { createLogger } from '../utils/logger';
import { OrionError, ErrorCode } from '../../errors';
import { OrionError, ValidationError, NotFoundError, ErrorCode, handleError } from '../errors';

const logger = pino({ name: 'pipeline-run-history-routes' });

interface PipelineRunHistoryRoutesOptions {
  pipelineService: PipelineService;
}

export default async function pipelineRunHistoryRoutes(
  app: FastifyInstance,
  options: PipelineRunHistoryRoutesOptions
): Promise<void> {
  const { pipelineService } = options;

  // GET /pipelines/:id/run-history — Get run history aggregated by time period
  app.get(
    '/pipelines/:id/run-history',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const params = request.params as { id: string };
        const query = request.query as Record<string, string>;

        const period = query.period || 'day';
        if (!['day', 'week', 'month'].includes(period)) {
handleError(reply, new ValidationError('VALIDATION_ERROR'))
          return;
        }

        const limit = query.limit ? parseInt(query.limit, 10) : 30;
        if (isNaN(limit) || limit < 1 || limit > 365) {
handleError(reply, new ValidationError('VALIDATION_ERROR'))
          return;
        }

        const history = await pipelineService.getRunHistory(params.id, period as 'day' | 'week' | 'month', limit);

        await reply.send(history);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
handleError(reply, new NotFoundError('NOT_FOUND'))
            return;
          }
        }
        logger.error({ error: (error as Error).message }, 'Failed to get run history');
handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
      }
    }
  );
}
