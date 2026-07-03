/**
 * Data Quality API Routes
 * Routes under /api/v1/data-quality
 *
 * PostgreSQL-backed data quality rule management and check execution
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DataQualityService } from '../services/data-quality/DataQualityService';
import { DatabasePool } from '../services/database';
import { handleError } from '../errors';
import { createLogger } from '../utils/logger';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface DataQualityRoutesOptions {
  database?: DatabasePool;
}

export default async function dataQualityRoutes(app: FastifyInstance, options: DataQualityRoutesOptions): Promise<void> {
  const pool = options.database;
  if (!pool) {
    logger.warn('[DataQualityRoutes] Database not available, routes will return 503');
  }

  const service = pool ? new DataQualityService(pool) : null;

  // POST /data-quality/rules - Create a quality rule
  app.post('/data-quality/rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'data-quality', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const body = request.body as any;
      const tenantId = String((request as any).user?.tenantId || 'default');
      const rule = await service.createRule({ ...body, tenant_id: tenantId });
      return reply.status(201).send({ success: true, data: rule });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /data-quality/rules - List all quality rules
  app.get('/data-quality/rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'data-quality', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const tenantId = String((request as any).user?.tenantId || 'default');
      const rules = await service.listRules(tenantId);
      return reply.send({ success: true, data: rules });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /data-quality/rules/:id - Get a single quality rule
  app.get('/data-quality/rules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'data-quality', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const { id } = request.params as { id: string };
      const rule = await service.getRule(id);
      return handleError(reply, new NotFoundError('NOT_FOUND'));
      return reply.send({ success: true, data: rule });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // PUT /data-quality/rules/:id - Update a quality rule
  app.put('/data-quality/rules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'data-quality', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const rule = await service.updateRule(id, body);
      return handleError(reply, new NotFoundError('NOT_FOUND'));
      return reply.send({ success: true, data: rule });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // DELETE /data-quality/rules/:id - Delete a quality rule
  app.delete('/data-quality/rules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'data-quality', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const { id } = request.params as { id: string };
      const deleted = await service.deleteRule(id);
      return handleError(reply, new NotFoundError('NOT_FOUND'));
      return reply.send({ success: true });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // POST /data-quality/rules/:id/run - Run a quality check
  app.post('/data-quality/rules/:id/run', {
    onRequest: [authenticateUser, requirePermission({ resource: 'data-quality', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const { id } = request.params as { id: string };
      const check = await service.runCheck(id);
      return reply.send({ success: true, data: check });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  // GET /data-quality/checks - List check results
  app.get('/data-quality/checks', {
    onRequest: [authenticateUser, requirePermission({ resource: 'data-quality', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return handleError(reply, new ServiceUnavailableError('SERVICE_UNAVAILABLE'));
    try {
      const tenantId = String((request as any).user?.tenantId || 'default');
      const query = request.query as any;
      const checks = await service.listChecks(tenantId, query.ruleId);
      return reply.send({ success: true, data: checks });
    } catch (error) {
      return handleError(reply, error);
    }
  });
}
