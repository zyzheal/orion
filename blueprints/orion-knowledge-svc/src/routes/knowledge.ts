/**
 * Knowledge Routes
 *
 * API endpoints for knowledge spaces, documents, RAG, and graph operations.
 * Prefix: /api/v1
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { KnowledgeService } from '../services/KnowledgeService';
import { KnowledgeRepository } from '../services/KnowledgeRepository';
import { VectorRepository } from '../services/VectorRepository';
import { DatabasePool } from '../utils/database';
import { DocType } from '../types/knowledge';

interface RoutesOptions {
  database?: DatabasePool;
}

export default async function knowledgeRoutes(app: FastifyInstance, options: RoutesOptions): Promise<void> {
  if (!options.database) {
    throw new Error('KnowledgeRoutes requires a database pool');
  }

  const pool = options.database;
  const knowledgeRepo = new KnowledgeRepository(pool);
  const vectorRepo = new VectorRepository(pool, parseInt(process.env.VECTOR_DIMENSION || '1536', 10));
  const service = new KnowledgeService(knowledgeRepo, vectorRepo, {
    chunkSize: 500,
    chunkOverlap: 50,
    defaultTopK: 5,
    defaultScoreThreshold: 0.7,
  });

  // ==================== Knowledge Spaces ====================

  // POST /knowledge/v1/spaces - Create a knowledge space
  app.post('/spaces', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || !body.name || !body.ownerId) {
      await reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: name, ownerId',
      });
      return;
    }

    const space = await service.createSpace({
      name: body.name as string,
      description: body.description as string | undefined,
      visibility: (body.visibility as 'private' | 'team' | 'public') || 'private',
      ownerId: body.ownerId as string,
      teamId: body.teamId as string | undefined,
      tags: (body.tags as string[]) || [],
      config: body.config as Record<string, unknown> | undefined,
    });

    await reply.status(201).send({ success: true, data: { space } });
  });

  // GET /knowledge/v1/spaces - List knowledge spaces
  app.get('/spaces', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string> | undefined;
    const spaces = await service.listSpaces({
      ownerId: query?.ownerId,
      teamId: query?.teamId,
      visibility: query?.visibility,
      status: query?.status,
    });

    await reply.status(200).send({ success: true, data: { spaces, total: spaces.length } });
  });

  // GET /knowledge/v1/spaces/:id - Get a knowledge space
  app.get('/spaces/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const space = await service.getSpace(params.id);
    await reply.status(200).send({ success: true, data: { space } });
  });

  // PUT /knowledge/v1/spaces/:id - Update a knowledge space
  app.put('/spaces/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as Record<string, unknown> | undefined;
    if (!body) {
      await reply.status(400).send({ success: false, error: 'VALIDATION_ERROR', message: 'Request body is required' });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.visibility !== undefined) updates.visibility = body.visibility;
    if (body.status !== undefined) updates.status = body.status;
    if (body.teamId !== undefined) updates.teamId = body.teamId;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.config !== undefined) updates.config = body.config;

    const space = await service.updateSpace(params.id, updates);
    await reply.status(200).send({ success: true, data: { space } });
  });

  // DELETE /knowledge/v1/spaces/:id - Delete a knowledge space
  app.delete('/spaces/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const deleted = await service.deleteSpace(params.id);
    if (!deleted) {
      await reply.status(404).send({ success: false, error: 'NOT_FOUND', message: `Space ${params.id} not found` });
      return;
    }
    await reply.status(200).send({ success: true, message: 'Space deleted' });
  });

  // ==================== Documents ====================

  // POST /knowledge/v1/docs - Create a document
  app.post('/docs', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || !body.spaceId || !body.title || !body.content) {
      await reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: spaceId, title, content',
      });
      return;
    }

    const doc = await service.createDoc({
      spaceId: body.spaceId as string,
      title: body.title as string,
      content: body.content as string,
      docType: (body.docType as DocType) || 'text',
      tags: (body.tags as string[]) || [],
      metadata: (body.metadata as Record<string, string | number | boolean>) || {},
      sourceUrl: body.sourceUrl as string | undefined,
      authorId: body.authorId as string | undefined,
    });

    await reply.status(201).send({ success: true, data: { doc } });
  });

  // GET /knowledge/v1/docs - List documents
  app.get('/docs', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string> | undefined;
    if (!query?.spaceId) {
      await reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Query parameter spaceId is required',
      });
      return;
    }

    const result = await service.listDocs({
      spaceId: query.spaceId,
      status: query.status as 'draft' | 'published' | 'archived' | 'processing' | 'failed' | undefined,
      docType: query.docType as DocType | undefined,
      page: query.page ? parseInt(query.page, 10) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20,
    });

    await reply.status(200).send({ success: true, data: result });
  });

  // GET /knowledge/v1/docs/:id - Get a document
  app.get('/docs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const doc = await service.getDoc(params.id);
    await reply.status(200).send({ success: true, data: { doc } });
  });

  // PUT /knowledge/v1/docs/:id - Update a document
  app.put('/docs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as Record<string, unknown> | undefined;
    if (!body) {
      await reply.status(400).send({ success: false, error: 'VALIDATION_ERROR', message: 'Request body is required' });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.content !== undefined) updates.content = body.content;
    if (body.status !== undefined) updates.status = body.status;
    if (body.summary !== undefined) updates.summary = body.summary;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.metadata !== undefined) updates.metadata = body.metadata;

    const doc = await service.updateDoc(params.id, updates);
    await reply.status(200).send({ success: true, data: { doc } });
  });

  // DELETE /knowledge/v1/docs/:id - Delete a document
  app.delete('/docs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const deleted = await service.deleteDoc(params.id);
    if (!deleted) {
      await reply.status(404).send({ success: false, error: 'NOT_FOUND', message: `Document ${params.id} not found` });
      return;
    }
    await reply.status(200).send({ success: true, message: 'Document deleted' });
  });

  // POST /knowledge/v1/docs/:id/publish - Publish a document
  app.post('/docs/:id/publish', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const doc = await service.publishDoc(params.id);
    await reply.status(200).send({ success: true, data: { doc } });
  });

  // GET /knowledge/v1/docs/:id/versions - Get document versions
  app.get('/docs/:id/versions', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const versions = await service.getDocVersions(params.id);
    await reply.status(200).send({ success: true, data: { versions } });
  });

  // GET /knowledge/v1/docs/:id/versions/:version - Get a specific version
  app.get('/docs/:id/versions/:version', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string; version: string };
    const version = await service.getDocVersion(params.id, parseInt(params.version, 10));
    await reply.status(200).send({ success: true, data: { version } });
  });

  // POST /knowledge/v1/docs/:id/vectorize - Vectorize a document for semantic search
  app.post('/docs/:id/vectorize', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const result = await service.vectorizeDocument(params.id);
      await reply.status(200).send({ success: true, data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('VECTOR_UNAVAILABLE')) {
        await reply.status(503).send({
          success: false,
          error: 'VECTOR_SERVICE_UNAVAILABLE',
          message: 'Vector service is not configured',
        });
        return;
      }
      throw err;
    }
  });

  // ==================== RAG ====================

  // POST /knowledge/v1/rag/retrieve - Semantic retrieval using vector search
  app.post('/rag/retrieve', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || !body.query) {
      await reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Missing required field: query',
      });
      return;
    }

    try {
      const results = await service.retrieve({
        query: body.query as string,
        spaceIds: body.spaceIds as string[] | undefined,
        topK: body.topK ? parseInt(String(body.topK), 10) : undefined,
        scoreThreshold: body.scoreThreshold ? parseFloat(String(body.scoreThreshold)) : undefined,
        tagFilter: body.tagFilter as string[] | undefined,
        metadataFilter: body.metadataFilter as Record<string, string | number | boolean> | undefined,
        includeContent: body.includeContent !== false,
      });
      await reply.status(200).send({ success: true, data: { results, total: results.length } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('VECTOR_UNAVAILABLE')) {
        await reply.status(503).send({
          success: false,
          error: 'VECTOR_SERVICE_UNAVAILABLE',
          message: 'Vector search is not configured. Use /rag/query for text-based search instead.',
        });
        return;
      }
      throw err;
    }
  });

  // POST /knowledge/v1/rag/query - Text-based RAG query (no vectors required)
  app.post('/rag/query', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || !body.query) {
      await reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Missing required field: query',
      });
      return;
    }

    const response = await service.queryRag({
      query: body.query as string,
      spaceId: body.spaceId as string | undefined,
      status: body.status as 'draft' | 'published' | 'archived' | 'processing' | 'failed' | undefined,
      page: body.page ? parseInt(String(body.page), 10) : 1,
      pageSize: body.pageSize ? parseInt(String(body.pageSize), 10) : 20,
    });

    await reply.status(200).send({ success: true, data: response });
  });

  // ==================== Knowledge Graph ====================

  // GET /knowledge/v1/graph - Query the knowledge graph
  app.get('/graph', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string> | undefined;
    if (!query?.spaceId) {
      await reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Query parameter spaceId is required',
      });
      return;
    }

    const graph = await service.queryGraph({
      spaceId: query.spaceId,
      nodeTypes: query.nodeTypes ? query.nodeTypes.split(',') : undefined,
      edgeTypes: query.edgeTypes ? query.edgeTypes.split(',') : undefined,
      maxDepth: query.maxDepth ? parseInt(query.maxDepth, 10) : 1,
      labelQuery: query.labelQuery,
    });

    await reply.status(200).send({ success: true, data: graph });
  });

  // POST /knowledge/v1/graph/nodes - Create a graph node
  app.post('/graph/nodes', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || !body.spaceId || !body.type || !body.label) {
      await reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: spaceId, type, label',
      });
      return;
    }

    const node = await service.addGraphNode(
      body.spaceId as string,
      body.type as string,
      body.label as string,
      (body.properties as Record<string, unknown>) || {},
      body.sourceDocId as string | undefined
    );

    await reply.status(201).send({ success: true, data: { node } });
  });

  // POST /knowledge/v1/graph/edges - Create a graph edge
  app.post('/graph/edges', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || !body.spaceId || !body.sourceNodeId || !body.targetNodeId || !body.type) {
      await reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: spaceId, sourceNodeId, targetNodeId, type',
      });
      return;
    }

    const edge = await service.addGraphEdge(
      body.spaceId as string,
      body.sourceNodeId as string,
      body.targetNodeId as string,
      body.type as string,
      (body.properties as Record<string, unknown>) || {},
      body.sourceDocId as string | undefined
    );

    await reply.status(201).send({ success: true, data: { edge } });
  });

  // DELETE /knowledge/v1/graph/nodes/:id - Delete a graph node
  app.delete('/graph/nodes/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const deleted = await service.deleteGraphNode(params.id);
    if (!deleted) {
      await reply.status(404).send({ success: false, error: 'NOT_FOUND', message: `Node ${params.id} not found` });
      return;
    }
    await reply.status(200).send({ success: true, message: 'Node deleted' });
  });

  // DELETE /knowledge/v1/graph/edges/:id - Delete a graph edge
  app.delete('/graph/edges/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const deleted = await service.deleteGraphEdge(params.id);
    if (!deleted) {
      await reply.status(404).send({ success: false, error: 'NOT_FOUND', message: `Edge ${params.id} not found` });
      return;
    }
    await reply.status(200).send({ success: true, message: 'Edge deleted' });
  });

  // GET /knowledge/v1/graph/stats/:spaceId - Get graph statistics
  app.get('/graph/stats/:spaceId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { spaceId: string };
    const stats = await service.getGraphStats(params.spaceId);
    await reply.status(200).send({ success: true, data: stats });
  });

  // POST /knowledge/v1/graph/extract/:spaceId/:docId - Extract graph from a document
  app.post('/graph/extract/:spaceId/:docId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { spaceId: string; docId: string };
    const result = await service.extractGraphFromDoc(params.spaceId, params.docId);
    await reply.status(200).send({ success: true, data: result });
  });
}
