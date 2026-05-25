/**
 * DBA (Database Administration) API Routes
 *
 * Routes under /api/v1/dba
 * Handles SQL order management, data source management, audit rules
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DbaService, type CreateOrderInput, type CreateDataSourceInput, type CreateAuditRuleInput } from '../services/dba/DbaService';

// In-memory singleton (in production, should use PostgreSQL Repository)
const dbaService = new DbaService();

interface AuthRequest {
  userId: string;
  tenantId: string;
}

async function getAuthInfo(request: FastifyRequest): Promise<AuthRequest> {
  const user = (request as any).user;
  return {
    userId: user?.userId || 'system',
    tenantId: user?.tenantId || '1',
  };
}

export default async function dbaRoutes(app: FastifyInstance): Promise<void> {
  // ==================== SQL Orders ====================

  // List orders
  app.get('/dba/orders', {
    onRequest: [authenticateUser, requirePermission({ resource: 'dba', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const auth = await getAuthInfo(request);
    const result = await dbaService.listOrders({
      tenantId: auth.tenantId,
      status: query.status,
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
    });
    return reply.send({ success: true, data: result });
  });

  // Get order
  app.get('/dba/orders/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'dba', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const order = await dbaService.getOrder(params.id);
    if (!order) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Order not found' });
    }
    return reply.send({ success: true, data: order });
  });

  // Create order
  app.post('/dba/orders', {
    onRequest: [authenticateUser, requirePermission({ resource: 'dba', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CreateOrderInput;
    const auth = await getAuthInfo(request);
    const order = await dbaService.createOrder(body, auth.userId, auth.tenantId);
    return reply.status(201).send({ success: true, data: order });
  });

  // Approve order
  app.post('/dba/orders/:id/approve', {
    onRequest: [authenticateUser, requirePermission({ resource: 'dba', action: 'approve' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const auth = await getAuthInfo(request);
    const order = await dbaService.approveOrder(params.id, auth.userId);
    if (!order) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Order not found' });
    }
    return reply.send({ success: true, data: order });
  });

  // Reject order
  app.post('/dba/orders/:id/reject', {
    onRequest: [authenticateUser, requirePermission({ resource: 'dba', action: 'approve' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const order = await dbaService.rejectOrder(params.id);
    if (!order) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Order not found' });
    }
    return reply.send({ success: true, data: order });
  });

  // Execute order
  app.post('/dba/orders/:id/execute', {
    onRequest: [authenticateUser, requirePermission({ resource: 'dba', action: 'execute' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const order = await dbaService.executeOrder(params.id);
    if (!order) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Order not found' });
    }
    return reply.send({ success: true, data: order });
  });

  // ==================== Data Sources ====================

  // List data sources
  app.get('/dba/datasources', {
    onRequest: [authenticateUser, requirePermission({ resource: 'dba', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const result = await dbaService.listDataSources(query.tenantId);
    return reply.send({ success: true, data: result });
  });

  // Get data source
  app.get('/dba/datasources/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'dba', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const ds = await dbaService.getDataSource(params.id);
    if (!ds) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Data source not found' });
    }
    return reply.send({ success: true, data: ds });
  });

  // Create data source
  app.post('/dba/datasources', {
    onRequest: [authenticateUser, requirePermission({ resource: 'dba', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CreateDataSourceInput;
    const ds = await dbaService.createDataSource(body);
    return reply.status(201).send({ success: true, data: ds });
  });

  // Update data source
  app.put('/dba/datasources/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'dba', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const body = request.body as any;
    const ds = await dbaService.updateDataSource(params.id, body);
    if (!ds) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Data source not found' });
    }
    return reply.send({ success: true, data: ds });
  });

  // Delete data source
  app.delete('/dba/datasources/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'dba', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const deleted = await dbaService.deleteDataSource(params.id);
    if (!deleted) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Data source not found' });
    }
    return reply.send({ success: true, message: 'Data source deleted' });
  });

  // Test connection
  app.post('/dba/datasources/:id/test', {
    onRequest: [authenticateUser, requirePermission({ resource: 'dba', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const result = await dbaService.testConnection(params.id);
    if (!result.success) {
      return reply.status(400).send({ error: 'CONNECTION_ERROR', message: result.message });
    }
    return reply.send({ success: true, data: result });
  });

  // ==================== Audit Rules ====================

  // List audit rules
  app.get('/dba/audit-rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'dba', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const result = await dbaService.listAuditRules(query.tenantId);
    return reply.send({ success: true, data: result });
  });

  // Create audit rule
  app.post('/dba/audit-rules', {
    onRequest: [authenticateUser, requirePermission({ resource: 'dba', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CreateAuditRuleInput;
    const auth = await getAuthInfo(request);
    const rule = await dbaService.createAuditRule(body, auth.tenantId);
    return reply.status(201).send({ success: true, data: rule });
  });

  // Update audit rule
  app.put('/dba/audit-rules/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'dba', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const body = request.body as any;
    const rule = await dbaService.updateAuditRule(params.id, body);
    if (!rule) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Audit rule not found' });
    }
    return reply.send({ success: true, data: rule });
  });

  // ==================== Direct Query ====================

  app.post('/dba/query', {
    onRequest: [authenticateUser, requirePermission({ resource: 'dba', action: 'execute' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    // Mock query response
    return reply.send({
      success: true,
      data: {
        rows: [],
        rowCount: 0,
        message: 'Direct query execution (mock - implement with actual DB connection)',
      },
    });
  });
}
