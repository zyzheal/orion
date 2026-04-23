/**
 * VectorStore - AI semantic search with cosine similarity
 * Production-ready stub (Map-based storage, embed real Milvus/Qdrant later)
 */
import pino from 'pino';
import { VectorDocument, SearchQuery, SearchResult, VectorStoreConfig } from './types';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class VectorStore {
  private config: VectorStoreConfig;
  private documents: Map<string, VectorDocument> = new Map();

  constructor(config: VectorStoreConfig) {
    this.config = config;
  }

  /**
   * Generate embedding vector (hash-based stub, replace with real embedding API in production)
   */
  private generateEmbedding(text: string): number[] {
    const hash = this.simpleHash(text);
    const embedding: number[] = [];
    for (let i = 0; i < this.config.dimension; i++) {
      embedding.push((hash[i % hash.length] / 255) * 2 - 1);
    }
    return embedding;
  }

  private simpleHash(text: string): number[] {
    const result: number[] = [];
    for (let i = 0; i < text.length; i++) {
      result.push(text.charCodeAt(i));
    }
    // Pad to at least 4 elements
    while (result.length < 4) {
      result.push(0);
    }
    return result;
  }

  /**
   * Add document (auto-generates embedding)
   */
  async addDocument(content: string, metadata: Record<string, any> = {}): Promise<string> {
    const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const embedding = this.generateEmbedding(content);
    const doc: VectorDocument = { id, content, metadata, embedding };
    this.documents.set(id, doc);
    logger.info({ documentId: id }, 'Document added to vector store');
    return id;
  }

  /**
   * Semantic search with cosine similarity
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    const queryEmbedding = this.generateEmbedding(query.query);
    const topK = query.topK || 10;

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
   * Cosine similarity calculation
   */
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

  /**
   * Metadata filter matching
   */
  private matchesFilter(doc: VectorDocument, filter: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (doc.metadata[key] !== value) return false;
    }
    return true;
  }

  /**
   * Delete document
   */
  async deleteDocument(id: string): Promise<boolean> {
    return this.documents.delete(id);
  }

  /**
   * Get document count
   */
  get documentCount(): number {
    return this.documents.size;
  }
}
