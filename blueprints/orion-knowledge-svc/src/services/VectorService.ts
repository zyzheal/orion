/**
 * VectorService - Business logic layer for vector operations
 *
 * Handles embedding generation, vector search, and vector store management.
 */
import { VectorRepository } from './VectorRepository';
import {
  VectorEmbedding,
  VectorStore,
  VectorSearchResult,
  VectorStoreConfig,
  DistanceMetric,
  CreateVectorStoreInput,
  UpdateVectorStoreInput,
  EmbedRequest,
  EmbedBatchRequest,
  EmbedResponse,
  VectorStoreStats,
  VectorSearchRequest,
} from '../types/vector';

export class VectorServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'VectorServiceError';
  }
}

export class VectorService {
  private repo: VectorRepository;
  private defaultMetric: DistanceMetric;

  constructor(repo: VectorRepository, defaultMetric?: DistanceMetric) {
    this.repo = repo;
    this.defaultMetric = defaultMetric ?? 'cosine';
  }

  // ==================== Embedding ====================

  async embed(request: EmbedRequest): Promise<EmbedResponse> {
    const vector = await this.repo.embed(request.text);
    return {
      embeddings: [vector],
      model: request.model || 'simulated-hash-v1',
      dimension: vector.length,
    };
  }

  async embedBatch(request: EmbedBatchRequest): Promise<EmbedResponse> {
    if (request.texts.length === 0) {
      return { embeddings: [], model: request.model || 'simulated-hash-v1', dimension: 0 };
    }

    const vectors = await this.repo.embedBatch(request.texts);
    return {
      embeddings: vectors,
      model: request.model || 'simulated-hash-v1',
      dimension: vectors.length > 0 ? vectors[0].length : 0,
    };
  }

  // ==================== Vector Store Management ====================

  async createStore(input: CreateVectorStoreInput): Promise<VectorStore> {
    const existing = await this.repo.getStoreByNameAndOwner(input.name, input.ownerId);
    if (existing) {
      throw new VectorServiceError(`Vector store "${input.name}" already exists for owner ${input.ownerId}`, 'STORE_DUPLICATE');
    }

    const config: VectorStoreConfig = {
      dimension: input.config.dimension || 1536,
      metric: input.config.metric || this.defaultMetric,
      indexType: input.config.indexType || 'hnsw',
      hnswM: input.config.hnswM || 16,
      hnswEfConstruction: input.config.hnswEfConstruction || 64,
      ivfLists: input.config.ivfLists,
    };

    return this.repo.createStore(input.name, input.ownerId, config, input.description, input.spaceId);
  }

  async getStore(id: string): Promise<VectorStore> {
    const store = await this.repo.getStoreById(id);
    if (!store) {
      throw new VectorServiceError(`Vector store ${id} not found`, 'STORE_NOT_FOUND');
    }
    return store;
  }

  async getStoreByNameAndOwner(name: string, ownerId: string): Promise<VectorStore> {
    const store = await this.repo.getStoreByNameAndOwner(name, ownerId);
    if (!store) {
      throw new VectorServiceError(`Vector store "${name}" not found for owner ${ownerId}`, 'STORE_NOT_FOUND');
    }
    return store;
  }

  async listStores(filter?: { ownerId?: string; spaceId?: string; status?: string }): Promise<VectorStore[]> {
    return this.repo.listStores(filter);
  }

  async updateStore(id: string, input: UpdateVectorStoreInput): Promise<VectorStore> {
    const existing = await this.repo.getStoreById(id);
    if (!existing) {
      throw new VectorServiceError(`Vector store ${id} not found`, 'STORE_NOT_FOUND');
    }

    const updates: { name?: string; description?: string; status?: string; config?: Partial<VectorStoreConfig> } = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.status !== undefined) updates.status = input.status;
    if (input.config !== undefined) updates.config = input.config;

