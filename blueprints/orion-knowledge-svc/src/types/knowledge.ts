/**
 * Knowledge Domain Types
 *
 * Types for knowledge spaces, documents, RAG retrieval, and knowledge graph.
 */

// ==================== Knowledge Space ====================

/**
 * Knowledge space visibility level
 */
export type SpaceVisibility = 'private' | 'team' | 'public';

/**
 * Knowledge space status
 */
export type SpaceStatus = 'active' | 'archived' | 'deleted';

/**
 * Knowledge space (knowledge base container)
 */
export interface KnowledgeSpace {
  /** Space unique ID */
  id: string;
  /** Space name */
  name: string;
  /** Space description */
  description?: string;
  /** Visibility level */
  visibility: SpaceVisibility;
  /** Current status */
  status: SpaceStatus;
  /** Owner user/tenant ID */
  ownerId: string;
  /** Team ID (for team visibility spaces) */
  teamId?: string;
  /** Tags for categorization */
  tags: string[];
  /** Space-level configuration */
  config: SpaceConfig;
  /** Document count */
  documentCount: number;
  /** Whether vector indexing is enabled */
  vectorIndexingEnabled: boolean;
  /** When the space was created */
  createdAt: Date;
  /** When the space was last updated */
  updatedAt: Date;
}

/**
 * Space configuration
 */
export interface SpaceConfig {
  /** Embedding model to use */
  embeddingModel?: string;
  /** Vector dimension for this space */
  vectorDimension?: number;
  /** Default RAG top_k */
  defaultTopK?: number;
  /** Default similarity threshold */
  defaultScoreThreshold?: number;
  /** Chunk size for document splitting */
  chunkSize?: number;
  /** Chunk overlap for document splitting */
  chunkOverlap?: number;
  /** Whether to enable knowledge graph extraction */
  enableGraphExtraction?: boolean;
}

// ==================== Document ====================

/**
 * Document type
 */
export type DocType = 'text' | 'markdown' | 'pdf' | 'docx' | 'html' | 'csv' | 'json' | 'image' | 'video' | 'audio';

/**
 * Document status
 */
export type DocStatus = 'draft' | 'published' | 'archived' | 'processing' | 'failed';

/**
 * Document chunk (for RAG)
 */
export interface DocumentChunk {
  /** Chunk unique ID */
  id: string;
  /** Parent document ID */
  docId: string;
  /** Chunk index within the document */
  chunkIndex: number;
  /** Text content of the chunk */
  content: string;
  /** Metadata for the chunk */
  metadata: Record<string, string | number | boolean>;
  /** Embedding vector ID (references vector_store) */
  embeddingId?: string;
  /** Token count */
  tokenCount?: number;
  /** When the chunk was created */
  createdAt: Date;
}

/**
 * Knowledge document
 */
export interface KnowledgeDoc {
  /** Document unique ID */
  id: string;
  /** Parent space ID */
  spaceId: string;
  /** Document title */
  title: string;
  /** Document content (raw text) */
  content: string;
  /** Document type */
  docType: DocType;
  /** Current status */
  status: DocStatus;
  /** Document summary (auto-generated or manual) */
  summary?: string;
  /** Tags for categorization */
  tags: string[];
  /** Custom metadata */
  metadata: Record<string, string | number | boolean>;
  /** Source URL (if imported from external source) */
  sourceUrl?: string;
  /** Version number */
  version: number;
  /** Author/creator ID */
  authorId?: string;
  /** Whether this document has been vectorized */
  vectorized: boolean;
  /** Number of chunks after splitting */
  chunkCount?: number;
  /** When the document was created */
  createdAt: Date;
  /** When the document was last updated */
  updatedAt: Date;
  /** When the document was published */
  publishedAt?: Date;
}

/**
 * Document version
 */
export interface DocVersion {
  /** Version unique ID */
  id: string;
  /** Parent document ID */
  docId: string;
  /** Version number */
  version: number;
  /** Content at this version */
  content: string;
  /** Change description */
  changeLog?: string;
  /** Author who made this version */
  authorId?: string;
  /** When this version was created */
  createdAt: Date;
}

// ==================== RAG ====================

/**
 * RAG retrieval request
 */
