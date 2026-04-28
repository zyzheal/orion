/**
 * Vector Store API Routes
 * Semantic search and vector document management
 *
 * P0-G2 Fix: Connected to PostgreSQL pgvector backend when database is available.
 * Prefix: /api/v1/vector-store
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { VectorStore } from '../services/ai/VectorStore';
import { VectorStoreConfig } from '../services/ai/types';

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

  const vectorStore = new VectorStore(config, options.database);

  // POST /vector-store/documents - Add document
  app.post('/documents', async (request: FastifyRequest, reply: FastifyReply) => {
    const { content, metadata } = request.body as { content: string; metadata?: Record<string, any> };
    if (!content) return reply.status(400).send({ error: 'CONTENT_REQUIRED' });

    const id = await vectorStore.addDocument(content, metadata);
    return reply.send({ id, persistent: vectorStore.isPersistent });
  });

  // POST /vector-store/search - Semantic search
  app.post('/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const { query, topK, filter } = request.body as {
      query: string;
      topK?: number;
      filter?: Record<string, any>;
    };
    if (!query) return reply.status(400).send({ error: 'QUERY_REQUIRED' });

    const results = await vectorStore.search({ query, topK, filter });
    return reply.send({ results });
  });

  // DELETE /vector-store/documents/:id - Delete document
  app.delete('/documents/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deleted = await vectorStore.deleteDocument(id);
    if (!deleted) return reply.status(404).send({ error: 'NOT_FOUND' });
    return reply.send({ success: true });
  });

  // GET /vector-store/stats - Get stats
  app.get('/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      documentCount: vectorStore.documentCount,
      persistent: vectorStore.isPersistent,
    });
  });
}
