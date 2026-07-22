/**
 * Metadata Management API Routes (Phase 4 Batch 2)
 *
 * Routes under /api/v1/metadata
 * Data asset catalog, lineage tracking
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { MetadataService } from '../services/metadata/MetadataService';
import { DatabasePool } from '../services/database';
import { NotFoundError, handleError } from '../errors';

interface MetadataRoutesOptions {
  database?: DatabasePool;
}

export default async function metadataRoutes(
  app: FastifyInstance,
  options: MetadataRoutesOptions = {}
): Promise<void> {
  void options.database;
  const metadataService = new MetadataService();
  // Catalog
  app.post('/metadata/catalog', {
    onRequest: [authenticateUser, requirePermission({ resource: 'metadata', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const item = await metadataService.createCatalogItem(body, tenantId);
    return reply.status(201).send({ success: true, data: item });
  });

  app.get('/metadata/catalog', {
    onRequest: [authenticateUser, requirePermission({ resource: 'metadata', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const items = await metadataService.listCatalogItems(tenantId, { type: query.type });
    return reply.send({ success: true, data: items });
  });

  app.get('/metadata/catalog/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'metadata', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const item = await metadataService.getCatalogItem(params.id);
    return handleError(reply, new NotFoundError('NOT_FOUND'));
    return reply.send({ success: true, data: item });
  });

  app.put('/metadata/catalog/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'metadata', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const body = request.body as any;
    const item = await metadataService.updateCatalogItem(params.id, body);
    return handleError(reply, new NotFoundError('NOT_FOUND'));
    return reply.send({ success: true, data: item });
  });

  app.delete('/metadata/catalog/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'metadata', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const deleted = await metadataService.deleteCatalogItem(params.id);
    return handleError(reply, new NotFoundError('NOT_FOUND'));
    return reply.send({ success: true, message: 'Catalog item deleted' });
  });

  // Lineage
  app.post('/metadata/lineage', {
    onRequest: [authenticateUser, requirePermission({ resource: 'metadata', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const relation = await metadataService.createLineage(body, tenantId);
    return reply.status(201).send({ success: true, data: relation });
  });

  app.get('/metadata/lineage', {
    onRequest: [authenticateUser, requirePermission({ resource: 'metadata', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const tenantId = String((request as any).user?.tenantId || 1);
    const relations = await metadataService.getLineage(tenantId, { itemId: query.itemId });
    return reply.send({ success: true, data: relations });
  });

  app.delete('/metadata/lineage/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'metadata', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const deleted = await metadataService.deleteLineage(params.id);
    return handleError(reply, new NotFoundError('NOT_FOUND'));
    return reply.send({ success: true, message: 'Lineage relation deleted' });
  });
}