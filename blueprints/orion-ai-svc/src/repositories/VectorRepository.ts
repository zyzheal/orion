/**
 * VectorRepository - Stub
 * Data access for vector documents (pgvector backend).
 */

export interface VectorEntity {
  id: string;
  collection: string;
  content: string;
  contentHash: string;
  metadata: Record<string, unknown>;
  embedding: number[];
  score?: number;
}

export class VectorRepository {
  private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.db = db;
  }

  async insert(data: Omit<VectorEntity, 'id'>): Promise<VectorEntity> {
    return { id: `vec-${Date.now()}`, ...data };
  }

  async search(_embedding: number[], _limit: number, _options?: { collection?: string; metadataFilter?: Record<string, unknown> }): Promise<VectorEntity[]> {
    return [];
  }

  async delete(id: string): Promise<boolean> {
    return false;
  }
}
