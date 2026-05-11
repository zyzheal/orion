/**
 * VectorStore - AI semantic search with cosine similarity
 *
 * P0-G2 Fix: Replaced Map-based storage with PostgreSQL pgvector backend.
 * Falls back to in-memory storage when no DB is configured.
 * Supports configurable embedding providers (hash-based fallback, OpenAI, or custom).
 */
import pino from 'pino';
import { VectorDocument, SearchQuery, SearchResult, VectorStoreConfig } from './types';
import { VectorRepository } from '../../repositories/VectorRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export type EmbeddingProvider = 'hash' | 'openai' | 'custom';

export interface EmbeddingFn {
  (text: string): Promise<number[]>;
}

export class VectorStore {
  private config: VectorStoreConfig;
  private repository?: VectorRepository;
  private embeddingFn?: EmbeddingFn;
  private embeddingProvider: EmbeddingProvider;

  // Fallback Map storage when no DB is available
  private documents: Map<string, VectorDocument> = new Map();

  constructor(config: VectorStoreConfig, db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.config = config;
    this.embeddingProvider = (config.embeddingProvider as EmbeddingProvider) || 'hash';

    if (db) {
      this.repository = new VectorRepository(db);
      logger.info('VectorStore initialized with PostgreSQL pgvector backend');
    } else {
      logger.warn('VectorStore initialized with in-memory fallback (no DB provided)');
    }

    // Configure embedding function
    if (config.embeddingFn) {
      this.embeddingFn = config.embeddingFn;
    } else if (this.embeddingProvider === 'openai' && config.apiKey) {
      this.embeddingFn = this.createOpenAIEmbeddingFn(config.apiKey, config.embeddingModel);
    } else {
      // Default to hash-based embedding
      this.embeddingFn = (text: string) => Promise.resolve(this.hashEmbedding(text));
    }
  }

  /**
   * Add document (auto-generates embedding)
   */
  async addDocument(content: string, metadata: Record<string, any> = {}): Promise<string> {
    const embedding = await this.embeddingFn!(content);

    if (this.repository) {
      const entity = await this.repository.insert({
        collection: this.config.collectionName,
        content,
        contentHash: this.hashString(content),
        metadata,
        embedding,
      });
      logger.info({ documentId: entity.id, collection: entity.collection }, 'Document added to vector store');
      return entity.id;
    }

    // Fallback to in-memory
    const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const doc: VectorDocument = { id, content, metadata, embedding };
    this.documents.set(id, doc);
    logger.info({ documentId: id }, 'Document added to in-memory vector store');
    return id;
  }

  /**
   * Semantic search with real vector similarity (pgvector) or cosine similarity (fallback)
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    const queryEmbedding = await this.embeddingFn!(query.query);
    const topK = query.topK || 10;

    if (this.repository) {
      const results = await this.repository.search(
        queryEmbedding,
        topK,
        {
          collection: this.config.collectionName,
          metadataFilter: query.filter,
        },
      );

      return results.map((r) => ({
        document: {
          id: r.id,
          content: r.content,
          metadata: r.metadata,
          embedding: r.embedding || [],
        },
        score: r.score,
      }));
    }

    // Fallback to in-memory cosine similarity
    const results: SearchResult[] = [];
    for (const [, doc] of this.documents) {
      if (query.filter && !this.matchesFilter(doc, query.filter)) continue;
      const score = this.cosineSimilarity(queryEmbedding, doc.embedding);
      results.push({ document: doc, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Delete document
   */
  async deleteDocument(id: string): Promise<boolean> {
    if (this.repository) {
      return this.repository.delete(id);
    }
    return this.documents.delete(id);
  }

  /**
   * Get document count
   */
  get documentCount(): number {
    if (this.repository) {
      // Will be populated when actually queried; return 0 as placeholder
      return 0;
    }
    return this.documents.size;
  }

  /**
   * Check if connected to real vector store
   */
  get isPersistent(): boolean {
    return !!this.repository;
  }

  // ==================== Embedding Providers ====================

  private createOpenAIEmbeddingFn(apiKey: string, model?: string): EmbeddingFn {
    const embeddingModel = model || 'text-embedding-ada-002';
    return async (text: string): Promise<number[]> => {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: embeddingModel,
          input: text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI embedding API error (${response.status}): ${error}`);
      }

      const data = await response.json() as { data?: Array<{ embedding: number[] }> };
      return data.data?.[0]?.embedding ?? [];
    };
  }

  // ==================== Internal Helpers ====================

  private hashEmbedding(text: string): number[] {
    const hash = this.simpleHash(text);
    const dimension = this.config.dimension || 1536;
    const embedding: number[] = [];
    for (let i = 0; i < dimension; i++) {
      embedding.push((hash[i % hash.length] / 255) * 2 - 1);
    }
    return embedding;
  }

  private simpleHash(text: string): number[] {
    const result: number[] = [];
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      // Simple character-level hashing with mixing
      result.push(((charCode * 31 + result.reduce((a, b) => a + b, 0)) % 256) + 128);
    }
    while (result.length < 4) result.push(0);
    return result;
  }

  private hashString(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private matchesFilter(doc: VectorDocument, filter: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (doc.metadata[key] !== value) return false;
    }
    return true;
  }
}
