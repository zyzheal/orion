/**
 * Middleware Operations API Routes (Phase 4 - Middleware Operations)
 * Middleware health monitoring, connection pool management, message queue tracking
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { MiddlewareOpsService } from '../services/middleware-ops/MiddlewareOpsService';
import { DatabasePool } from '../services/database';
import { NotFoundError, handleError } from '../errors';

interface MiddlewareOpsRoutesOptions {
  database?: DatabasePool;
}

export default async function middlewareOpsRoutes(
  app: FastifyInstance,
  options: MiddlewareOpsRoutesOptions = {}
): Promise<void> {
  void options.database;
  const middlewareOpsService = new MiddlewareOpsService();
  // Instances
  app.post('/middleware/instances', {
    onRequest: [authenticateUser, requirePermission({ resource: 'middleware', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const instance = await middlewareOpsService.createInstance(body, tenantId);
    return reply.status(201).send({ success: true, data: instance });
  });

  app.get('/middleware/instances', {
    onRequest: [authenticateUser, requirePermission({ resource: 'middleware', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const instances = await middlewareOpsService.listInstances(tenantId, { type: query.type, status: query.status });
    return reply.send({ success: true, data: instances });
  });

  app.get('/middleware/instances/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'middleware', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const instance = await middlewareOpsService.getInstance(params.id);
    return handleError(reply, new NotFoundError('NOT_FOUND'));
    return reply.send({ success: true, data: instance });
  });

  app.put('/middleware/instances/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'middleware', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as any;
    const instance = await middlewareOpsService.updateInstance(params.id, body);
    return handleError(reply, new NotFoundError('NOT_FOUND'));
    return reply.send({ success: true, data: instance });
  });

  app.delete('/middleware/instances/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'middleware', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const deleted = await middlewareOpsService.deleteInstance(params.id);
    return handleError(reply, new NotFoundError('NOT_FOUND'));
    return reply.send({ success: true, message: 'Instance deleted' });
  });

  // Metrics
  app.post('/middleware/metrics', {
    onRequest: [authenticateUser, requirePermission({ resource: 'middleware', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const metric = await middlewareOpsService.recordMetric(body, tenantId);
    return reply.status(201).send({ success: true, data: metric });
  });

  app.get('/middleware/metrics', {
    onRequest: [authenticateUser, requirePermission({ resource: 'middleware', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const metricList = await middlewareOpsService.listMetrics(tenantId, { middlewareId: query.middlewareId, metricName: query.metricName });
    return reply.send({ success: true, data: metricList });
  });

  // Connection Pools
  app.post('/middleware/connection-pools', {
    onRequest: [authenticateUser, requirePermission({ resource: 'middleware', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const pool = await middlewareOpsService.recordConnectionPool(body, tenantId);
    return reply.status(201).send({ success: true, data: pool });
  });

  app.get('/middleware/connection-pools', {
    onRequest: [authenticateUser, requirePermission({ resource: 'middleware', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const pools = await middlewareOpsService.listConnectionPools(tenantId, { middlewareId: query.middlewareId });
    return reply.send({ success: true, data: pools });
  });

  // Message Queue Stats
  app.post('/middleware/mq-stats', {
    onRequest: [authenticateUser, requirePermission({ resource: 'middleware', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const stats = await middlewareOpsService.recordMqStats(body, tenantId);
    return reply.status(201).send({ success: true, data: stats });
  });

  app.get('/middleware/mq-stats', {
    onRequest: [authenticateUser, requirePermission({ resource: 'middleware', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const mqStatsList = await middlewareOpsService.listMqStats(tenantId, { middlewareId: query.middlewareId });
    return reply.send({ success: true, data: mqStatsList });
  });

  // Alerts
  app.get('/middleware/alerts', {
    onRequest: [authenticateUser, requirePermission({ resource: 'middleware', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const alertList = await middlewareOpsService.listAlerts(tenantId, { severity: query.severity, alertType: query.alertType });
    return reply.send({ success: true, data: alertList });
  });

  app.delete('/middleware/alerts/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'middleware', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const deleted = await middlewareOpsService.deleteAlert(params.id);
    return handleError(reply, new NotFoundError('NOT_FOUND'));
    return reply.send({ success: true, message: 'Alert deleted' });
  });

  // Health Summary
  app.get('/middleware/health-summary', {
    onRequest: [authenticateUser, requirePermission({ resource: 'middleware', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = String((request as any).user?.tenantId || 1);
    const summary = await middlewareOpsService.getHealthSummary(tenantId);
    return reply.send({ success: true, data: summary });
  });
}
