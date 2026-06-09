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
import pino from 'pino';

const logger = pino({ name: 'observability-routes' });

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
        return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'runId query parameter is required' });
      }

      if (!timelineService) {
        return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'Timeline service requires database connection' });
      }

      const timelines = await timelineService.getTimelineByRunId(runId);
      return reply.status(200).send({
        success: true,
        data: { timelines: timelines.slice(0, limit), total: timelines.length, runId, limit },
      });
    } catch (error: any) {
      logger.error({ error }, 'Failed to list execution timelines');
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  // GET /api/v1/observability/timeline/:id/events - Get events for a timeline
  app.get('/timeline/:id/events', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);

      if (!timelineService) {
        return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'Timeline service requires database connection' });
      }

      const events = await timelineService.getEvents(id);
      return reply.status(200).send({ success: true, data: { events, timelineId: id } });
    } catch (error: any) {
      logger.error({ error, timelineId: (request.params as any).id }, 'Failed to get timeline events');
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: error.message });
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
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  // GET /api/v1/observability/executions/:id - Get execution replay data
  app.get('/executions/:id', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);

      if (!timelineService) {
        return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'Timeline service requires database connection' });
      }

      const replayData = await timelineService.getReplayData(id);
      return reply.status(200).send({ success: true, data: replayData });
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to get execution');
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });
}
