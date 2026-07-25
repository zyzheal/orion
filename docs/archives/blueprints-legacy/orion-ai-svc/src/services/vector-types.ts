/**
 * Vector Types - Extended type definitions for code and knowledge embeddings
 *
 * Provides specialized types for:
 * - Code semantic search (function/class/file chunks)
 * - Knowledge base search (wiki/api_doc/design_doc)
 * - Hybrid search (vector + keyword)
 */

// ==================== Embedding Provider Types ====================

export type EmbeddingProviderType = 'openai' | 'voyage' | 'claude' | 'hash';

export interface EmbeddingProviderConfig {
  type: EmbeddingProviderType;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

// ==================== Code Embedding Types ====================

export type CodeChunkType = 'function' | 'class' | 'file' | 'snippet';

export interface CodeChunkMetadata {
  language: string;          // Programming language (typescript, python, go, etc.)
  lineStart: number;         // Starting line number
  lineEnd: number;           // Ending line number
  dependencies?: string[];   // Imported modules/dependencies
  exports?: string[];        // Exported symbols
  complexity?: number;       // Cyclomatic complexity (optional)
  author?: string;           // Last modifier (optional)
}

export interface CodeEmbedding {
  id: string;
  projectId: string;
  filePath: string;
  chunkType: CodeChunkType;
  chunkName: string;         // Function/class name
  content: string;           // Code content
  embedding: number[];       // Vector embedding (1536 dimensions)
  metadata: CodeChunkMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface CodeEmbeddingInput {
  projectId: string;
  filePath: string;
  chunkType: CodeChunkType;
  chunkName: string;
  content: string;
  embedding?: number[];        // Optional embedding (generated if not provided)
  metadata: CodeChunkMetadata;
}

// ==================== Knowledge Embedding Types ====================

export type KnowledgeDocType = 'wiki' | 'api_doc' | 'design_doc' | 'runbook';

export interface KnowledgeMetadata {
  author?: string;
  version?: string;
  tags?: string[];
  project?: string;
  category?: string;
  lastUpdated?: Date;
}

export interface KnowledgeEmbedding {
  id: string;
  docId: string;
  docType: KnowledgeDocType;
  title: string;
  content: string;
  embedding: number[];
  metadata: KnowledgeMetadata;
  createdAt: Date;
}

export interface KnowledgeEmbeddingInput {
  docId: string;
  docType: KnowledgeDocType;
  title: string;
  content: string;
  embedding?: number[];        // Optional embedding (generated if not provided)
  metadata?: KnowledgeMetadata;
}

// ==================== Semantic Search Types ====================

export interface SemanticSearchRequest {
  query: string;
  options: {
    projectId?: string;
    chunkType?: CodeChunkType[];
    docType?: KnowledgeDocType[];
    limit?: number;              // Default: 10
    threshold?: number;          // Minimum similarity (0-1), default: 0.7
    hybridSearch?: boolean;      // Enable hybrid search (vector + keyword)
    keywordBoost?: number;       // Keyword match boost factor (0-1), default: 0.3
    searchType?: 'code' | 'knowledge' | 'all';  // Search scope
  };
}

export interface CodeSearchMatch {
  id: string;
  content: string;
  similarity: number;
  source: {
    filePath: string;
    chunkType: CodeChunkType;
    chunkName: string;
    projectId: string;
    metadata: CodeChunkMetadata;
  };
}

export interface KnowledgeSearchMatch {
  id: string;
  content: string;
  similarity: number;
  source: {
    docId: string;
    docType: KnowledgeDocType;
    title: string;
    metadata: KnowledgeMetadata;
  };
}

export interface SemanticSearchResult {
  codeMatches?: CodeSearchMatch[];
  knowledgeMatches?: KnowledgeSearchMatch[];
  metadata: {
    queryEmbeddingTime: number;   // Time to generate query embedding (ms)
    searchTime: number;           // Time for vector search (ms)
    totalMatches: number;         // Total number of matches
    hybridKeywordMatches?: number; // Keyword matches in hybrid mode
  };
}

// ==================== Batch Embedding Types ====================

export interface BatchEmbedRequest {
  items: Array<CodeEmbeddingInput | KnowledgeEmbeddingInput>;
  type: 'code' | 'knowledge';
  batchSize?: number;           // Batch size for API calls (default: 20)
  skipExisting?: boolean;       // Skip items already embedded (by content hash)
}

export interface BatchEmbedResult {
  success: boolean;
  processed: number;
  skipped: number;
  failed: number;
  errors?: Array<{ index: number; error: string }>;
  embeddingTime: number;        // Total embedding time (ms)
}

// ==================== Embedding Status Types ====================

export interface EmbeddingStatus {
  codeEmbeddings: {
    total: number;
    byProject: Record<string, number>;
    byChunkType: Record<CodeChunkType, number>;
    lastUpdated: Date | null;
  };
  knowledgeEmbeddings: {
    total: number;
    byDocType: Record<KnowledgeDocType, number>;
    lastUpdated: Date | null;
  };
  vectorDocuments: {
    total: number;
    byCollection: Record<string, number>;
  };
  embeddingProvider: string;    // 'hash' | 'openai' | 'custom'
  dimension: number;            // Embedding dimension (1536)
}

// ==================== Code Chunking Strategy Types ====================

export interface ChunkingConfig {
  maxChunkSize: number;         // Max characters per chunk (default: 500)
  minChunkSize: number;         // Min characters per chunk (default: 50)
  overlapSize: number;          // Overlap between chunks (default: 50)
  splitBy: 'function' | 'class' | 'file' | 'paragraph';  // Chunking strategy
  language?: string;            // Programming language for syntax-aware chunking
}

export interface ChunkedCode {
  chunks: Array<{
    type: CodeChunkType;
    name: string;
    content: string;
    metadata: CodeChunkMetadata;
  }>;
  metadata: {
    filePath: string;
    language: string;
    totalChunks: number;
    totalLines: number;
  };
}

// ==================== Embedding Cache Types ====================

export interface EmbeddingCacheEntry {
  contentHash: string;          // SHA-256 hash of content
  embedding: number[];
  createdAt: Date;
  expiresAt: Date;
}

export interface EmbeddingCacheConfig {
  enabled: boolean;
  ttlDays: number;              // Cache TTL in days (default: 30)
  maxSize: number;              // Max cache entries (default: 10000)
}