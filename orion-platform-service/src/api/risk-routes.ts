/**
 * Risk Management API Routes
 *
 * Routes under /api/v1/risk
 * Provides risk events tracking and health check history.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';

interface RiskRoutesOptions {
  database?: DatabasePool;
}

export default async function riskRoutes(
  app: FastifyInstance,
  options: RiskRoutesOptions = {}
): Promise<void> {
  // ==================== Risk Events ====================

  // GET /risk/events - List risk events
  app.get('/events', {
    onRequest: [authenticateUser, requirePermission({ resource: 'risk', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const limit = parseInt(query.limit || '20', 10);
    const offset = parseInt(query.offset || '0', 10);

    // In-memory risk events for now; would use repository with real DB
    const events: unknown[] = [];

    return reply.send({
      code: 200,
      message: 'OK',
      data: {
        events,
        total: events.length,
        limit,
        offset,
      },
    });
  });

  // GET /risk/events/:id - Get risk event detail
  app.get('/events/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'risk', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    return reply.status(404).send({ code: 404, message: `Risk event not found: ${params.id}` });
  });

  // ==================== Health Check History ====================

  // GET /risk/health-check/history - Get health check history
  app.get('/health-check/history', {
    onRequest: [authenticateUser, requirePermission({ resource: 'risk', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const limit = parseInt(query.limit || '20', 10);

    const checks: unknown[] = [];

    return reply.send({
      code: 200,
      message: 'OK',
      data: {
        checks,
        total: checks.length,
        limit,
      },
    });
  });
}
