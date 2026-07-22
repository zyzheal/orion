/**
 * Vector Store Types
 *
 * Types for vector embeddings, vector stores, and semantic search operations.
 */

// ==================== Vector Embedding ====================

/**
 * Distance metric for vector similarity
 */
export type DistanceMetric = 'cosine' | 'euclidean' | 'dot_product';

/**
 * Single vector embedding record
 */
export interface VectorEmbedding {
  /** Embedding unique ID */
  id: string;
  /** Vector store ID this embedding belongs to */
  storeId: string;
  /** Reference ID (e.g., chunk ID, document ID) */
  refId: string;
  /** Reference type (e.g., 'chunk', 'document') */
  refType: string;
  /** Embedding vector (float array) */
  vector: number[];
  /** Metadata associated with this embedding */
  metadata: Record<string, string | number | boolean>;
  /** When the embedding was created */
  createdAt: Date;
}

/**
 * Vector search request
 */
export interface VectorSearchRequest {
  /** Query vector */
  vector: number[];
  /** Vector store ID to search in */
  storeId: string;
  /** Number of results to return */
  topK?: number;
  /** Distance metric override */
  metric?: DistanceMetric;
  /** Metadata filter */
  metadataFilter?: Record<string, string | number | boolean>;
}

/**
 * Vector search result
 */
export interface VectorSearchResult {
  /** Embedding ID */
  id: string;
  /** Reference ID */
  refId: string;
  /** Reference type */
  refType: string;
  /** Similarity/distance score */
  score: number;
  /** Metadata */
  metadata: Record<string, string | number | boolean>;
}

// ==================== Vector Store ====================

/**
 * Vector store status
 */
export type VectorStoreStatus = 'active' | 'building' | 'error' | 'archived';

/**
 * Vector store configuration
 */
export interface VectorStoreConfig {
  /** Vector dimension */
  dimension: number;
  /** Distance metric */
  metric: DistanceMetric;
  /** Index type (hnsw, ivfflat, or plain for no index) */
  indexType?: 'hnsw' | 'ivfflat' | 'plain';
  /** HNSW M parameter (max connections per layer) */
  hnswM?: number;
  /** HNSW ef_construction parameter */
  hnswEfConstruction?: number;
  /** IVF lists count */
  ivfLists?: number;
}

/**
 * Vector store (collection of embeddings)
 */
export interface VectorStore {
  /** Store unique ID */
  id: string;
  /** Store name */
  name: string;
  /** Store description */
  description?: string;
  /** Owner/tenant ID */
  ownerId: string;
  /** Space ID (if associated with a knowledge space) */
  spaceId?: string;
  /** Current status */
  status: VectorStoreStatus;
  /** Store configuration */
  config: VectorStoreConfig;
  /** Number of vectors in the store */
  vectorCount: number;
  /** When the store was created */
  createdAt: Date;
  /** When the store was last updated */
  updatedAt: Date;
  /** When the index was last built */
  lastIndexedAt?: Date;
}

// ==================== Vector Store Input Types ====================

export interface CreateVectorStoreInput {
  name: string;
  description?: string;
  ownerId: string;
  spaceId?: string;
  config: Omit<VectorStoreConfig, 'metric'> & { metric?: DistanceMetric };
}

export interface UpdateVectorStoreInput {
  name?: string;
  description?: string;
  status?: VectorStoreStatus;
  config?: Partial<VectorStoreConfig>;
}

export interface AddVectorsInput {
  /** Reference IDs for each vector */
  refIds: string[];
  /** Reference type (applied to all) */
  refType?: string;
  /** Vectors array (must match refIds length) */
  vectors: number[][];
  /** Metadata for each vector (must match refIds length) */
  metadata?: Record<string, string | number | boolean>[];
}

export interface EmbedRequest {
  /** Text content to embed */
  text: string;
  /** Embedding model to use (optional, uses default) */
  model?: string;
}

export interface EmbedBatchRequest {
  /** Text contents to embed */
  texts: string[];
  /** Embedding model to use */
  model?: string;
}

export interface EmbedResponse {
  /** Generated embeddings */
  embeddings: number[][];
  /** Model used */
  model: string;
  /** Dimension of each embedding */
  dimension: number;
}

export interface VectorStoreListFilter {
  ownerId?: string;
  spaceId?: string;
  status?: VectorStoreStatus;
}

export interface VectorStoreStats {
  /** Total vectors */
  vectorCount: number;
  /** Average vector magnitude */
  avgMagnitude?: number;
  /** Index status */
  indexStatus: string;
  /** Last indexed timestamp */
  lastIndexedAt?: Date;
}
