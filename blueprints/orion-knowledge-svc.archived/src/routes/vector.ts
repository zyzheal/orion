/**
 * Vector Routes
 *
 * API endpoints for embedding generation and vector search.
 * Prefix: /api/v1
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { VectorService } from '../services/VectorService';
import { VectorRepository } from '../services/VectorRepository';
import { DatabasePool } from '../utils/database';

interface RoutesOptions {
  database?: DatabasePool;
}

export default async function vectorRoutes(app: FastifyInstance, options: RoutesOptions): Promise<void> {
  if (!options.database) {
    throw new Error('VectorRoutes requires a database pool');
  }

  const pool = options.database;
  const dimension = parseInt(process.env.VECTOR_DIMENSION || '1536', 10);
  const repo = new VectorRepository(pool, dimension);
  const service = new VectorService(repo, (process.env.VECTOR_DISTANCE_METRIC as 'cosine' | 'euclidean' | 'dot_product') || 'cosine');

  // ==================== Embedding ====================

  // POST /vector/embed - Generate embedding for a single text
  app.post('/embed', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || !body.text) {
      await reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Missing required field: text',
      });
      return;
    }

    const response = await service.embed({
      text: body.text as string,
      model: body.model as string | undefined,
    });

    await reply.status(200).send({ success: true, data: response });
  });

  // POST /vector/embed/batch - Generate embeddings for multiple texts
  app.post('/embed/batch', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || !body.texts || !Array.isArray(body.texts)) {
      await reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Missing required field: texts (array)',
      });
      return;
    }

    const texts = body.texts as string[];
    if (texts.length > 100) {
      await reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Maximum 100 texts per batch',
      });
      return;
    }

    const response = await service.embedBatch({
      texts,
      model: body.model as string | undefined,
    });

    await reply.status(200).send({ success: true, data: response });
  });

  // ==================== Vector Search ====================

  // POST /vector/search - Search vectors using a query vector
  app.post('/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || !body.storeId || !body.vector) {
      await reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: storeId, vector',
      });
      return;
    }

    const results = await service.search({
      storeId: body.storeId as string,
      vector: body.vector as number[],
      topK: body.topK ? parseInt(String(body.topK), 10) : 10,
      metric: body.metric as 'cosine' | 'euclidean' | 'dot_product' | undefined,
      metadataFilter: body.metadataFilter as Record<string, string | number | boolean> | undefined,
    });

    await reply.status(200).send({ success: true, data: { results, total: results.length } });
  });

  // POST /vector/search/semantic - Semantic search using text query
  app.post('/search/semantic', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || !body.query) {
      await reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Missing required field: query',
      });
      return;
    }

    const results = await service.semanticSearch(body.query as string, {
      storeId: body.storeId as string | undefined,
      topK: body.topK ? parseInt(String(body.topK), 10) : 10,
      scoreThreshold: body.scoreThreshold ? parseFloat(String(body.scoreThreshold)) : 0,
      metadataFilter: body.metadataFilter as Record<string, string | number | boolean> | undefined,
    });

    await reply.status(200).send({ success: true, data: { results, total: results.length } });
  });
}