export interface RagRetrieveRequest {
  /** Query text for semantic search */
  query: string;
  /** Space IDs to search within (empty = all accessible spaces) */
  spaceIds?: string[];
  /** Maximum number of results to return */
  topK?: number;
  /** Minimum similarity score threshold */
  scoreThreshold?: number;
  /** Filter by document tags */
  tagFilter?: string[];
  /** Filter by metadata */
  metadataFilter?: Record<string, string | number | boolean>;
  /** Whether to include full chunk content */
  includeContent?: boolean;
  /** Rerank results (if reranker available) */
  rerank?: boolean;
}

/**
 * RAG retrieval result
 */
export interface RagResult {
  /** Chunk ID */
  chunkId: string;
  /** Parent document ID */
  docId: string;
  /** Parent document title */
  docTitle: string;
  /** Parent space ID */
  spaceId: string;
  /** Chunk content */
  content: string;
  /** Similarity score (0-1, higher = more similar) */
  score: number;
  /** Chunk metadata */
  metadata: Record<string, string | number | boolean>;
  /** Document tags */
  tags: string[];
  /** Chunk index within the document */
  chunkIndex: number;
}

/**
 * RAG query request (structured, with filters)
 */
export interface RagQueryRequest {
  /** Query text */
  query: string;
  /** Space ID filter */
  spaceId?: string;
  /** Document status filter */
  status?: DocStatus;
  /** Date range filter */
  dateFrom?: Date;
  dateTo?: Date;
  /** Pagination */
  page?: number;
  pageSize?: number;
}

/**
 * RAG query response
 */
export interface RagQueryResponse {
  /** Results */
  results: RagResult[];
  /** Total matching results (for pagination) */
  total: number;
  /** Current page */
  page: number;
  /** Page size */
  pageSize: number;
}

// ==================== Knowledge Graph ====================

/**
 * Knowledge graph node
 */
export interface GraphNode {
  /** Node unique ID */
  id: string;
  /** Space ID */
  spaceId: string;
  /** Node type/entity type */
  type: string;
  /** Node label/name */
  label: string;
  /** Node properties */
  properties: Record<string, string | number | boolean>;
  /** Source document ID (if extracted from a document) */
  sourceDocId?: string;
  /** When the node was created */
  createdAt: Date;
  /** When the node was last updated */
  updatedAt: Date;
}

/**
 * Knowledge graph edge
 */
export interface GraphEdge {
  /** Edge unique ID */
  id: string;
  /** Space ID */
  spaceId: string;
  /** Source node ID */
  sourceNodeId: string;
  /** Target node ID */
  targetNodeId: string;
  /** Edge type/relation type */
  type: string;
  /** Edge properties/weight */
  properties: Record<string, string | number | boolean>;
  /** Source document ID (if extracted from a document) */
  sourceDocId?: string;
  /** When the edge was created */
  createdAt: Date;
}

/**
 * Graph query request
 */
export interface GraphQueryRequest {
  /** Space ID */
  spaceId: string;
  /** Starting node ID(s) for traversal */
  startNodeIds?: string[];
  /** Node types to filter */
  nodeTypes?: string[];
  /** Edge types to filter */
  edgeTypes?: string[];
  /** Maximum traversal depth */
  maxDepth?: number;
  /** Search query for node labels */
  labelQuery?: string;
}

/**
 * Graph query response
 */
export interface GraphQueryResponse {
  /** Nodes in the result subgraph */
  nodes: GraphNode[];
  /** Edges connecting the nodes */
  edges: GraphEdge[];
}

// ==================== Space Input/Update Types ====================

export interface CreateSpaceInput {
  name: string;
  description?: string;
  visibility?: SpaceVisibility;
  ownerId: string;
  teamId?: string;
  tags?: string[];
  config?: Partial<SpaceConfig>;
}

export interface UpdateSpaceInput {
  name?: string;
  description?: string;
  visibility?: SpaceVisibility;
  status?: SpaceStatus;
  teamId?: string;
  tags?: string[];
  config?: Partial<SpaceConfig>;
}

export interface CreateDocInput {
  spaceId: string;
  title: string;
  content: string;
  docType?: DocType;
  tags?: string[];
  metadata?: Record<string, string | number | boolean>;
  sourceUrl?: string;
  authorId?: string;
}

export interface UpdateDocInput {
  title?: string;
  content?: string;
  status?: DocStatus;
  summary?: string;
  tags?: string[];
  metadata?: Record<string, string | number | boolean>;
}

export interface ListDocsFilter {
  spaceId: string;
  status?: DocStatus;
  docType?: DocType;
  tagFilter?: string[];
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
