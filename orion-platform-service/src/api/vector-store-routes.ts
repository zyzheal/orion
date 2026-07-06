/**
 * Vector Store API Routes
 * Semantic search and vector document management
 *
 * P0-G2 Fix: Connected to PostgreSQL pgvector backend when database is available.
 * Prefix: /api/v1/vector-store
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';
import { VectorStore } from '../services/ai/VectorStore';
import { VectorStoreConfig } from '../services/ai/types';
import { ValidationError, NotFoundError, handleError } from '../errors';

interface VectorStoreRoutesOptions {
  database?: DatabasePool;
}

export default async function vectorStoreRoutes(app: FastifyInstance, options: VectorStoreRoutesOptions = {}): Promise<void> {
  const config: VectorStoreConfig = {
    host: process.env.VECTOR_STORE_HOST || 'localhost',
    port: parseInt(process.env.VECTOR_STORE_PORT || '19530') || 19530,
    collectionName: process.env.VECTOR_STORE_COLLECTION || 'orion',
    dimension: parseInt(process.env.VECTOR_STORE_DIMENSION || '1536') || 1536,
    apiKey: process.env.OPENAI_API_KEY,
    embeddingProvider: (process.env.VECTOR_EMBEDDING_PROVIDER as any) || 'hash',
    embeddingModel: process.env.VECTOR_EMBEDDING_MODEL || 'text-embedding-ada-002',
  };

  const vectorStore = options.database
    ? new VectorStore(config, options.database, true)
    : new VectorStore(config, { query: async () => ({ rows: [], rowCount: 0 }) }, false);

  // POST /vector-store/documents - Add document
  app.post('/documents', {
    onRequest: [authenticateUser, requirePermission({ resource: 'vector', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { content, metadata } = request.body as { content: string; metadata?: Record<string, any> };
    if (!content) {
      return handleError(reply, new ValidationError('Document content is required'));
    }

    const id = await vectorStore.addDocument(content, metadata);
    return reply.send({ id, persistent: vectorStore.isPersistent });
  });

  // POST /vector-store/search - Semantic search
  app.post('/search', {
    onRequest: [authenticateUser, requirePermission({ resource: 'vector', action: 'read' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { query, topK, filter } = request.body as {
      query: string;
      topK?: number;
      filter?: Record<string, any>;
    };
    if (!query) {
      return handleError(reply, new ValidationError('Search query is required'));
    }

    const results = await vectorStore.search({ query, topK, filter });
    return reply.send({ results });
  });

  // DELETE /vector-store/documents/:id - Delete document
  app.delete('/documents/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'vector', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deleted = await vectorStore.deleteDocument(id);
    if (!deleted) {
      return handleError(reply, new NotFoundError('Document not found'));
    }
    return reply.send({ success: true });
  });

  // GET /vector-store/stats - Get stats
  app.get('/stats', {
    onRequest: [authenticateUser, requirePermission({ resource: 'vector', action: 'read' })],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      documentCount: vectorStore.documentCount,
      persistent: vectorStore.isPersistent,
    });
  });
}
