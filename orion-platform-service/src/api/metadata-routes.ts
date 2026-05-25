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

const metadataService = new MetadataService();

export default async function metadataRoutes(app: FastifyInstance): Promise<void> {
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
    if (!item) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Catalog item not found' });
    return reply.send({ success: true, data: item });
  });

  app.put('/metadata/catalog/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'metadata', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const body = request.body as any;
    const item = await metadataService.updateCatalogItem(params.id, body);
    if (!item) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Catalog item not found' });
    return reply.send({ success: true, data: item });
  });

  app.delete('/metadata/catalog/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'metadata', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const deleted = await metadataService.deleteCatalogItem(params.id);
    if (!deleted) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Catalog item not found' });
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
    if (!deleted) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Lineage relation not found' });
    return reply.send({ success: true, message: 'Lineage relation deleted' });
  });
}