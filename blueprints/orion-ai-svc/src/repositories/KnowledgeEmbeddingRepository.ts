/**
 * KnowledgeEmbeddingRepository - Stub
 * Data access for knowledge/document embedding vectors.
 */

export interface KnowledgeEmbeddingEntity {
  id: string;
  docId: string;
  docType: string;
  title: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  created_at: Date;
}

export class KnowledgeEmbeddingRepository {
  private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> };

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> }) {
    this.db = db;
  }

  async insert(_data: Omit<KnowledgeEmbeddingEntity, 'id' | 'created_at'>): Promise<KnowledgeEmbeddingEntity> {
    return {
      id: `know-emb-${Date.now()}`,
      ..._data,
      created_at: new Date(),
    } as KnowledgeEmbeddingEntity;
  }

  async search(_embedding: number[], _limit: number, _filters?: Record<string, unknown>): Promise<Array<{ embedding: KnowledgeEmbeddingEntity; similarity: number }>> {
    return [];
  }

  async keywordSearch(_keywords: string[], _filters?: Record<string, unknown>): Promise<Array<KnowledgeEmbeddingEntity>> {
    return [];
  }
}
