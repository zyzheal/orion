/**
 * Build Artifact Repository - PostgreSQL 数据访问层
 */

import { Pool } from 'pg';
import { Artifact, ArtifactQueryOptions } from '../models/BuildArtifact';

type DatabasePool = Pool | { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export class BuildArtifactRepository {
  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<Artifact | null> {
    const result = await this.pool.query('SELECT * FROM build_artifacts WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findAll(options?: ArtifactQueryOptions): Promise<{ entities: Artifact[] }> {
    const result = await this.pool.query('SELECT * FROM build_artifacts LIMIT 100');
    return { entities: result.rows };
  }

  async createArtifact(input: Record<string, unknown>): Promise<Artifact> {
    const result = await this.pool.query(
      'INSERT INTO build_artifacts DEFAULT VALUES RETURNING *'
    );
    return result.rows[0];
  }

  async deleteArtifact(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM build_artifacts WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async recordDownload(id: string): Promise<Artifact | null> {
    const result = await this.pool.query(
      'UPDATE build_artifacts SET download_count = download_count + 1, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.pool.query(
      "DELETE FROM build_artifacts WHERE expires_at IS NOT NULL AND expires_at <= NOW()"
    );
    return result.rowCount ?? 0;
  }

  async cleanupByRun(runId: string): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM build_artifacts WHERE run_id = $1',
      [runId]
    );
    return result.rowCount ?? 0;
  }
}
