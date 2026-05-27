/**
 * Knowledge Base API Routes (M28 - Orion-Knowledge)
 *
 * Routes under /api/v1/knowledge
 * - Space CRUD: /v1/spaces
 * - Document CRUD: /v1/docs
 * - RAG: /v1/rag/retrieve, /v1/rag/query
 * - Knowledge Graph: /v1/graph
 *
 * Uses PostgreSQL Repository pattern with kb_spaces, kb_docs, kb_doc_versions tables.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { KnowledgeRepository } from '../services/knowledge/KnowledgeRepository';
import { KnowledgeService, KnowledgeServiceError } from '../services/knowledge/KnowledgeService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

interface KnowledgeRoutesOptions {
  database?: DatabasePool;
}

/**
 * Extract tenant ID from request (from auth context or header).
 * In production this comes from JWT claims.
 * Throws 400 if x-tenant-id header is missing.
 */
function getTenantId(request: FastifyRequest, reply: FastifyReply): string {
  const tenantId = (request.headers as any)['x-tenant-id'];
  if (!tenantId) {
    reply.status(400).send({ error: 'MISSING_TENANT', message: 'x-tenant-id header is required' });
    throw new Error('Tenant missing'); // to satisfy return type
  }
  return tenantId;
}

export default async function knowledgeRoutes(
  app: FastifyInstance,
  options: KnowledgeRoutesOptions
): Promise<void> {
  // Initialize Repository and Service with database pool
  const repository = options.database
    ? new KnowledgeRepository(options.database)
    : undefined;

  if (!repository) {
    console.warn('[KnowledgeRoutes] No database pool provided, knowledge routes will not be functional');
    return;
  }

  const service = new KnowledgeService(repository);

  // ============================================================================
  // Space CRUD
  // ============================================================================

  /**
   * GET /api/v1/knowledge/spaces
   * List/search knowledge spaces
   */
  app.get(
    '/spaces',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'read' })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tenantId = getTenantId(request, reply);
      const {   type, search, page, perPage   } = request.query as any as any as {
        type?: string; search?: string; page?: string; perPage?: string
      };
      const p = page ? parseInt(page, 10) : 1;
      const pp = perPage ? parseInt(perPage, 10) : 50;

      const spaces = await service.listSpaces(tenantId, {
        type,
        search,
        limit: pp,
        offset: (p - 1) * pp,
      });

      return reply.send({
        data: spaces,
        meta: { total: spaces.length, page: p, perPage: pp },
      });
    }
  );

  /**
   * POST /api/v1/knowledge/spaces
   * Create a new knowledge space
   */
  app.post(
    '/spaces',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'write' })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tenantId = getTenantId(request, reply);
      const {   name, type, description, teamId, ownerId   } = request.body as any as any as { name: string; type: 'public' | 'internal' | 'private'; description?: string; teamId?: string; ownerId?: string };

      if (!name) {
        return reply.status(400).send({ error: 'INVALID_INPUT', message: 'Space name is required' });
      }

      try {
        const space = await service.createSpace(tenantId, {
          name,
          type: type || 'public',
          owner_id: ownerId || 'system',
          team_id: teamId,
          description,
        });
        return reply.status(201).send({ data: space });
      } catch (err: any) {
        if (err instanceof KnowledgeServiceError) {
          return reply.status(400).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  /**
   * GET /api/v1/knowledge/spaces/:id
   * Get space detail
   */
  app.get(
    '/spaces/:id',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const space = await service.getSpace((request.params as any).id);
        return reply.send({ data: space });
      } catch (err: any) {
        if (err instanceof KnowledgeServiceError && err.code === 'NOT_FOUND') {
          return reply.status(404).send({ error: 'NOT_FOUND', message: err.message });
        }
        throw err;
      }
    }
  );

  /**
   * PUT /api/v1/knowledge/v1/spaces/:id
   * Update a space
   */
  app.put(
    '/spaces/:id',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'write' })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      try {
        const space = await service.updateSpace((request.params as any).id, request.body as any);
        return reply.send({ data: space });
      } catch (err: any) {
        if (err instanceof KnowledgeServiceError) {
          return reply.status(err.code === 'NOT_FOUND' ? 404 : 400).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  /**
   * DELETE /api/v1/knowledge/v1/spaces/:id
   * Delete a space (cascades to docs)
   */
  app.delete(
    '/spaces/:id',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'delete' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await service.deleteSpace((request.params as any).id);
        return reply.status(204).send();
      } catch (err: any) {
        if (err instanceof KnowledgeServiceError) {
          return reply.status(err.code === 'NOT_FOUND' ? 404 : 400).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // ============================================================================
  // Document CRUD
  // ============================================================================

  /**
   * GET /api/v1/knowledge/v1/docs
   * List/search documents
   * Supports type='docs' for document center filtering
   */
  app.get(
    '/docs',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'read' })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tenantId = getTenantId(request, reply);
      const {   spaceId, status, tag, search, page, pageSize, perPage, type   } = request.query as any as any;
      const p = page ? parseInt(page, 10) : 1;
      const pp = pageSize || perPage ? parseInt(pageSize || perPage || '50', 10) : 50;

      // If type='docs', use document center specific listing
      if (type === 'docs') {
        const docs = await service.listDocsByType(tenantId, {
          tag,
          search,
          limit: pp,
          offset: (p - 1) * pp,
        });

        return reply.send({
          data: docs,
          meta: { total: docs.length, page: p, perPage: pp, type: 'docs' },
        });
      }

      const docs = await service.listDocs(tenantId, {
        spaceId,
        status,
        tag,
        search,
        limit: pp,
        offset: (p - 1) * pp,
      });

      return reply.send({
        data: docs,
        meta: { total: docs.length, page: p, perPage: pp },
      });
    }
  );

  /**
   * GET /api/v1/knowledge/v1/docs/tags
   * Get document center tags (for type=docs)
   */
  app.get(
    '/docs/tags',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = getTenantId(request, reply);
      const tags = await service.getDocTags(tenantId);
      return reply.send({ data: tags });
    }
  );

  /**
   * GET /api/v1/knowledge/v1/docs/toc
   * Get document center table of contents (for type=docs)
   */
  app.get(
    '/docs/toc',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantId = getTenantId(request, reply);
      const toc = await service.getDocToc(tenantId);
      return reply.send({ data: toc });
    }
  );

  /**
   * POST /api/v1/knowledge/v1/sync
   * Trigger document center sync
   */
  app.post(
    '/sync',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'write' })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tenantId = getTenantId(request, reply);
      const {   source   } = request.body as any as any || {};

      try {
        const syncLog = await service.triggerSync(tenantId, source);
        return reply.status(200).send({ data: syncLog });
      } catch (err: any) {
        if (err instanceof KnowledgeServiceError) {
          return reply.status(400).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  /**
   * GET /api/v1/knowledge/v1/sync/logs
   * Get document center sync logs
   */
  app.get(
    '/sync/logs',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'read' })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tenantId = getTenantId(request, reply);
      const limit = (request.query as any).limit ? parseInt((request.query as any).limit, 10) : 10;

      const logs = await service.getSyncLogs(tenantId, limit);
      return reply.send({ data: logs });
    }
  );

  /**
   * POST /api/v1/knowledge/v1/docs
   * Create a document
   */
  app.post(
    '/docs',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'write' })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tenantId = getTenantId(request, reply);
      const {   title, content, spaceId, tags, status, authorId   } = request.body as any as any;

      if (!title || !content || !spaceId) {
        return reply.status(400).send({ error: 'INVALID_INPUT', message: 'title, content, and spaceId are required' });
      }

      try {
        const doc = await service.createDoc(tenantId, {
          title,
          content,
          space_id: spaceId,
          tags,
          status: status as any,
          author_id: authorId,
        });
        return reply.status(201).send({ data: doc });
      } catch (err: any) {
        if (err instanceof KnowledgeServiceError) {
          return reply.status(err.code === 'NOT_FOUND' ? 404 : 400).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  /**
   * GET /api/v1/knowledge/v1/docs/:id
   * Get document detail
   */
  app.get(
    '/docs/:id',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const doc = await service.getDoc((request.params as any).id);
        return reply.send({ data: doc });
      } catch (err: any) {
        if (err instanceof KnowledgeServiceError && err.code === 'NOT_FOUND') {
          return reply.status(404).send({ error: 'NOT_FOUND', message: err.message });
        }
        throw err;
      }
    }
  );

  /**
   * PUT /api/v1/knowledge/v1/docs/:id
   * Update a document
   */
  app.put(
    '/docs/:id',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'write' })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      try {
        const doc = await service.updateDoc((request.params as any).id, {
          title: (request.body as any).title,
          content: (request.body as any).content,
          tags: (request.body as any).tags,
          status: (request.body as any).status as any,
        });
        return reply.send({ data: doc });
      } catch (err: any) {
        if (err instanceof KnowledgeServiceError) {
          return reply.status(err.code === 'NOT_FOUND' ? 404 : 400).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  /**
   * DELETE /api/v1/knowledge/v1/docs/:id
   * Delete a document
   */
  app.delete(
    '/docs/:id',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'delete' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await service.deleteDoc((request.params as any).id);
        return reply.status(204).send();
      } catch (err: any) {
        if (err instanceof KnowledgeServiceError) {
          return reply.status(err.code === 'NOT_FOUND' ? 404 : 400).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  /**
   * GET /api/v1/knowledge/v1/docs/:id/versions
   * Get document version history
   */
  app.get(
    '/docs/:id/versions',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const versions = await service.getDocVersions((request.params as any).id);
        return reply.send({ data: versions });
      } catch (err: any) {
        if (err instanceof KnowledgeServiceError && err.code === 'NOT_FOUND') {
          return reply.status(404).send({ error: 'NOT_FOUND', message: err.message });
        }
        throw err;
      }
    }
  );

  // ============================================================================
  // RAG API
  // ============================================================================

  /**
   * POST /api/v1/knowledge/v1/rag/retrieve
   * Semantic/text retrieve for RAG
   */
  app.post(
    '/rag/retrieve',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'read' })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tenantId = getTenantId(request, reply);
      const {   query, spaceId, topK   } = request.body as any as any;

      if (!query) {
        return reply.status(400).send({ error: 'INVALID_INPUT', message: 'query is required' });
      }

      try {
        const results = await service.retrieve(tenantId, query, { spaceId, topK });
        return reply.send({
          data: {
            results: results.map(r => ({
              docId: r.id,
              title: r.title,
              snippet: r.content.substring(0, 500),
              score: r.similarity,
            })),
            total: results.length,
          },
        });
      } catch (err: any) {
        if (err instanceof KnowledgeServiceError) {
          return reply.status(400).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  /**
   * POST /api/v1/knowledge/v1/rag/query
   * RAG query with source attribution
   */
  app.post(
    '/rag/query',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'read' })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tenantId = getTenantId(request, reply);
      const {   query, spaceId, topK   } = request.body as any as any;

      if (!query) {
        return reply.status(400).send({ error: 'INVALID_INPUT', message: 'query is required' });
      }

      try {
        const results = await service.retrieve(tenantId, query, { spaceId, topK });

        // Generate answer from retrieved sources
        let answer = '';
        if (results.length > 0) {
          const sourceContents = results
            .filter(r => r.similarity > 0.3)
            .map(r => r.content.substring(0, 500))
            .join('\n\n---\n\n');

          answer = `Based on ${results.length} retrieved knowledge source(s):\n\n${sourceContents.substring(0, 2000)}`;
        } else {
          answer = 'No relevant knowledge sources found for the query.';
        }

        return reply.send({
          data: {
            answer,
            sources: results.map(r => ({
              documentId: r.id,
              title: r.title,
              snippet: r.content.substring(0, 300),
              relevanceScore: r.similarity,
              spaceId: r.space_id || '',
            })),
            confidence: results.length > 0 ? Math.min(0.9, results[0].similarity + 0.2) : 0,
          },
        });
      } catch (err: any) {
        if (err instanceof KnowledgeServiceError) {
          return reply.status(400).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }
  );

  // ============================================================================
  // Knowledge Graph
  // ============================================================================

  /**
   * GET /api/v1/knowledge/v1/graph
   * Get knowledge graph (space -> doc -> tag relationships)
   */
  app.get(
    '/graph',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'knowledge', action: 'read' })],
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const tenantId = getTenantId(request, reply);
      const {   spaceId   } = request.query as any as any;

      try {
        const spaces = spaceId
          ? [await service.getSpace(spaceId)]
          : await service.listSpaces(tenantId, { limit: 20 });

        const nodes: any[] = [];
        const edges: any[] = [];

        for (const space of spaces) {
          nodes.push({ id: space.id, type: 'space', label: space.name });

          const docs = await service.listDocs(tenantId, { spaceId: space.id, limit: 50 });
          for (const doc of docs) {
            nodes.push({ id: doc.id, type: 'doc', label: doc.title, spaceId: doc.space_id });
            edges.push({ source: space.id, target: doc.id, relation: 'contains' });

            for (const tag of (doc.tags || [])) {
              const tagId = `tag-${tag}`;
              if (!nodes.find(n => n.id === tagId)) {
                nodes.push({ id: tagId, type: 'tag', label: tag });
              }
              edges.push({ source: doc.id, target: tagId, relation: 'tagged' });
            }
          }
        }

        return reply.send({ data: { nodes, edges } });
      } catch (err: any) {
        if (err instanceof KnowledgeServiceError && err.code === 'NOT_FOUND') {
          return reply.status(404).send({ error: 'NOT_FOUND', message: err.message });
        }
        throw err;
      }
    }
  );
}
