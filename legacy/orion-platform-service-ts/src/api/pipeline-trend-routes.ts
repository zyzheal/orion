/**
 * Pipeline Run History Trend API Routes
 *
 * Endpoints:
 *   GET /pipelines/:id/runs/trend    — Get run history trend data for a single pipeline
 *   GET /pipelines/trend/compare     — Compare run history trends across multiple pipelines
 *
 * Query params for /trend:
 *   period      — 7d, 30d, or 90d (default: 30d)
 *   granularity — hour, day, or week (default: day)
 *
 * Query params for /compare:
 *   pipelineIds — JSON array of pipeline IDs (required, max 20)
 *   period      — 7d, 30d, or 90d (default: 30d)
 *   granularity — hour, day, or week (default: day)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PipelineService } from '../services/pipeline/PipelineService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { createLogger } from '../utils/logger';
import { OrionError, ValidationError, ErrorCode, handleError } from '../errors';

const logger = createLogger('pipeline-trend-routes');

interface PipelineTrendRoutesOptions {
  pipelineService: PipelineService;
}

export default async function pipelineTrendRoutes(
  app: FastifyInstance,
  options: PipelineTrendRoutesOptions
): Promise<void> {
  const { pipelineService } = options;

  if (!pipelineService) {
    logger.warn('[PipelineTrendRoutes] No pipelineService provided, routes will not be functional');
    return;
  }

  // GET /pipelines/:id/runs/trend — Get run history trend data for a single pipeline
  app.get(
    '/pipelines/:id/runs/trend',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const params = request.params as { id: string };
        const query = request.query as Record<string, string>;

        const period = ['7d', '30d', '90d'].includes(query.period) ? query.period : '30d';
        const granularity = ['hour', 'day', 'week'].includes(query.granularity) ? query.granularity : 'day';

        const trend = await pipelineService.getRunHistoryTrend(
          params.id,
          period as '7d' | '30d' | '90d',
          granularity as 'hour' | 'day' | 'week'
        );

        await reply.send({
          data: trend,
          pipelineId: params.id,
          period,
          granularity,
          total: trend.length,
        });
      } catch (error) {
        logger.error({ error: (error as Error).message }, 'Failed to get run history trend');
        handleError(reply, new OrionError('Failed to get run history trend', ErrorCode.INTERNAL_ERROR));
      }
    }
  );

  // GET /pipelines/trend/compare — Compare run history trends across multiple pipelines
  app.get(
    '/pipelines/trend/compare',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'pipeline', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as Record<string, string>;

        let pipelineIds: string[] = [];
        if (query.pipelineIds) {
          try {
            pipelineIds = JSON.parse(query.pipelineIds);
          } catch {
            handleError(reply, new ValidationError('pipelineIds must be a valid JSON array'));
            return;
          }
        }

        if (!Array.isArray(pipelineIds) || pipelineIds.length === 0) {
          handleError(reply, new ValidationError('pipelineIds query param must be a non-empty JSON array'));
          return;
        }

        if (pipelineIds.length > 20) {
          handleError(reply, new ValidationError('Maximum 20 pipelines can be compared at once'));
          return;
        }

        const period = ['7d', '30d', '90d'].includes(query.period) ? query.period : '30d';
        const granularity = ['hour', 'day', 'week'].includes(query.granularity) ? query.granularity : 'day';

        const compareData = await pipelineService.getRunHistoryCompare(
          pipelineIds,
          period as '7d' | '30d' | '90d',
          granularity as 'hour' | 'day' | 'week'
        );

        await reply.send({
          data: compareData,
          period,
          granularity,
          pipelineCount: Object.keys(compareData).length,
        });
      } catch (error) {
        logger.error({ error: (error as Error).message }, 'Failed to compare pipeline trends');
        handleError(reply, new OrionError('Failed to compare pipeline trends', ErrorCode.INTERNAL_ERROR));
      }
    }
  );
}
