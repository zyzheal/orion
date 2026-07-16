/**
 * Vector Store Routes
 *
 * API endpoints for vector store CRUD and management.
 * Prefix: /api/v1
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { VectorService } from '../services/VectorService';
import { VectorRepository } from '../services/VectorRepository';
import { DatabasePool } from '../utils/database';
import { UpdateVectorStoreInput, VectorStoreStatus } from '../types/vector';

interface RoutesOptions {
  database?: DatabasePool;
}

export default async function vectorStoreRoutes(app: FastifyInstance, options: RoutesOptions): Promise<void> {
  if (!options.database) {
    throw new Error('VectorStoreRoutes requires a database pool');
  }

  const pool = options.database;
  const dimension = parseInt(process.env.VECTOR_DIMENSION || '1536', 10);
  const repo = new VectorRepository(pool, dimension);
  const service = new VectorService(repo, (process.env.VECTOR_DISTANCE_METRIC as 'cosine' | 'euclidean' | 'dot_product') || 'cosine');

  // ==================== Vector Store CRUD ====================

  // POST /vector/store - Create a vector store
  app.post('/store', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || !body.name || !body.ownerId || !body.config) {
      await reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: name, ownerId, config',
      });
      return;
    }

    const config = body.config as Record<string, unknown>;
    if (!config.dimension) {
      await reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'config.dimension is required',
      });
      return;
    }

    const store = await service.createStore({
      name: body.name as string,
      description: body.description as string | undefined,
      ownerId: body.ownerId as string,
      spaceId: body.spaceId as string | undefined,
      config: {
        dimension: config.dimension as number,
        metric: (config.metric as 'cosine' | 'euclidean' | 'dot_product') || 'cosine',
        indexType: config.indexType as 'hnsw' | 'ivfflat' | 'plain' | undefined,
        hnswM: config.hnswM ? parseInt(String(config.hnswM), 10) : undefined,
        hnswEfConstruction: config.hnswEfConstruction ? parseInt(String(config.hnswEfConstruction), 10) : undefined,
        ivfLists: config.ivfLists ? parseInt(String(config.ivfLists), 10) : undefined,
      },
    });

    await reply.status(201).send({ success: true, data: { store } });
  });

  // GET /vector/store - List vector stores
  app.get('/store', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string> | undefined;
    const stores = await service.listStores({
      ownerId: query?.ownerId,
      spaceId: query?.spaceId,
      status: query?.status,
    });

    await reply.status(200).send({ success: true, data: { stores, total: stores.length } });
  });

  // GET /vector/store/:id - Get a vector store
  app.get('/store/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const store = await service.getStore(params.id);
    await reply.status(200).send({ success: true, data: { store } });
  });

  // PUT /vector/store/:id - Update a vector store
  app.put('/store/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as Record<string, unknown> | undefined;
    if (!body) {
      await reply.status(400).send({ success: false, error: 'VALIDATION_ERROR', message: 'Request body is required' });
      return;
    }

    const updates: UpdateVectorStoreInput = {};
    if (body.name !== undefined) updates.name = body.name as string;
    if (body.description !== undefined) updates.description = body.description as string;
    if (body.status !== undefined) updates.status = body.status as VectorStoreStatus;
    if (body.config !== undefined) updates.config = body.config as Partial<Record<string, unknown>>;

    const store = await service.updateStore(params.id, updates);
    await reply.status(200).send({ success: true, data: { store } });
  });

  // DELETE /vector/store/:id - Delete a vector store
  app.delete('/store/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const deleted = await service.deleteStore(params.id);
    if (!deleted) {
      await reply.status(404).send({ success: false, error: 'NOT_FOUND', message: `Vector store ${params.id} not found` });
      return;
    }
    await reply.status(200).send({ success: true, message: 'Vector store deleted' });
  });

  // ==================== Vector Store Operations ====================

  // POST /vector/store/:id/vectors - Add vectors to a store
  app.post('/store/:id/vectors', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as Record<string, unknown> | null;
    if (!body || !body.refIds || !body.vectors) {
      await reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: refIds, vectors',
      });
      return;
    }

    const refIds = body.refIds as string[];
    const vectors = body.vectors as number[][];

    if (!Array.isArray(refIds) || !Array.isArray(vectors)) {
      await reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'refIds and vectors must be arrays',
      });
      return;
    }

    if (refIds.length !== vectors.length) {
      await reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'refIds and vectors must have the same length',
      });
      return;
    }

    const embeddings = await service.addVectors(
      params.id,
      refIds,
      vectors,
      body.metadata as Record<string, unknown>[] | undefined,
      body.refType as string | undefined
    );

    await reply.status(201).send({ success: true, data: { embeddings, count: embeddings.length } });
  });

  // GET /vector/store/:id/vectors/:refId - Get vectors by reference ID
  app.get('/store/:id/vectors/:refId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string; refId: string };
    const embeddings = await service.getVectorsByRefId(params.id, params.refId);
    await reply.status(200).send({ success: true, data: { embeddings, total: embeddings.length } });
  });

  // DELETE /vector/store/:id/vectors/:refId - Delete vectors by reference ID
  app.delete('/store/:id/vectors/:refId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string; refId: string };
    const deleted = await service.deleteVectorsByRefId(params.refId);
    await reply.status(200).send({ success: true, data: { deleted } });
  });

  // GET /vector/store/:id/stats - Get vector store statistics
  app.get('/store/:id/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const stats = await service.getStoreStats(params.id);
    await reply.status(200).send({ success: true, data: stats });
  });

  // POST /vector/store/:id/rebuild-index - Rebuild the vector index
  app.post('/store/:id/rebuild-index', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const success = await service.rebuildIndex(params.id);
    await reply.status(200).send({ success: true, data: { indexed: success } });
  });
}