    const updated = await this.repo.updateStore(id, updates);
    if (!updated) {
      throw new VectorServiceError(`Failed to update vector store ${id}`, 'STORE_UPDATE_FAILED');
    }
    return updated;
  }

  async deleteStore(id: string): Promise<boolean> {
    const existing = await this.repo.getStoreById(id);
    if (!existing) {
      throw new VectorServiceError(`Vector store ${id} not found`, 'STORE_NOT_FOUND');
    }

    // Delete all vectors in the store first
    await this.repo.deleteVectorsByStoreId(id);
    return this.repo.deleteStore(id);
  }

  // ==================== Vector Operations ====================

  async addVectors(storeId: string, refIds: string[], vectors: number[][], metadata?: Record<string, unknown>[], refType?: string): Promise<VectorEmbedding[]> {
    const store = await this.repo.getStoreById(storeId);
    if (!store) {
      throw new VectorServiceError(`Vector store ${storeId} not found`, 'STORE_NOT_FOUND');
    }

    if (refIds.length !== vectors.length) {
      throw new VectorServiceError('refIds and vectors arrays must have the same length', 'VECTOR_COUNT_MISMATCH');
    }

    if (metadata && metadata.length !== vectors.length) {
      throw new VectorServiceError('metadata array must have the same length as vectors', 'METADATA_COUNT_MISMATCH');
    }

    // Validate vector dimensions
    const expectedDim = store.config.dimension;
    for (let i = 0; i < vectors.length; i++) {
      if (vectors[i].length !== expectedDim) {
        throw new VectorServiceError(
          `Vector at index ${i} has dimension ${vectors[i].length}, expected ${expectedDim}`,
          'VECTOR_DIMENSION_MISMATCH'
        );
      }
    }

    return this.repo.batchStoreVectors(storeId, refIds, vectors, metadata, refType || 'chunk');
  }

  async deleteVectorsByRefId(refId: string): Promise<number> {
    return this.repo.deleteVectorsByRefId(refId);
  }

  async getVectorsByRefId(storeId: string, refId: string): Promise<VectorEmbedding[]> {
    const store = await this.repo.getStoreById(storeId);
    if (!store) {
      throw new VectorServiceError(`Vector store ${storeId} not found`, 'STORE_NOT_FOUND');
    }
    return this.repo.getVectorsByRefId(storeId, refId) as unknown as VectorEmbedding[];
  }

  // ==================== Vector Search ====================

  async search(request: VectorSearchRequest): Promise<VectorSearchResult[]> {
    const store = await this.repo.getStoreById(request.storeId);
    if (!store) {
      throw new VectorServiceError(`Vector store ${request.storeId} not found`, 'STORE_NOT_FOUND');
    }

    if (request.vector.length !== store.config.dimension) {
      throw new VectorServiceError(
        `Query vector has dimension ${request.vector.length}, expected ${store.config.dimension}`,
        'VECTOR_DIMENSION_MISMATCH'
      );
    }

    const results = await this.repo.vectorSearch(
      request.storeId,
      request.vector,
      request.topK || 10,
      request.metric || store.config.metric
    );

    // Apply metadata filter
    if (request.metadataFilter) {
      return results.filter((r) => this.matchesMetadataFilter(r.metadata, request.metadataFilter!));
    }

    return results;
  }

  async semanticSearch(query: string, options?: { storeId?: string; topK?: number; scoreThreshold?: number; metadataFilter?: Record<string, unknown> }): Promise<VectorSearchResult[]> {
    if (options?.storeId) {
      // Search within a specific store
      const store = await this.repo.getStoreById(options.storeId);
      if (!store) {
        throw new VectorServiceError(`Vector store ${options.storeId} not found`, 'STORE_NOT_FOUND');
      }

      const queryVector = await this.repo.embed(query);
      const results = await this.repo.vectorSearch(
        options.storeId,
        queryVector,
        options.topK || 10,
        store.config.metric
      );

      if (options.metadataFilter) {
        return results.filter((r) => this.matchesMetadataFilter(r.metadata, options.metadataFilter!));
      }

      return results.filter((r) => r.score >= (options.scoreThreshold ?? 0));
    }

    // Search across all stores
    return this.repo.semanticSearch(query, {
      topK: options?.topK,
      scoreThreshold: options?.scoreThreshold,
      metadataFilter: options?.metadataFilter,
    });
  }

  // ==================== Stats ====================

  async getStoreStats(storeId: string): Promise<VectorStoreStats> {
    const store = await this.repo.getStoreById(storeId);
    if (!store) {
      throw new VectorServiceError(`Vector store ${storeId} not found`, 'STORE_NOT_FOUND');
    }

    const stats = await this.repo.getStoreStats(storeId);
    return {
      vectorCount: stats.vectorCount,
      avgMagnitude: undefined,
      indexStatus: store.config.indexType || 'plain',
      lastIndexedAt: stats.lastIndexedAt,
    };
  }

  async rebuildIndex(storeId: string): Promise<boolean> {
    const store = await this.repo.getStoreById(storeId);
    if (!store) {
      throw new VectorServiceError(`Vector store ${storeId} not found`, 'STORE_NOT_FOUND');
    }

    await this.repo.markStoreIndexed(storeId);
    return true;
  }

  // ==================== Helpers ====================

  private matchesMetadataFilter(metadata: Record<string, unknown>, filter: Record<string, unknown>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (key === 'spaceIds') {
        const spaceIds = value as string[];
        const metaSpaceId = metadata.spaceId as string;
        if (spaceIds.length > 0 && metaSpaceId && !spaceIds.includes(metaSpaceId)) {
          return false;
        }
        continue;
      }
      if (key === 'tags') {
        const filterTags = value as string[];
        const metaTags = metadata.tags as string[];
        if (filterTags.length > 0 && metaTags) {
          const hasMatch = filterTags.some((t) => metaTags.includes(t));
          if (!hasMatch) return false;
        }
        continue;
      }
      if (metadata[key] !== value) {
        return false;
      }
    }
    return true;
  }
}
