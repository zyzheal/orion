/**
 * CodeEmbeddingRepository - Stub
 * Data access for code embedding vectors.
 */

import { CodeChunkType, CodeChunkMetadata } from '../services/vector-types';

export interface CodeEmbeddingEntity {
  id: string;
  projectId: string;
  filePath: string;
  chunkType: CodeChunkType;
  chunkName: string;
  content: string;
  embedding: number[];
  metadata: CodeChunkMetadata;
  created_at: Date;
  updated_at: Date;
}

export class CodeEmbeddingRepository {
  private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> };

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> }) {
    this.db = db;
  }

  async insert(_data: Omit<CodeEmbeddingEntity, 'id' | 'created_at' | 'updated_at'>): Promise<CodeEmbeddingEntity> {
    return {
      id: `code-emb-${Date.now()}`,
      ..._data,
      created_at: new Date(),
      updated_at: new Date(),
    } as CodeEmbeddingEntity;
  }

  async findByFilePath(projectId: string, _filePath: string): Promise<CodeEmbeddingEntity[]> {
    return [];
  }

  async deleteByFilePath(projectId: string, _filePath: string): Promise<number> {
    return 0;
  }

  async search(_embedding: number[], _limit: number, _filters?: Record<string, unknown>): Promise<Array<{ embedding: CodeEmbeddingEntity; similarity: number }>> {
    return [];
  }

  async keywordSearch(_keywords: string[], _filters?: Record<string, unknown>): Promise<Array<CodeEmbeddingEntity>> {
    return [];
  }
}
