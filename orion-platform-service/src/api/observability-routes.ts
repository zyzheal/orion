/**
 * Observability API Routes
 *
 * Routes under /api/v1/observability
 * Handles execution timeline and execution queries backed by PostgreSQL.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';
import { ExecutionTimelineService } from '../services/observability/ExecutionTimelineService';
import { ExecutionTimelineRepository } from '../repositories/ExecutionTimelineRepository';
import { createLogger } from '../utils/logger';
import { OrionError, ValidationError, ServiceUnavailableError, ErrorCode, handleError } from '../errors';

const logger = createLogger('observability-routes');

interface ObservabilityRoutesOptions {
  database?: DatabasePool;
}

export default async function observabilityRoutes(
  app: FastifyInstance,
  options: ObservabilityRoutesOptions
): Promise<void> {
  // Initialize timeline service if database is available
  const timelineRepo = options.database ? new ExecutionTimelineRepository(options.database) : undefined;
  const timelineService = timelineRepo
    ? new ExecutionTimelineService({ repository: timelineRepo })
    : undefined;

  // ==================== Execution Timeline ====================

  // GET /api/v1/observability/timeline - List execution timelines
  app.get('/timeline', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const runId = query.runId;
      const limit = parseInt(query.limit, 10) || 50;

      if (!runId) {
        return handleError(reply, new ValidationError('VALIDATION_ERROR'));
      }

      if (!timelineService) {
        return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
      }

      const timelines = await timelineService.getTimelineByRunId(runId);
      return reply.status(200).send({
        success: true,
        data: { timelines: timelines.slice(0, limit), total: timelines.length, runId, limit },
      });
    } catch (error: any) {
      logger.error({ error }, 'Failed to list execution timelines');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /api/v1/observability/timeline/:id/events - Get events for a timeline
  app.get('/timeline/:id/events', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);

      if (!timelineService) {
        return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
      }

      const events = await timelineService.getEvents(id);
      return reply.status(200).send({ success: true, data: { events, timelineId: id } });
    } catch (error: any) {
      logger.error({ error, timelineId: (request.params as any).id }, 'Failed to get timeline events');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // ==================== Executions ====================

  // GET /api/v1/observability/executions - List executions
  app.get('/executions', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const pipelineId = query.pipelineId;
      const status = query.status;
      const page = parseInt(query.page, 10) || 1;
      const limit = parseInt(query.limit, 10) || 20;

      // ExecutionTimelineService / PipelineRunService would be called here
      return reply.status(200).send({
        success: true,
        data: { executions: [], total: 0, page, limit },
      });
    } catch (error: any) {
      logger.error({ error }, 'Failed to list executions');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });

  // GET /api/v1/observability/executions/:id - Get execution replay data
  app.get('/executions/:id', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);

      if (!timelineService) {
        return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
      }

      const replayData = await timelineService.getReplayData(id);
      return reply.status(200).send({ success: true, data: replayData });
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to get execution');
      return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR));
    }
  });
}
