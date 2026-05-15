/**
 * PandaWiki Service Routes
 *
 * HTTP API endpoints for knowledge base management.
 * Provides proxy to PandaWiki backend with tenant isolation.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PandaWikiService } from '../services/PandaWikiService';

// Request/Response type definitions
interface CreateSpaceRequest {
  name: string;
  description?: string;
}

interface CreateDocumentRequest {
  spaceId: string;
  title: string;
  content: string;
  parentId?: string;
  tags?: string[];
}

interface UpdateDocumentRequest {
  title?: string;
  content?: string;
  tags?: string[];
}

interface DocumentQuery {
  spaceId?: string;
  q?: string;
  page?: string;
  limit?: string;
}

interface SearchQuery {
  q: string;
  spaceId?: string;
}

interface AskQuestionRequest {
  spaceId: string;
  question: string;
}

interface PandaWikiRoutesOptions {
  wikiService?: PandaWikiService;
}

export async function pandawikiRoutes(
  fastify: FastifyInstance,
  options: PandaWikiRoutesOptions = {}
): Promise<void> {
  // Dependency injection: use provided service or create new instance
  const wikiService = options.wikiService ?? new PandaWikiService();

  // ==================== Space Management ====================

  fastify.post<{ Body: CreateSpaceRequest }>('/api/v1/knowledge/spaces', async (request: FastifyRequest<{ Body: CreateSpaceRequest }>, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const { name, description } = request.body;
    const space = await wikiService.createSpace(tenantId, { name, description });
    return reply.code(201).send({ success: true, data: space });
  });

  fastify.get('/api/v1/knowledge/spaces', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    return wikiService.listSpaces(tenantId);
  });

  fastify.get('/api/v1/knowledge/spaces/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const space = await wikiService.getSpace(id);
    if (!space) return reply.code(404).send({ success: false, error: 'Space not found' });
    return { success: true, data: space };
  });

  // ==================== Document Management ====================

  fastify.post<{ Body: CreateDocumentRequest }>('/api/v1/knowledge/documents', async (request: FastifyRequest<{ Body: CreateDocumentRequest }>, reply: FastifyReply) => {
    const { tenantId, userId } = request.headers as { tenantId: string; userId: string };
    const { spaceId, title, content, parentId, tags } = request.body;
    const doc = await wikiService.createDocument(tenantId, userId, { spaceId, title, content, parentId, tags });
    return reply.code(201).send({ success: true, data: doc });
  });

  fastify.get<{ Querystring: DocumentQuery }>('/api/v1/knowledge/documents', async (request: FastifyRequest<{ Querystring: DocumentQuery }>, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const { spaceId, q, page, limit } = request.query;
    return wikiService.listDocuments({ spaceId, q, tenantId, page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined });
  });

  fastify.get('/api/v1/knowledge/documents/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const doc = await wikiService.getDocument(id);
    if (!doc) return reply.code(404).send({ success: false, error: 'Document not found' });
    return { success: true, data: doc };
  });

  fastify.put<{ Params: { id: string }; Body: UpdateDocumentRequest }>('/api/v1/knowledge/documents/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateDocumentRequest }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { title, content, tags } = request.body;
    const result = await wikiService.updateDocument(id, { title, content, tags });
    return { success: true, data: result };
  });

  fastify.delete('/api/v1/knowledge/documents/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await wikiService.deleteDocument(id);
    return reply.code(204).send();
  });

  // ==================== Search ====================

  fastify.get<{ Querystring: SearchQuery }>('/api/v1/knowledge/search', async (request: FastifyRequest<{ Querystring: SearchQuery }>, reply: FastifyReply) => {
    const { tenantId } = request.headers as { tenantId: string };
    const { q, spaceId } = request.query;
    return wikiService.search({ q, spaceId, tenantId });
  });

  // ==================== AI Query ====================

  fastify.post<{ Body: AskQuestionRequest }>('/api/v1/knowledge/ask', async (request: FastifyRequest<{ Body: AskQuestionRequest }>, reply: FastifyReply) => {
    const { spaceId, question } = request.body;
    return wikiService.askQuestion(spaceId, question);
  });
}
