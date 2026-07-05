/**
 * VectorStore - AI semantic search with PostgreSQL pgvector
 *
 * Uses PostgreSQL pgvector extension for vector similarity search.
 * Supports configurable embedding providers (hash-based fallback, OpenAI, or custom).
 */
import { createLogger } from '../../utils/logger';
import { SearchQuery, SearchResult, VectorStoreConfig } from './types';
import { VectorRepository } from '../../repositories/VectorRepository';
import { OrionError } from '../../errors';

const logger = createLogger('VectorStore');

export type EmbeddingProvider = 'hash' | 'openai' | 'custom';

export interface EmbeddingFn {
  (text: string): Promise<number[]>;
}

export class VectorStore {
  private config: VectorStoreConfig;
  private repository: VectorRepository;
  private embeddingFn: EmbeddingFn;
  private embeddingProvider: EmbeddingProvider;
  private persistent: boolean;

  constructor(config: VectorStoreConfig, db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }, persistent: boolean = true) {
    this.config = config;
    this.embeddingProvider = (config.embeddingProvider as EmbeddingProvider) || 'hash';
    this.repository = new VectorRepository(db);
    this.persistent = persistent;
    logger.info('VectorStore initialized with PostgreSQL pgvector backend');

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
    const embedding = await this.embeddingFn(content);

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

  /**
   * Semantic search with pgvector cosine similarity
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    const queryEmbedding = await this.embeddingFn(query.query);
    const topK = query.topK || 10;

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
        metadata: typeof r.metadata === 'string' ? VectorStore.safeJsonParse(r.metadata) : r.metadata,
        embedding: r.embedding || [],
      },
      score: r.score,
    }));
  }

  /**
   * Delete document
   */
  async deleteDocument(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  /**
   * Get document count
   */
  async documentCount(): Promise<number> {
    return this.repository.count(this.config.collectionName);
  }

  /**
   * Check if connected to persistent vector store
   */
  get isPersistent(): boolean {
    return this.persistent;
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
        throw new OrionError(`OpenAI embedding API error (${response.status}): ${error}`, 'OPERATION_FAILED')
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

  private static safeJsonParse(value: string, fallback: Record<string, any> = {}): Record<string, any> {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
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
}
