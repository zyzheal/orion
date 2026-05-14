/**
 * PandaWiki Service Routes
 *
 * HTTP API endpoints for knowledge base management.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PandaWikiService } from '../services/PandaWikiService';

const wikiService = new PandaWikiService();

export async function pandawikiRoutes(fastify: FastifyInstance): Promise<void> {
  // ==================== Space Management ====================

  fastify.post('/api/v1/knowledge/spaces', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const body = request.body as any;
    const space = await wikiService.createSpace(tenantId, body);
    return reply.code(201).send(space);
  });

  fastify.get('/api/v1/knowledge/spaces', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    return wikiService.listSpaces(tenantId);
  });

  fastify.get('/api/v1/knowledge/spaces/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const space = await wikiService.getSpace(id);
    if (!space) return reply.code(404).send({ error: 'Space not found' });
    return space;
  });

  // ==================== Document Management ====================

  fastify.post('/api/v1/knowledge/documents', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.headers as { tenantId: string; userId: string };
    const body = request.body as any;
    const doc = await wikiService.createDocument(tenantId, userId, body);
    return reply.code(201).send(doc);
  });

  fastify.get('/api/v1/knowledge/documents', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const query = request.query as any;
    return wikiService.listDocuments({ ...query, tenantId });
  });

  fastify.get('/api/v1/knowledge/documents/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const doc = await wikiService.getDocument(id);
    if (!doc) return reply.code(404).send({ error: 'Document not found' });
    return doc;
  });

  fastify.put('/api/v1/knowledge/documents/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return wikiService.updateDocument(id, body);
  });

  fastify.delete('/api/v1/knowledge/documents/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await wikiService.deleteDocument(id);
    return reply.code(204).send();
  });

  // ==================== Search ====================

  fastify.get('/api/v1/knowledge/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const query = request.query as any;
    return wikiService.search({ ...query, tenantId });
  });

  // ==================== AI Query ====================

  fastify.post('/api/v1/knowledge/ask', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    return wikiService.askQuestion(body.spaceId, body.question);
  });
}
