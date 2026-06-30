/**
 * Vectorize Rules API Routes
 * Routes under /api/v1/vectorize-rules
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { VectorizeRulesService } from '../services/vectorize-rules/VectorizeRulesService';
import { DatabasePool } from '../services/database';
import { handleError } from '../errors';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface VectorizeRulesRoutesOptions {
  database?: DatabasePool;
}

export default async function vectorizeRulesRoutes(app: FastifyInstance, options: VectorizeRulesRoutesOptions): Promise<void> {
  const pool = options.database;
  if (!pool) {
    logger.warn('[VectorizeRulesRoutes] Database not available, routes will return 503');
  }

  const service = pool ? new VectorizeRulesService(pool) : null;

  app.post('/vectorize-rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'vector', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return reply.status(503).send({ success: false, error: 'SERVICE_UNAVAILABLE' });
    try {
      const body = request.body as any;
      const tenantId = String((request as any).user?.tenantId || 'default');
      const rule = await service.createRule({ ...body, tenant_id: tenantId });
      return reply.status(201).send({ success: true, data: rule });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  app.get('/vectorize-rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'vector', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return reply.status(503).send({ success: false, error: 'SERVICE_UNAVAILABLE' });
    try {
      const tenantId = String((request as any).user?.tenantId || 'default');
      const rules = await service.listRules(tenantId);
      return reply.send({ success: true, data: rules });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  app.put('/vectorize-rules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'vector', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return reply.status(503).send({ success: false, error: 'SERVICE_UNAVAILABLE' });
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const rule = await service.updateRule(id, body);
      if (!rule) return reply.status(404).send({ success: false, error: 'NOT_FOUND' });
      return reply.send({ success: true, data: rule });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  app.delete('/vectorize-rules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'vector', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return reply.status(503).send({ success: false, error: 'SERVICE_UNAVAILABLE' });
    try {
      const { id } = request.params as { id: string };
      const deleted = await service.deleteRule(id);
      if (!deleted) return reply.status(404).send({ success: false, error: 'NOT_FOUND' });
      return reply.send({ success: true });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  app.patch('/vectorize-rules/:id/toggle', {
    onRequest: [authenticateUser, requirePermission({ resource: 'vector', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!service) return reply.status(503).send({ success: false, error: 'SERVICE_UNAVAILABLE' });
    try {
      const { id } = request.params as { id: string };
      const { enabled } = request.body as { enabled: boolean };
      const rule = await service.toggleRule(id, enabled);
      if (!rule) return reply.status(404).send({ success: false, error: 'NOT_FOUND' });
      return reply.send({ success: true, data: rule });
    } catch (error) {
      return handleError(reply, error);
    }
  });
}
