import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DbaService } from '../services/DbaService';

const dbaService = new DbaService();

export async function dbaRoutes(fastify: FastifyInstance): Promise<void> {
  // ==================== SQL Orders ====================

  // Create order
  fastify.post('/orders', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.headers as { tenantId: string; userId: string };
    const body = request.body as any;
    const order = await dbaService.createOrder(tenantId, userId, body);
    return reply.code(201).send(order);
  });

  // List orders
  fastify.get('/orders', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const query = request.query as any;
    return dbaService.listOrders({ ...query, tenantId });
  });

  // Get order
  fastify.get('/orders/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const order = await dbaService.getOrder(id);
    if (!order) return reply.code(404).send({ error: 'Order not found' });
    return order;
  });

  // Approve order
  fastify.post('/orders/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.headers as { userId: string };
    return dbaService.approveOrder(id, userId);
  });

  // Reject order
  fastify.post('/orders/:id/reject', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.headers as { userId: string };
    const body = request.body as any;
    return dbaService.rejectOrder(id, userId, body.reason || '');
  });

  // Execute order
  fastify.post('/orders/:id/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.headers as { userId: string };
    return dbaService.executeOrder({ orderId: id, executedBy: userId });
  });

  // ==================== Data Sources ====================

  // List data sources
  fastify.get('/sources', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    return dbaService.listDataSources(tenantId);
  });

  // Create data source
  fastify.post('/sources', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const body = request.body as any;
    const source = await dbaService.createDataSource(tenantId, body);
    return reply.code(201).send(source);
  });

  // Update data source
  fastify.put('/sources/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return dbaService.updateDataSource(id, body);
  });

  // Delete data source
  fastify.delete('/sources/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await dbaService.deleteDataSource(id);
    return reply.code(204).send();
  });

  // Test connection
  fastify.post('/sources/:id/test', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return dbaService.testConnection(id);
  });

  // ==================== Audit Rules ====================

  // List rules
  fastify.get('/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    return dbaService.listAuditRules(tenantId);
  });

  // Create rule
  fastify.post('/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const body = request.body as any;
    const rule = await dbaService.createAuditRule(tenantId, body);
    return reply.code(201).send(rule);
  });

  // Update rule
  fastify.put('/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return dbaService.updateAuditRule(id, body);
  });

  // ==================== User Permissions ====================

  // Get permissions
  fastify.get('/permissions', async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, tenantId } = request.headers as { userId: string; tenantId: string };
    return dbaService.getUserPermissions(userId, tenantId);
  });

  // Update permissions
  fastify.put('/permissions', async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, tenantId } = request.headers as { userId: string; tenantId: string };
    const body = request.body as any;
    return dbaService.updateUserPermissions(userId, tenantId, body);
  });

  // ==================== SQL Query ====================

  // Execute query
  fastify.post('/query', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    return dbaService.executeQuery(body.sourceId, body.sql, body.limit);
  });
}
